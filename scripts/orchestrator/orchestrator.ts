/**
 * Core Orchestrator for managing Claude Code agent executions
 */

import { ProcessManager } from './process-manager.js';
import { StateManager } from './state-manager.js';
import { OutputHandler } from './output-handler.js';
import { AgentConfig, AgentOutput, OrchestratorConfig, SessionMetadata } from './types.js';

/**
 * Main orchestrator class for executing Claude Code agents
 */
export class Orchestrator {
  private processManager: ProcessManager;
  private stateManager: StateManager;
  private outputHandler: OutputHandler;

  constructor(stateDir: string = '.orchestrator') {
    this.processManager = new ProcessManager();
    this.stateManager = new StateManager(stateDir);
    this.outputHandler = new OutputHandler();
  }

  /**
   * Initialize a new project
   */
  initProject(projectId: string, metadata?: SessionMetadata): void {
    this.stateManager.createProject(projectId, metadata);
  }

  /**
   * Resume an existing project
   */
  resumeProject(projectId: string): boolean {
    return this.stateManager.resumeProject(projectId) !== null;
  }

  /**
   * List all available projects
   */
  listProjects(): string[] {
    return this.stateManager.listProjects();
  }

  /**
   * Execute a single agent
   */
  async executeAgent(
    agent: AgentConfig,
    previousOutput?: AgentOutput,
    streamOutput: boolean = true,
    saveOutput: boolean = true
  ): Promise<AgentOutput> {
    // Check for existing session
    const existingSessionId = this.stateManager.getSession(agent.name);

    // Build system prompt with previous output if needed
    let systemPrompt = agent.systemPrompt || '';
    if (previousOutput) {
      const previousContext = this.outputHandler.prepareOutputForNextAgent(previousOutput);
      systemPrompt = systemPrompt
        ? `${systemPrompt}\n\n${previousContext}`
        : previousContext;
    }

    try {
      if (streamOutput) {
        this.outputHandler.displayAgentHeader(agent.name, 0, 1);
      }

      // Execute Claude command
      const result = await this.processManager.executeClaudeCommand({
        prompt: agent.prompt,
        outputFormat: 'json',
        resumeSessionId: existingSessionId,
        allowedTools: agent.allowedTools,
        appendSystemPrompt: systemPrompt,
        model: agent.model,
        workingDirectory: agent.workingDirectory,
        verbose: false,
      });

      // Create output object
      const output: AgentOutput = {
        agentName: agent.name,
        sessionId: result.session_id,
        result: result.result,
        isError: result.is_error,
        totalCostUsd: result.total_cost_usd,
        durationMs: result.duration_ms,
        timestamp: new Date(),
      };

      // Stream to console if enabled
      if (streamOutput) {
        this.outputHandler.streamToConsole(
          agent.name,
          `Result: ${result.result.substring(0, 200)}${result.result.length > 200 ? '...' : ''}`
        );
      }

      // Save session and output
      this.stateManager.setSession(agent.name, result.session_id);
      this.stateManager.addOutput(output);

      // Save to file if enabled
      if (saveOutput) {
        const outputDir = this.stateManager.getOutputDir();
        const filepath = this.outputHandler.saveToFile(output, outputDir);
        if (streamOutput) {
          this.outputHandler.streamToConsole(agent.name, `Saved to: ${filepath}`);
        }
      }

      return output;
    } catch (error) {
      const errorOutput: AgentOutput = {
        agentName: agent.name,
        sessionId: existingSessionId || '',
        result: error instanceof Error ? error.message : String(error),
        isError: true,
        totalCostUsd: 0,
        durationMs: 0,
        timestamp: new Date(),
      };

      this.stateManager.addOutput(errorOutput);
      this.outputHandler.displayError(agent.name, error as Error);

      return errorOutput;
    }
  }

  /**
   * Execute agents sequentially, passing outputs between them
   */
  async executeSequential(config: OrchestratorConfig): Promise<AgentOutput[]> {
    const outputs: AgentOutput[] = [];
    let previousOutput: AgentOutput | undefined;

    for (let i = 0; i < config.agents.length; i++) {
      const agent = config.agents[i];

      if (config.streamToConsole) {
        this.outputHandler.displayAgentHeader(agent.name, i, config.agents.length);
      }

      const output = await this.executeAgent(
        agent,
        config.passOutputs ? previousOutput : undefined,
        config.streamToConsole,
        config.saveToFiles
      );

      outputs.push(output);

      // Stop on error unless explicitly continuing
      if (output.isError) {
        console.error(`Agent ${agent.name} failed. Stopping sequential execution.`);
        break;
      }

      previousOutput = output;
    }

    if (config.streamToConsole) {
      this.outputHandler.displaySummary(outputs);
    }

    return outputs;
  }

  /**
   * Execute agents in parallel
   */
  async executeParallel(config: OrchestratorConfig): Promise<AgentOutput[]> {
    const promises = config.agents.map((agent, index) => {
      if (config.streamToConsole) {
        this.outputHandler.displayAgentHeader(agent.name, index, config.agents.length);
      }

      return this.executeAgent(
        agent,
        undefined, // No previous output in parallel mode
        config.streamToConsole,
        config.saveToFiles
      );
    });

    const outputs = await Promise.all(promises);

    if (config.streamToConsole) {
      this.outputHandler.displaySummary(outputs);
    }

    return outputs;
  }

  /**
   * Execute agents based on configuration
   */
  async execute(config: OrchestratorConfig): Promise<AgentOutput[]> {
    // Check Claude CLI availability
    const isAvailable = await this.processManager.checkClaudeAvailable();
    if (!isAvailable) {
      throw new Error(
        'Claude CLI is not available. Please ensure it is installed and in your PATH.'
      );
    }

    // Initialize or resume project if needed
    if (config.projectId) {
      const resumed = this.resumeProject(config.projectId);
      if (!resumed) {
        this.initProject(config.projectId);
      }
    } else {
      // Create a new project with timestamp
      const projectId = `project_${Date.now()}`;
      this.initProject(projectId);
    }

    // Execute based on mode
    if (config.mode === 'parallel') {
      return await this.executeParallel(config);
    } else {
      return await this.executeSequential(config);
    }
  }

  /**
   * Get current project state
   */
  getState() {
    return this.stateManager.getCurrentState();
  }

  /**
   * Get all outputs for current project
   */
  getAllOutputs() {
    return this.stateManager.getAllOutputs();
  }

  /**
   * Get outputs for a specific agent
   */
  getAgentOutputs(agentName: string) {
    return this.stateManager.getOutputs(agentName);
  }

  /**
   * Get the latest output for an agent
   */
  getLatestAgentOutput(agentName: string) {
    return this.stateManager.getLatestOutput(agentName);
  }
}
