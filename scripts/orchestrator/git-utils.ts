/**
 * Git utilities for orchestrator
 */

import { spawn } from 'child_process';

export interface GitStatus {
  hasUncommittedChanges: boolean;
  currentBranch: string;
  stagedFiles: string[];
  unstagedFiles: string[];
  untrackedFiles: string[];
}

export interface CommitOptions {
  message: string;
  addAll?: boolean;
}

/**
 * Git operations manager
 */
export class GitUtils {
  /**
   * Execute a git command and return the output
   */
  private async execGit(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const child = spawn('git', args, {
        cwd: process.cwd(),
        env: process.env,
      });

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error: Error) => {
        reject(new Error(`Failed to execute git: ${error.message}`));
      });

      child.on('close', (code: number) => {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code });
      });
    });
  }

  /**
   * Check if current directory is a git repository
   */
  async isGitRepository(): Promise<boolean> {
    try {
      const result = await this.execGit(['rev-parse', '--git-dir']);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Get current git status
   */
  async getStatus(): Promise<GitStatus> {
    const isRepo = await this.isGitRepository();
    if (!isRepo) {
      throw new Error('Not a git repository');
    }

    // Get current branch
    const branchResult = await this.execGit(['branch', '--show-current']);
    const currentBranch = branchResult.stdout;

    // Get status in porcelain format
    const statusResult = await this.execGit(['status', '--porcelain']);
    const statusLines = statusResult.stdout.split('\n').filter(line => line.trim());

    const stagedFiles: string[] = [];
    const unstagedFiles: string[] = [];
    const untrackedFiles: string[] = [];

    for (const line of statusLines) {
      const status = line.substring(0, 2);
      const file = line.substring(3);

      if (status === '??') {
        untrackedFiles.push(file);
      } else if (status[0] !== ' ' && status[0] !== '?') {
        stagedFiles.push(file);
      } else if (status[1] !== ' ' && status[1] !== '?') {
        unstagedFiles.push(file);
      }
    }

    const hasUncommittedChanges = stagedFiles.length > 0 || unstagedFiles.length > 0 || untrackedFiles.length > 0;

    return {
      hasUncommittedChanges,
      currentBranch,
      stagedFiles,
      unstagedFiles,
      untrackedFiles,
    };
  }

  /**
   * Stage all changes
   */
  async addAll(): Promise<void> {
    await this.execGit(['add', '.']);
  }

  /**
   * Create a commit
   */
  async commit(options: CommitOptions): Promise<void> {
    if (options.addAll) {
      await this.addAll();
    }

    const result = await this.execGit(['commit', '-m', options.message]);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to create commit: ${result.stderr || result.stdout}`);
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(branchName: string, checkout: boolean = true): Promise<void> {
    // Check if branch already exists
    const branchExists = await this.branchExists(branchName);

    if (branchExists) {
      throw new Error(`Branch "${branchName}" already exists`);
    }

    // Create and optionally checkout the branch
    if (checkout) {
      const result = await this.execGit(['checkout', '-b', branchName]);
      if (result.exitCode !== 0) {
        throw new Error(`Failed to create branch: ${result.stderr || result.stdout}`);
      }
    } else {
      const result = await this.execGit(['branch', branchName]);
      if (result.exitCode !== 0) {
        throw new Error(`Failed to create branch: ${result.stderr || result.stdout}`);
      }
    }
  }

  /**
   * Check if a branch exists
   */
  async branchExists(branchName: string): Promise<boolean> {
    try {
      const result = await this.execGit(['rev-parse', '--verify', branchName]);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Checkout a branch
   */
  async checkoutBranch(branchName: string): Promise<void> {
    const result = await this.execGit(['checkout', branchName]);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to checkout branch: ${result.stderr || result.stdout}`);
    }
  }

  /**
   * Get list of all branches
   */
  async listBranches(): Promise<string[]> {
    const result = await this.execGit(['branch', '--list']);

    return result.stdout
      .split('\n')
      .map(line => line.trim().replace(/^\*\s*/, ''))
      .filter(line => line.length > 0);
  }

  /**
   * Sanitize a branch name to be git-compliant
   */
  sanitizeBranchName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Sanitize a project name to be filesystem-compliant (kebab-case)
   */
  sanitizeProjectName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_\s]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50); // Limit to 50 characters as per schema
  }

  /**
   * Format status for display
   */
  formatStatus(status: GitStatus): string {
    const lines: string[] = [];

    lines.push(`Current branch: ${status.currentBranch || '(detached HEAD)'}`);

    if (status.stagedFiles.length > 0) {
      lines.push(`\nStaged files (${status.stagedFiles.length}):`);
      status.stagedFiles.forEach(file => lines.push(`  + ${file}`));
    }

    if (status.unstagedFiles.length > 0) {
      lines.push(`\nUnstaged files (${status.unstagedFiles.length}):`);
      status.unstagedFiles.forEach(file => lines.push(`  M ${file}`));
    }

    if (status.untrackedFiles.length > 0) {
      lines.push(`\nUntracked files (${status.untrackedFiles.length}):`);
      status.untrackedFiles.forEach(file => lines.push(`  ? ${file}`));
    }

    return lines.join('\n');
  }
}
