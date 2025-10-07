import {
  Fragment,
  isValidElement,
  type HTMLAttributes,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
} from "react";

import "./styles/panel.css";

const BASE_CLASSNAME = "three-zone-panel flex h-full flex-col overflow-hidden rounded-tl-xl rounded-bl-xl border-t border-l border-b border-border bg-popover shadow-sm";

type PanelSlot = "header" | "toolbar" | "content" | "footer";

interface SlotComponent<P = SlotProps> {
  (props: P): ReactElement | null;
  displayName?: string;
  __slot: PanelSlot;
}

type SlotProps = PropsWithChildren;

type SlotAttributes<T extends HTMLElement> = HTMLAttributes<T> & Record<string, unknown>;

export interface ThreeZonePanelSlotProps {
  header?: SlotAttributes<HTMLElement>;
  toolbar?: SlotAttributes<HTMLDivElement>;
  content?: SlotAttributes<HTMLDivElement>;
  footer?: SlotAttributes<HTMLElement>;
}

export interface ThreeZonePanelProps extends PropsWithChildren {
  header?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  className?: string;
  slotProps?: ThreeZonePanelSlotProps;
  contentOverflow?: "auto" | "hidden";
  variant?: "default" | "quiet";
}

const HeaderSlot = createSlot("header", "ThreeZonePanel.Header");
const ToolbarSlot = createSlot("toolbar", "ThreeZonePanel.Toolbar");
const ContentSlot = createSlot("content", "ThreeZonePanel.Content");
const FooterSlot = createSlot("footer", "ThreeZonePanel.Footer");

export function ThreeZonePanel({
  header,
  toolbar,
  footer,
  children,
  className,
  slotProps,
  contentOverflow = "auto",
  variant = "default",
}: ThreeZonePanelProps) {
  const slotCollections: Record<PanelSlot, ReactNode[]> = {
    header: [],
    toolbar: [],
    content: [],
    footer: [],
  };
  const looseChildren: ReactNode[] = [];

  for (const child of flattenChildren(children)) {
    if (!isValidElement(child)) {
      looseChildren.push(child);
      continue;
    }

    const slot = getSlot(child);
    if (!slot) {
      looseChildren.push(child);
      continue;
    }

    const slotChildren = (child as ReactElement<SlotProps>).props.children;
    slotCollections[slot].push(...flattenChildren(slotChildren));
  }

  if (slotCollections.content.length === 0 && looseChildren.length > 0) {
    looseChildren.forEach((node) => {
      slotCollections.content.push(node);
    });
  }

  const resolvedHeader = header ?? mergeSlotChildren(slotCollections.header);
  const resolvedToolbar = toolbar ?? mergeSlotChildren(slotCollections.toolbar);
  const resolvedContent = mergeSlotChildren(slotCollections.content);
  const resolvedFooter = footer ?? mergeSlotChildren(slotCollections.footer);

  const headerAttributes = buildSlotAttributes(
    slotProps?.header,
    "three-zone-panel__header",
    "header",
  );
  const toolbarAttributes = buildSlotAttributes(
    slotProps?.toolbar,
    "three-zone-panel__toolbar",
    "toolbar",
  );
  const contentAttributes = buildSlotAttributes(
    slotProps?.content,
    getContentClassName(contentOverflow),
    "content",
  );
  const footerAttributes = buildSlotAttributes(
    slotProps?.footer,
    "three-zone-panel__footer",
    "footer",
  );

  return (
    <section
      className={mergeClassNames(BASE_CLASSNAME, className)}
      data-slot="panel"
      data-variant={variant}
      role="group"
    >
      {resolvedHeader ? (
        <header {...headerAttributes}>{resolvedHeader}</header>
      ) : null}
      {resolvedToolbar ? (
        <div {...toolbarAttributes}>{resolvedToolbar}</div>
      ) : null}
      <div {...contentAttributes}>{resolvedContent}</div>
      {resolvedFooter ? (
        <footer {...footerAttributes}>{resolvedFooter}</footer>
      ) : null}
    </section>
  );
}

ThreeZonePanel.Header = HeaderSlot;
ThreeZonePanel.Toolbar = ToolbarSlot;
ThreeZonePanel.Content = ContentSlot;
ThreeZonePanel.Footer = FooterSlot;

export const PanelHeader = HeaderSlot;
export const PanelToolbar = ToolbarSlot;
export const PanelContent = ContentSlot;
export const PanelFooter = FooterSlot;

export type ThreeZonePanelHeaderProps = PropsWithChildren;
export type ThreeZonePanelToolbarProps = PropsWithChildren;
export type ThreeZonePanelContentProps = PropsWithChildren;
export type ThreeZonePanelFooterProps = PropsWithChildren;

function createSlot(slot: PanelSlot, displayName: string): SlotComponent {
  const Slot: SlotComponent = ({ children }: SlotProps) => {
    return <Fragment>{children}</Fragment>;
  };
  Slot.displayName = displayName;
  Slot.__slot = slot;
  return Slot;
}

function hasPanelSlotMetadata(type: unknown): type is SlotComponent {
  return typeof type === "function" && "__slot" in (type as { __slot?: PanelSlot });
}

function getSlot(element: ReactElement): PanelSlot | null {
  const type = element.type;
  if (hasPanelSlotMetadata(type)) {
    return type.__slot;
  }
  return null;
}

function mergeSlotChildren(nodes: ReactNode[] | undefined): ReactNode | null {
  if (!nodes || nodes.length === 0) {
    return null;
  }
  if (nodes.length === 1) {
    return nodes[0];
  }
  return nodes;
}

function mergeClassNames(...values: Array<string | undefined | null>): string {
  return values.filter(Boolean).join(" ");
}

function buildSlotAttributes<T extends HTMLElement>(
  attributes: SlotAttributes<T> | undefined,
  baseClassName: string,
  slotName: PanelSlot,
): SlotAttributes<T> {
  const merged = { ...(attributes ?? {}) } as SlotAttributes<T> & {
    className?: string;
    role?: string;
  };
  merged.className = mergeClassNames(baseClassName, attributes?.className);
  if (merged["data-slot"] == null) {
    merged["data-slot"] = slotName;
  }
  if (slotName === "toolbar" && merged.role == null) {
    merged.role = "toolbar";
  }
  return merged;
}

function getContentClassName(overflow: "auto" | "hidden"): string {
  return mergeClassNames(
    "three-zone-panel__content",
    overflow === "auto" ? "three-zone-panel__content--auto" : "three-zone-panel__content--hidden",
  );
}

function flattenChildren(node: ReactNode): ReactNode[] {
  if (node == null || typeof node === "boolean") {
    return [];
  }
  if (Array.isArray(node)) {
    return (node as ReactNode[]).flatMap((child) => flattenChildren(child));
  }
  return [node];
}
