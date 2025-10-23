import { useMemo, type CSSProperties } from "react";

import LogoMark from "@/assets/LOGO-SVG.svg";
import LoginBackground from "@/assets/LOGIN_BACKGROUND_.png";

import { LoginForm } from "../components/LoginForm";

import "./login-page.css";

export function LoginRoute() {
  const backgroundStyle = useMemo(
    () =>
      ({
        "--login-background-image": `url(${LoginBackground})`,
      }) as CSSProperties,
    [],
  );

  return (
    <div className="login-page">
      <div className="login-page__background" style={backgroundStyle} aria-hidden="true" />
      <main className="login-page__main">
        <section className="login-page__panel">
          <div className="login-page__brand" data-testid="login-brand">
            <img
              src={LogoMark}
              alt="Weg Translator logo"
              className="login-page__brand-logo"
              width={88}
              height={88}
              loading="eager"
            />
            <div className="login-page__brand-copy">
              <h1 className="login-page__brand-title">Weg Translator</h1>
              <p className="login-page__brand-subtitle">AI-powered localization for your documents</p>
            </div>
          </div>
          <div className="login-page__panel-form">
            <LoginForm />
          </div>
        </section>
      </main>
    </div>
  );
}

export const loginRouteComponent = LoginRoute;
