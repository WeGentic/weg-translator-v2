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
  const sidebarOne = useLayoutSelector((state) => state.sidebarOne);
  const sidebarTwo = useLayoutSelector((state) => state.sidebarTwo);

  // Calculate grid column based on which sidebars are mounted and visible
  // Grid columns: 1 = sidebarOne, 2 = sidebarTwo, 3 = sidemenu, 4 = main
  let gridColumn = "1 / -1"; // default: span all columns

  const sidebarOneVisible = sidebarOne.mounted;
  const sidebarTwoVisible = sidebarTwo.mounted && sidebarTwo.visible;
  const sidemenuVisible = sidemenu.mounted && sidemenu.mode !== "unmounted" && sidemenu.mode !== "hidden";

  // Start from the first empty column
  let startColumn = 1;
  if (sidebarOneVisible) startColumn = 2;
  if (sidebarTwoVisible) startColumn = 3;
  if (sidemenuVisible) startColumn = 4;

  gridColumn = `${startColumn} / -1`;

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
