# Claude Code Orchestrator

A deterministic TypeScript orchestrator for running Claude Code CLI instances in headless mode with context isolation and flexible agent execution (sequential/parallel).

## Features

- **Dual Modes**: Planner (project management) and Tasker (direct task execution)
- **Git-Aware Workflow**: Automatic git status checking, commit handling, and branch creation
- **Context Isolation**: Each agent runs with controlled tool access and isolated sessions
- **Flexible Execution**: Run agents sequentially (with output passing) or in parallel
- **State Management**: Persistent project state with resume capability
- **Output Handling**: Stream to console, save to files, and pass between agents
- **Session Tracking**: Maintains conversation continuity across agent executions

## Prerequisites

- Node.js 18+ with TypeScript support
- Claude Code CLI installed and available in PATH
- Valid Claude API credentials configured

## Installation

1. Navigate to the orchestrator directory:
```bash
cd scripts/orchestrator
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Usage

### Start the Orchestrator

```bash
npm start
# or
npm run dev
```

### Mode: Planner

Planner mode provides structured project management with git-aware workflow:

#### **Create New Project** (Git-Aware)

The deterministic workflow follows these steps:

1. **Ask for Project Name**
   - Enter a descriptive project name
   - Automatically sanitized for use as a git branch name
   - Example: "My Project Name" → `my-project-name`

2. **Check for Uncommitted Changes**
   - Automatically scans git status
   - If uncommitted changes exist, presents three options:
     - **Commit automatically**: Auto-commit all changes with a custom message
     - **Commit manually**: Exit and let you commit manually
     - **Skip (risky)**: Continue without committing (not recommended)
   - Shows detailed status: staged, unstaged, and untracked files

3. **Create Git Branch**
   - Creates a new branch using the sanitized project name
   - Automatically switches to the new branch
   - If branch exists, offers to switch to it

4. **Collect User Request**
   - Prompts for detailed description of the target implementation or feature
   - Stored as `user_input` variable in project metadata
   - Available as context for all agents during execution

5. **Initialize Orchestrator Project**
   - Creates project state in `.orchestrator/`
   - Tracks branch name, description, and user_input
   - Ready for agent configuration with full context

**Non-Git Directories**: If not in a git repository, steps 2-3 are automatically skipped.

#### **Resume Existing Project**

   - Lists available projects
   - Restores session state and history
   - Continues from previous execution context

### Mode: Tasker

Tasker mode allows direct task execution:

1. Provide initial user input
2. Configure agent(s) step-by-step
3. Execute and monitor results

## Agent Configuration

When configuring agents, you provide:

- **Name**: Unique identifier for the agent
- **Prompt**: The task/question for Claude
- **Allowed Tools**: Comma-separated list (e.g., "Read,Write,Bash") or empty for all
- **System Prompt**: Optional additional instructions
- **Model**: sonnet (default), haiku, or opus

## Execution Modes

### Sequential Execution
- Agents run one after another
- Output from each agent is passed to the next
- Stops on first error
- Ideal for multi-step workflows

### Parallel Execution
- All agents run simultaneously
- Independent contexts
- Faster for unrelated tasks
- Returns when all complete

## Output Management

### Streaming
Real-time console output with:
- Color-coded agent labels
- Timestamps
- Execution summaries

### File Storage
Outputs saved to `.orchestrator/outputs/<project-id>/`:
- Individual execution results
- Aggregated agent outputs
- JSON format for programmatic access

### Output Passing
In sequential mode, results from agent N become context for agent N+1:
```
Agent 1: Analyze code
  ↓ (output)
Agent 2: Generate tests based on analysis
  ↓ (output)
Agent 3: Review tests for completeness
```

## Project State

State is persisted in `.orchestrator/`:
```
.orchestrator/
├── projects/
│   ├── project_123.json    # Project state
│   └── project_456.json
└── outputs/
    ├── project_123/
    │   ├── agent_1_<timestamp>.json
    │   └── agent_2_<timestamp>.json
    └── project_456/
        └── ...
```

## Example Workflows

### Code Review Pipeline (Sequential)
```
Agent 1: "Analyze the authentication module for security issues"
Agent 2: "Based on the analysis, suggest fixes for identified issues"
Agent 3: "Review the suggested fixes for completeness"
```

### Multi-Feature Analysis (Parallel)
```
Agent 1: "Test user authentication flow"
Agent 2: "Test file upload functionality"
Agent 3: "Test API endpoints"
```

## Architecture

### Core Components

- **index.ts**: CLI interface with interactive prompts and git workflow
- **orchestrator.ts**: Execution engine and coordination
- **process-manager.ts**: Claude CLI process spawning with path detection
- **state-manager.ts**: Persistent session and output tracking
- **output-handler.ts**: Console streaming and file operations
- **git-utils.ts**: Git operations (status, commit, branch management)
- **types.ts**: TypeScript interfaces and type definitions

### Git Integration

The orchestrator includes comprehensive git utilities:

- **Status Checking**: Detects staged, unstaged, and untracked files
- **Commit Management**: Auto-commit with custom messages or manual workflow
- **Branch Operations**: Create, check existence, checkout, and list branches
- **Name Sanitization**: Converts project names to git-compliant branch names
- **Repository Detection**: Gracefully handles non-git directories

#### Branch Name Sanitization

Project names are automatically converted to valid git branch names:
- Converts to lowercase
- Replaces special characters with hyphens
- Removes leading/trailing hyphens
- Example: "My Project #1" → `my-project-1`

### Claude CLI Integration

Uses headless mode with flags:
- `claude -p "<prompt>"`: Non-interactive execution
- `--output-format json`: Structured output
- `--resume <session_id>`: Continue conversations
- `--append-system-prompt`: Inject context
- `--allowedTools`: Restrict tool access
- `--model`: Select AI model

## Development

### Build
```bash
npm run build
```

### Clean
```bash
npm run clean
```

### Project Structure
```
scripts/orchestrator/
├── index.ts              # Entry point with CLI UI
├── orchestrator.ts       # Core orchestration logic
├── process-manager.ts    # Claude CLI spawning
├── state-manager.ts      # Session and output tracking
├── output-handler.ts     # Output streaming and storage
├── git-utils.ts          # Git operations (status, commit, branch)
├── types.ts              # TypeScript interfaces
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
├── test-basic.js         # Basic functionality tests
├── test-git.js           # Git utilities tests
└── README.md             # This file
```

## Limitations

- Claude CLI must be installed and accessible
- Headless mode does not persist between CLI restarts
- Context isolation is advisory (tool restrictions via flags)
- Parallel execution does not support output passing

## Troubleshooting

### "Claude CLI is not available"
Ensure Claude Code CLI is installed:
```bash
which claude
```

### "Failed to spawn Claude CLI"
Check PATH and permissions:
```bash
claude --help
```

### "No valid JSON result found"
Enable verbose mode for debugging:
- Set `verbose: true` in ProcessOptions
- Check stderr output for errors

## Contributing

This orchestrator is designed to be extended. Consider adding:
- Agent templates/presets
- Custom output formatters
- Webhook notifications
- CI/CD integration
- Agent chaining DSL

## License

Part of the Weg-Translator-Tauri project.
