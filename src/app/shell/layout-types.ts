import type { ReactNode } from "react";

export type LayoutVisibility = {
  footer?: boolean;
};

export type BackgroundConfig =
  | { kind: "default" }
  | { kind: "gradient"; name: string }
  | { kind: "image"; src: string; blur?: number }
  | { kind: "component"; element: ReactNode };

export type LayoutSlotKey = "footer" | "background";

export interface LayoutSlots {
  footer?: ReactNode;
  background?: ReactNode;
}

export interface LayoutStaticData extends LayoutVisibility {
  background?: BackgroundConfig;
  slots?: Partial<LayoutSlots>;
}

export const LAYOUT_SLOT_SOURCE_ORDER = [
  "static-data",
  "component-slot",
  "global-default",
] as const;

export type LayoutSlotSource = (typeof LAYOUT_SLOT_SOURCE_ORDER)[number];

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    layout?: LayoutStaticData;
  }
}
