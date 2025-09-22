import { useMemo } from "react";
import { useRouterState } from "@tanstack/react-router";

type UseHeaderTitleOptions = {
  explicit?: string | null;
  fallback?: string;
};

const ROUTE_TITLES: Record<string, string> = {
  "/": "Workspace",
  "/login": "Sign in",
};

export function useHeaderTitle(options?: UseHeaderTitleOptions): string {
  const { explicit, fallback = "Workspace" } = options ?? {};

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return useMemo(() => {
    if (explicit && explicit.trim().length > 0) {
      return explicit;
    }

    return ROUTE_TITLES[pathname] ?? fallback;
  }, [explicit, fallback, pathname]);
}
