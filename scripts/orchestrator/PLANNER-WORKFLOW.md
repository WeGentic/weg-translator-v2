# Planner Mode: Git-Aware Workflow

This document details the deterministic workflow for creating a new project in Planner mode.

## Complete Flow

### Step 0: Initial Mode Selection

```
╔═══════════════════════════════════════════════════════════════╗
║           Claude Code Orchestrator v1.0.0                     ║
╚═══════════════════════════════════════════════════════════════╝

Choose Mode:
❯ Planner  - Plan and manage projects
  Tasker   - Execute tasks with agents
```

Select **Planner**.

---

### Step 1: Choose Planner Sub-Mode

```
## Choose Mode
Please choose one of the following modes by replying with the corresponding letter:

A. Create new Project
B. Resume an existing Project

Select option:
❯ A. Create new Project
  B. Resume existing Project
```

Select **A. Create new Project**.

---

### Step 2: Enter Project Information

```
## Create New Project

? Project name: › my-awesome-feature
? Project description (optional): › Add dark mode support to the UI
```

**Input:**
- Project name: `my-awesome-feature`
- Description: `Add dark mode support to the UI`

---

### Step 3: Git Status Check (Automatic)

```
## Checking Git Status...

⚠ You have uncommitted changes:

Current branch: main

Staged files (2):
  + src/components/Button.tsx
  + src/styles/theme.css

Unstaged files (3):
  M src/App.tsx
  M src/utils/helpers.ts
  M README.md

Untracked files (5):
  ? .orchestrator/
  ? scripts/orchestrator/
  ? test-output.json
  ? docs/architecture.md
  ? .env.local
```

---

### Step 4: Handle Uncommitted Changes

```
? How would you like to handle these changes?
❯ Commit automatically - Auto-commit all changes with a default message
  Commit manually - Exit so you can commit manually
  Skip (risky) - Continue without committing (not recommended)
```

#### Option A: Commit Automatically

```
? Commit message: › chore: save work before starting my-awesome-feature

📝 Committing changes...

✓ Changes committed successfully!
```

#### Option B: Commit Manually

```
⚠ Please commit your changes manually and run the orchestrator again.
  git add .
  git commit -m "your message"

[Process exits with code 0]
```

User must manually commit:
```bash
git add .
git commit -m "chore: save work in progress"
npm start  # Re-run orchestrator
```

#### Option C: Skip (Risky)

```
⚠ Continuing without committing (not recommended)
```

Proceeds to next step with uncommitted changes (not recommended for production workflows).

---

### Step 5: Create Git Branch (Automatic)

```
## Creating branch: my-awesome-feature

✓ Created and switched to branch "my-awesome-feature"
```

If the branch already exists:

```
## Creating branch: my-awesome-feature

? Branch "my-awesome-feature" already exists. Switch to it? (Y/n) › Yes
```

- **Yes**: Switches to existing branch
- **No**: Cancels project creation

---

### Step 6: Collect User Request/Target Implementation

```
## User Request

Please describe your request, target implementation, or feature:

? Your request: › Implement dark mode toggle with system preference detection and local storage persistence
```

**Input stored as `user_input` variable**:
```
"Implement dark mode toggle with system preference detection and local storage persistence"
```

This input is:
- ✅ Stored in project metadata
- ✅ Available to all agents as context
- ✅ Displayed when resuming the project
- ✅ Used as initial prompt for first agent (optional)

---

### Step 7: Project Initialized

```
✓ Project "my-awesome-feature" created successfully!

## Configure Agents

Context (user_input):
"Implement dark mode toggle with system preference detection and local storage persistence"

You will now define the agents to execute step by step.
```

Now you proceed to configure agents with the user_input context available.

---

## Non-Git Directory Behavior

If the orchestrator is run in a directory that is **not** a git repository:

```
## Create New Project

? Project name: › my-awesome-feature
? Project description (optional): › Add dark mode support

## Checking Git Status...

⚠ Not a git repository. Skipping git workflow.

✓ Project "my-awesome-feature" created successfully!

## Configure Agents

You will now define the agents to execute step by step.
```

Steps 2-5 (git operations) are automatically skipped.

---

## Git Status Display Format

### Clean Repository

```
## Checking Git Status...

✓ No uncommitted changes

## Creating branch: my-awesome-feature
```

### Repository with Only Staged Files

```
## Checking Git Status...

⚠ You have uncommitted changes:

Current branch: main

Staged files (3):
  + src/new-feature.ts
  + tests/new-feature.test.ts
  + docs/feature-spec.md
```

### Repository with Only Unstaged Files

```
## Checking Git Status...

⚠ You have uncommitted changes:

Current branch: main

Unstaged files (2):
  M src/App.tsx
  M README.md
```

### Repository with Only Untracked Files

```
## Checking Git Status...

⚠ You have uncommitted changes:

Current branch: main

Untracked files (4):
  ? temp/
  ? scratch.js
  ? notes.txt
  ? .env.local
```

---

## Branch Name Sanitization Examples

| Project Name Input          | Sanitized Branch Name      |
|-----------------------------|----------------------------|
| `My Awesome Feature`        | `my-awesome-feature`       |
| `Feature/User-Auth`         | `feature-user-auth`        |
| `Fix #123: Bug in UI`       | `fix-123-bug-in-ui`        |
| `Support @mentions`         | `support-mentions`         |
| `Add $special% chars!`      | `add-special-chars`        |
| `---Leading-Hyphens---`     | `leading-hyphens`          |

---

## Complete Success Flow Example

```
╔═══════════════════════════════════════════════════════════════╗
║           Claude Code Orchestrator v1.0.0                     ║
╚═══════════════════════════════════════════════════════════════╝

? Choose Mode: › Planner

## Choose Mode
? Select option: › A. Create new Project

## Create New Project

? Project name: › add-user-authentication
? Project description (optional): › Implement JWT-based user authentication

## Checking Git Status...

✓ No uncommitted changes

## Creating branch: add-user-authentication

✓ Created and switched to branch "add-user-authentication"

## User Request

Please describe your request, target implementation, or feature:

? Your request: › Implement JWT-based authentication with refresh token support, secure password hashing using bcrypt, and protected API routes with role-based access control

✓ Project "add-user-authentication" created successfully!

## Configure Agents

Context (user_input):
"Implement JWT-based authentication with refresh token support, secure password hashing using bcrypt, and protected API routes with role-based access control"

You will now define the agents to execute step by step.

--- Agent 1 ---

? Agent name: › code-analyzer
? Agent prompt: › Analyze the current authentication setup
? Allowed tools (comma-separated, leave empty for all): › Read,Grep,WebSearch
? System prompt (optional): ›
? Model: › Sonnet (default)

? Add another agent? (y/N) › no

? Execution mode: › Sequential (pass outputs)
? Stream output to console? (Y/n) › yes
? Save outputs to files? (Y/n) › yes

## Executing Agents...

[Agent execution begins...]
```

---

## Error Handling

### Git Command Fails

```
## Creating branch: my-feature

✗ Failed to create branch: fatal: A branch named 'my-feature' already exists.

[Process exits with code 1]
```

### Commit Fails

```
📝 Committing changes...

✗ Failed to commit: nothing to commit, working tree clean

[Process exits with code 1]
```

---

## Deterministic Guarantees

The Planner workflow is **fully deterministic**:

1. **Same inputs = Same outputs**: Given the same project name and commit choices, the orchestrator will always produce the same branch and project state.

2. **No hidden state**: All decisions are explicit user choices (no random defaults).

3. **Predictable flow**: The flow always follows the same sequence:
   - Ask project name
   - Check git status
   - Handle changes (if any)
   - Create branch (if git repo)
   - Ask for user request/target implementation
   - Initialize project with user_input
   - Configure agents with user_input context

4. **Clear exit points**: The process only exits at explicit user cancellation or unrecoverable errors.

5. **Idempotent operations**: Re-running with the same project name on an existing branch offers to switch (no silent failures).

---

## Testing the Workflow

You can test the git utilities without running the full orchestrator:

```bash
cd scripts/orchestrator
node test-git.js
```

This will show:
- Whether you're in a git repository
- Current git status
- Branch name sanitization examples
- List of existing branches
- Status summary

---

## Integration with Agent Execution

After the git-aware setup completes, the normal agent configuration flow begins. The project metadata now includes:

```json
{
  "projectId": "add-user-authentication",
  "createdAt": "2025-10-31T...",
  "updatedAt": "2025-10-31T...",
  "metadata": {
    "description": "Implement JWT-based user authentication",
    "branchName": "add-user-authentication",
    "userInput": "Implement JWT-based authentication with refresh token support, secure password hashing using bcrypt, and protected API routes with role-based access control"
  },
  "sessions": {},
  "outputs": {}
}
```

Key metadata fields:
- **`branchName`**: The git branch created for this project (for reference and future git operations)
- **`userInput`**: The user's complete request/target implementation description (available as context for all agents)
- **`description`**: Optional short description provided during project creation
