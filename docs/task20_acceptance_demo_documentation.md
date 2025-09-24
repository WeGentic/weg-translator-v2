# Task 20 – Acceptance Demo Scenario

## Summary
- Added reusable demo assets (`docs/jliff-editor/demo/sample.docx` and `sample.en-US-fr-FR.xlf`) to provide realistic source material with placeholders.
- Introduced a dedicated CLI (`cargo run --bin seed-demo-project`) that seeds the application data folder with a fully converted project, including JLIFF and tag-map artifacts.
- Documented the manual QA flow covering table rendering, placeholder parity remediation, save semantics, and virtualization stress checks.

## Seeding the Demo Project
1. From `src-tauri/`, run `cargo run --bin seed-demo-project -- --overwrite` to create a fresh `demo-appdata` folder under the same directory.
2. The CLI prints the generated project identifiers and the absolute app folder path (for example, `.../src-tauri/demo-appdata`).
3. Point the desktop app to this folder:
   - Launch `npm run tauri dev` (or the packaged binary).
   - In *Settings → Storage*, update the "App Folder" to the printed `demo-appdata` path and restart when prompted.

## Manual Verification Steps
1. **Load seeded project** – Open the "JLIFF Demo" project; select the single file. Confirm the segments table renders placeholder chips (e.g., `{{ph:name}}`) and summary metrics.
2. **Placeholder remediation** – Edit segment `uintro-s1`, remove the placeholder token from the target, trigger the row inspector's "Insert missing" action, save, and verify the parity badge returns to OK.
3. **Save propagation** – Re-open the file (or rerun `read_project_artifact`) to confirm the JLIFF document reflects the saved target.
4. **QC filters and search** – Toggle "Only mismatches" and exercise the global search field. Ensure virtualization maintains smooth scrolling (duplicate the seeded project with `--slug` if additional rows are desired).

## Notes
- The CLI accepts overrides (`--app-dir`, `--doc`, `--xliff`, languages) when a different dataset is required.
- Re-run with `--overwrite` to reset artifacts between acceptance sessions.
