# Project Creation QA Checklist

Use this checklist to validate the create-project wizard and backend orchestration command.

1. **Happy path (processable + reference files)**
   1. Launch the wizard, fill required fields (project name, language pairs).
   2. Drop one processable file and one reference file.
   3. Click _Finalize_.
   4. Verify success toast appears, wizard closes, and project list shows the new entry.
   5. Confirm filesystem contains `Translations`, `References`, `Instructions` directories and language pair subfolders.
   6. Inspect database (or dev logs) to ensure artifact/job records were created and marked `GENERATED`/`completed`.

2. **Duplicate folder slug**
   1. Create a project named `Alpha`.
   2. Start another project with the same name; finalize.
   3. Ensure the wizard generates a unique folder name (`alpha-2`, etc.) and the backend reports success.

3. **Missing source file**
   1. Choose a processable file, then rename/delete it on disk before finalizing.
   2. Finalize and expect a filesystem error overlay.
   3. Verify toast communicates the failure reason and no project directory remains on disk.

4. **Conversion failure**
   1. Use a malformed processable file.
   2. Finalize and confirm the overlay reports conversion failure with actionable detail.
   3. Check logs for `CONVERSION_STREAM_FAILED` entries.

5. **Validation failure**
   1. Use a valid processable file that produces invalid XLIFF output.
   2. Finalize; ensure validation errors surface and job status is `failed` with error log.

6. **Empty state guard**
   1. Attempt to finalize without files → overlay and toast should block submission.

7. **Client creation + association**
   1. Create a new client within the wizard, finalize, and confirm the project references the client.

8. **Progress events**
   1. With devtools open, observe `project:create:progress` events for each phase.
   2. Confirm `project:create:complete` fires on success.

9. **Rollback integrity**
   1. Force an error during file copy (e.g., by toggling file permissions).
   2. Ensure partially created directories are removed and no DB records remain.

10. **Logging verification**
    1. Review app log output; confirm each phase logs `info` and any errors emit `error` with slug/project UUID context.

Record results and any anomalies for follow-up.
