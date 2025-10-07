import { type CSSProperties, type PropsWithChildren } from "react";

import { useLayoutSelector } from "./layout-context";
import "@/shared/styles/layout/layout-main.css";

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
 * right of the mounted sidebar rails.
 */
export function LayoutMain({ children, scroll = "auto" }: LayoutMainProps) {
  const sidebarOne = useLayoutSelector((state) => state.sidebarOne);
  const sidebarTwo = useLayoutSelector((state) => state.sidebarTwo);
  const footer = useLayoutSelector((state) => state.footer);

  const sidebarOneVisible = sidebarOne.mounted;
  const sidebarTwoVisible = sidebarTwo.mounted && sidebarTwo.visible;

  let startColumn = 1;
  if (sidebarOneVisible) startColumn = 2;
  if (sidebarTwoVisible) startColumn = 3;

  const gridColumn = `${startColumn} / -1`;
  const footerOffset = footer.mounted && footer.visible ? footer.height : 0;
  const baseSpacing = 8;
  const contentStyle: CSSProperties = {
    paddingTop: `${baseSpacing}px`,
    paddingBottom: `${footerOffset + baseSpacing}px`,
    boxSizing: "border-box",
  };

  return (
    <section
      role="main"
      className="layout-main"
      style={{ gridColumn, gridRow: "1 / 2" }}
    >
      <div
        className={
          scroll === "auto"
            ? "layout-main__content layout-main__content--scroll-auto"
            : "layout-main__content layout-main__content--scroll-hidden"
        }
        style={contentStyle}
      >
        {children}
      </div>
    </section>
  );
}
