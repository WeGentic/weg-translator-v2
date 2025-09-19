# Weg Translator IPC Playground

This project showcases a modern, extensible inter-process communication (IPC) setup between a **React 19** frontend and a **Rust/Tauri 2.8** backend. The wiring is intentionally modular so new commands, streams, or services can be layered in without disturbing existing flows.

## Quick start

```bash
npm install
npm run tauri dev
```

To validate builds locally:

```bash
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## IPC architecture

### Rust side (`src-tauri/src/ipc`)

- **Commands** (`commands.rs`)
  - `health_check` → returns `AppHealthReport` (versions, profile)
  - `list_active_jobs` → exposes tracked in-flight translation jobs
  - `start_translation` → spawns an async job, streams progress, then completion payload
  - `fail_translation` → broadcasts a structured failure event (handy for cancellation UX)
- **Events** (`events.rs`): channel names follow a URI-like namespace (`translation://progress`, `translation://completed`, `translation://failed`).
- **Shared DTOs** (`dto.rs`): serde-driven models keep payloads camelCased for the frontend, with UUID job IDs and optional metadata slots.
- **State manager** (`state.rs`): minimal `TranslationState` registry (Arc + Mutex) that tracks job lifecycle and snapshots active jobs.

The backend emits progress via `tokio::time::sleep` driven tasks so you can swap in a real translator/LLM pipeline later without changing the IPC surface.

### Frontend side (`src/ipc` and `src/App.tsx`)

- `ipc/types.ts` mirrors the Rust DTOs in TypeScript.
- `ipc/client.ts` wraps `@tauri-apps/api` `invoke` calls with a `safeInvoke` helper for consistent error handling.
- `ipc/events.ts` centralises `listen` subscriptions and returns unlisten functions, making it easy to fan out event handlers.
- `App.tsx` demonstrates a small reactive UI: submit jobs, watch progress bars update in real time, and inspect completion payloads.

### Extending the bridge

1. **Add DTOs** in `src-tauri/src/ipc/dto.rs` and re-export them in `ipc/mod.rs`.
2. **Expose a new command** in `commands.rs`, returning `Result<T, InvokeError>` for clean error propagation.
3. **Register** the command inside `tauri::Builder::invoke_handler` in `src-tauri/src/lib.rs`.
4. **Mirror types** in `src/ipc/types.ts`, then add `safeInvoke` wrappers or listeners as needed.

Events follow the same pattern—declare a constant, emit from Rust, subscribe from React with strong typing.

## Next steps

- Replace the simulated translation pipeline inside `start_translation` with the actual LLM/agent orchestration logic.
- Layer authentication/entitlement checks before mutating commands.
- Promote the in-memory `TranslationState` to a more robust job queue (e.g. crossbeam channel, database-backed store) when you need multi-session continuity.
