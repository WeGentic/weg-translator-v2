#!/usr/bin/env node

/**
 * Test git utilities for the orchestrator
 */

import { GitUtils } from './dist/git-utils.js';
import chalk from 'chalk';

console.log(chalk.cyan.bold('🧪 Testing Git Utilities...\n'));

const gitUtils = new GitUtils();

// Test 1: Check if this is a git repository
console.log(chalk.yellow('Test 1: Checking if current directory is a git repo...'));
const isRepo = await gitUtils.isGitRepository();

if (isRepo) {
  console.log(chalk.green('✓ This is a git repository\n'));

  // Test 2: Get current status
  console.log(chalk.yellow('Test 2: Getting git status...'));
  const status = await gitUtils.getStatus();
  console.log(chalk.green('✓ Status retrieved successfully\n'));
  console.log(chalk.dim(gitUtils.formatStatus(status)));

  // Test 3: Test branch name sanitization
  console.log(chalk.yellow('\nTest 3: Testing branch name sanitization...'));
  const testNames = [
    'My Project Name',
    'Feature/New-Stuff',
    'test@#$%special',
    'normal-branch-name',
  ];

  for (const name of testNames) {
    const sanitized = gitUtils.sanitizeBranchName(name);
    console.log(chalk.dim(`  "${name}" → "${sanitized}"`));
  }
  console.log(chalk.green('✓ Branch name sanitization works\n'));

  // Test 4: List branches
  console.log(chalk.yellow('Test 4: Listing branches...'));
  const branches = await gitUtils.listBranches();
  console.log(chalk.green(`✓ Found ${branches.length} branches:`));
  branches.slice(0, 5).forEach(branch => {
    console.log(chalk.dim(`  - ${branch}`));
  });
  if (branches.length > 5) {
    console.log(chalk.dim(`  ... and ${branches.length - 5} more`));
  }
  console.log('');

  // Summary
  console.log(chalk.cyan.bold('📊 Git Status Summary:'));
  console.log(chalk.dim(`  Current branch: ${status.currentBranch}`));
  console.log(chalk.dim(`  Uncommitted changes: ${status.hasUncommittedChanges ? 'Yes' : 'No'}`));
  console.log(chalk.dim(`  Staged files: ${status.stagedFiles.length}`));
  console.log(chalk.dim(`  Unstaged files: ${status.unstagedFiles.length}`));
  console.log(chalk.dim(`  Untracked files: ${status.untrackedFiles.length}`));
  console.log('');

} else {
  console.log(chalk.red('✗ This is NOT a git repository\n'));
  console.log(chalk.yellow('Note: Git workflow features will be skipped when running in non-git directories.\n'));
}

console.log(chalk.green('✅ All git utility tests passed!\n'));
