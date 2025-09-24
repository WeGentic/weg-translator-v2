# Task 1 Documentation — External Pattern Validation

## What was validated
- TanStack Router static data patterns for layout configuration and typed augmentation.
- React 19 Suspense/ErrorBoundary placement guidance for persistent shells vs. route content.
- React 19 Compiler recommendations about removing manual memoization.
- Zustand selector + `shallow` usage patterns to minimise re-renders.
- shadcn/ui + Tailwind CSS v4 (Vite) integration requirements and caveats.

## Key references
- TanStack Router `staticData` docs.[^tanstack-concepts][^tanstack-static]
- React Suspense reference for boundary placement.[^react-suspense-doc]
- React Compiler introduction on automated memoisation.[^react-compiler-doc]
- Zustand `useShallow` usage guide.[^zustand-hook][^zustand-guide]
- shadcn/ui Tailwind v4 upgrade notes.[^shadcn-tailwind]

[^tanstack-concepts]: https://tanstack.com/router/v1/docs/framework/react/routing/routing-concepts
[^tanstack-static]: https://tanstack.com/router/latest/docs/framework/react/guide/static-route-data
[^react-suspense-doc]: https://react.dev/reference/react/Suspense
[^react-compiler-doc]: https://react.dev/learn/react-compiler/introduction
[^zustand-hook]: https://zustand.docs.pmnd.rs/hooks/use-shallow
[^zustand-guide]: https://zustand.docs.pmnd.rs/guides/prevent-rerenders-with-use-shallow
[^shadcn-tailwind]: https://ui.shadcn.com/docs/tailwind-v4
