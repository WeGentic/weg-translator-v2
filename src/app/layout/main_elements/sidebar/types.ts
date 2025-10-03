import type { ComponentType } from "react";

export type MenuItem = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  route?: string;
  badge?: number | string;
  onClose?: () => void;
  children?: MenuItem[];
  shortcut?: string;
  notification?: boolean;
  disabled?: boolean;
};

export type MenuTree = {
  fixedItems: MenuItem[];
  temporaryItems?: MenuItem[];
  editorItems?: MenuItem[];
};
