## React 19.2 coding guidelines

1) Actions for mutations (client‑only) → useActionState + <form action> + useFormStatus + useOptimistic

What / why
React 19 lets you wire async mutations to form submissions and handle pending, errors, reset, and optimistic UI without ad‑hoc useState plumbing. Keep the UI responsive and predictable.

2) Async transitions for “busy but interactive” flows → useTransition(startTransition(async …))

What / why
In React 19, startTransition can run an async function; React toggles isPending for you. Use it for non‑urgent updates like post‑submit navigation, list refreshes, etc.

3) Read promises and context directly where you need them → use(resource)

What / why
use() reads the value of a Promise or a Context and integrates with Suspense & error boundaries. Unlike Hooks, you can call it inside conditionals. Prefer use(context) over useContext when you need that flexibility.

4) Stop using forwardRef in new code → ref is a normal prop (+ callback ref cleanup)

What / why
Function components accept ref directly. Also, callback refs may return a cleanup function, which React calls on unmount. This simplifies focus/imperative cases and avoids extra effects

5) Simpler Context providers → render <Context> (not <Context.Provider>)

What / why
In React 19 you can render the Context object itself as the provider. Less ceremony and clearer intent.

6) Separate events from effects → useEffectEvent

What / why
Extract non‑reactive logic (e.g., logging, notifications) from an Effect so changing those values doesn’t retrigger the Effect. Prevents stale closures without disabling lint rules. 

7) Hide UI without losing state (and defer its work) → <Activity /> (19.2)

What / why
<Activity mode="hidden"> visually hides a subtree using display:none, destroys its effects, keeps its state/DOM, and deprioritizes updates until visible. Great for tabs/sidebars/anticipatory UI.

8) Use built‑in document metadata and resource components where you render UI

What / why
Render <title>, <meta>, <link rel="stylesheet" precedence="…">, and <script async> right inside your components. React hoists/deduplicates correctly and manages stylesheet precedence and script ordering. Less boilerplate, fewer head‑management libraries for simple cases.

9) Pro‑actively preload / preinit / preconnect right from components

What / why
Use React DOM’s static APIs to pull critical resources forward (fonts, CSS, scripts) or warm connections (DNS, TLS). You can even call them in event handlers for predictive fetches.

10) Web Components (Custom Elements) interop without wrappers

What / why
React 19 fully supports Custom Elements and passes “Custom Elements Everywhere.” Props map to properties/attributes with sensible heuristics; you can now use Web Components directly. For custom events, the always‑works approach is addEventListener via a ref (and now you can clean it up right in the ref). 

11) useDeferredValue(initialValue) for smoother first paint

What / why
React 19 added an initial value option. Useful for expensive search/filter UIs: you can render a fast “blank” first, then defer the heavy render to the actual value.12) Centralize error handling at the root

What / why
React 19 improved error reporting and added root options: onCaughtError, onUncaughtError, and (existing) onRecoverableError. Good spot to log, surface to telemetry, or show a global UI.13) Linting that matches the model → eslint-plugin-react-hooks@6 (flat config) + Effect Events rules

What / why
19.2 ships an updated hooks plugin with Flat Config and rules aligned with the new mental model (including useEffectEvent). Adopt it to keep Effects clean and transitions/actions safe.