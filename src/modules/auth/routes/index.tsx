import { useMemo, type CSSProperties, type MouseEvent } from "react";
import { Link } from "@tanstack/react-router";

import LogoMark from "@/assets/LOGO-SVG.svg";
import LoginBackground from "@/assets/LOGIN_BACKGROUND_.png";

import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/shared/utils/class-names";
import { usePageTransition } from "@/shared/transitions/PageTransitionProvider";
import { SupabaseConnectionIndicator } from "@/shared/components/SupabaseConnectionIndicator";
import { useSupabaseHealth } from "@/app/hooks/useSupabaseHealth";

import { LoginForm } from "../components/LoginForm";

import "./css/login-page.css";

export function LoginRoute() {
  const { setMessage } = usePageTransition();
  const { healthResult } = useSupabaseHealth();

  const backgroundStyle = useMemo(
    () =>
      ({
        "--login-background-image": `url(${LoginBackground})`,
      }) as CSSProperties,
    [],
  );

  const toggleHelperText = "Create an account for your Organization.";

  const handleNavigateToRegister = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    setMessage("Preparing registration form…");
  };

  return (
    <div className="login-page">
      <div className="login-page__background" style={backgroundStyle} aria-hidden="true" />
      <main className="login-page__main">
        <section className="login-page__panel">
          <div className="login-page__brand" data-testid="login-brand">
            <img
              src={LogoMark}
              alt="Tr-entic logo"
              className="login-page__brand-logo mt-6"
              width={77}
              height={77}
              loading="eager"
            />
            <div className="login-page__brand-copy">
              <h1 className="login-page__brand-title">Tr-entic</h1>
              <p className="login-page__brand-subtitle">Next-Gen AI-powered Translation and Localization Framework</p>
            </div>
          </div>
          <div id="login-panel-card">
            <LoginForm />
          </div>
          <div className="login-page__panel-toggle">
            <span className="login-page__divider" role="presentation" />
            <p className="login-page__toggle-copy" aria-live="polite">
              {toggleHelperText}
            </p>
            <Link
              to="/register"
              preload="intent"
              onClick={handleNavigateToRegister}
              aria-label="Navigate to registration page"
              className={cn(buttonVariants({ variant: "default", size: "lg" }), "login-page__toggle-button mb-6")}
            >
              Create a new Account
            </Link>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              marginTop: '12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              background: healthResult?.status === 'connected' ? '#22c55e' : healthResult?.status === 'disconnected' ? '#ef4444' : '#f59e0b',
              color: 'white'
            }}>
              {healthResult?.status === 'connected'
                ? `✓ Database Connected • ${healthResult.latency}ms`
                : healthResult?.status === 'disconnected'
                ? `✗ Database Error: ${healthResult.error}`
                : `⟳ Checking database...`
              }
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export const loginRouteComponent = LoginRoute;
