# Plan

## Create a “Sidecar” CLI of OpenXLIFF for Tauri Apps -> https://github.com/rmraya/OpenXLIFF

**What you do**
- Ship OpenXLIFF’s CLI scripts (convert.sh/.cmd, merge.sh/.cmd, etc.) with your app. These scripts expose all the library features (convert/merge/validate, 1.2↔2.x, skeletons, JSON/XML config, SRX, etc.). 
- Add the scripts (or a tiny launcher) as Tauri sidecars (bundle.externalBin) and call them with the Shell plugin. 
- Include a Java 21 runtime next to your app (use jlink to make it small). OpenXLIFF builds against JDK 21 and runs fine with a minimal runtime. 
GitHub

## OpenXLIFF CLI usage (examples)

To XLIFF (1.2 or 2.0/2.1/2.2):
convert.sh -file input.docx -srcLang en-US -tgtLang it-IT -xliff out.xlf -2.1

Merge back:
merge.sh -xliff out.xlf -target output.docx
(These are first-class entry points provided by OpenXLIFF.) 
GitHub

- Tauri bits (minimal)

src-tauri/tauri.conf.json → add the sidecar path(s) under bundle.externalBin.

- Use tauri-plugin-shell to spawn the sidecar from Rust/JS, and grant the allowlist in capabilities/default.json. The docs show exactly how to add a sidecar and pass arguments. 

## Bundling Java 21 without making your app huge

- Use jlink to produce a custom runtime image with only the modules you need, then ship that with your sidecar. This is the standard way to embed a slim JRE. (Optionally, jpackage if you’re producing a Java-only installer, but with Tauri you typically just include the jlink image.

## Executable Plan

### Scope & Assumptions

- Target stack: Tauri 2.8.5, Rust 1.89, React 19.1.1
- OS targets: macOS (x64/arm64), Windows 11 (x64/arm64)
- Ship OpenXLIFF CLI scripts (convert/merge/validate) as sidecars
- Bundle Java 21 via jlink minimal image per-platform
- Invoke sidecars via @tauri-apps/plugin-shell Command.sidecar
- Note: Tauri v2 capabilities schema changes across minors; copy exact snippets from v2.tauri.app/develop/sidecar when implementing

### SQLite Integration Baseline — 2025-09-20

- Branch `feature/sqlite-integration` created for database work.
- Baseline checks pass: `cargo check` (warns about unused `TranslationStage::Failed`), `pnpm lint`.
- No dedicated Rust or JS automated tests yet; will backfill during SQLite rollout.
- `.gitignore` currently lacks SQLite patterns — add alongside migration files later.
- Key risks: ensuring migrations run before IPC usage, avoiding concurrency issues with existing translation queue, and keeping capability manifests scoped to the new database file.

### SQLite Integration Progress — 2025-03-18

- Embedded migrations (`001`–`003`) now execute via the SQL plugin during setup; helper integration tests run them against in-memory SQLite before each assertion.
- `DbManager` serialises writes with a Tokio mutex and emits structured logs under `target="db::jobs"`, improving observability for insert/update/store-output flows.
- Friendly error mapping: database errors bubble up as actionable IPC messages (e.g., duplicate job IDs or missing files) and the React UI presents them in Alert components.
- New Vitest suite (`src/ipc/client.test.ts`, `src/components/history/TranslationHistoryTable.test.tsx`) verifies IPC payloads and history rendering, complementing Rust integration tests in `src-tauri/tests/db_integration.rs`.
- Documentation refreshed (README.md, sqlite-plan.md) with testing commands, database locations, and QA expectations; `.gitignore` excludes local `*.db` / `*.sqlite` artefacts.

### Phase 0 — Validate Inputs

[x] Confirm OpenXLIFF CLI scripts available and supported on JDK 21
    - Verified in OpenXLIFF README (master): "JDK 21 or newer is required" and CLI scripts (convert.sh/cmd, merge.sh/cmd, validate/xliffchecker, etc.) are provided.
[x] Verify OpenXLIFF license permits redistribution with app
    - License is EPL-1.0; redistribution allowed with compliance.
[x] Verify current Tauri v2 sidecar + capabilities examples in docs
    - Checked v2 docs: will follow `bundle.externalBin` + capabilities JSON and `@tauri-apps/plugin-shell` Command.sidecar usage per https://v2.tauri.app/develop/sidecar/.
[x] Verify @tauri-apps/plugin-shell version compatible with Tauri 2.8.5
    - Latest stable JS and Rust plugin versions are 2.3.1 (npm/crates). Will pin JS `@tauri-apps/plugin-shell@2.3.1` and Rust `tauri-plugin-shell = "2.3.1"`.
[x] Confirm CI runners/hosts have JDK 21 for building jlink images
    - Verified `.github/workflows/ci.yml` uses `actions/setup-java@v4` with Temurin 21 across macOS and Windows runners.

### Phase 1 — Repo Layout & Version Pinning

[x] Create vendor directory: vendor/openxliff/ for JAR/scripts
[x] Create runtime directory: vendor/jre/ to hold per-OS jlink images
[x] Add version file: vendor/openxliff/VERSION for pinning/upgrades
[x] Add checksums: vendor/openxliff/SHA256SUMS for integrity (placeholder)
[x] Add README: vendor/README.md describing provenance and update steps

### Phase 2 — Acquire OpenXLIFF Assets

[x] Build upstream OpenXLIFF v4.8.0 “dist” (scripts + jlink image)
    - Built locally via Gradle task `dist`; upstream repo has no release assets
[x] Vendor per‑platform dist snapshot: vendor/openxliff/dist-macos-arm64
[x] Note: Upstream dist embeds a jlink runtime under bin/ + lib/ and invokes it from scripts

### Phase 3 — Java Runtime Strategy

[x] Use upstream dist’s jlink image for macOS arm64 (validated)
[ ] Generate additional dists on target OSes (Windows x64, macOS x64) in CI or per‑host
[x] Optional: keep custom jdeps/jlink script (scripts/build-jre.sh) for fallback

### Phase 4 — Wrap Scripts to Use Bundled Dist

[x] Sidecar wrappers call resource scripts under resources/openxliff/<platform>/*
[x] macOS/Linux: robust relative path resolution for packaged + dev trees
[x] Windows: .cmd wrappers resolve resources path and delegate to upstream .cmd
[x] Errors report missing resources with actionable message

### Phase 5 — Normalize Executable Bits & Line Endings

[x] chmod +x all .sh scripts in repo
[x] Convert .cmd line endings to CRLF (Windows-friendly)
[x] Add .gitattributes to preserve script endings/executability
[x] Add pre-commit check script for executable bits

### Phase 6 — Place Sidecars in App Tree

[x] Create app sidecar dir: src-tauri/sidecars/openxliff/bin/
[x] Implement wrapper .sh/.cmd delegating to resources/openxliff/<platform>/*
[x] Keep source-of-truth under vendor/ dists; new sync script mirrors to resources

### Phase 7 — Bundle Dist as Resources

Do not list JRE in externalBin; place upstream dist under src-tauri/resources/openxliff/<platform>/
Scripts in dist call its own jlink runtime (bin/java) — no extra wiring needed

### Phase 8 — Configure Tauri Sidecars

[x] Edit src-tauri/tauri.conf.json: add relative sidecar binaries under bundle.externalBin
[x] Use per-platform entries (mac .sh, windows .cmd)
[x] Dev: verify sidecars resolve resources and show help on macOS arm64
[x] Verify cargo check after resource normalization (fixed macOS EACCES by replacing JRE legal symlinks with plain files)
[x] Verify build bundles sidecars correctly
    - Debug build succeeded; bundles at:
      - src-tauri/target/debug/bundle/macos/weg-translator.app
      - src-tauri/target/debug/bundle/dmg/weg-translator_0.1.0_aarch64.dmg
[x] Add resource paths for dist via bundle.resources (resources/openxliff/**)
[x] Update sidecar wrappers to resolve Resources/resources path in macOS .app
[x] Add suffixed sidecar files for current target (macOS arm64)

### Phase 9 — Capabilities for Shell Plugin (Permissions)

[x] Create/modify src-tauri/capabilities/default.json
[x] Add plugin-shell permission identifiers required by current docs
[x] Add sidecar allow entries for each OpenXLIFF script name
[x] Start with "args": true to unblock dev; plan to restrict later
[ ] Add refined args validators per script when CLI stabilizes

### Phase 9.1 — Capabilities for Dialog Plugin

[x] Add dialog:allow-open and dialog:allow-save to default capability

### Phase 10 — Wire Plugin in Rust

[x] Add dependency: tauri-plugin-shell in src-tauri/Cargo.toml
[x] Register plugin in src-tauri/src/main.rs builder init
[x] Build to confirm plugin loads without errors (cargo check ok)

### Phase 11 — JavaScript API Layer

[x] Add util: src/lib/openxliff.ts wrapping Command.sidecar for convert/merge/validate
[x] Implement spawn/execute with stdout/stderr line streaming
[x] Normalize exit codes and parse known error patterns
[x] Return structured result: { code, stdout, stderr, error }

### Phase 12 — React Integration (Minimal UI)

[x] Add UI actions in src/routes/index.tsx to call utils
[x] Use ShadCN 3.3.1 components for inputs/buttons/progress
[x] Tailwind 4.1.1 classes for layout; avoid custom CSS
[x] Show live logs; final status; reveal/open output path (added opener actions)
[x] Add OpenXLIFF panel with file pickers (convert + validate) on translator workspace

### Phase 13 — File Dialogs & Paths

Use @tauri-apps/plugin-dialog for file pickers
[x] Wire dialog plugin in JS (open/save)
[x] Register dialog plugin in Rust builder
[x] Provide default output locations next to input file
[x] Add opener permissions for reveal/open path and wire Reveal button
[x] Validate file existence with @tauri-apps/plugin-fs or Rust command
    - Implemented Rust command `path_exists` (src-tauri/src/ipc/commands.rs) and JS helper `src/lib/fs.ts`; integrated in OpenXliffPanel before convert/validate/merge.
[x] Sanitize paths for Windows quoting and macOS spaces
    - Args are passed as discrete array entries via plugin-shell; no manual quoting needed.

### Phase 14 — Argument Construction & Validation

[x] Map UI options to CLI flags (srcLang, tgtLang, xliff version, type)
[x] Escape and order arguments exactly as scripts expect
[x] Add client-side validation for languages (BCP-47) and version flags
[x] Support optional config files (SRX, JSON/XML) via additional flags

### Phase 15 — Cross-Platform Testing (Dev)

[x] Verify sidecars run inside macOS .app and show usage
[ ] Run tauri dev on macOS x64/arm64 with sample DOCX/PPTX
    - Blocked in current headless CLI: no DISPLAY; requires local macOS session or virtual display (Xvfb) per Tauri headless testing guidance.
[x] Verify script resolves bundled JRE and JARs with real files (Test.docx → Test.en-it.xlf via bundled convert.sh)
[ ] Repeat on Windows 11 x64; confirm .cmd wrapper works and outputs files
[x] Validate convert -> merge roundtrip for at least one sample
    - Confirmed via src-tauri/sidecars wrappers; outputs in tmp/roundtrip/

### Phase 16 — CI: Build-Time Asset Prep

[x] Add scripts/fetch-openxliff.sh to refresh vendor artifacts by version
[x] Add scripts/build-jre.sh to run jdeps/jlink and place images
[x] Cache vendor OpenXLIFF dist per OS/arch in CI
[x] Add CI job matrix per target platform/arch
[x] Upload artifacts with sidecars and JRE packaged

### Phase 17 — Packaging QA

[ ] Build release: tauri build for macOS and Windows
[ ] Inspect app bundle for sidecars in correct location
[ ] Verify resources/jre paths present and correct
[ ] Smoke-run sidecars from final bundle with real files

### Phase 18 — Codesigning & Notarization (macOS)

[ ] Ensure sidecar scripts and JRE binaries are signed with app identity
[ ] Verify hardened runtime entitlements compatible with sidecar exec
[ ] Notarize app; validate stapled ticket opens without quarantine dialogs

### Phase 19 — Windows Security & AV

[ ] Ensure SmartScreen passes signing with trusted cert
[ ] Test execution in default Defender settings; measure startup time
[ ] Adjust wrapper to minimize spawning overhead (optional)

### Phase 20 — Capability Hardening

[x] Replace "args": true with explicit lists and regex validators
[ ] Separate capability files per window if needed
[ ] Add deny-by-default for other shell commands
[ ] Gate sidecars behind user action permissions in UI

### Phase 21 — Error Handling & Telemetry

[x] Map common OpenXLIFF errors to friendly messages
    - Added structured detection in `src/lib/openxliff.ts` and surfaced friendly status messages in `src/components/openxliff/OpenXliffPanel.tsx`.
[ ] Capture stderr for diagnostics; redact PII where needed
[ ] Add optional log file toggle for support bundles

### Phase 22 — Fallbacks & Recovery

[ ] Detect missing JRE/resource corruption; show repair prompt
[ ] Offer “Reinstall Components” to restore sidecar/JRE resources
[ ] Verify enough disk space before large operations

### Phase 23 — Documentation

[ ] Update README.md with sidecar architecture, paths, and usage
[ ] Add contributor guide to update OpenXLIFF/JRE safely
[ ] Document security posture: capabilities and restrictions
[ ] Add troubleshooting section with common fixes

### Phase 24 — Upgrades Strategy

[ ] Track OpenXLIFF and JDK minor updates quarterly
[ ] Re-run jdeps when OpenXLIFF updates to adjust modules
[ ] Smoke-tests across sample formats after update
[ ] Maintain change log for sidecar version bumps

### Phase 25 — Nice-to-Haves (Future)

[ ] Replace shell scripts with tiny Rust launcher calling Java for speed
[ ] Preflight validator (fast) before full convert
[ ] Stream progress events to UI via lines/topics
[ ] Add settings for default SRX and config templates

### Uncertainties & Actions

- Capabilities JSON structure in Tauri v2 varies by minor; when implementing, copy the exact schema and permission identifiers from v2.tauri.app/develop/sidecar and the plugin-shell reference
- OpenXLIFF CLI flags should be validated against the specific release you vendor
