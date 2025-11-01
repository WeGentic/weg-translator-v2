#!/usr/bin/env node

/**
 * Basic verification test for the orchestrator
 */

import { ProcessManager } from './dist/process-manager.js';
import { StateManager } from './dist/state-manager.js';
import { OutputHandler } from './dist/output-handler.js';
import { Orchestrator } from './dist/orchestrator.js';

console.log('🧪 Testing Claude Code Orchestrator...\n');

// Test 1: Check if modules load correctly
console.log('✓ All modules imported successfully');

// Test 2: Check Claude CLI availability
const processManager = new ProcessManager();
const isAvailable = await processManager.checkClaudeAvailable();

if (isAvailable) {
  console.log('✓ Claude CLI is available');
} else {
  console.log('✗ Claude CLI is NOT available');
  console.log('  Please ensure Claude Code CLI is installed and in your PATH');
  process.exit(1);
}

// Test 3: Create state manager instance
new StateManager('.orchestrator-test');
console.log('✓ StateManager initialized');

// Test 4: Create output handler instance
new OutputHandler();
console.log('✓ OutputHandler initialized');

// Test 5: Create orchestrator instance
const orchestrator = new Orchestrator('.orchestrator-test');
console.log('✓ Orchestrator initialized');

// Test 6: List projects (should be empty initially)
const projects = orchestrator.listProjects();
console.log(`✓ Found ${projects.length} existing projects`);

console.log('\n✅ All basic tests passed!');
console.log('\nYou can now run the full orchestrator with:');
console.log('  npm start\n');

// Cleanup test directory
import { rmSync, existsSync } from 'fs';
if (existsSync('.orchestrator-test')) {
  rmSync('.orchestrator-test', { recursive: true, force: true });
  console.log('🧹 Cleaned up test directory\n');
}
