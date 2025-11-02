/**
 * State Manager for tracking sessions and outputs across agent executions
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { SessionState, AgentOutput, SessionMetadata } from './types.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const deserializeAgentOutput = (value: unknown): AgentOutput | null => {
  if (!isRecord(value)) {
    return null;
  }

  const agentName = value.agentName;
  const sessionId = value.sessionId;
  const result = value.result;

  if (typeof agentName !== 'string' || typeof sessionId !== 'string' || typeof result !== 'string') {
    return null;
  }

  const isError =
    typeof value.isError === 'boolean'
      ? value.isError
      : typeof value.is_error === 'boolean'
        ? value.is_error
        : false;

  const totalCostUsd =
    typeof value.totalCostUsd === 'number'
      ? value.totalCostUsd
      : typeof value.total_cost_usd === 'number'
        ? value.total_cost_usd
        : 0;

  const durationMs =
    typeof value.durationMs === 'number'
      ? value.durationMs
      : typeof value.duration_ms === 'number'
        ? value.duration_ms
        : 0;

  const timestampRaw = value.timestamp;
  const timestamp =
    typeof timestampRaw === 'string' || typeof timestampRaw === 'number'
      ? new Date(timestampRaw)
      : new Date();

  const rawOutput =
    typeof value.rawOutput === 'string'
      ? value.rawOutput
      : typeof value.raw_output === 'string'
        ? value.raw_output
        : undefined;

  return {
    agentName,
    sessionId,
    result,
    isError,
    totalCostUsd,
    durationMs,
    timestamp,
    rawOutput,
  };
};

const toSessionMetadata = (value: unknown): SessionMetadata | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const metadata: SessionMetadata = {};

  for (const [key, rawValue] of Object.entries(record)) {
    if (typeof rawValue === 'undefined') {
      continue;
    }

    if (key === 'userInput' && typeof rawValue === 'string') {
      metadata.userInput = rawValue;
      continue;
    }

    if (key === 'mode' && typeof rawValue === 'string') {
      metadata.mode = rawValue;
      continue;
    }

    if (key === 'description' && typeof rawValue === 'string') {
      metadata.description = rawValue;
      continue;
    }

    if (key === 'branchName' && typeof rawValue === 'string') {
      metadata.branchName = rawValue;
      continue;
    }

    if (key === 'projectNameSanitized' && typeof rawValue === 'string') {
      metadata.projectNameSanitized = rawValue;
      continue;
    }

    metadata[key] = rawValue;
  }

  return metadata;
};

/**
 * Manages persistent state for orchestrator sessions
 */
export class StateManager {
  private stateDir: string;
  private currentState: SessionState | null = null;

  constructor(stateDir: string = '.orchestrator') {
    this.stateDir = stateDir;
    this.ensureStateDirectory();
  }

  /**
   * Create a new project session
   */
  createProject(projectId: string, metadata?: SessionMetadata): SessionState {
    const state: SessionState = {
      projectId,
      sessions: new Map(),
      outputs: new Map(),
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
    };

    this.currentState = state;
    this.saveState();
    return state;
  }

  /**
   * Resume an existing project session
   */
  resumeProject(projectId: string): SessionState | null {
    const statePath = this.getStatePath(projectId);

    if (!existsSync(statePath)) {
      return null;
    }

    try {
      const data = readFileSync(statePath, 'utf-8');
      const parsed = JSON.parse(data) as unknown;

      if (!isRecord(parsed)) {
        throw new Error('State file did not contain an object payload');
      }

      const projectIdValue = parsed.projectId;
      if (typeof projectIdValue !== 'string') {
        throw new Error('State file missing projectId');
      }

      const sessionsRaw = isRecord(parsed.sessions) ? parsed.sessions : {};
      const sessionEntries: Array<[string, string]> = [];
      for (const [agent, session] of Object.entries(sessionsRaw)) {
        if (typeof session === 'string') {
          sessionEntries.push([agent, session]);
        }
      }

      const outputsRaw = isRecord(parsed.outputs) ? parsed.outputs : {};
      const outputEntries: Array<[string, AgentOutput[]]> = [];
      for (const [agent, rawOutputs] of Object.entries(outputsRaw)) {
        if (!Array.isArray(rawOutputs)) {
          continue;
        }

        const deserialized = rawOutputs
          .map(deserializeAgentOutput)
          .filter((output): output is AgentOutput => output !== null);

        outputEntries.push([agent, deserialized]);
      }

      const createdAtRaw = parsed.createdAt;
      const updatedAtRaw = parsed.updatedAt;

      // Reconstruct Maps from saved objects
      const state: SessionState = {
        projectId: projectIdValue,
        sessions: new Map(sessionEntries),
        outputs: new Map(outputEntries),
        createdAt:
          typeof createdAtRaw === 'string' || typeof createdAtRaw === 'number'
            ? new Date(createdAtRaw)
            : new Date(),
        updatedAt:
          typeof updatedAtRaw === 'string' || typeof updatedAtRaw === 'number'
            ? new Date(updatedAtRaw)
            : new Date(),
        metadata: toSessionMetadata(parsed.metadata),
      };

      this.currentState = state;
      return state;
    } catch (error) {
      console.error(`Failed to resume project ${projectId}:`, error);
      return null;
    }
  }

  /**
   * Add or update a session for an agent
   */
  setSession(agentName: string, sessionId: string): void {
    if (!this.currentState) {
      throw new Error('No active project. Create or resume a project first.');
    }

    this.currentState.sessions.set(agentName, sessionId);
    this.currentState.updatedAt = new Date();
    this.saveState();
  }

  /**
   * Get session ID for an agent
   */
  getSession(agentName: string): string | undefined {
    return this.currentState?.sessions.get(agentName);
  }

  /**
   * Add an output for an agent
   */
  addOutput(output: AgentOutput): void {
    if (!this.currentState) {
      throw new Error('No active project. Create or resume a project first.');
    }

    const existing = this.currentState.outputs.get(output.agentName) || [];
    existing.push(output);
    this.currentState.outputs.set(output.agentName, existing);
    this.currentState.updatedAt = new Date();
    this.saveState();
  }

  /**
   * Get all outputs for an agent
   */
  getOutputs(agentName: string): AgentOutput[] {
    return this.currentState?.outputs.get(agentName) || [];
  }

  /**
   * Get the latest output for an agent
   */
  getLatestOutput(agentName: string): AgentOutput | undefined {
    const outputs = this.getOutputs(agentName);
    return outputs[outputs.length - 1];
  }

  /**
   * Get all outputs across all agents
   */
  getAllOutputs(): Map<string, AgentOutput[]> {
    return this.currentState?.outputs ?? new Map<string, AgentOutput[]>();
  }

  /**
   * Get current project state
   */
  getCurrentState(): SessionState | null {
    return this.currentState;
  }

  /**
   * List all available projects
   */
  listProjects(): string[] {
    const projectsDir = join(this.stateDir, 'projects');
    if (!existsSync(projectsDir)) {
      return [];
    }

    try {
      return readdirSync(projectsDir)
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.replace('.json', ''));
    } catch {
      return [];
    }
  }

  /**
   * Get output directory for current project
   */
  getOutputDir(): string {
    if (!this.currentState) {
      throw new Error('No active project');
    }

    const outputDir = join(this.stateDir, 'outputs', this.currentState.projectId);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    return outputDir;
  }

  /**
   * Save current state to disk
   */
  private saveState(): void {
    if (!this.currentState) {
      return;
    }

    const statePath = this.getStatePath(this.currentState.projectId);

    // Convert Maps to objects for JSON serialization
    const serializable = {
      projectId: this.currentState.projectId,
      sessions: Object.fromEntries(this.currentState.sessions),
      outputs: Object.fromEntries(
        Array.from(this.currentState.outputs.entries()).map(([key, value]) => [
          key,
          value,
        ])
      ),
      createdAt: this.currentState.createdAt.toISOString(),
      updatedAt: this.currentState.updatedAt.toISOString(),
      metadata: this.currentState.metadata,
    };

    const dir = dirname(statePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(statePath, JSON.stringify(serializable, null, 2));
  }

  /**
   * Get the file path for a project's state
   */
  private getStatePath(projectId: string): string {
    return join(this.stateDir, 'projects', `${projectId}.json`);
  }

  /**
   * Ensure state directory exists
   */
  private ensureStateDirectory(): void {
    const dirs = [
      this.stateDir,
      join(this.stateDir, 'projects'),
      join(this.stateDir, 'outputs'),
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }
}
