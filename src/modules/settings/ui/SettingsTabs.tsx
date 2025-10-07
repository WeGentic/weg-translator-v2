import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { Settings, Languages, FolderOpen, Palette, Keyboard, Zap } from "lucide-react";

export interface SettingsTab {
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
}

interface SettingsTabsProps {
  tabs: SettingsTab[];
  defaultTab?: string;
  value?: string;
  onTabChange?: (tabId: string) => void;
}

export function SettingsTabs({ tabs, defaultTab, value, onTabChange }: SettingsTabsProps) {
  return (
    <Tabs
      value={value}
      defaultValue={value ?? defaultTab ?? tabs[0]?.id}
      onValueChange={onTabChange}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-6">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground"
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="space-y-6">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

// Predefined tab configurations
export const DEFAULT_SETTINGS_TABS = {
  GENERAL: {
    id: "general",
    label: "General",
    icon: <Settings className="h-4 w-4" />,
  },
  TRANSLATION: {
    id: "translation",
    label: "Translation",
    icon: <Languages className="h-4 w-4" />,
  },
  STORAGE: {
    id: "storage",
    label: "Storage",
    icon: <FolderOpen className="h-4 w-4" />,
  },
  INTERFACE: {
    id: "interface",
    label: "Interface",
    icon: <Palette className="h-4 w-4" />,
  },
  SHORTCUTS: {
    id: "shortcuts",
    label: "Shortcuts",
    icon: <Keyboard className="h-4 w-4" />,
  },
  ADVANCED: {
    id: "advanced",
    label: "Advanced",
    icon: <Zap className="h-4 w-4" />,
  },
} as const;

export default SettingsTabs;
