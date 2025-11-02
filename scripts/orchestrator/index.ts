#!/usr/bin/env node

/**
 * Claude Code Orchestrator - Entry Point
 * A deterministic TypeScript orchestrator for running Claude Code instances
 */

import prompts from 'prompts';
import chalk from 'chalk';
import { Orchestrator } from './orchestrator.js';
import { GitUtils } from './git-utils.js';
import { InputAnalyzerUtils } from './input-analyzer-utils.js';
import { AgentConfig, OrchestratorMode, PlannerMode, CommitMode } from './types.js';

type PromptAnswers = Record<string, unknown>;
type ExecutionMode = 'sequential' | 'parallel';

const CANCELLED_MESSAGE = '\nOperation cancelled.';

const toPromptAnswers = (value: unknown): PromptAnswers =>
  typeof value === 'object' && value !== null ? (value as PromptAnswers) : {};

const toStringAnswer = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const toOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const toBooleanAnswer = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const isOrchestratorMode = (value: unknown): value is OrchestratorMode =>
  value === 'planner' || value === 'tasker';

const isPlannerMode = (value: unknown): value is PlannerMode =>
  value === 'create' || value === 'resume';

const isCommitMode = (value: unknown): value is CommitMode =>
  value === 'manual' || value === 'auto' || value === 'skip';

const isExecutionMode = (value: unknown): value is ExecutionMode =>
  value === 'sequential' || value === 'parallel';

interface InputAnalysisSummary {
  projectName?: string;
  keyObjectivesCount: number;
  requiredFeaturesCount: number;
  risksCount: number;
  openQuestionsCount: number;
}

const toInputAnalysisSummary = (data: unknown): InputAnalysisSummary | null => {
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const record = data as Record<string, unknown>;
  const keyObjectives = Array.isArray(record.key_objectives) ? record.key_objectives : [];
  const requiredFeatures = Array.isArray(record.required_features) ? record.required_features : [];
  const risks = Array.isArray(record.risks_and_mitigations) ? record.risks_and_mitigations : [];
  const openQuestions = Array.isArray(record.open_questions) ? record.open_questions : [];

  return {
    projectName: typeof record.project_name === 'string' ? record.project_name : undefined,
    keyObjectivesCount: keyObjectives.length,
    requiredFeaturesCount: requiredFeatures.length,
    risksCount: risks.length,
    openQuestionsCount: openQuestions.length,
  };
};

const formatUnknown = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

/**
 * Main CLI interface
 */
class OrchestratorCLI {
  private orchestrator: Orchestrator;
  private gitUtils: GitUtils;
  private inputAnalyzerUtils: InputAnalyzerUtils;

  constructor() {
    this.orchestrator = new Orchestrator();
    this.gitUtils = new GitUtils();
    this.inputAnalyzerUtils = new InputAnalyzerUtils();
  }

  /**
   * Display welcome banner
   */
  displayBanner(): void {
    console.clear();
    console.log(chalk.cyan.bold('\n╔═══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║           Claude Code Orchestrator v1.0.0                     ║'));
    console.log(chalk.cyan.bold('╚═══════════════════════════════════════════════════════════════╝\n'));
  }

  /**
   * Show initial mode selection
   */
  async selectMode(): Promise<OrchestratorMode> {
    const response = toPromptAnswers(await prompts({
      type: 'select',
      name: 'mode',
      message: 'Choose Mode:',
      choices: [
        { title: 'Planner', value: 'planner', description: 'Plan and manage projects' },
        { title: 'Tasker', value: 'tasker', description: 'Execute tasks with agents' },
      ],
      initial: 0,
    }));

    const mode = response.mode;

    if (!isOrchestratorMode(mode)) {
      console.log(chalk.yellow(CANCELLED_MESSAGE));
      process.exit(0);
    }

    return mode;
  }

  /**
   * Show planner sub-mode selection
   */
  async selectPlannerMode(): Promise<PlannerMode> {
    console.log(chalk.cyan.bold('\n## Choose Mode'));
    console.log('Please choose one of the following modes by replying with the corresponding letter:\n');
    console.log(chalk.green('A.') + ' Create new Project');
    console.log(chalk.green('B.') + ' Resume an existing Project\n');

    const response = toPromptAnswers(await prompts({
      type: 'select',
      name: 'mode',
      message: 'Select option:',
      choices: [
        { title: 'A. Create new Project', value: 'create' },
        { title: 'B. Resume existing Project', value: 'resume' },
      ],
      initial: 0,
    }));

    const mode = response.mode;

    if (!isPlannerMode(mode)) {
      console.log(chalk.yellow(CANCELLED_MESSAGE));
      process.exit(0);
    }

    return mode;
  }

  /**
   * Handle Planner mode
   */
  async handlePlannerMode(): Promise<void> {
    const plannerMode = await this.selectPlannerMode();

    if (plannerMode === 'create') {
      await this.createNewProject();
    } else {
      await this.resumeExistingProject();
    }
  }

  /**
   * Create a new project with git-aware workflow
   */
  async createNewProject(): Promise<void> {
    console.log(chalk.cyan.bold('\n## Create New Project\n'));

    // Step 1: Ask for project name
    const projectInfoAnswers = toPromptAnswers(await prompts([
      {
        type: 'text',
        name: 'projectName',
        message: 'Project name:',
        initial: `project_${Date.now()}`,
        validate: (value: string) => (value.length > 0 ? true : 'Project name is required'),
      },
      {
        type: 'text',
        name: 'description',
        message: 'Project description (optional):',
      },
    ]));

    const projectName = toStringAnswer(projectInfoAnswers.projectName);
    const projectDescription = toOptionalString(projectInfoAnswers.description);

    if (!projectName) {
      console.log(chalk.yellow(CANCELLED_MESSAGE));
      return;
    }

    const projectNameSanitized = this.gitUtils.sanitizeProjectName(projectName);
    const branchName = this.gitUtils.sanitizeBranchName(projectName);

    // Step 2: Check for uncommitted changes
    console.log(chalk.cyan('\n## Checking Git Status...\n'));

    const isGitRepo = await this.gitUtils.isGitRepository();

    if (!isGitRepo) {
      console.log(chalk.yellow('⚠ Not a git repository. Skipping git workflow.\n'));
    } else {
      const gitStatus = await this.gitUtils.getStatus();

      if (gitStatus.hasUncommittedChanges) {
        console.log(chalk.yellow('⚠ You have uncommitted changes:\n'));
        console.log(chalk.dim(this.gitUtils.formatStatus(gitStatus)));
        console.log('');

        const commitChoiceAnswers = toPromptAnswers(await prompts({
          type: 'select',
          name: 'mode',
          message: 'How would you like to handle these changes?',
          choices: [
            {
              title: 'Commit automatically',
              value: 'auto',
              description: 'Auto-commit all changes with a default message'
            },
            {
              title: 'Commit manually',
              value: 'manual',
              description: 'Exit so you can commit manually'
            },
            {
              title: 'Skip (risky)',
              value: 'skip',
              description: 'Continue without committing (not recommended)'
            },
          ],
          initial: 0,
        }));

        const commitModeValue = commitChoiceAnswers.mode;

        if (!isCommitMode(commitModeValue)) {
          console.log(chalk.yellow(CANCELLED_MESSAGE));
          return;
        }

        const commitMode: CommitMode = commitModeValue;

        if (commitMode === 'manual') {
          console.log(chalk.yellow('\n⚠ Please commit your changes manually and run the orchestrator again.'));
          console.log(chalk.dim('  git add .'));
          console.log(chalk.dim('  git commit -m "your message"'));
          console.log('');
          process.exit(0);
        } else if (commitMode === 'auto') {
          const commitMessageAnswers = toPromptAnswers(await prompts({
            type: 'text',
            name: 'message',
            message: 'Commit message:',
            initial: `chore: save work before starting ${projectName}`,
            validate: (value: string) => (value.length > 0 ? true : 'Commit message is required'),
          }));

          const commitMessage = toStringAnswer(commitMessageAnswers.message);

          if (!commitMessage) {
            console.log(chalk.yellow(CANCELLED_MESSAGE));
            return;
          }

          try {
            console.log(chalk.cyan('\n📝 Committing changes...\n'));
            await this.gitUtils.commit({
              message: commitMessage,
              addAll: true,
            });
            console.log(chalk.green('✓ Changes committed successfully!\n'));
          } catch (error) {
            console.error(chalk.red(`\n✗ Failed to commit: ${formatUnknown(error)}\n`));
            process.exit(1);
          }
        } else {
          // skip mode
          console.log(chalk.yellow('\n⚠ Continuing without committing (not recommended)\n'));
        }
      } else {
        console.log(chalk.green('✓ No uncommitted changes\n'));
      }

      // Step 3: Ask if user wants to create a branch
      const branchChoiceAnswers = toPromptAnswers(await prompts({
        type: 'confirm',
        name: 'createBranch',
        message: `Create and switch to branch "${branchName}"?`,
        initial: true,
      }));

      const createBranch = toBooleanAnswer(branchChoiceAnswers.createBranch);

      if (createBranch === undefined) {
        console.log(chalk.yellow(CANCELLED_MESSAGE));
        return;
      }

      if (createBranch) {
        console.log(chalk.cyan(`\n## Creating branch: ${branchName}\n`));

        try {
          const branchExists = await this.gitUtils.branchExists(branchName);

          if (branchExists) {
            const overwriteAnswers = toPromptAnswers(await prompts({
              type: 'confirm',
              name: 'value',
              message: `Branch "${branchName}" already exists. Switch to it?`,
              initial: true,
            }));

            const overwrite = toBooleanAnswer(overwriteAnswers.value);

            if (overwrite) {
              await this.gitUtils.checkoutBranch(branchName);
              console.log(chalk.green(`✓ Switched to existing branch "${branchName}"\n`));
            } else {
              console.log(chalk.yellow(CANCELLED_MESSAGE));
              return;
            }
          } else {
            await this.gitUtils.createBranch(branchName, true);
            console.log(chalk.green(`✓ Created and switched to branch "${branchName}"\n`));
          }
        } catch (error) {
          console.error(chalk.red(`\n✗ Failed to create branch: ${formatUnknown(error)}\n`));
          process.exit(1);
        }
      } else {
        console.log(chalk.yellow(`\n⚠ Skipping branch creation. Continuing on current branch.\n`));
      }
    }

    // Step 4: Ask for user's request/target implementation
    console.log(chalk.cyan('## User Request\n'));
    console.log(chalk.dim('Please describe your request, target implementation, or feature:\n'));

    const userRequestAnswers = toPromptAnswers(await prompts({
      type: 'text',
      name: 'input',
      message: 'Your request:',
      validate: (value: string) => (value.length > 0 ? true : 'Request is required'),
    }));

    const userInput = toStringAnswer(userRequestAnswers.input);

    if (!userInput) {
      console.log(chalk.yellow(CANCELLED_MESSAGE));
      return;
    }
    // Step 5: Create w-projects directory and invoke W-InputAnalyzer
    console.log(chalk.cyan('\n## Running Input Analysis...\n'));
    console.log(chalk.dim(`Creating project directory: w-projects/${projectNameSanitized}\n`));

    try {
      // Create the project directory
      const projectDir = this.inputAnalyzerUtils.createProjectDirectory(projectNameSanitized);
      console.log(chalk.green(`✓ Project directory created: ${projectDir}\n`));

      // Invoke W-InputAnalyzer with streaming
      console.log(chalk.cyan('Invoking W-InputAnalyzer agent...\n'));
      console.log(chalk.dim('This may take a few minutes depending on the complexity of your request.\n'));

      const result = await this.inputAnalyzerUtils.invokeInputAnalyzer(
        userInput,
        projectNameSanitized,
        undefined, // onChunk - let debug mode handle it
        undefined, // onStderr - let debug mode handle it
        true, // Enable debug mode
        600000 // 10 minute timeout
      );

      if (!result.success) {
        console.error(chalk.red(`\n✗ Input Analysis failed: ${result.error}\n`));
        process.exit(1);
      }

      console.log(chalk.green('✓ Input Analysis completed successfully!\n'));

      // Step 6: Verify file creation
      console.log(chalk.cyan('## Verifying Output File...\n'));

      const fileExists = this.inputAnalyzerUtils.verifyFileCreation(result.outputPath);

      if (!fileExists) {
        console.error(chalk.red(`✗ Output file not found at: ${result.outputPath}\n`));
        process.exit(1);
      }

      console.log(chalk.green(`✓ File created: ${result.outputPath}\n`));

      // Step 7: Validate JSON against schema
      console.log(chalk.cyan('## Validating JSON Schema...\n'));

      const validation = this.inputAnalyzerUtils.validateJsonAgainstSchema(result.jsonData);

      if (!validation.valid) {
        console.error(chalk.red('✗ JSON validation failed:\n'));
        validation.errors?.forEach((error) => {
          console.error(chalk.red(`  - ${error}`));
        });
        console.error('');
        process.exit(1);
      }

      console.log(chalk.green('✓ JSON schema validation passed!\n'));

      // Display summary of analysis
      const analysisSummary = toInputAnalysisSummary(result.jsonData);

      if (analysisSummary) {
        console.log(chalk.cyan('## Analysis Summary:\n'));
        console.log(chalk.dim(`Project Name: ${analysisSummary.projectName ?? 'N/A'}`));
        console.log(chalk.dim(`Objectives: ${analysisSummary.keyObjectivesCount}`));
        console.log(chalk.dim(`Features: ${analysisSummary.requiredFeaturesCount}`));
        console.log(chalk.dim(`Risks: ${analysisSummary.risksCount}`));
        console.log(chalk.dim(`Open Questions: ${analysisSummary.openQuestionsCount}`));
        console.log('');
      }

    } catch (error) {
      console.error(chalk.red(`\n✗ Error during input analysis: ${formatUnknown(error)}\n`));
      process.exit(1);
    }

    // Initialize orchestrator project with user input
    this.orchestrator.initProject(projectName, {
      description: projectDescription,
      branchName,
      userInput,
      projectNameSanitized,
    });

    console.log(chalk.green(`✓ Project "${projectName}" initialized successfully!\n`));

    // Now proceed to configure agents with user input context
    await this.configureAndExecuteAgents(projectName, userInput);
  }

  /**
   * Resume an existing project
   */
  async resumeExistingProject(): Promise<void> {
    const projects = this.orchestrator.listProjects();

    if (projects.length === 0) {
      console.log(chalk.yellow('\nNo existing projects found.\n'));
      return;
    }

    const responseAnswers = toPromptAnswers(await prompts({
      type: 'select',
      name: 'projectId',
      message: 'Select a project to resume:',
      choices: projects.map(id => ({ title: id, value: id })),
    }));

    const projectId = toStringAnswer(responseAnswers.projectId);

    if (!projectId) {
      console.log(chalk.yellow(CANCELLED_MESSAGE));
      return;
    }

    const resumed = this.orchestrator.resumeProject(projectId);

    if (!resumed) {
      console.log(chalk.red(`\n✗ Failed to resume project "${projectId}".\n`));
      return;
    }

    console.log(chalk.green(`\n✓ Project "${projectId}" resumed successfully!\n`));

    // Show current state
    const state = this.orchestrator.getState();
    if (state) {
      console.log(chalk.dim(`Created: ${state.createdAt.toISOString()}`));
      console.log(chalk.dim(`Updated: ${state.updatedAt.toISOString()}`));
      console.log(chalk.dim(`Sessions: ${state.sessions.size}`));
      console.log(chalk.dim(`Outputs: ${state.outputs.size}`));

      // Show user input if available
      if (state.metadata?.userInput) {
        console.log(chalk.cyan('\nUser Request:'));
        console.log(chalk.dim(state.metadata.userInput));
      }
      console.log('');
    }

    // Continue with agent execution, passing the stored user input
    const userInput = typeof state?.metadata?.userInput === 'string'
      ? state.metadata.userInput
      : undefined;
    await this.configureAndExecuteAgents(projectId, userInput);
  }

  /**
   * Handle Tasker mode
   */
  async handleTaskerMode(): Promise<void> {
    console.log(chalk.cyan.bold('\n## Tasker Mode\n'));

    const inputAnswers = toPromptAnswers(await prompts({
      type: 'text',
      name: 'userInput',
      message: 'Provide user input:',
      validate: (value: string) => (value.length > 0 ? true : 'Input is required'),
    }));

    const userInput = toStringAnswer(inputAnswers.userInput);

    if (!userInput) {
      console.log(chalk.yellow(CANCELLED_MESSAGE));
      return;
    }

    // Create a temporary project for tasker mode
    const projectId = `tasker_${Date.now()}`;
    this.orchestrator.initProject(projectId, {
      mode: 'tasker',
      userInput,
    });

    console.log(chalk.green('\n✓ Tasker session initialized.\n'));

    // Configure agents for this task
    await this.configureAndExecuteAgents(projectId, userInput);
  }

  /**
   * Configure and execute agents
   */
  async configureAndExecuteAgents(projectId: string, initialInput?: string): Promise<void> {
    const agents: AgentConfig[] = [];

    console.log(chalk.cyan.bold('\n## Configure Agents\n'));

    // Display user input context if available
    if (initialInput) {
      console.log(chalk.cyan('Context (user_input):'));
      console.log(chalk.dim(`"${initialInput}"\n`));
    }

    console.log(chalk.dim('You will now define the agents to execute step by step.\n'));

    // Agent configuration loop
    let addMore = true;
    let agentNumber = 1;

    while (addMore) {
      console.log(chalk.yellow(`\n--- Agent ${agentNumber} ---\n`));

      const agentAnswers = toPromptAnswers(await prompts([
        {
          type: 'text',
          name: 'name',
          message: 'Agent name:',
          initial: `agent_${agentNumber}`,
          validate: (value: string) => (value.length > 0 ? true : 'Name is required'),
        },
        {
          type: 'text',
          name: 'prompt',
          message: 'Agent prompt:',
          initial: initialInput && agentNumber === 1 ? initialInput : '',
          validate: (value: string) => (value.length > 0 ? true : 'Prompt is required'),
        },
        {
          type: 'text',
          name: 'allowedTools',
          message: 'Allowed tools (comma-separated, leave empty for all):',
          initial: '',
        },
        {
          type: 'text',
          name: 'systemPrompt',
          message: 'System prompt (optional):',
          initial: '',
        },
        {
          type: 'select',
          name: 'model',
          message: 'Model:',
          choices: [
            { title: 'Sonnet (default)', value: '' },
            { title: 'Haiku', value: 'haiku' },
            { title: 'Opus', value: 'opus' },
          ],
          initial: 0,
        },
      ]));

      const agentName = toStringAnswer(agentAnswers.name);
      const agentPrompt = toStringAnswer(agentAnswers.prompt);
      const allowedToolsInput = toOptionalString(agentAnswers.allowedTools);
      const systemPrompt = toOptionalString(agentAnswers.systemPrompt);
      const modelValue = toOptionalString(agentAnswers.model);

      if (!agentName || !agentPrompt) {
        console.log(chalk.yellow('\nAgent configuration cancelled.'));
        break;
      }

      const agent: AgentConfig = {
        name: agentName,
        prompt: agentPrompt,
        allowedTools: allowedToolsInput
          ? allowedToolsInput
              .split(',')
              .map(tool => tool.trim())
              .filter(tool => tool.length > 0)
          : undefined,
        systemPrompt: systemPrompt,
        model: modelValue && modelValue.length > 0 ? modelValue : undefined,
      };

      agents.push(agent);

      const continueAnswers = toPromptAnswers(await prompts({
        type: 'confirm',
        name: 'addMore',
        message: 'Add another agent?',
        initial: false,
      }));

      const addMoreResponse = toBooleanAnswer(continueAnswers.addMore);

      if (addMoreResponse === undefined) {
        addMore = false;
        break;
      }

      addMore = addMoreResponse;
      agentNumber++;
    }

    if (agents.length === 0) {
      console.log(chalk.yellow('\nNo agents configured. Exiting.\n'));
      return;
    }

    // Execution mode selection
    const execAnswers = toPromptAnswers(await prompts([
      {
        type: 'select',
        name: 'mode',
        message: 'Execution mode:',
        choices: [
          { title: 'Sequential (pass outputs)', value: 'sequential' },
          { title: 'Parallel (independent)', value: 'parallel' },
        ],
        initial: 0,
      },
      {
        type: 'confirm',
        name: 'streamToConsole',
        message: 'Stream output to console?',
        initial: true,
      },
      {
        type: 'confirm',
        name: 'saveToFiles',
        message: 'Save outputs to files?',
        initial: true,
      },
    ]));

    const executionModeValue = toStringAnswer(execAnswers.mode);

    if (!isExecutionMode(executionModeValue)) {
      console.log(chalk.yellow(CANCELLED_MESSAGE));
      return;
    }

    const streamToConsole = toBooleanAnswer(execAnswers.streamToConsole);
    const saveToFiles = toBooleanAnswer(execAnswers.saveToFiles);
    const passOutputs = executionModeValue === 'sequential';

    console.log(chalk.cyan.bold('\n## Executing Agents...\n'));

    try {
      const outputs = await this.orchestrator.execute({
        mode: executionModeValue,
        agents,
        streamToConsole: streamToConsole ?? true,
        saveToFiles: saveToFiles ?? true,
        passOutputs,
        projectId,
      });

      console.log(chalk.green(`\n✓ Execution complete! ${outputs.length} agent(s) executed.\n`));
    } catch (error) {
      console.error(chalk.red('\n✗ Execution failed:'), formatUnknown(error));
    }
  }

  /**
   * Run the CLI
   */
  async run(): Promise<void> {
    this.displayBanner();

    const mode = await this.selectMode();

    if (mode === 'planner') {
      await this.handlePlannerMode();
    } else {
      await this.handleTaskerMode();
    }

    console.log(chalk.cyan('\nThank you for using Claude Code Orchestrator!\n'));
  }
}

// Main entry point
const cli = new OrchestratorCLI();
cli.run().catch((error) => {
  console.error(chalk.red('Fatal error:'), formatUnknown(error));
  process.exit(1);
});
