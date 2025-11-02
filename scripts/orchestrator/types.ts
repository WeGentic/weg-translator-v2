/**
 * Core types for Claude Code Orchestrator
 */

/**
 * Configuration for a single agent execution
 */
export interface AgentConfig {
  /** Unique identifier for this agent instance */
  name: string;
  /** The prompt to send to Claude */
  prompt: string;
  /** Optional list of allowed tools (e.g., ["Read", "Write", "Bash"]) */
  allowedTools?: string[];
  /** Optional system prompt to append */
  systemPrompt?: string;
  /** Optional model override (e.g., "sonnet", "opus", "haiku") */
  model?: string;
  /** Optional working directory for context isolation */
  workingDirectory?: string;
}

/**
 * Output from a Claude Code execution
 */
export interface AgentOutput {
  /** Agent name that produced this output */
  agentName: string;
  /** Session ID from Claude */
  sessionId: string;
  /** The actual response/result */
  result: string;
  /** Whether this was an error */
  isError: boolean;
  /** Cost in USD */
  totalCostUsd: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Raw output for debugging */
  rawOutput?: string;
  /** Timestamp of execution */
  timestamp: Date;
}

/**
 * Session state for tracking active Claude instances
 */
export interface SessionMetadata {
  /** Original user request captured during planning */
  userInput?: string;
  /** Operating mode for the orchestrator (planner/tasker/etc.) */
  mode?: string;
  /** Project description supplied when initializing */
  description?: string;
  /** Git branch name associated with the project */
  branchName?: string;
  /** Sanitized project name used for directory creation */
  projectNameSanitized?: string;
  /** Allow additional metadata properties */
  [key: string]: unknown;
}

export interface SessionState {
  /** Unique project identifier */
  projectId: string;
  /** Map of agent name to session ID */
  sessions: Map<string, string>;
  /** Map of agent name to their outputs */
  outputs: Map<string, AgentOutput[]>;
  /** Project creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Optional project metadata */
  metadata?: SessionMetadata;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Execution mode */
  mode: 'sequential' | 'parallel';
  /** List of agents to execute */
  agents: AgentConfig[];
  /** Whether to stream output to console */
  streamToConsole: boolean;
  /** Whether to save outputs to files */
  saveToFiles: boolean;
  /** Whether to pass outputs between agents */
  passOutputs: boolean;
  /** Optional project ID for resume */
  projectId?: string;
}

/**
 * CLI execution result from Claude
 */
export interface ClaudeCliResult {
  /** Result text or data */
  result: string;
  /** Session ID for continuation */
  session_id: string;
  /** Whether this was an error */
  is_error: boolean;
  /** Total cost in USD */
  total_cost_usd: number;
  /** Duration in milliseconds */
  duration_ms: number;
}

/**
 * Process execution options
 */
export interface ProcessOptions {
  /** The prompt to send */
  prompt: string;
  /** Output format (text, json, stream-json) */
  outputFormat?: 'text' | 'json' | 'stream-json';
  /** Session ID to resume */
  resumeSessionId?: string;
  /** Allowed tools */
  allowedTools?: string[];
  /** System prompt to append */
  appendSystemPrompt?: string;
  /** Model to use */
  model?: string;
  /** Working directory */
  workingDirectory?: string;
  /** Maximum turns */
  maxTurns?: number;
  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Orchestrator mode selection
 */
export type OrchestratorMode = 'planner' | 'tasker';

/**
 * Planner sub-mode selection
 */
export type PlannerMode = 'create' | 'resume';

/**
 * Git commit mode selection
 */
export type CommitMode = 'manual' | 'auto' | 'skip';

/**
 * Project initialization options
 */
export interface ProjectInitOptions {
  projectName: string;
  branchName: string;
  commitMode?: CommitMode;
  commitMessage?: string;
}
