import { type PropsWithChildren } from "react";

import { useLayoutSelector } from "./layout-context";

/**
 * Props accepted by {@link LayoutMain}. Consumers can disable the internal
 * scroll container (e.g. for virtualization scenarios) by setting `scroll` to
 * "hidden".
 */
export interface LayoutMainProps extends PropsWithChildren {
  scroll?: "auto" | "hidden";
}

/**
 * Main content slot that spans either the entire grid width or the space to the
 * right of the sidemenu depending on its mount state.
 */
export function LayoutMain({ children, scroll = "auto" }: LayoutMainProps) {
  const sidemenu = useLayoutSelector((state) => state.sidemenu);
  const gridColumn = !sidemenu.mounted || sidemenu.mode === "unmounted" ? "1 / span 2" : "2 / 3";

  return (
    <section
      role="main"
      className="flex h-full w-full flex-col overflow-hidden bg-transparent"
      style={{ gridColumn, gridRow: "2 / 3" }}
    >
      <div className={scroll === "auto" ? "flex-1 overflow-y-auto" : "flex-1 overflow-hidden"}>{children}</div>
    </section>
  );
}
