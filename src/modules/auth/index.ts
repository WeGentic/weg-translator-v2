/**
 * Auth module public surface.
 * Exposes routed screens, composable views, and controller hooks used across the app.
 *
 * Folder layout
 * - components/          Presentational React views (forms, dialog, entry points)
 * - components/forms     Registration step UIs consumed by the registration controller
 * - components/dialog    Dialog presentation sections (profile/confirm)
 * - hooks/controllers    Feature-level hooks centralising side effects and state
 * - routes/              TanStack Router file-based routes
 */
export { LoginRoute, loginRouteComponent } from "./routes";
export { RegistrationRoute, registrationRouteComponent } from "./routes/RegistrationRoute";
export { LoginForm } from "./components/LoginForm";
export { RegistrationForm } from "./components/RegistrationForm";
export { UserAccountDialog } from "./components/UserAccountDialog";
export { useAuth } from "./hooks/useAuth";
export { useRegistrationForm } from "./hooks/controllers/useRegistrationForm";
export { useUserAccountDialog } from "./hooks/controllers/useUserAccountDialog";
