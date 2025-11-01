# Orchestrator Flow Summary

## Complete Planner Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                      START ORCHESTRATOR                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Mode Selection│
                    │ Planner/Tasker│
                    └───────┬───────┘
                            │
                        [Planner]
                            │
                            ▼
                ┌───────────────────────┐
                │ Sub-Mode Selection    │
                │ Create/Resume Project │
                └───────┬───────────────┘
                        │
                    [Create]
                        │
                        ▼
        ┌───────────────────────────────────┐
        │ STEP 1: Ask for Project Name      │
        │ Input: "my-awesome-feature"       │
        │ Sanitized: my-awesome-feature     │
        └───────────────┬───────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────┐
        │ STEP 2: Check Git Status          │
        │ • Is git repo?                    │
        │ • Uncommitted changes?            │
        └───────────────┬───────────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
        [Changes?]              [No Changes]
            │                       │
            ▼                       │
    ┌──────────────────┐           │
    │ Commit Options:  │           │
    │ • Auto-commit    │           │
    │ • Manual (exit)  │           │
    │ • Skip (risky)   │           │
    └─────────┬────────┘           │
              │                     │
        [Auto/Skip]                 │
              │                     │
              └──────────┬──────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │ STEP 3: Create/Switch to Branch    │
        │ Branch: my-awesome-feature         │
        │ • Create if not exists             │
        │ • Switch if exists (confirm)       │
        └────────────────┬───────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │ STEP 4: Collect User Request       │
        │ Prompt: "Your request:"            │
        │ Input: user_input variable         │
        │ • Stored in project metadata       │
        │ • Available to all agents          │
        └────────────────┬───────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │ STEP 5: Initialize Project         │
        │ • Create .orchestrator/project.json│
        │ • Store: name, branch, user_input  │
        └────────────────┬───────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │ STEP 6: Configure Agents           │
        │ Display: user_input context        │
        │ For each agent:                    │
        │  • Name                            │
        │  • Prompt                          │
        │  • Allowed tools                   │
        │  • System prompt                   │
        │  • Model                           │
        └────────────────┬───────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │ STEP 7: Execution Mode Selection   │
        │ • Sequential (pass outputs)        │
        │ • Parallel (independent)           │
        └────────────────┬───────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │ STEP 8: Execute Agents             │
        │ • Stream output to console         │
        │ • Save to .orchestrator/outputs/   │
        │ • Pass between agents (sequential) │
        └────────────────┬───────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │ STEP 9: Display Summary            │
        │ • Total agents executed            │
        │ • Success/failure count            │
        │ • Total cost (USD)                 │
        │ • Total time                       │
        └────────────────────────────────────┘
```

## Key Variables Tracked

```typescript
{
  // Project identification
  projectName: string;           // User-provided name
  branchName: string;            // Git-sanitized branch name

  // Core input
  userInput: string;             // 🎯 User's request/implementation target
  description?: string;          // Optional short description

  // Git context
  currentBranch: string;         // Original branch before creation
  hasUncommittedChanges: boolean;
  commitMode?: 'auto'|'manual'|'skip';

  // Agent execution
  agents: AgentConfig[];         // List of configured agents
  executionMode: 'sequential'|'parallel';

  // Results
  sessions: Map<agentName, sessionId>;
  outputs: Map<agentName, AgentOutput[]>;
}
```

## Resume Project Flow

```
┌─────────────────────────────────┐
│ Resume Existing Project         │
└────────────┬────────────────────┘
             │
             ▼
    ┌────────────────────┐
    │ List Projects      │
    │ Select from list   │
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────────────┐
    │ Load Project State         │
    │ • projectName              │
    │ • branchName               │
    │ • user_input (display)     │
    │ • sessions (restored)      │
    │ • outputs (available)      │
    └────────┬───────────────────┘
             │
             ▼
    ┌────────────────────────────┐
    │ Configure Additional Agents│
    │ Context: user_input shown  │
    │ Previous outputs available │
    └────────┬───────────────────┘
             │
             ▼
         [Execute]
```

## Tasker Mode Flow

```
┌─────────────────────────────────┐
│ Tasker Mode                     │
└────────────┬────────────────────┘
             │
             ▼
    ┌────────────────────┐
    │ Collect User Input │
    │ user_input variable│
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────────────┐
    │ Create Temp Project        │
    │ ID: tasker_<timestamp>     │
    │ Store: user_input          │
    └────────┬───────────────────┘
             │
             ▼
    ┌────────────────────────────┐
    │ Configure Agents           │
    │ First agent auto-populated │
    │ with user_input as prompt  │
    └────────┬───────────────────┘
             │
             ▼
         [Execute]
```

## File System Structure

```
project-root/
├── .orchestrator/
│   ├── projects/
│   │   ├── my-awesome-feature.json    # Project state
│   │   ├── test-project.json
│   │   └── tasker_1234567890.json
│   └── outputs/
│       ├── my-awesome-feature/
│       │   ├── agent_1_<timestamp>.json
│       │   ├── agent_2_<timestamp>.json
│       │   └── agent_1_all.json
│       └── test-project/
│           └── ...
└── scripts/orchestrator/
    ├── dist/                   # Compiled JS
    ├── index.ts               # Main entry point
    ├── orchestrator.ts        # Core logic
    ├── process-manager.ts     # Claude CLI spawning
    ├── state-manager.ts       # State persistence
    ├── output-handler.ts      # Output management
    ├── git-utils.ts           # Git operations
    └── types.ts               # TypeScript types
```

## Project State Example

```json
{
  "projectId": "my-awesome-feature",
  "createdAt": "2025-10-31T15:30:00.000Z",
  "updatedAt": "2025-10-31T15:45:00.000Z",
  "metadata": {
    "description": "Add dark mode",
    "branchName": "my-awesome-feature",
    "userInput": "Implement dark mode toggle with system preference detection and local storage persistence"
  },
  "sessions": {
    "agent_1": "session_abc123",
    "agent_2": "session_def456"
  },
  "outputs": {
    "agent_1": [
      {
        "agentName": "agent_1",
        "sessionId": "session_abc123",
        "result": "Analysis complete...",
        "isError": false,
        "totalCostUsd": 0.0023,
        "durationMs": 1234,
        "timestamp": "2025-10-31T15:35:00.000Z"
      }
    ]
  }
}
```

## user_input Usage

The `user_input` variable is used throughout the orchestration:

1. **Storage**: Stored in project metadata
2. **Display**: Shown when configuring agents
3. **Context**: Available to agents as `initialInput` parameter
4. **Resume**: Displayed when resuming a project
5. **Agent Prompts**: Can be used as the first agent's prompt (Tasker mode)

Example agent configuration with user_input:

```typescript
// Planner mode - user_input available as context
const agents = [
  {
    name: "analyzer",
    prompt: "Based on the user request, analyze the codebase",
    // user_input: "Implement dark mode..." is available in context
  },
  {
    name: "implementer",
    prompt: "Implement the requested feature",
    // Previous agent's output + user_input context
  }
];

// Tasker mode - user_input used as first prompt
const agents = [
  {
    name: "agent_1",
    prompt: userInput, // "Implement dark mode..." directly used
  }
];
```
