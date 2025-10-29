import { useMemo, type CSSProperties } from "react";
import { useSearch } from "@tanstack/react-router";

import LoginBackground from "@/assets/LOGIN_BACKGROUND_.png";

import { RecoveryForm } from "../components/RecoveryForm";

import "./css/registration-page.css";

/**
 * Recovery Route Component
 *
 * Displayed when a user with an orphaned auth account attempts to log in
 * or register again. Provides options to either:
 * 1. Start fresh (cleanup orphaned account with verification code)
 * 2. Continue registration (resume incomplete flow)
 *
 * Query parameters:
 * - email: Pre-filled email address from orphan detection
 * - reason: Why user was redirected (orphaned|failed|incomplete)
 * - correlationId: Optional correlation ID for request tracing
 *
 * Requirements: Req 7 (Recovery Route and UI Components)
 * Related: Task 4.3 (Create Recovery Route Scaffold)
 */
export function RecoveryRoute() {
  const search = useSearch({ from: "/register/recover" });

  const backgroundStyle = useMemo(
    () =>
      ({
        "--registration-background-image": `url(${LoginBackground})`,
      }) as CSSProperties,
    [],
  );

  return (
    <div className="registration-page">
      <div className="registration-page__background" style={backgroundStyle} aria-hidden="true" />
      <main className="registration-page__main">
        <section className="registration-page__form">
          <RecoveryForm
            initialEmail={search.email || ""}
            reason={search.reason || "orphaned"}
            correlationId={search.correlationId}
          />
        </section>
      </main>
    </div>
  );
}

export const recoveryRouteComponent = RecoveryRoute;
