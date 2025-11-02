/**
 * Process Manager for spawning and managing Claude Code CLI instances
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { ProcessOptions, ClaudeCliResult } from './types.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const formatUnknown = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

/**
 * Spawns a Claude Code CLI process and returns the result
 */
export class ProcessManager {
  private claudePath: string = 'claude';

  constructor() {
    // Try to find the actual Claude executable path
    this.findClaudePath();
  }

  /**
   * Find the Claude CLI executable path
   */
  private findClaudePath(): void {
    // Common installation paths
    const possiblePaths = [
      process.env.HOME + '/.claude/local/claude',
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        this.claudePath = path;
        return;
      }
    }

    // Default to 'claude' and hope it's in PATH
    this.claudePath = 'claude';
  }
  /**
   * Execute a Claude Code command and return the parsed result
   */
  async executeClaudeCommand(options: ProcessOptions): Promise<ClaudeCliResult> {
    const args = this.buildCommandArgs(options);

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      // Build command string for shell execution
      const cmdString = this.buildCommandString(args);

      const child = spawn(cmdString, {
        cwd: options.workingDirectory || process.cwd(),
        env: process.env,
        shell: true, // Use shell to access aliases
      });

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error: Error) => {
        reject(new Error(`Failed to spawn Claude CLI: ${error.message}`));
      });

      child.on('close', (code: number) => {
        if (code !== 0) {
          reject(new Error(`Claude CLI exited with code ${code}\nStderr: ${stderr}`));
          return;
        }

        try {
          // Parse JSON output
          const result = this.parseOutput(stdout, options.outputFormat || 'json');
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse Claude output: ${formatUnknown(error)}\nOutput: ${stdout}`));
        }
      });
    });
  }

  /**
   * Execute a Claude Code command with streaming output.
   * Streams each parsed line through the optional callback and resolves with the final result.
   */
  async executeClaudeCommandStreaming(
    options: ProcessOptions,
    onChunk?: (chunk: string) => void
  ): Promise<ClaudeCliResult> {
    const args = this.buildCommandArgs({
      ...options,
      outputFormat: 'stream-json',
    });

    return new Promise<ClaudeCliResult>((resolve, reject) => {
      let stderr = '';
      let finalResult: ClaudeCliResult | null = null;
      let buffer = '';

      const cmdString = this.buildCommandString(args);

      const child = spawn(cmdString, {
        cwd: options.workingDirectory || process.cwd(),
        env: process.env,
        shell: true,
      });

      const processLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return;
        }

        if (onChunk) {
          onChunk(trimmed);
        }

        const candidate = this.parseResultLine(trimmed);
        if (candidate) {
          finalResult = candidate;
        }
      };

      child.stdout?.on('data', (data: Buffer) => {
        buffer += data.toString();

        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          processLine(line);
          newlineIndex = buffer.indexOf('\n');
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error: Error) => {
        reject(new Error(`Failed to spawn Claude CLI: ${error.message}`));
      });

      child.on('close', (code: number) => {
        if (buffer.trim()) {
          processLine(buffer);
        }

        if (code !== 0) {
          reject(new Error(`Claude CLI exited with code ${code}\nStderr: ${stderr}`));
          return;
        }

        if (!finalResult) {
          reject(new Error('No final result received from Claude CLI'));
          return;
        }

        resolve(finalResult);
      });
    });
  }

  /**
   * Build a shell-safe command string from arguments
   */
  private buildCommandString(args: string[]): string {
    // Escape arguments for shell execution
    const escapedArgs = args.map(arg => {
      // If arg contains spaces or special chars, quote it
      if (/[\s'"$`\\]/.test(arg)) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
      }
      return arg;
    });

    return `${this.claudePath} ${escapedArgs.join(' ')}`;
  }

  /**
   * Build command line arguments for Claude CLI
   */
  private buildCommandArgs(options: ProcessOptions): string[] {
    const args: string[] = [];

    // Non-interactive mode
    args.push('-p');
    if (options.prompt) {
      args.push(options.prompt);
    }

    // Output format
    if (options.outputFormat) {
      args.push('--output-format', options.outputFormat);
    }

    // Resume session
    if (options.resumeSessionId) {
      args.push('--resume', options.resumeSessionId);
    }

    // Allowed tools
    if (options.allowedTools && options.allowedTools.length > 0) {
      args.push('--allowedTools', options.allowedTools.join(','));
    }

    // System prompt
    if (options.appendSystemPrompt) {
      args.push('--append-system-prompt', options.appendSystemPrompt);
    }

    // Model
    if (options.model) {
      args.push('--model', options.model);
    }

    // Max turns
    if (options.maxTurns !== undefined) {
      args.push('--max-turns', options.maxTurns.toString());
    }

    // Verbose
    if (options.verbose) {
      args.push('--verbose');
    }

    return args;
  }

  private parseResultLine(line: string): ClaudeCliResult | null {
    try {
      const parsed = JSON.parse(line) as unknown;
      return this.toClaudeResult(parsed);
    } catch {
      return null;
    }
  }

  private toClaudeResult(value: unknown): ClaudeCliResult | null {
    if (!isRecord(value)) {
      return null;
    }

    const sessionId = value.session_id;
    const resultText = value.result;

    if (typeof sessionId !== 'string' || typeof resultText !== 'string') {
      return null;
    }

    return {
      result: resultText,
      session_id: sessionId,
      is_error: typeof value.is_error === 'boolean' ? value.is_error : Boolean(value.is_error),
      total_cost_usd: typeof value.total_cost_usd === 'number' ? value.total_cost_usd : 0,
      duration_ms: typeof value.duration_ms === 'number' ? value.duration_ms : 0,
    };
  }

  /**
   * Parse Claude CLI output based on format
   */
  private parseOutput(output: string, format: string): ClaudeCliResult {
    if (format === 'json' || format === 'stream-json') {
      // For JSON output, parse the last complete JSON object
      const lines = output.trim().split('\n');

      // Try to parse from the last line backwards
      for (let i = lines.length - 1; i >= 0; i--) {
        const candidate = this.parseResultLine(lines[i]);
        if (candidate) {
          return candidate;
        }
      }

      throw new Error('No valid JSON result found in output');
    }

    // For text output, create a minimal result object
    return {
      result: output.trim(),
      session_id: '',
      is_error: false,
      total_cost_usd: 0,
      duration_ms: 0,
    };
  }

  /**
   * Check if Claude CLI is available
   */
  async checkClaudeAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      // Try to run claude --help to verify it's available
      const child = spawn(`${this.claudePath} --help`, {
        shell: true,
      });

      child.on('close', (code) => {
        resolve(code === 0);
      });
      child.on('error', () => {
        resolve(false);
      });
    });
  }
}
