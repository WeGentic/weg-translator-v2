import { useMemo, type CSSProperties } from "react";

import LoginBackground from "@/assets/LOGIN_BACKGROUND_.png";

import { RegistrationForm } from "../components/RegistrationForm";

import "./css/registration-page.css";

export function RegistrationRoute() {
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
          <RegistrationForm />
        </section>
      </main>
    </div>
  );
}

export const registrationRouteComponent = RegistrationRoute;
