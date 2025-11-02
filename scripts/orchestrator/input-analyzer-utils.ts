/**
 * Utilities for invoking W-InputAnalyzer and handling JSON validation
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface InputAnalyzerResult {
  success: boolean;
  outputPath: string;
  jsonData?: unknown;
  error?: string;
}

/**
 * Input Analyzer manager for W-InputAnalyzer slash command
 */
export class InputAnalyzerUtils {
  private claudePath: string = 'claude';
  private schemaPath: string;
  private projectsRootDir: string;

  constructor(schemaPath?: string, projectsRootDir?: string) {
    // Always use current working directory (should be project root)
    const projectRoot = process.cwd();

    this.schemaPath = schemaPath || join(projectRoot, '.claude/schemas/input-analyzer.json');
    this.projectsRootDir = projectsRootDir || join(projectRoot, 'w-projects');
    this.findClaudePath();
  }

  /**
   * Find the Claude CLI executable path
   */
  private findClaudePath(): void {
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

    this.claudePath = 'claude';
  }

  /**
   * Create w-projects directory structure
   */
  createProjectDirectory(projectNameSanitized: string): string {
    const projectDir = join(this.projectsRootDir, projectNameSanitized);

    if (!existsSync(this.projectsRootDir)) {
      mkdirSync(this.projectsRootDir, { recursive: true });
    }

    if (!existsSync(projectDir)) {
      mkdirSync(projectDir, { recursive: true });
    }

    return projectDir;
  }

  /**
   * Invoke W-InputAnalyzer with streaming JSON output
   */
  async invokeInputAnalyzer(
    userInput: string,
    projectNameSanitized: string,
    onChunk?: (chunk: string) => void,
    onStderr?: (chunk: string) => void,
    debug: boolean = false,
    timeoutMs: number = 600000 // 10 minute timeout
  ): Promise<InputAnalyzerResult> {
    // Create project directory
    const projectDir = this.createProjectDirectory(projectNameSanitized);
    const outputPath = join(projectDir, `${projectNameSanitized}_UserInput.json`);

    // Build command arguments
    // Note: Slash command with args should be formatted as: /command arg1 arg2
    // IMPORTANT: stream-json with -p requires --verbose flag
    const slashCommand = `/W-InputAnalyzer "${userInput}" "${projectNameSanitized}"`;

    const args = [
      '--dangerously-skip-permissions',
      '--verbose',
      '--output-format',
      'stream-json',
      '-p',
      slashCommand,
    ];

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let finalJson: unknown;
      let hasOutput = false;

      // CRITICAL: Must run from project root where .claude/ directory exists
      const projectRoot = process.cwd();

      if (debug) {
        console.log('\n[DEBUG] Executing command:', this.claudePath, args.join(' '));
        console.log('[DEBUG] Working directory (project root):', projectRoot);
        console.log('[DEBUG] Output path:', outputPath);
        console.log('[DEBUG] Args:', JSON.stringify(args, null, 2));
        console.log('\n');
      }

      // Spawn Claude directly with args array (NOT through shell)
      const child = spawn(this.claudePath, args, {
        cwd: projectRoot,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'], // stdin ignored, stdout and stderr piped
      });

      if (debug) {
        console.log('[DEBUG] Child process spawned, PID:', child.pid);
        console.log('[DEBUG] Stdout exists:', !!child.stdout);
        console.log('[DEBUG] Stderr exists:', !!child.stderr);
      }

      // Set up timeout
      const timeout = setTimeout(() => {
        if (debug) {
          console.log('[DEBUG] Timeout reached, killing process');
        }
        child.kill('SIGTERM');
        resolve({
          success: false,
          outputPath,
          error: `Command timed out after ${timeoutMs / 1000} seconds. Consider increasing timeout or checking command execution.`,
        });
      }, timeoutMs);

      // Monitor if data events are being fired
      let stdoutEventCount = 0;
      let stderrEventCount = 0;

      // Handle stdout data (this is where stream-json output goes)
      child.stdout?.on('data', (data: Buffer) => {
        stdoutEventCount++;
        if (debug && stdoutEventCount === 1) {
          console.log('[DEBUG] First stdout data event received!');
        }
        hasOutput = true;
        const chunk = data.toString();
        stdout += chunk;

        // Process each line
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;

          if (debug) {
            console.log('[STDOUT]:', line);
          }

          // Try to parse as JSON
          try {
            const parsed = JSON.parse(line) as unknown;

            // Check if this looks like our final result
            // The W-InputAnalyzer should output a JSON conforming to the schema
            if (
              typeof parsed === 'object' &&
              parsed !== null &&
              'project_name' in parsed &&
              'raw_user_input' in parsed
            ) {
              finalJson = parsed;
              if (debug) {
                console.log('[DEBUG] Found final JSON result with project_name and raw_user_input');
              }
            }

            if (onChunk) {
              onChunk(line);
            }
          } catch {
            // Not JSON or partial line, might be text output
            if (onChunk) {
              onChunk(line);
            }
          }
        }
      });

      // Handle stderr (verbose output and progress goes here)
      child.stderr?.on('data', (data: Buffer) => {
        stderrEventCount++;
        if (debug && stderrEventCount === 1) {
          console.log('[DEBUG] First stderr data event received!');
        }

        hasOutput = true;
        const chunk = data.toString();
        stderr += chunk;

        if (debug) {
          process.stderr.write(chunk); // Write directly to preserve formatting
        }

        if (onStderr) {
          onStderr(chunk);
        }
      });

      child.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn Claude CLI: ${error.message}`));
      });

      child.on('close', (code: number) => {
        clearTimeout(timeout);

        if (debug) {
          console.log(`\n[DEBUG] Process exited with code: ${code}`);
          console.log(`[DEBUG] Has output: ${hasOutput}`);
          console.log(`[DEBUG] Stdout events: ${stdoutEventCount}`);
          console.log(`[DEBUG] Stderr events: ${stderrEventCount}`);
          console.log(`[DEBUG] Stdout length: ${stdout.length}`);
          console.log(`[DEBUG] Stderr length: ${stderr.length}`);
          if (stdout.length > 0) {
            console.log(`[DEBUG] First 500 chars of stdout:`, stdout.substring(0, 500));
          }
        }

        if (code !== 0) {
          resolve({
            success: false,
            outputPath,
            error: `Claude CLI exited with code ${code}${stderr ? `\nStderr: ${stderr}` : ''}${!hasOutput ? '\nNo output received - command may not be executing' : ''}`,
          });
          return;
        }

        if (finalJson === undefined) {
          // Check if output file was created despite missing stream
          if (existsSync(outputPath)) {
            try {
              const fileContent = readFileSync(outputPath, 'utf-8');
              finalJson = JSON.parse(fileContent) as unknown;
              if (debug) {
                console.log('[DEBUG] Loaded JSON from output file');
              }
            } catch {
              // File exists but couldn't parse
            }
          }

          if (finalJson === undefined) {
            resolve({
              success: false,
              outputPath,
              error: `No valid JSON result received from W-InputAnalyzer\nStdout: ${stdout.substring(0, 500)}${stderr ? `\nStderr: ${stderr.substring(0, 500)}` : ''}`,
            });
            return;
          }
        }

        resolve({
          success: true,
          outputPath,
          jsonData: finalJson,
        });
      });
    });
  }

  /**
   * Verify that the output file was created
   */
  verifyFileCreation(outputPath: string): boolean {
    return existsSync(outputPath);
  }

  /**
   * Load and validate JSON against schema
   */
  validateJsonAgainstSchema(jsonData: unknown): { valid: boolean; errors?: string[] } {
    // Load the schema
    if (!existsSync(this.schemaPath)) {
      return {
        valid: false,
        errors: [`Schema file not found at: ${this.schemaPath}`],
      };
    }

    const schemaContent = JSON.parse(readFileSync(this.schemaPath, 'utf-8')) as Record<string, unknown>;

    // Perform basic validation
    const errors: string[] = [];

    if (typeof jsonData !== 'object' || jsonData === null) {
      return {
        valid: false,
        errors: ['Analyzer output is not a JSON object'],
      };
    }

    const record = jsonData as Record<string, unknown>;

    // Check required fields
    const requiredFields = Array.isArray(schemaContent.required)
      ? (schemaContent.required as unknown[])
      : [];

    for (const field of requiredFields) {
      if (typeof field === 'string') {
        if (!(field in record)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    // Check project_name pattern
    const projectName = record.project_name;
    if (typeof projectName === 'string') {
      const pattern = /^[a-z0-9-]+$/;
      if (!pattern.test(projectName)) {
        errors.push(`project_name must match pattern: ^[a-z0-9-]+$`);
      }
      if (projectName.length < 3 || projectName.length > 50) {
        errors.push(`project_name must be between 3 and 50 characters`);
      }
    } else if (projectName !== undefined) {
      errors.push('project_name must be a string');
    }

    // Check raw_user_input length
    const rawInput = record.raw_user_input;
    if (typeof rawInput === 'string') {
      if (rawInput.length < 10 || rawInput.length > 10000) {
        errors.push(`raw_user_input must be between 10 and 10000 characters`);
      }
    } else if (rawInput !== undefined) {
      errors.push('raw_user_input must be a string');
    }

    // Additional validation for array fields
    const arrayFields = [
      'key_objectives',
      'success_criteria',
      'risks_and_mitigations',
      'required_features',
    ];

    for (const field of arrayFields) {
      const value = record[field];
      if (value !== undefined) {
        if (!Array.isArray(value)) {
          errors.push(`${field} must be an array`);
        } else if (value.length === 0) {
          errors.push(`${field} must have at least one item`);
        }
      }
    }

    // Validate ID patterns
    this.validateIdPatterns(record, errors);

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate ID patterns in nested objects
   */
  private validateIdPatterns(record: Record<string, unknown>, errors: string[]): void {
    // Validate objective IDs
    const keyObjectives = record.key_objectives;
    if (Array.isArray(keyObjectives)) {
      keyObjectives.forEach((obj, index) => {
        if (typeof obj === 'object' && obj !== null) {
          const id = (obj as Record<string, unknown>).id;
          if (typeof id === 'string' && !/^OBJ-\d{3}$/.test(id)) {
            errors.push(`key_objectives[${index}].id must match pattern: OBJ-XXX`);
          }
        }
      });
    }

    // Validate technical constraint IDs
    const technicalConstraints = record.technical_constraints;
    if (
      typeof technicalConstraints === 'object' &&
      technicalConstraints !== null &&
      Array.isArray((technicalConstraints as Record<string, unknown>).constraints_list)
    ) {
      const constraints = (technicalConstraints as Record<string, unknown>).constraints_list as unknown[];
      constraints.forEach((tc, index) => {
        if (typeof tc === 'object' && tc !== null) {
          const id = (tc as Record<string, unknown>).id;
          if (typeof id === 'string' && !/^TC-\d{3}$/.test(id)) {
            errors.push(`technical_constraints.constraints_list[${index}].id must match pattern: TC-XXX`);
          }
        }
      });
    }

    // Validate success criteria IDs
    const successCriteria = record.success_criteria;
    if (Array.isArray(successCriteria)) {
      successCriteria.forEach((sc, index) => {
        if (typeof sc === 'object' && sc !== null) {
          const id = (sc as Record<string, unknown>).id;
          if (typeof id === 'string' && !/^SC-\d{3}$/.test(id)) {
            errors.push(`success_criteria[${index}].id must match pattern: SC-XXX`);
          }
        }
      });
    }

    // Validate risk IDs
    const risks = record.risks_and_mitigations;
    if (Array.isArray(risks)) {
      risks.forEach((risk, index) => {
        if (typeof risk === 'object' && risk !== null) {
          const id = (risk as Record<string, unknown>).id;
          if (typeof id === 'string' && !/^RISK-\d{3}$/.test(id)) {
            errors.push(`risks_and_mitigations[${index}].id must match pattern: RISK-XXX`);
          }
        }
      });
    }

    // Validate feature IDs
    const requiredFeatures = record.required_features;
    if (Array.isArray(requiredFeatures)) {
      requiredFeatures.forEach((feat, index) => {
        if (typeof feat === 'object' && feat !== null) {
          const id = (feat as Record<string, unknown>).id;
          if (typeof id === 'string' && !/^FEAT-\d{3}$/.test(id)) {
            errors.push(`required_features[${index}].id must match pattern: FEAT-XXX`);
          }
        }
      });
    }

    // Validate question IDs
    const openQuestions = record.open_questions;
    if (Array.isArray(openQuestions)) {
      openQuestions.forEach((q, index) => {
        if (typeof q === 'object' && q !== null) {
          const id = (q as Record<string, unknown>).id;
          if (typeof id === 'string' && !/^Q-\d{3}$/.test(id)) {
            errors.push(`open_questions[${index}].id must match pattern: Q-XXX`);
          }
        }
      });
    }
  }

  /**
   * Build a shell-safe command string from arguments
   */
  private buildCommandString(args: string[]): string {
    const escapedArgs = args.map((arg) => {
      // If arg contains spaces or special chars, quote it
      if (/[\s'"$`\\]/.test(arg)) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
      }
      return arg;
    });

    return `${this.claudePath} ${escapedArgs.join(' ')}`;
  }

  /**
   * Read JSON file from disk
   */
  readJsonFile(filePath: string): unknown {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as unknown;
  }
}
