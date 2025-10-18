# 0. Metadata
- Project: Project Creation Wizard Wiring to Database Flow
- Working folder: /Volumes/SSD_1_ext/CODING/WeGentic/Weg-Translator-Tauri/weg-translator

# 1. Atomic Information Extraction (Information Preservation)
- AI-1: Implementation touches `src/modules/projects/components/wizard-v2`, references `docs/db-refactor-summary.md`, and must coordinate with related Rust backend code.
- AI-2: On “Finalize”, create `Projects/{project_name}` under the app root `Projects` directory; if folder creation fails, surface an elegant, visually appealing error message.
- AI-3: Generate a project UUID; upon failure, trigger rollback of previous actions.
- AI-4: Persist project data to the SQLite database using the existing schema and code; on failure, rollback, return an elegant error message, and log detailed diagnostic information.
- AI-5: Create subfolders `Projects/{project_name}/Translations`, `Projects/{project_name}/References`, and `Projects/{project_name}/Instructions`; failure must rollback, present an elegant error message, and log details.
- AI-6: Copy user-selected files into the appropriate subfolder based on Translation Role; failure must rollback, show an elegant error message, and log details.
- AI-7: Update the SQLite `project` table with file metadata according to current schemas; failure must rollback, show an elegant error message, and log details.
- AI-8: For each selected language pair, create `Projects/{project_name}/Translations/{source_locale}_{target_locale}` subfolders; ensure conversion scaffolding exists.
- AI-9: Convert each Translation Role document to XLF per language pair, displaying a visually appealing loader during conversion.
- AI-10: After all actions, verify correctness of created assets and close the wizard gracefully.

# 2. Plan — Tasks, Steps

Task 1
Status: NOT COMPLETED

Detailed Description (Purpose/Outcome): Establish authoritative understanding of the current wizard, database schema references, and Rust command landscape needed for the project creation flow.
Gate (Exit Criteria): Documented notes map wizard finalize touchpoints to Rust IPC commands and database schema references.

Acceptance (Gherkin):
```gherkin
Feature: Baseline context for project creation wiring
Scenario: Gate met
    Given the developer has reviewed wizard-v2 components and database documentation
    When they enumerate existing project-related IPC commands
    Then a shared note lists finalize handler entry points with their corresponding Rust modules
```

Step 1.1
Status: NOT COMPLETED

Detailed Description (Goal): Capture finalize workflow entry points inside wizard-v2 components.
What: Inspect wizard-v2 finalize handlers.
Why: Knowing which component triggers “Finalize” guides integration points.
How: `rg "Finalize" src/modules/projects/components/wizard-v2 -n`
Check: Search output lists the file containing the finalize handler names and line numbers.

Step 1.2
Status: NOT COMPLETED

Detailed Description (Goal): Summarize database schema requirements impacting project creation.
What: Review docs/db-refactor-summary.md project sections.
Why: Ensures database writes comply with current schema contracts.
How: `less +"/projects" docs/db-refactor-summary.md`
Check: Notes document identifies the tables and columns used during project creation.

Step 1.3
Status: NOT COMPLETED

Detailed Description (Goal): Inventory Rust IPC commands relevant to project creation.
What: Enumerate project IPC modules.
Why: Confirms whether to extend existing commands or author new ones.
How: `rg "project" src-tauri/src/ipc/commands -n`
Check: Collected list of command files names their responsibilities in the shared notes.

Task 2
Status: NOT COMPLETED

Detailed Description (Purpose/Outcome): Define and prepare the frontend finalize flow, including payload contract, loader UX, and error surface for project creation.
Gate (Exit Criteria): Finalize action triggers a stubbed IPC call, showing loader and polished error component placeholders.

Acceptance (Gherkin):
```gherkin
Feature: Finalize UI scaffolding
Scenario: Gate met
    Given the wizard finalize button is clicked
    When the stubbed IPC call resolves or rejects
    Then the UI shows the loader during the request and renders the styled error component on failure
```

Step 2.1
Status: NOT COMPLETED

Detailed Description (Goal): Align data payload shape between wizard state and backend requirements.
What: Draft TypeScript interface for project creation payload.
Why: Guarantees consistent data fields across UI and IPC boundaries.
How: Add `export interface ProjectCreationPayload { name: string; uuid: string; languagePairs: string[]; files: WizardFileDescriptor[]; }` to `src/modules/projects/components/wizard-v2/types.ts`.
Check: Type file exports the new interface and TypeScript build succeeds locally.

Step 2.2
Status: NOT COMPLETED

Detailed Description (Goal): Trigger IPC command invocation from the finalize button.
What: Wire finalize handler to call `invoke("create_project")`.
Why: Initiates backend orchestration when the user confirms project creation.
How: Update the finalize handler in `src/modules/projects/components/wizard-v2/FinalizeStep.tsx` to `await invoke<ProjectCreationResponse>("create_project", payload)`.
Check: Clicking finalize in development logs the stubbed IPC request without runtime errors.

Step 2.3
Status: NOT COMPLETED

Detailed Description (Goal): Provide visual feedback during the finalize operation.
What: Render loading indicator while request is in flight.
Why: Communicates ongoing processing during multi-step operations.
How: Use component state `const [isSubmitting, setIsSubmitting] = useState(false);` and conditionally render the loader component per React 19 guidelines.
Check: UI displays the loader while finalize promise is pending.

Step 2.4
Status: NOT COMPLETED

Detailed Description (Goal): Surface elegant failures to the user.
What: Integrate shared error presentation component for finalize failures.
Why: Maintains UX consistency for multi-step errors.
How: Render `<InlineError message={error.message} tone="destructive" />` inside the finalize step when IPC returns an error.
Check: Simulated IPC rejection shows the styled error element.

Task 3
Status: NOT COMPLETED

Detailed Description (Purpose/Outcome): Implement a transactional Rust IPC command that orchestrates folder creation, UUID generation, database writes, subfolder scaffolding, and rollback logic.
Gate (Exit Criteria): Running the IPC command with test data creates the base project directory, commits database entries, and cleans up on forced failure.

Acceptance (Gherkin):
```gherkin
Feature: Atomic project creation command
Scenario: Gate met
    Given a valid project payload reaches the Rust backend
    When the command executes through all filesystem and database steps
    Then the project root exists, database rows are committed, and induced failures remove created artifacts
```

Step 3.1
Status: NOT COMPLETED

Detailed Description (Goal): Establish the Rust IPC command scaffold with transaction boundaries.
What: Create `create_project` command skeleton.
Why: Centralizes multi-step orchestration in one Rust entry point.
How: Add `#[tauri::command] pub async fn create_project(...) -> Result<ProjectCreatedResponse, IpcError>` in `src-tauri/src/ipc/commands/projects/create.rs` with SQLite transaction start/end structure.
Check: `cargo check -p weg-translator` passes with the new command signature.

Step 3.2
Status: NOT COMPLETED

Detailed Description (Goal): Ensure the base project directory exists before other work.
What: Create `Projects/{project_name}` folder.
Why: Root folder is required for subsequent substructure and file placement.
How: Use `fs::create_dir_all(project_root_path).map_err(|err| rollback_and_wrap(err, "Failed to create project folder"))?;`.
Check: Test run confirms folder is created on disk when command succeeds.

Step 3.3
Status: NOT COMPLETED

Detailed Description (Goal): Assign a unique identifier for the project.
What: Generate UUID for the project record.
Why: UUID links filesystem artifacts with database entries.
How: Call `let project_id = Uuid::new_v4().to_string();` and include it in response payload.
Check: Command logs display the generated UUID and database inserts use the same value.

Step 3.4
Status: NOT COMPLETED

Detailed Description (Goal): Persist core project data inside a transaction.
What: Insert project row using existing SQLx schema.
Why: Database must reflect the new project or rollback fully on error.
How: Within `let mut tx = pool.begin().await?;` execute `sqlx::query!("INSERT INTO projects ...", ...)`.
Check: On success, `SELECT` query finds the inserted row; on simulated failure, row is absent.

Step 3.5
Status: NOT COMPLETED

Detailed Description (Goal): Scaffold required subdirectories beneath the project root.
What: Create Translations, References, and Instructions subfolders.
Why: These directories organize user assets immediately.
How: Iterate over `["Translations", "References", "Instructions"]` calling `create_dir_all`.
Check: File system inspection shows all three subfolders exist post-command.

Step 3.6
Status: NOT COMPLETED

Detailed Description (Goal): Place uploaded files into their designated role folders.
What: Copy files to role-based subdirectories.
Why: Ensures assets are stored according to Translation Role.
How: For each file, compute destination via role mapping and call `fs::copy(&source, &dest)` with rollback on failure.
Check: Copied files appear in respective directories with matching filenames.

Step 3.7
Status: NOT COMPLETED

Detailed Description (Goal): Record file metadata in SQLite.
What: Insert project_files entries aligned with copied assets.
Why: Database must reflect filesystem contents for downstream processing.
How: Execute `sqlx::query!("INSERT INTO project_files ...")` within the open transaction.
Check: Querying `project_files` returns new rows referencing the project UUID.

Step 3.8
Status: NOT COMPLETED

Detailed Description (Goal): Prepare language pair translation folders.
What: Create `{srcLocale}_{tgtLocale}` subfolders under Translations.
Why: Conversion output segregates by language pair.
How: Loop `language_pairs` creating `Translations/{pair}` directory with `create_dir_all`.
Check: Each language pair directory exists when inspected on disk.

Step 3.9
Status: NOT COMPLETED

Detailed Description (Goal): Commit the transaction or execute filesystem rollback on failure.
What: Finalize transaction handling.
Why: Guarantees atomicity between database and filesystem changes.
How: On success call `tx.commit().await?;` else invoke `rollback_fs_changes(&created_paths)` and `tx.rollback().await?`.
Check: Forced panic removes created folders and leaves database untouched.

Task 4
Status: NOT COMPLETED

Detailed Description (Purpose/Outcome): Integrate document-to-XLF conversion per language pair with responsive loader feedback and detailed error messaging.
Gate (Exit Criteria): Conversion routine runs for Translation Role files, updates UI loader state, and reports styled errors on failure.

Acceptance (Gherkin):
```gherkin
Feature: Document conversion workflow
Scenario: Gate met
    Given Translation Role files exist for a project
    When finalize triggers the conversion step
    Then language pair folders receive generated XLF files while the UI shows a loader and surfaces formatted errors if conversion fails
```

Step 4.1
Status: NOT COMPLETED

Detailed Description (Goal): Kick off conversion jobs after successful base creation.
What: Invoke existing conversion sidecar for Translation Role files.
Why: Produces XLF assets required for subsequent translation workflow.
How: Call the OpenXLIFF sidecar via `invoke("convert_document_to_xlf", { ... })` for each language pair and role file.
Check: Conversion logs indicate successful sidecar execution per file-language pair combination.

Step 4.2
Status: NOT COMPLETED

Detailed Description (Goal): Reflect conversion progress in the UI.
What: Bind loader state to conversion lifecycle events.
Why: Keeps user informed while long-running conversions happen.
How: Extend finalize state machine to show progress (e.g., set `conversionStatus` before invoking and update via IPC events).
Check: Loader persists until conversions finish and hides afterward.

Step 4.3
Status: NOT COMPLETED

Detailed Description (Goal): Handle conversion failures elegantly.
What: Pipe conversion errors into shared error presenter.
Why: Maintains consistent UX and aids troubleshooting.
How: Catch sidecar errors, map to `IpcError`, and display via `<InlineError tone="destructive">`.
Check: Simulated conversion failure renders the error component with details.

Task 5
Status: NOT COMPLETED

Detailed Description (Purpose/Outcome): Verify end-to-end success criteria, perform double checks, and close the wizard cleanly.
Gate (Exit Criteria): QA checklist confirms filesystem, database, and UI states are correct; wizard closes automatically on success.

Acceptance (Gherkin):
```gherkin
Feature: Final validation and wizard closure
Scenario: Gate met
    Given the project creation process completes without errors
    When validation checks run on filesystem, database, and UI state
    Then the wizard resets/ closes and a success confirmation displays
```

Step 5.1
Status: NOT COMPLETED

Detailed Description (Goal): Validate filesystem artifacts after completion.
What: Audit project directories and files against payload.
Why: Confirms structure and copies match expectations.
How: Run `tree Projects/{project_name}` and cross-check with payload map.
Check: Directory listing mirrors expected folder hierarchy and file names.

Step 5.2
Status: NOT COMPLETED

Detailed Description (Goal): Confirm database entries align with filesystem results.
What: Query projects and project_files tables.
Why: Ensures data persistence matches physical assets.
How: Use `sqlite3 weg_translator.db "SELECT name FROM projects WHERE uuid='...'";` and verify associated entries in `project_files`.
Check: Queries return rows with matching UUID and filenames.

Step 5.3
Status: NOT COMPLETED

Detailed Description (Goal): Close wizard and reset state after successful completion.
What: Dispatch wizard completion actions.
Why: Provides clear UX transition and readiness for next project.
How: Call existing wizard store reset function and navigate per router guidelines.
Check: Wizard modal closes and success toast appears in UI.
