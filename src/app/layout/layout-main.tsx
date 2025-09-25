import { type PropsWithChildren } from "react";

import { useLayoutSelector } from "./layout-context";
import "./css-styles/layout-main.css";

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
      className="layout-main"
      style={{ gridColumn, gridRow: "2 / 3" }}
    >
      <div
        className={
          scroll === "auto"
            ? "layout-main__content layout-main__content--scroll-auto"
            : "layout-main__content layout-main__content--scroll-hidden"
        }
      >
        {children}
      </div>
    </section>
  );
}
