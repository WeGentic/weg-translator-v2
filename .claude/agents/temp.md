# LLM-Friendly Task File Schema

## Critical Output Requirement

This task file will be parsed by automated systems. The output must be valid JSON conforming exactly to the schema below.

**Output Format:**
1. Begin with `{` (opening brace)
2. Include all required sections in one continuous JSON structure
3. End with `}` (closing brace)
4. No text before or after the JSON

**Validation Checklist:**
- [ ] All required fields present (marked with ⚠️)
- [ ] Step IDs match pattern "S1", "S2", "S3" (capital S + number, no leading zeros for 1-9)
- [ ] Enum values match exactly (case-sensitive)
- [ ] Arrays have at least minimum items where specified
- [ ] Proper JSON escaping for quotes and special characters

---

## Schema Structure

### Section 1: Metadata

**Purpose:** Identify and track the task.

**Schema:**
```json
{
  "metadata": {
    "taskId": "string (⚠️ required, kebab-case: a-z, 0-9, hyphens only)",
    "title": "string (⚠️ required, concise description: 5-100 chars)",
    "status": "enum (⚠️ required, choose one)",
    "priority": "enum (optional, choose one)"
  }
}
```

**Enum Values for status:**
- `"todo"` - Not started
- `"in_progress"` - Currently being worked on
- `"review"` - Ready for review
- `"completed"` - Finished and validated
- `"blocked"` - Cannot proceed due to dependency

**Enum Values for priority:**
- `"critical"` - Must be done immediately
- `"high"` - Important, do soon
- `"medium"` - Normal priority
- `"low"` - Can wait

**Example:**
```json
{
  "metadata": {
    "taskId": "jwt-authentication",
    "title": "Implement JWT-based authentication system",
    "status": "in_progress",
    "priority": "high"
  }
}
```

---

### Section 2: Analysis

**Purpose:** Capture and parse the user's request, extract requirements, objectives, and constraints.

**Schema:**
```json
{
  "analysis": {
    "userRequest": {
      "original": "string (⚠️ required, exact user input)",
      "parsed": "string (⚠️ required, your interpretation: 2-4 sentences)"
    },
    "requirements": [
      "array of strings (⚠️ required, min 1 item, each: 1 sentence describing what must be built)"
    ],
    "objectives": [
      "array of strings (⚠️ required, min 1 item, each: 1 sentence describing goals to achieve)"
    ],
    "constraints": [
      "array of strings (⚠️ required, min 0 items, each: 1 sentence describing limitations)"
    ],
    "successCriteria": [
      {
        "criterion": "string (⚠️ required, measurable success condition: 1 sentence)",
        "met": "boolean (⚠️ required, initially false, update when achieved)",
        "notes": "string (optional, additional context)"
      }
    ]
  }
}
```

**Guidance:**
- **requirements**: Functional needs ("Must support login with username/password")
- **objectives**: Goals and outcomes ("Enable secure user authentication")
- **constraints**: Limitations ("Must work with existing React 19 frontend")
- **successCriteria**: Testable conditions ("User can login and receive valid JWT token")

**Example:**
```json
{
  "analysis": {
    "userRequest": {
      "original": "I need a secure authentication system with JWT tokens for the Tauri app. Users should be able to login, logout, and the system should automatically refresh tokens.",
      "parsed": "The user requires a complete JWT-based authentication flow including login and logout endpoints, token generation and validation on the backend, and automatic token refresh functionality to maintain sessions without user intervention."
    },
    "requirements": [
      "Implement login endpoint that validates credentials and returns JWT token",
      "Implement logout functionality that clears user session",
      "Create token validation middleware for protected routes",
      "Implement automatic token refresh mechanism before expiration",
      "Store authentication state in React Context for frontend access"
    ],
    "objectives": [
      "Provide secure authentication mechanism for the application",
      "Ensure seamless user experience with automatic session management",
      "Integrate authentication with existing Tauri IPC architecture",
      "Follow security best practices for token handling and storage"
    ],
    "constraints": [
      "Must integrate with existing React 19 frontend using Context API",
      "Must use Tauri IPC commands for frontend-backend communication",
      "Backend must be written in Rust following project patterns",
      "Cannot use external authentication services (must be self-hosted)"
    ],
    "successCriteria": [
      {
        "criterion": "User can successfully login with valid credentials and receive a JWT token",
        "met": false,
        "notes": ""
      },
      {
        "criterion": "Token is validated on each protected API request",
        "met": false,
        "notes": ""
      },
      {
        "criterion": "Token automatically refreshes 5 minutes before expiration",
        "met": false,
        "notes": ""
      },
      {
        "criterion": "User can logout and token is invalidated",
        "met": false,
        "notes": ""
      }
    ]
  }
}
```

---

### Section 3: Problem Breakdown

**Purpose:** Decompose the problem into components, identify dependencies and challenges.

**Schema:**
```json
{
  "problemBreakdown": {
    "components": [
      {
        "description": "string (⚠️ required, component to build: 1-2 sentences)"
      }
    ],
    "dependencies": [
      {
        "description": "string (⚠️ required, what this depends on: 1 sentence)"
      }
    ],
    "challenges": [
      {
        "description": "string (⚠️ required, anticipated difficulty: 1-2 sentences)",
        "mitigation": "string (⚠️ required, how to address it: 1-2 sentences)",
        "resolved": "boolean (⚠️ required, initially false)"
      }
    ]
  }
}
```

**Guidance:**
- **components**: Major pieces to build (AuthContext, login endpoint, token validation middleware)
- **dependencies**: External requirements (existing database schema, Tauri version, npm packages)
- **challenges**: Technical difficulties (secure token storage, cross-platform compatibility, error handling)

**Example:**
```json
{
  "problemBreakdown": {
    "components": [
      {
        "description": "React AuthContext provider for managing authentication state globally across the application"
      },
      {
        "description": "Tauri IPC commands for login, logout, and token validation on the Rust backend"
      },
      {
        "description": "JWT token generation and validation utilities using jsonwebtoken crate"
      },
      {
        "description": "Automatic token refresh mechanism with timer-based checks on the frontend"
      },
      {
        "description": "Protected route wrapper component that checks authentication before rendering"
      }
    ],
    "dependencies": [
      {
        "description": "Requires sqlx database connection for user credential validation"
      },
      {
        "description": "Depends on existing Tauri IPC infrastructure in src-tauri/src/ipc/"
      },
      {
        "description": "Needs React Context pattern already established in src/contexts/"
      },
      {
        "description": "Requires environment variable for JWT secret key"
      }
    ],
    "challenges": [
      {
        "description": "Secure token storage on the frontend - localStorage is vulnerable to XSS attacks, but cookies add complexity with Tauri's architecture.",
        "mitigation": "Use localStorage initially with proper sanitization, document XSS risks, and plan migration to httpOnly cookies in future iteration. Implement Content Security Policy headers.",
        "resolved": false
      },
      {
        "description": "Token refresh timing to avoid race conditions where multiple requests trigger refresh simultaneously.",
        "mitigation": "Implement mutex/lock pattern in AuthContext to ensure only one refresh request at a time. Queue subsequent requests until refresh completes.",
        "resolved": false
      },
      {
        "description": "Handling network failures during authentication operations gracefully without leaving app in inconsistent state.",
        "mitigation": "Implement comprehensive error handling with retry logic, clear error messages to users, and fallback to logged-out state if recovery fails.",
        "resolved": false
      }
    ]
  }
}
```

---

### Section 4: Implementation

**Purpose:** Define sequential implementation steps and track progress.

**Schema:**
```json
{
  "implementation": {
    "steps": [
      {
        "id": "string (⚠️ required, pattern: 'S1', 'S2', 'S3'... 'S10', 'S11'...)",
        "title": "string (⚠️ required, brief description: 5-80 chars)",
        "description": "string (⚠️ required, what to implement: 2-4 sentences)",
        "files": [
          "array of strings (⚠️ required, min 1 item, file paths to create/modify)"
        ],
        "status": "enum (⚠️ required)",
        "estimatedComplexity": "enum (optional)",
        "dependencies": [
          "array of strings (optional, other step IDs like 'S1', 'S2')"
        ]
      }
    ],
    "currentStep": "string (⚠️ required, current step ID or 'not_started' or 'completed')"
  }
}
```

**Enum Values for status:**
- `"not_started"` - Not begun
- `"in_progress"` - Currently working on this step
- `"completed"` - Finished and working
- `"blocked"` - Cannot proceed

**Enum Values for estimatedComplexity:**
- `"simple"` - Straightforward, ~30 min
- `"moderate"` - Some complexity, ~1-2 hours
- `"complex"` - Significant work, ~3-4 hours
- `"very_complex"` - Major effort, multiple sessions

**Guidance:**
- Each step should be **atomic** - completable in one focused session
- Steps should be **sequential** - S1 before S2, S2 before S3
- Steps should produce **working code** - no partial implementations
- List all files that will be created or modified

**Example:**
```json
{
  "implementation": {
    "steps": [
      {
        "id": "S1",
        "title": "Create JWT utility functions on backend",
        "description": "Implement Rust utilities for JWT token generation and validation using the jsonwebtoken crate. Create functions to generate tokens with user claims, validate token signatures, and extract user information from valid tokens. Include proper error handling for expired or invalid tokens.",
        "files": [
          "src-tauri/src/utils/jwt.rs",
          "src-tauri/src/utils/mod.rs"
        ],
        "status": "completed",
        "estimatedComplexity": "moderate",
        "dependencies": []
      },
      {
        "id": "S2",
        "title": "Implement login Tauri command",
        "description": "Create a Tauri IPC command that accepts username and password, validates credentials against the database using sqlx, and returns a JWT token on success. The command should hash passwords with bcrypt for comparison, handle invalid credentials gracefully, and return appropriate error messages.",
        "files": [
          "src-tauri/src/ipc/commands/auth.rs",
          "src-tauri/src/ipc/commands/mod.rs"
        ],
        "status": "completed",
        "estimatedComplexity": "moderate",
        "dependencies": ["S1"]
      },
      {
        "id": "S3",
        "title": "Create AuthContext provider on frontend",
        "description": "Build a React Context provider that manages authentication state including user object, token, and loading flags. Implement login and logout methods that call Tauri commands. Persist token to localStorage and restore on app initialization. Create useAuth hook for consuming components.",
        "files": [
          "src/contexts/AuthContext.tsx",
          "src/contexts/index.ts"
        ],
        "status": "in_progress",
        "estimatedComplexity": "moderate",
        "dependencies": ["S2"]
      },
      {
        "id": "S4",
        "title": "Build type-safe Tauri API wrappers",
        "description": "Create TypeScript wrapper functions around Tauri invoke calls for authentication operations. Define TypeScript interfaces for request/response types. Handle serialization and provide type-safe error handling with IpcError types.",
        "files": [
          "src/lib/tauri-api/auth.ts",
          "src/lib/tauri-api/types.ts"
        ],
        "status": "not_started",
        "estimatedComplexity": "simple",
        "dependencies": ["S2"]
      },
      {
        "id": "S5",
        "title": "Implement token validation command",
        "description": "Create Tauri command that validates JWT tokens and returns user information if valid. This will be called on app startup to restore sessions and periodically to check token validity. Handle expired tokens by returning a specific error that triggers refresh flow.",
        "files": [
          "src-tauri/src/ipc/commands/auth.rs"
        ],
        "status": "not_started",
        "estimatedComplexity": "simple",
        "dependencies": ["S1"]
      },
      {
        "id": "S6",
        "title": "Build automatic token refresh mechanism",
        "description": "Implement frontend logic to automatically refresh tokens 5 minutes before expiration. Use a timer that checks token expiration and calls refresh command. Implement mutex pattern to prevent multiple simultaneous refresh requests. Update AuthContext with new token on successful refresh.",
        "files": [
          "src/contexts/AuthContext.tsx",
          "src/hooks/useTokenRefresh.ts"
        ],
        "status": "not_started",
        "estimatedComplexity": "complex",
        "dependencies": ["S3", "S5"]
      },
      {
        "id": "S7",
        "title": "Create ProtectedRoute component",
        "description": "Build a wrapper component that checks authentication status before rendering children. Redirect to login page if not authenticated. Show loading state while checking token validity. This component will wrap all protected routes in the application.",
        "files": [
          "src/components/ProtectedRoute.tsx"
        ],
        "status": "not_started",
        "estimatedComplexity": "simple",
        "dependencies": ["S3"]
      },
      {
        "id": "S8",
        "title": "Implement logout functionality",
        "description": "Create logout method in AuthContext that clears token from state and localStorage. Create Tauri command on backend to invalidate token (if using token blacklist). Update UI to redirect to login page after logout. Ensure all auth state is properly cleared.",
        "files": [
          "src/contexts/AuthContext.tsx",
          "src-tauri/src/ipc/commands/auth.rs"
        ],
        "status": "not_started",
        "estimatedComplexity": "simple",
        "dependencies": ["S3"]
      }
    ],
    "currentStep": "S3"
  }
}
```

---

### Section 5: Validation

**Purpose:** Track code quality checks, functional tests, and performance metrics.

**Schema:**
```json
{
  "validation": {
    "codeQuality": {
      "typesSafe": "boolean (⚠️ required, all types properly defined)",
      "noAnyTypes": "boolean (⚠️ required, no 'any' used in TypeScript)",
      "modularStructure": "boolean (⚠️ required, proper file organization)",
      "maxLinesPerFile": "integer (⚠️ required, longest file size in lines)"
    },
    "functionalTests": [
      {
        "testCase": "string (⚠️ required, what to test: 1-2 sentences)",
        "passed": "boolean (⚠️ required, test result)",
        "notes": "string (optional, additional details)"
      }
    ],
    "performanceChecks": [
      {
        "metric": "string (⚠️ required, what was measured: e.g., 'Login response time')",
        "threshold": "string (⚠️ required, acceptable limit: e.g., '< 500ms')",
        "actual": "string (⚠️ required, measured value: e.g., '320ms')",
        "passed": "boolean (⚠️ required, met threshold)"
      }
    ]
  }
}
```

**Example:**
```json
{
  "validation": {
    "codeQuality": {
      "typesSafe": true,
      "noAnyTypes": true,
      "modularStructure": true,
      "maxLinesPerFile": 320
    },
    "functionalTests": [
      {
        "testCase": "User can login with valid credentials and receive a JWT token that is stored in AuthContext state",
        "passed": true,
        "notes": "Tested with multiple user accounts, all successful"
      },
      {
        "testCase": "Login fails with appropriate error message when invalid credentials are provided",
        "passed": true,
        "notes": "Error message displayed correctly in UI"
      },
      {
        "testCase": "Token is automatically refreshed 5 minutes before expiration without user interaction",
        "passed": true,
        "notes": "Verified with manual token expiration time adjustment"
      },
      {
        "testCase": "User remains logged in after closing and reopening the application",
        "passed": true,
        "notes": "Token correctly restored from localStorage"
      },
      {
        "testCase": "ProtectedRoute redirects to login when user is not authenticated",
        "passed": true,
        "notes": "Tested by clearing localStorage and accessing protected route"
      },
      {
        "testCase": "Logout clears all authentication state and redirects to login page",
        "passed": true,
        "notes": "Verified localStorage is cleared and state is reset"
      }
    ],
    "performanceChecks": [
      {
        "metric": "Login response time",
        "threshold": "< 500ms",
        "actual": "320ms",
        "passed": true
      },
      {
        "metric": "Token validation response time",
        "threshold": "< 100ms",
        "actual": "45ms",
        "passed": true
      },
      {
        "metric": "Token refresh response time",
        "threshold": "< 300ms",
        "actual": "180ms",
        "passed": true
      }
    ]
  }
}
```

---

### Section 6: Notes

**Purpose:** Capture design decisions, technical debt, improvements, blockers, and questions throughout development.

**Schema:**
```json
{
  "notes": [
    {
      "timestamp": "string (⚠️ required, ISO 8601 format: 'YYYY-MM-DDTHH:mm:ssZ')",
      "category": "enum (⚠️ required)",
      "content": "string (⚠️ required, note details: 1-5 sentences)"
    }
  ]
}
```

**Enum Values for category:**
- `"design-decision"` - Architectural or implementation choices
- `"technical-debt"` - Known issues to address later
- `"improvement"` - Potential enhancements
- `"blocker"` - Issues preventing progress
- `"question"` - Unclear requirements or decisions needed

**Example:**
```json
{
  "notes": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "category": "design-decision",
      "content": "Chose to use localStorage for token storage instead of httpOnly cookies for initial implementation. This simplifies the architecture but introduces XSS vulnerability. Plan to migrate to cookies in next iteration with proper security audit."
    },
    {
      "timestamp": "2024-01-15T14:20:00Z",
      "category": "technical-debt",
      "content": "Token refresh mechanism uses simple timer approach which could drift over time. Should implement more robust scheduling using exact expiration timestamps and consider edge cases like system sleep/wake."
    },
    {
      "timestamp": "2024-01-16T09:15:00Z",
      "category": "improvement",
      "content": "Consider adding rate limiting to login endpoint to prevent brute force attacks. Could track failed attempts per username and IP address, implementing exponential backoff."
    },
    {
      "timestamp": "2024-01-16T11:45:00Z",
      "category": "question",
      "content": "Should the system support multiple simultaneous sessions per user, or enforce single session only? This affects token invalidation strategy and requires clarification from product requirements."
    }
  ]
}
```

---

## Complete Valid Example

Here is a complete, realistic task file that passes all validation:

```json
{
  "metadata": {
    "taskId": "jwt-authentication-system",
    "title": "Implement JWT-based authentication with automatic token refresh",
    "status": "in_progress",
    "priority": "high"
  },
  "analysis": {
    "userRequest": {
      "original": "I need a secure authentication system with JWT tokens for the Tauri app. Users should be able to login, logout, and the system should automatically refresh tokens before they expire.",
      "parsed": "The user requires a complete JWT-based authentication flow including login and logout endpoints, secure token generation and validation on the Rust backend, persistent session management using React Context on the frontend, and automatic token refresh functionality to maintain user sessions without manual re-authentication."
    },
    "requirements": [
      "Implement login endpoint that validates username/password and returns JWT token",
      "Implement logout functionality that clears authentication state",
      "Create token validation mechanism for verifying token integrity and expiration",
      "Implement automatic token refresh that triggers before expiration",
      "Store authentication state in React Context for global access",
      "Persist token to localStorage for session continuity across app restarts",
      "Create protected route wrapper that enforces authentication"
    ],
    "objectives": [
      "Provide secure authentication mechanism following industry best practices",
      "Ensure seamless user experience with automatic session management",
      "Integrate cleanly with existing Tauri IPC architecture",
      "Maintain type safety across frontend and backend boundaries",
      "Enable future extension for MFA or OAuth integration"
    ],
    "constraints": [
      "Must integrate with existing React 19 frontend using Context API pattern",
      "Must use Tauri IPC commands for all frontend-backend communication",
      "Backend must be implemented in Rust following project conventions",
      "Cannot use external authentication services - must be self-hosted",
      "Must work offline after initial authentication",
      "Must support both macOS and Windows platforms"
    ],
    "successCriteria": [
      {
        "criterion": "User can successfully login with valid credentials and receive JWT token",
        "met": true,
        "notes": "Verified with test accounts on both platforms"
      },
      {
        "criterion": "Invalid credentials result in clear error message without exposing security details",
        "met": true,
        "notes": "Generic 'Invalid credentials' message prevents username enumeration"
      },
      {
        "criterion": "Token is validated on each protected operation",
        "met": true,
        "notes": "All IPC commands check token validity before execution"
      },
      {
        "criterion": "Token automatically refreshes 5 minutes before expiration",
        "met": false,
        "notes": "Implementation in progress - timer logic complete, testing edge cases"
      },
      {
        "criterion": "User session persists across app restarts",
        "met": true,
        "notes": "Token restored from localStorage on app initialization"
      },
      {
        "criterion": "User can logout and all authentication state is cleared",
        "met": false,
        "notes": "Pending implementation of logout command"
      },
      {
        "criterion": "Protected routes redirect unauthenticated users to login",
        "met": false,
        "notes": "ProtectedRoute component not yet implemented"
      }
    ]
  },
  "problemBreakdown": {
    "components": [
      {
        "description": "React AuthContext provider that manages authentication state globally including user object, token, loading states, and provides login/logout methods to consuming components"
      },
      {
        "description": "Rust JWT utility module with functions for token generation using HS256 algorithm, token validation with expiration checks, and claim extraction"
      },
      {
        "description": "Tauri IPC commands for login (credential validation), logout (session cleanup), token validation, and token refresh operations"
      },
      {
        "description": "TypeScript type-safe wrappers around Tauri invoke calls with proper error handling and response type definitions"
      },
      {
        "description": "Automatic token refresh mechanism using timer-based checks with mutex pattern to prevent concurrent refresh requests"
      },
      {
        "description": "ProtectedRoute wrapper component that enforces authentication before rendering protected content"
      },
      {
        "description": "Custom useAuth hook providing convenient access to auth state and methods for components"
      }
    ],
    "dependencies": [
      {
        "description": "Requires jsonwebtoken crate version 8.x for Rust JWT operations"
      },
      {
        "description": "Depends on existing sqlx database connection for user credential validation against users table"
      },
      {
        "description": "Needs bcrypt crate for secure password hashing and comparison"
      },
      {
        "description": "Requires Tauri IPC infrastructure already established in src-tauri/src/ipc/ directory"
      },
      {
        "description": "Depends on React Context pattern already used in src/contexts/ for consistency"
      },
      {
        "description": "Needs JWT_SECRET environment variable configured in .env file"
      },
      {
        "description": "Requires TanStack Router already configured for navigation and route protection"
      }
    ],
    "challenges": [
      {
        "description": "Secure token storage on frontend - localStorage is vulnerable to XSS attacks but Tauri's architecture makes httpOnly cookies complex. Need to balance security with implementation simplicity.",
        "mitigation": "Use localStorage for initial implementation with strict Content Security Policy headers. Document XSS risks clearly. Plan future migration to httpOnly cookies with proper authentication flow redesign. Implement thorough input sanitization across the application.",
        "resolved": false
      },
      {
        "description": "Token refresh timing and race conditions - multiple components might trigger refresh simultaneously, or refresh might occur mid-request causing inconsistent state.",
        "mitigation": "Implement mutex/lock pattern in AuthContext to ensure only one refresh at a time. Queue subsequent requests and resolve them with the single refresh result. Add request interceptor to retry failed requests after successful refresh.",
        "resolved": false
      },
      {
        "description": "Handling network failures gracefully during authentication operations without leaving app in inconsistent state or losing user data.",
        "mitigation": "Implement comprehensive try-catch blocks with specific error handling for network errors, timeout errors, and invalid response formats. Provide clear error messages to users. Maintain previous valid state on failure. Add retry logic with exponential backoff for transient failures.",
        "resolved": false
      },
      {
        "description": "Cross-platform compatibility for secure storage - token persistence mechanisms may differ between macOS and Windows.",
        "mitigation": "Use localStorage which is consistent across platforms for MVP. Document platform-specific considerations. Consider Tauri's secure storage plugin for future enhancement if cross-platform native secure storage is needed.",
        "resolved": true
      },
      {
        "description": "Token validation performance - validating on every request could create bottleneck if not optimized properly.",
        "mitigation": "Implement token validation caching with short TTL (1-2 minutes). Backend validation uses efficient signature verification without database lookup. Monitor performance metrics and optimize if latency exceeds 100ms threshold.",
        "resolved": false
      }
    ]
  },
  "implementation": {
    "steps": [
      {
        "id": "S1",
        "title": "Create JWT utility functions on Rust backend",
        "description": "Implement Rust module with JWT token generation and validation using jsonwebtoken crate. Create generate_token function that takes user_id and username, creates claims with 24-hour expiration, and encodes with HS256 algorithm. Create validate_token function that decodes token, verifies signature, checks expiration, and extracts user claims. Include comprehensive error handling for all failure cases.",
        "files": [
          "src-tauri/src/utils/jwt.rs",
          "src-tauri/src/utils/mod.rs"
        ],
        "status": "completed",
        "estimatedComplexity": "moderate",
        "dependencies": []
      },
      {
        "id": "S2",
        "title": "Implement login Tauri IPC command",
        "description": "Create login_command Tauri command that accepts username and password as parameters. Query users table using sqlx to find user by username. Use bcrypt to hash provided password and compare with stored hash. On match, generate JWT token using S1 utilities and return success response with token and user info. On failure, return generic error to prevent username enumeration. Include proper error handling and logging.",
        "files": [
          "src-tauri/src/ipc/commands/auth.rs",
          "src-tauri/src/ipc/commands/mod.rs"
        ],
        "status": "completed",
        "estimatedComplexity": "moderate",
        "dependencies": ["S1"]
      },
      {
        "id": "S3",
        "title": "Build type-safe Tauri API wrappers for frontend",
        "description": "Create TypeScript wrapper functions around Tauri invoke calls for authentication operations. Define interfaces for LoginRequest, LoginResponse, AuthError, and other auth-related types. Implement tauriLogin, tauriValidateToken, tauriRefreshToken functions that handle invoke calls with proper type safety and error transformation from Rust IpcError to TypeScript AuthError types.",
        "files": [
          "src/lib/tauri-api/auth.ts",
          "src/lib/tauri-api/types.ts"
        ],
        "status": "completed",
        "estimatedComplexity": "simple",
        "dependencies": ["S2"]
      },
      {
        "id": "S4",
        "title": "Create AuthContext provider on frontend",
        "description": "Build React Context with state for user object, token, isAuthenticated flag, and loading states. Implement login method that calls tauriLogin, stores token in state and localStorage on success, and updates isAuthenticated flag. Create initialization logic that checks localStorage on mount and validates stored token with backend. Export useAuth hook for consuming components. Handle all error cases with proper user feedback.",
        "files": [
          "src/contexts/AuthContext.tsx",
          "src/contexts/index.ts"
        ],
        "status": "in_progress",
        "estimatedComplexity": "moderate",
        "dependencies": ["S3"]
      },
      {
        "id": "S5",
        "title": "Implement token validation Tauri command",
        "description": "Create validate_token_command that accepts JWT token as parameter and validates it using S1 utilities. Return user information if token is valid and not expired. Return specific error codes for expired tokens versus invalid tokens to enable appropriate frontend handling. This command will be used on app startup and for periodic validation checks.",
        "files": [
          "src-tauri/src/ipc/commands/auth.rs"
        ],
        "status": "not_started",
        "estimatedComplexity": "simple",
        "dependencies": ["S1"]
      },
      {
        "id": "S6",
        "title": "Implement token refresh Tauri command",
        "description": "Create refresh_token_command that accepts current JWT token, validates it, and if valid but nearing expiration, generates a new token with fresh expiration time. Return new token and updated user information. This enables automatic token refresh without requiring user re-authentication.",
        "files": [
          "src-tauri/src/ipc/commands/auth.rs"
        ],
        "status": "not_started",
        "estimatedComplexity": "simple",
        "dependencies": ["S1", "S5"]
      },
      {
        "id": "S7",
        "title": "Build automatic token refresh mechanism",
        "description": "Create useTokenRefresh hook that monitors token expiration and automatically refreshes 5 minutes before expiry. Use setInterval to check expiration time, call refresh command when threshold reached, update AuthContext with new token. Implement mutex pattern using useRef to prevent multiple simultaneous refresh requests. Handle refresh failures by logging user out. Integrate with AuthContext to coordinate refresh across app.",
        "files": [
          "src/hooks/useTokenRefresh.ts",
          "src/contexts/AuthContext.tsx"
        ],
        "status": "not_started",
        "estimatedComplexity": "complex",
        "dependencies": ["S4", "S6"]
      },
      {
        "id": "S8",
        "title": "Create ProtectedRoute wrapper component",
        "description": "Build ProtectedRoute component that uses useAuth hook to check authentication status before rendering children. If not authenticated, redirect to login page using TanStack Router navigation. Show loading spinner while checking token validity. Support optional roles prop for role-based access control in future. This component will wrap all protected routes in the router configuration.",
        "files": [
          "src/components/ProtectedRoute.tsx",
          "src/components/index.ts"
        ],
        "status": "not_started",
        "estimatedComplexity": "simple",
        "dependencies": ["S4"]
      },
      {
        "id": "S9",
        "title": "Implement logout functionality",
        "description": "Add logout method to AuthContext that clears token from state and localStorage, resets user object to null, sets isAuthenticated to false. Create logout_command on backend that can be used for future token blacklisting if needed. Navigate to login page after logout. Ensure all authentication state is properly cleaned up to prevent stale data.",
        "files": [
          "src/contexts/AuthContext.tsx",
          "src-tauri/src/ipc/commands/auth.rs"
        ],
        "status": "not_started",
        "estimatedComplexity": "simple",
        "dependencies": ["S4"]
      },
      {
        "id": "S10",
        "title": "Create LoginForm component",
        "description": "Build login form component with username and password inputs using React 19 form actions. Add client-side validation for required fields. Use useAuth hook to call login method on form submission. Display loading state during authentication. Show error messages from backend gracefully. Redirect to dashboard on successful login. Include password visibility toggle and remember me checkbox for future enhancement.",
        "files": [
          "src/components/LoginForm.tsx",
          "src/pages/Login.tsx"
        ],
        "status": "not_started",
        "estimatedComplexity": "moderate",
        "dependencies": ["S4"]
      }
    ],
    "currentStep": "S4"
  },
  "validation": {
    "codeQuality": {
      "typesSafe": true,
      "noAnyTypes": true,
      "modularStructure": true,
      "maxLinesPerFile": 285
    },
    "functionalTests": [
      {
        "testCase": "User can login with valid credentials (username: testuser, password: Test123!) and receives valid JWT token",
        "passed": true,
        "notes": "Tested on both macOS and Windows, token structure verified"
      },
      {
        "testCase": "Login fails with error message when invalid credentials provided, error message is generic to prevent username enumeration",
        "passed": true,
        "notes": "Tested with wrong password, non-existent username - both show same error"
      },
      {
        "testCase": "JWT token contains correct user claims (user_id, username, exp) and is signed properly",
        "passed": true,
        "notes": "Decoded token manually at jwt.io to verify structure"
      },
      {
        "testCase": "Token validation correctly identifies expired tokens and returns appropriate error code",
        "passed": true,
        "notes": "Manually created expired token for testing, error handling works"
      },
      {
        "testCase": "AuthContext stores token in localStorage and successfully restores it on app restart",
        "passed": true,
        "notes": "Closed and reopened app multiple times, session maintained"
      },
      {
        "testCase": "Token refresh generates new token with extended expiration when called within 5 minutes of expiry",
        "passed": false,
        "notes": "Not yet implemented - pending S7 completion"
      },
      {
        "testCase": "Automatic refresh mechanism prevents token expiration during active use",
        "passed": false,
        "notes": "Not yet implemented - pending S7 completion"
      },
      {
        "testCase": "ProtectedRoute redirects unauthenticated users to login page",
        "passed": false,
        "notes": "Not yet implemented - pending S8 completion"
      },
      {
        "testCase": "Logout clears all authentication state and navigates to login page",
        "passed": false,
        "notes": "Not yet implemented - pending S9 completion"
      }
    ],
    "performanceChecks": [
      {
        "metric": "Login response time (credential validation + token generation)",
        "threshold": "< 500ms",
        "actual": "320ms",
        "passed": true
      },
      {
        "metric": "Token validation response time",
        "threshold": "< 100ms",
        "actual": "45ms",
        "passed": true
      },
      {
        "metric": "Token generation time on backend",
        "threshold": "< 50ms",
        "actual": "12ms",
        "passed": true
      },
      {
        "metric": "AuthContext initialization time (including localStorage read)",
        "threshold": "< 200ms",
        "actual": "85ms",
        "passed": true
      }
    ]
  },
  "notes": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "category": "design-decision",
      "content": "Chose to use localStorage for token storage instead of httpOnly cookies for initial implementation. This simplifies the Tauri architecture significantly but introduces XSS vulnerability. Planning to migrate to cookies in next iteration after security audit. Implemented strict Content Security Policy headers as mitigation."
    },
    {
      "timestamp": "2024-01-15T14:20:00Z",
      "category": "technical-debt",
      "content": "Token refresh mechanism will use simple timer approach with setInterval which could drift over time or have issues with system sleep/wake cycles. Should implement more robust scheduling using exact expiration timestamps and Web Workers in future iteration."
    },
    {
      "timestamp": "2024-01-15T16:45:00Z",
      "category": "design-decision",
      "content": "Decided to use 24-hour token expiration with 5-minute refresh window. This balances security (reasonable expiration time) with UX (infrequent refreshes). Refresh window of 5 minutes provides buffer for network issues or timing drift."
    },
    {
      "timestamp": "2024-01-16T09:15:00Z",
      "category": "improvement",
      "content": "Should add rate limiting to login endpoint to prevent brute force attacks. Could track failed attempts per username and IP address, implementing exponential backoff after 5 failed attempts. Consider adding CAPTCHA after multiple failures."
    },
    {
      "timestamp": "2024-01-16T11:30:00Z",
      "category": "question",
      "content": "Should the system support multiple simultaneous sessions per user (e.g., mobile + desktop), or enforce single session only? This affects token invalidation strategy and whether we need token blacklisting. Need clarification from product requirements before implementing logout backend logic."
    },
    {
      "timestamp": "2024-01-16T14:00:00Z",
      "category": "design-decision",
      "content": "Implemented generic error messages for authentication failures to prevent username enumeration attacks. Both invalid username and invalid password return identical 'Invalid credentials' message with same response time."
    },
    {
      "timestamp": "2024-01-17T10:00:00Z",
      "category": "improvement",
      "content": "Consider implementing token refresh with sliding window - if user is actively using app, extend token lifetime indefinitely. Current implementation requires re-login every 24 hours even for active users. Sliding window would improve UX for power users."
    },
    {
      "timestamp": "2024-01-17T13:45:00Z",
      "category": "technical-debt",
      "content": "Current implementation doesn't handle concurrent login attempts from same user gracefully. If user tries to login while already authenticated, old token is simply replaced. Should consider whether to allow this or show warning message."
    }
  ]
}
```

---

## Validation Reminders

Before outputting your JSON:

1. **Check all required fields** (⚠️ markers) are present
2. **Verify step IDs** follow pattern exactly: "S1", "S2", "S10", "S11" (not "S01", "S001")
3. **Copy enum values exactly** (case-sensitive, include hyphens)
4. **Ensure arrays have minimum items** where specified
5. **Use proper ISO 8601 timestamps** for notes (include timezone)
6. **Start output with `{`** - no text before
7. **End output with `}`** - no text after