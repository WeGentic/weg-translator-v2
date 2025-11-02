/**
 * Output Handler for streaming, storing, and passing outputs between agents
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { AgentOutput } from './types.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Handles output from Claude Code executions
 */
export class OutputHandler {
  /**
   * Stream output to console with colored labels
   */
  streamToConsole(agentName: string, content: string, isError: boolean = false): void {
    const label = chalk.cyan(`[${agentName}]`);
    const timestamp = chalk.gray(new Date().toISOString());

    if (isError) {
      console.error(`${timestamp} ${label} ${chalk.red(content)}`);
    } else {
      console.log(`${timestamp} ${label} ${content}`);
    }
  }

  /**
   * Stream a chunk of JSON output
   */
  streamJsonChunk(agentName: string, jsonLine: string): void {
    try {
      const parsed = JSON.parse(jsonLine) as unknown;

      if (isRecord(parsed)) {
        const typeValue = typeof parsed.type === 'string' ? parsed.type : undefined;
        const contentValue = typeof parsed.content === 'string' ? parsed.content : undefined;
        const hasResult = 'result' in parsed && parsed.result !== undefined;

        if (typeValue === 'message') {
          this.streamToConsole(agentName, contentValue ?? JSON.stringify(parsed));
        } else if (hasResult) {
          this.streamToConsole(agentName, chalk.green('✓ Completed'));
        } else {
          this.streamToConsole(agentName, chalk.dim(JSON.stringify(parsed)));
        }
      } else {
        this.streamToConsole(agentName, chalk.dim(jsonLine));
      }
    } catch {
      // Not JSON, just output as-is
      this.streamToConsole(agentName, jsonLine);
    }
  }

  /**
   * Save output to a file
   */
  saveToFile(output: AgentOutput, outputDir: string): string {
    const filename = `${output.agentName}_${output.timestamp.getTime()}.json`;
    const filepath = join(outputDir, filename);

    const data = {
      agentName: output.agentName,
      sessionId: output.sessionId,
      result: output.result,
      isError: output.isError,
      totalCostUsd: output.totalCostUsd,
      durationMs: output.durationMs,
      timestamp: output.timestamp.toISOString(),
      rawOutput: output.rawOutput,
    };

    writeFileSync(filepath, JSON.stringify(data, null, 2));
    return filepath;
  }

  /**
   * Save all outputs for an agent to a single file
   */
  saveAgentOutputs(agentName: string, outputs: AgentOutput[], outputDir: string): string {
    const filename = `${agentName}_all.json`;
    const filepath = join(outputDir, filename);

    const data = outputs.map(output => ({
      sessionId: output.sessionId,
      result: output.result,
      isError: output.isError,
      totalCostUsd: output.totalCostUsd,
      durationMs: output.durationMs,
      timestamp: output.timestamp.toISOString(),
    }));

    writeFileSync(filepath, JSON.stringify(data, null, 2));
    return filepath;
  }

  /**
   * Extract and format output for passing to the next agent
   */
  prepareOutputForNextAgent(output: AgentOutput): string {
    if (output.isError) {
      return `Previous agent (${output.agentName}) encountered an error: ${output.result}`;
    }

    return `Output from ${output.agentName}:\n\n${output.result}`;
  }

  /**
   * Create a system prompt from previous agent outputs
   */
  createSystemPromptFromOutputs(outputs: AgentOutput[]): string {
    const sections = outputs
      .filter(output => !output.isError)
      .map(output => {
        return `## Output from ${output.agentName}\n\n${output.result}`;
      });

    if (sections.length === 0) {
      return '';
    }

    return `# Previous Agent Outputs\n\n${sections.join('\n\n---\n\n')}`;
  }

  /**
   * Display a summary of execution results
   */
  displaySummary(outputs: AgentOutput[]): void {
    console.log('\n' + chalk.bold.cyan('═'.repeat(80)));
    console.log(chalk.bold.cyan('  Execution Summary'));
    console.log(chalk.bold.cyan('═'.repeat(80)) + '\n');

    let totalCost = 0;
    let totalDuration = 0;
    let successCount = 0;
    let errorCount = 0;

    for (const output of outputs) {
      totalCost += output.totalCostUsd;
      totalDuration += output.durationMs;

      if (output.isError) {
        errorCount++;
        console.log(chalk.red(`  ✗ ${output.agentName}`));
        console.log(chalk.dim(`    Error: ${output.result.substring(0, 100)}...`));
      } else {
        successCount++;
        console.log(chalk.green(`  ✓ ${output.agentName}`));
        console.log(chalk.dim(`    Duration: ${output.durationMs}ms`));
      }
    }

    console.log('\n' + chalk.bold('Statistics:'));
    console.log(`  Total agents: ${chalk.cyan(outputs.length.toString())}`);
    console.log(`  Successful: ${chalk.green(successCount.toString())}`);
    console.log(`  Failed: ${chalk.red(errorCount.toString())}`);
    console.log(`  Total cost: ${chalk.yellow(`$${totalCost.toFixed(4)}`)}`);
    console.log(`  Total time: ${chalk.yellow(`${(totalDuration / 1000).toFixed(2)}s`)}`);
    console.log('\n' + chalk.bold.cyan('═'.repeat(80)) + '\n');
  }

  /**
   * Display an error message
   */
  displayError(agentName: string, error: Error): void {
    console.error('\n' + chalk.red.bold('═'.repeat(80)));
    console.error(chalk.red.bold(`  Error in ${agentName}`));
    console.error(chalk.red.bold('═'.repeat(80)));
    console.error(chalk.red(error.message));
    console.error(chalk.red.bold('═'.repeat(80)) + '\n');
  }

  /**
   * Display a header for an agent execution
   */
  displayAgentHeader(agentName: string, index: number, total: number): void {
    console.log('\n' + chalk.blue('─'.repeat(80)));
    console.log(chalk.blue.bold(`  Agent ${index + 1}/${total}: ${agentName}`));
    console.log(chalk.blue('─'.repeat(80)) + '\n');
  }
}
