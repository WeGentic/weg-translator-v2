import { useEffect } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { MainLayout, useLayoutActions } from "@/app/layout/MainLayout";
import { AnimatedBackground } from "../components/AnimatedBackground";
import { LoginForm } from "../components/LoginForm";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }: { context: { auth?: { isAuthenticated?: boolean } } }) => {
    if (context.auth?.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const setHeader = useLayoutActions((state) => state.setHeader);
  const setFooter = useLayoutActions((state) => state.setFooter);
  const setSidemenu = useLayoutActions((state) => state.setSidemenu);
  const setBackground = useLayoutActions((state) => state.setBackground);
  const setHeaderContent = useLayoutActions((state) => state.setHeaderContent);
  const setFooterContent = useLayoutActions((state) => state.setFooterContent);
  const setSidemenuContent = useLayoutActions((state) => state.setSidemenuContent);

  useEffect(() => {
    setHeader({ mounted: false, visible: false });
    setFooter({ mounted: false, visible: false });
    setSidemenu({ mounted: false, mode: "hidden" });
    setHeaderContent(null);
    setFooterContent(null);
    setSidemenuContent(null);
    setBackground({ mounted: true, visible: true, element: <AnimatedBackground /> });
    return () => {
      setBackground({ element: null, mounted: false });
    };
  }, [setHeader, setFooter, setSidemenu, setBackground, setHeaderContent, setFooterContent, setSidemenuContent]);

  return (
    <>
      <MainLayout.Controller
        config={{
          header: { visible: false, mounted: false },
          footer: { visible: false, mounted: false },
          sidemenu: { mode: "hidden", mounted: false },
          background: { visible: true },
        }}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-6xl rounded-3xl border border-border/40 bg-background/85 p-6 shadow-xl backdrop-blur">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
            <div className="hidden flex-col items-center space-y-8 text-center lg:flex">
              <div className="space-y-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary shadow-lg">
                  <span className="text-3xl font-bold text-white">W</span>
                </div>
                <h1 className="text-4xl font-bold text-foreground">Weg Translator</h1>
                <p className="text-xl text-muted-foreground">
                  Transform your documents with AI-powered translation technology
                </p>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span>Real-time translation</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-secondary" />
                  <span>Multiple file formats</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  <span>Secure & private</span>
                </div>
              </div>
            </div>

            <div className="mx-auto w-full max-w-md">
              <LoginForm />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
