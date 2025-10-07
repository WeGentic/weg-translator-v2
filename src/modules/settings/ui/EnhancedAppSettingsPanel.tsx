import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, FolderSymlink, Monitor, Moon, Sun } from "lucide-react";

import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { ProjectsHostShell } from "@wegentic/layout-projects-host"; // Rollback: swap to ThreeZonePanel if verification finds regressions.
import { cn } from "@/shared/utils/class-names";
import {
  getAppSettings,
  updateAppFolder,
  updateAutoConvertOnOpen,
  updateTheme,
  updateUiLanguage,
  updateDefaultLanguages,
  updateXliffVersion,
  updateNotifications,
  updateMaxParallelConversions,
} from "@/core/ipc";
import type { AppSettings } from "@/core/ipc";

import { SettingsTabs, DEFAULT_SETTINGS_TABS } from "./SettingsTabs";
import { SettingsSection } from "./SettingsSection";
import {
  SwitchSettingItem,
  SelectSettingItem,
  CustomSettingItem,
} from "./SettingItem";

// Language options
const UI_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Português" },
];

const TRANSLATION_LANGUAGES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "es-MX", label: "Spanish (Mexico)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "de-DE", label: "German (Germany)" },
  { value: "it-IT", label: "Italian (Italy)" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "pt-PT", label: "Portuguese (Portugal)" },
  { value: "ja-JP", label: "Japanese" },
  { value: "ko-KR", label: "Korean" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "zh-TW", label: "Chinese (Traditional)" },
  { value: "ar-SA", label: "Arabic" },
  { value: "ru-RU", label: "Russian" },
];

const XLIFF_VERSIONS = [
  { value: "2.0", label: "XLIFF 2.0" },
  { value: "2.1", label: "XLIFF 2.1" },
  { value: "2.2", label: "XLIFF 2.2" },
];

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
  { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4" /> },
  { value: "auto", label: "System", icon: <Monitor className="h-4 w-4" /> },
];

const KEYBOARD_SHORTCUTS = [
  { keys: ["Ctrl", "Shift", "S"], action: "Open Settings", description: "Open the settings panel" },
  { keys: ["Ctrl", "N"], action: "New Project", description: "Create a new translation project" },
  { keys: ["Ctrl", "O"], action: "Open Project", description: "Open an existing project" },
  { keys: ["Ctrl", "S"], action: "Save", description: "Save current work" },
  { keys: ["F11"], action: "Toggle Fullscreen", description: "Enter or exit fullscreen mode" },
  { keys: ["Ctrl", ","], action: "Preferences", description: "Open application preferences" },
];

const SETTINGS_TAB_ITEMS = [
  DEFAULT_SETTINGS_TABS.GENERAL,
  DEFAULT_SETTINGS_TABS.TRANSLATION,
  DEFAULT_SETTINGS_TABS.STORAGE,
  DEFAULT_SETTINGS_TABS.SHORTCUTS,
  DEFAULT_SETTINGS_TABS.ADVANCED,
] as const;

const DEFAULT_ACTIVE_TAB = DEFAULT_SETTINGS_TABS.GENERAL.id;

function buildShortcutKeyIds(shortcut: (typeof KEYBOARD_SHORTCUTS)[number]) {
  const segments: Array<{ id: string; label: string; isLast: boolean }> = [];
  let accumulator = shortcut.action.replace(/\s+/g, "-").toLowerCase();
  shortcut.keys.forEach((label, index) => {
    accumulator = `${accumulator}-${label.toLowerCase()}`;
    segments.push({
      id: accumulator,
      label,
      isLast: index === shortcut.keys.length - 1,
    });
  });
  return segments;
}

export function EnhancedAppSettingsPanel() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_ACTIVE_TAB);
  const [searchTerm, setSearchTerm] = useState("");

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAppSettings();
      setSettings(data);
      return true;
    } catch (unknownError) {
      const message =
        unknownError instanceof Error ? unknownError.message : "Failed to load application settings.";
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const showStatus = useCallback((message: string) => {
    setStatus(message);
    setTimeout(() => setStatus(null), 3000);
  }, []);

  const handleUpdateSetting = useCallback(async (
    updateFn: () => Promise<AppSettings>,
    successMessage: string
  ) => {
    setIsUpdating(true);
    setError(null);
    try {
      const updated = await updateFn();
      setSettings(updated);
      showStatus(successMessage);
    } catch (unknownError) {
      const message =
        unknownError instanceof Error ? unknownError.message : "Unable to update setting.";
      setError(message);
    } finally {
      setIsUpdating(false);
    }
  }, [showStatus]);

  const handleChangeFolder = useCallback(async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selection = await open({ directory: true, multiple: false });
    const nextFolder = typeof selection === "string"
      ? selection
      : Array.isArray(selection)
        ? selection[0] ?? null
        : null;
    if (!nextFolder) return;

    await handleUpdateSetting(
      () => updateAppFolder(nextFolder),
      "Application folder updated successfully."
    );
  }, [handleUpdateSetting]);

  const handleRefreshSettings = useCallback(async () => {
    const refreshed = await loadSettings();
    if (refreshed) {
      showStatus("Settings reloaded from disk.");
    }
  }, [loadSettings, showStatus]);

  const alerts: ReactNode = (
    <>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {status ? (
        <Alert>
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );

  let panelBody: ReactNode;

  if (isLoading) {
    panelBody = (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading settings…</div>
      </div>
    );
  } else if (!settings) {
    panelBody = (
      <div className="space-y-4">
        {alerts}
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-sm text-muted-foreground">Settings are unavailable.</div>
        </div>
      </div>
    );
  } else {
    const generalTab = (
      <div className="space-y-6">
        <SettingsSection
          title="Appearance"
          description="Customize the look and feel of the application"
        >
          <SelectSettingItem
            label="Theme"
            description="Choose your preferred color theme"
            tooltip="Light theme for bright environments, dark theme for low-light conditions, or system to match your OS preference"
          >
            <Select
              value={settings.theme}
              onValueChange={(value) => {
                void handleUpdateSetting(
                  () => updateTheme(value),
                  "Theme updated successfully."
                );
              }}
              disabled={isUpdating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEME_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {option.icon}
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SelectSettingItem>

          <SelectSettingItem
            label="Interface Language"
            description="Choose the language for the user interface"
            tooltip="This changes the language of all menus, buttons, and messages in the application"
          >
          <Select
            value={settings.uiLanguage}
            onValueChange={(value) => {
              void handleUpdateSetting(
                () => updateUiLanguage(value),
                "Interface language updated successfully."
              );
            }}
            disabled={isUpdating}
          >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UI_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SelectSettingItem>
        </SettingsSection>

        <SettingsSection
          title="Notifications"
          description="Control how and when you receive notifications"
        >
          <SwitchSettingItem
            label="Show Notifications"
            description="Display system notifications for important events"
            tooltip="Enable this to receive notifications about completed translations, errors, and other important events"
            checked={settings.showNotifications}
            onCheckedChange={(checked) => {
              void handleUpdateSetting(
                () => updateNotifications(checked, settings.enableSoundNotifications),
                "Notification preferences updated."
              );
            }}
            disabled={isUpdating}
          />

          <SwitchSettingItem
            label="Sound Notifications"
            description="Play sounds with notifications"
            tooltip="Enable this to play notification sounds when events occur"
            checked={settings.enableSoundNotifications}
            onCheckedChange={(checked) => {
              void handleUpdateSetting(
                () => updateNotifications(settings.showNotifications, checked),
                "Sound notification setting updated."
              );
            }}
            disabled={isUpdating || !settings.showNotifications}
          />
        </SettingsSection>
      </div>
    );

    const translationTab = (
      <div className="space-y-6">
        <SettingsSection
          title="Default Languages"
          description="Set default source and target languages for new translations"
        >
          <SelectSettingItem
            label="Default Source Language"
            description="The default language to translate from"
            tooltip="This will be pre-selected when creating new translation projects"
          >
          <Select
            value={settings.defaultSourceLanguage}
            onValueChange={(value) => {
              void handleUpdateSetting(
                () => updateDefaultLanguages(value, settings.defaultTargetLanguage),
                "Default source language updated."
              );
            }}
            disabled={isUpdating}
          >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSLATION_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SelectSettingItem>

          <SelectSettingItem
            label="Default Target Language"
            description="The default language to translate to"
            tooltip="This will be pre-selected when creating new translation projects"
          >
          <Select
            value={settings.defaultTargetLanguage}
            onValueChange={(value) => {
              void handleUpdateSetting(
                () => updateDefaultLanguages(settings.defaultSourceLanguage, value),
                "Default target language updated."
              );
            }}
            disabled={isUpdating}
          >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSLATION_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SelectSettingItem>
        </SettingsSection>

        <SettingsSection
          title="File Format"
          description="Configure default XLIFF settings"
        >
          <SelectSettingItem
            label="Default XLIFF Version"
            description="Choose the XLIFF version for new files"
            tooltip="XLIFF 2.1 is recommended for most use cases as it provides the best balance of features and compatibility"
          >
          <Select
            value={settings.defaultXliffVersion}
            onValueChange={(value) => {
              void handleUpdateSetting(
                () => updateXliffVersion(value),
                "Default XLIFF version updated."
              );
            }}
            disabled={isUpdating}
          >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {XLIFF_VERSIONS.map((version) => (
                  <SelectItem key={version.value} value={version.value}>
                    {version.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SelectSettingItem>

          <SwitchSettingItem
            label="Auto-convert on Open"
            description="Automatically convert files when opening projects"
            tooltip="When enabled, files will be automatically converted to XLIFF format when you open a project"
            checked={settings.autoConvertOnOpen}
            onCheckedChange={(checked) => {
              void handleUpdateSetting(
                () => updateAutoConvertOnOpen(checked),
                "Auto-convert setting updated."
              );
            }}
            disabled={isUpdating}
          />
        </SettingsSection>
      </div>
    );

    const storageTab = (
      <div className="space-y-6">
        <SettingsSection
          title="Storage Location"
          description="Configure where the application stores its data"
        >
          <CustomSettingItem
            label="Application Folder"
            description="Location where projects, database, and settings are stored"
            tooltip="Choose a folder where you want to store all application data. This includes projects, database files, and configuration"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-2 py-1 text-xs">
                  {settings.appFolder}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleChangeFolder()}
                  disabled={isUpdating}
                  className="flex items-center gap-2"
                >
                  <FolderSymlink className="h-4 w-4" />
                  Change
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                    settings.appFolderExists
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                      : "bg-destructive/10 text-destructive"
                  )}
                >
                  {settings.appFolderExists ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                  {settings.appFolderExists ? "Available" : "Not found"}
                </span>
                <span>•</span>
                <span>{settings.isUsingDefaultLocation ? "Default location" : "Custom location"}</span>
              </div>
            </div>
          </CustomSettingItem>

          <div className="grid gap-3">
            <div className="text-sm font-medium">Managed Files</div>
            <div className="space-y-2">
              {[
                { label: "Database", path: settings.databasePath, exists: settings.databaseExists },
                { label: "Projects", path: settings.projectsPath, exists: settings.projectsPathExists },
                { label: "Settings", path: settings.settingsFile, exists: settings.settingsFileExists },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/5 p-3"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{item.label}</div>
                    <code className="text-xs text-muted-foreground">{item.path}</code>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                      item.exists
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {item.exists ? "Available" : "Missing"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </SettingsSection>
      </div>
    );

    const advancedTab = (
      <div className="space-y-6">
        <SettingsSection
          title="Performance"
          description="Configure performance and processing settings"
        >
          <CustomSettingItem
            label="Max Parallel Conversions"
            description="Maximum number of files to convert simultaneously"
            tooltip="Higher values can speed up conversion of multiple files but use more system resources. Recommended: 2-8 depending on your system"
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="16"
                value={settings.maxParallelConversions}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (value >= 1 && value <= 16) {
                    void handleUpdateSetting(
                      () => updateMaxParallelConversions(value),
                      "Max parallel conversions updated."
                    );
                  }
                }}
                disabled={isUpdating}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">files</span>
            </div>
          </CustomSettingItem>
        </SettingsSection>
      </div>
    );

    const shortcutsTab = (
      <div className="space-y-6">
        <SettingsSection
          title="Keyboard Shortcuts"
          description="Learn about available keyboard shortcuts"
        >
          <div className="space-y-3">
            {KEYBOARD_SHORTCUTS.map((shortcut) => (
              <div
                key={shortcut.action}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/5 p-3"
              >
                <div className="space-y-1">
                  <div className="text-sm font-medium">{shortcut.action}</div>
                  <div className="text-xs text-muted-foreground">{shortcut.description}</div>
                </div>
                <div className="flex items-center gap-1">
                  {buildShortcutKeyIds(shortcut).map(({ id, label, isLast }) => (
                    <span key={id}>
                      <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {label}
                      </kbd>
                      {!isLast ? <span className="mx-1 text-muted-foreground">+</span> : null}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SettingsSection>
      </div>
    );

    const tabs = [
      { ...DEFAULT_SETTINGS_TABS.GENERAL, content: generalTab },
      { ...DEFAULT_SETTINGS_TABS.TRANSLATION, content: translationTab },
      { ...DEFAULT_SETTINGS_TABS.STORAGE, content: storageTab },
      { ...DEFAULT_SETTINGS_TABS.SHORTCUTS, content: shortcutsTab },
      { ...DEFAULT_SETTINGS_TABS.ADVANCED, content: advancedTab },
    ];

    panelBody = (
      <div className="space-y-6">
        {alerts}
        <SettingsTabs
          tabs={tabs}
          defaultTab={DEFAULT_ACTIVE_TAB}
          value={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
    );
  }

  return (
    <section className="flex h-full w-full flex-col" aria-labelledby="settings-heading">
      <ProjectsHostShell
        className="h-full"
        header={
          <div className="flex w-full items-start justify-between">
            <div className="space-y-1">
              <h1 id="settings-heading" className="text-lg font-semibold text-foreground">Settings</h1>
              <p className="text-xs text-muted-foreground">
                Configure application preferences and translation defaults.
              </p>
            </div>
            <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void handleRefreshSettings();
              }}
              disabled={isLoading || isUpdating}
            >
              Reset
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled
              title="Changes are saved automatically"
            >
              Save
            </Button>
          </div>
        </div>
      }
      toolbar={
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search settings"
              aria-label="Search settings"
              className="sm:max-w-xs"
            />
            <Select
              value={activeTab}
              onValueChange={setActiveTab}
              disabled={isLoading || !settings}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Jump to section" />
              </SelectTrigger>
              <SelectContent>
                {SETTINGS_TAB_ITEMS.map((tab) => (
                  <SelectItem key={tab.id} value={tab.id}>
                    {tab.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm("")}
              disabled={!searchTerm}
            >
              Clear search
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void handleRefreshSettings();
              }}
              disabled={isLoading || isUpdating}
            >
              Reload
            </Button>
          </div>
        </div>
      }
        contentOverflow="auto"
        footer={
          <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
            <span>Changes save automatically.</span>
            <span>{isUpdating ? "Applying changes…" : "All settings up to date."}</span>
          </div>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-6 p-4 pb-20 md:p-6">
          {panelBody}
        </div>
      </ProjectsHostShell>
    </section>
  );
}

export default EnhancedAppSettingsPanel;
