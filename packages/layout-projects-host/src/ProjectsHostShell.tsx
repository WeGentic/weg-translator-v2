import {
  Fragment,
  isValidElement,
  type CSSProperties,
  type HTMLAttributes,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
} from "react";

import "./styles/projects-host.css";

const HOST_CLASSNAME =
  "flex h-full flex-col overflow-hidden rounded-tl-xl rounded-bl-xl border-t border-l border-b border-border bg-popover shadow-sm";

type HostSlot = "header" | "toolbar" | "content" | "footer";

type SlotProps = PropsWithChildren<unknown>;

interface SlotComponent<P = SlotProps> {
  (props: P): ReactElement | null;
  displayName?: string;
  __slot: HostSlot;
}

export interface ProjectsHostShellSlotProps {
  header?: HTMLAttributes<HTMLDivElement>;
  toolbar?: HTMLAttributes<HTMLDivElement>;
  content?: HTMLAttributes<HTMLDivElement>;
  footer?: HTMLAttributes<HTMLDivElement>;
}

export interface ProjectsHostShellProps extends PropsWithChildren {
  header?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  className?: string;
  slotProps?: ProjectsHostShellSlotProps;
  contentOverflow?: CSSProperties["overflowY"];
}

const HeaderSlot = createSlot("header", "ProjectsHostShell.Header");
const ToolbarSlot = createSlot("toolbar", "ProjectsHostShell.Toolbar");
const ContentSlot = createSlot("content", "ProjectsHostShell.Content");
const FooterSlot = createSlot("footer", "ProjectsHostShell.Footer");

function ProjectsHostShellBase({
  header,
  toolbar,
  footer,
  children,
  className,
  slotProps,
  contentOverflow = "auto",
}: ProjectsHostShellProps): ReactElement {
  const slotCollections: Record<HostSlot, ReactNode[]> = {
    header: [],
    toolbar: [],
    content: [],
    footer: [],
  };
  const looseChildren: ReactNode[] = [];

  const childCollection: ReactNode[] = [];
  flattenChildren(children, childCollection);

  childCollection.forEach((child) => {
    if (!isValidElement(child)) {
      looseChildren.push(child);
      return;
    }

    const slot = getSlot(child as ReactElement);
    if (!slot) {
      looseChildren.push(child);
      return;
    }

    slotCollections[slot].push((child as ReactElement<SlotProps>).props.children);
  });

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
    "projects-table-header-zone flex items-center justify-between px-4",
    "header",
  ) as HTMLAttributes<HTMLDivElement>;

  const toolbarAttributes = buildSlotAttributes(
    slotProps?.toolbar,
    "projects-table-toolbar-zone",
    "toolbar",
  ) as HTMLAttributes<HTMLDivElement>;

  const contentAttributes = buildSlotAttributes(
    slotProps?.content,
    "projects-table-main-zone",
    "content",
  ) as HTMLAttributes<HTMLDivElement>;

  const footerAttributes = buildSlotAttributes(
    slotProps?.footer,
    "flex-shrink-0 border-t-2 border-border bg-gradient-to-r from-muted/15 via-muted/8 to-transparent backdrop-blur-sm shadow-sm",
    "footer",
  ) as HTMLAttributes<HTMLDivElement>;

  const hostClassName = mergeClassNames(HOST_CLASSNAME, className);
  const contentStyle = mergeStyles(contentAttributes.style, { overflowY: contentOverflow });

  return (
    <div className={hostClassName} data-component="projects-host-shell">
      {resolvedHeader ? (
        <Fragment>
          <div {...headerAttributes}>{resolvedHeader}</div>
          <div className="sidebar-one__logo-divider" aria-hidden="true" />
        </Fragment>
      ) : null}
      {resolvedToolbar ? <div {...toolbarAttributes}>{resolvedToolbar}</div> : null}
      <div className="flex-1 flex flex-col min-h-0">
        <div {...contentAttributes} style={contentStyle}>
          {resolvedContent}
        </div>
        {resolvedFooter ? <div {...footerAttributes}>{resolvedFooter}</div> : null}
      </div>
    </div>
  );
}

type ProjectsHostShellComponent = ((props: ProjectsHostShellProps) => ReactElement | null) & {
  Header: SlotComponent;
  Toolbar: SlotComponent;
  Content: SlotComponent;
  Footer: SlotComponent;
};

const ProjectsHostShellWithSlots = ProjectsHostShellBase as ProjectsHostShellComponent;
ProjectsHostShellWithSlots.Header = HeaderSlot;
ProjectsHostShellWithSlots.Toolbar = ToolbarSlot;
ProjectsHostShellWithSlots.Content = ContentSlot;
ProjectsHostShellWithSlots.Footer = FooterSlot;

export const ProjectsHostShell = ProjectsHostShellWithSlots;

export type ProjectsHostShellHeaderProps = PropsWithChildren;
export type ProjectsHostShellToolbarProps = PropsWithChildren;
export type ProjectsHostShellContentProps = PropsWithChildren;
export type ProjectsHostShellFooterProps = PropsWithChildren;

type SlotAttributes = HTMLAttributes<HTMLDivElement> & { [key: string]: unknown };

function createSlot(slot: HostSlot, displayName: string): SlotComponent {
  const Slot: SlotComponent = ({ children }) => {
    return <Fragment>{children}</Fragment>;
  };
  Slot.displayName = displayName;
  Slot.__slot = slot;
  return Slot;
}

function getSlot(element: ReactElement): HostSlot | null {
  const type = element.type;
  if (typeof type === "function" && "__slot" in (type as Record<string, unknown>)) {
    return (type as SlotComponent).__slot;
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
  return [...nodes];
}

function mergeClassNames(...values: Array<string | undefined | null>): string {
  return values.filter(Boolean).join(" ");
}

function buildSlotAttributes(
  attributes: SlotAttributes | undefined,
  baseClassName: string,
  slotName: HostSlot,
): SlotAttributes {
  const merged = { ...(attributes ?? {}) } as SlotAttributes;
  if ("children" in merged) {
    delete (merged as { children?: ReactNode }).children;
  }
  merged.className = mergeClassNames(baseClassName, merged.className);
  if (merged["data-slot"] == null) {
    merged["data-slot"] = slotName;
  }
  return merged;
}

function mergeStyles(
  base: CSSProperties | undefined,
  overrides: CSSProperties,
): CSSProperties {
  return { ...(base ?? {}), ...overrides };
}

function flattenChildren(node: ReactNode, collection: ReactNode[]): void {
  if (node == null || typeof node === "boolean") {
    return;
  }
  if (Array.isArray(node)) {
    (node as ReactNode[]).forEach((childNode) => {
      flattenChildren(childNode, collection);
    });
    return;
  }
  if (isValidElement(node) && node.type === Fragment) {
    const fragmentChildren = (node.props as { children?: ReactNode }).children;
    flattenChildren(fragmentChildren ?? null, collection);
    return;
  }
  collection.push(node as ReactNode);
}

export type { ProjectsHostShellProps, ProjectsHostShellSlotProps };
