# Context for Weg-Translator-Tauri Project

## Platform

Tauri 2.8.x Desktop Application targeting Windows, macOS, and Linux

## Frontend

- React 19.2 with React Compiler enabled (automatic optimizations)
- TanStack Router (routing)
- TanStack Query (data fetching)
- Zustand (global state - minimal use)
- TypeScript 5.x

## Backend

- Rust 1.90.x
- sqlx (database)
- tokio (async runtime)

## Data Layer

- Local: SQLite
- Cloud: Supabase (authentication, database, storage)

## Frontend Architecture

- Component Model: Functional Components with Hooks
- Styling: Tailwind CSS + CSS Modules
- UI Library: Headless UI + Custom Components
- Routiong: TanStack Router
- Data Fetching: TanStack Query
- State Management: Zustand (global only), React Context (scoped)
- Forms & Mutations: React 19 Actions + useActionState
- Performance: React Compiler handles memoization automatically

## Architecture Principles

    1. Collocate state - Keep state close to where it's used
    2. Custom hooks as ViewModels - Encapsulate logic when beneficial
    3. React 19 Actions - Use Actions with useActionState for mutations
    4. Minimal global state - Only use Zustand/Context when truly global
    5. Lean on React Compiler - Avoid manual useMemo/useCallback/React.memo
    6. Type safety first - Strict TypeScript, no any usage