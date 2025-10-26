export interface DashboardEmail {
  id: string;
  sender: string;
  senderAvatar?: string;
  subject: string;
  preview: string;
  receivedAt: string;
  unread: boolean;
  hasAttachment?: boolean;
  priority?: "low" | "normal" | "high";
}

export interface DashboardClientSnapshot {
  id: string;
  name: string;
  industry: string;
  accountManager: string;
  status: "active" | "onboarding" | "paused";
  contactEmail: string;
  contractsExpiringInDays: number;
}

export type DashboardProjectStatus =
  | "planning"
  | "in-progress"
  | "review"
  | "blocked"
  | "delivered";

export type DashboardStatusFilter = "all" | DashboardProjectStatus;

export interface DashboardProjectSummary {
  id: string;
  name: string;
  languagePair: string;
  progress: number;
  status: DashboardProjectStatus;
  dueDate: string;
  owner: string;
}

export interface DashboardResourceLink {
  id: string;
  label: string;
  description: string;
  href: string;
  category: "documentation" | "guidelines" | "reporting" | "support";
  external?: boolean;
}

export type DashboardOptionEntry =
  | {
      id: string;
      kind: "toggle";
      title: string;
      description: string;
      enabled: boolean;
    }
  | {
      id: string;
      kind: "link";
      title: string;
      description: string;
      href: string;
    }
  | {
      id: string;
      kind: "action";
      title: string;
      description: string;
      actionLabel: string;
      disabled?: boolean;
    };

export interface DashboardTimeInsight {
  localTime: string;
  utcOffset: string;
  timezone: string;
  nextSyncAt: string;
  dailyTranslationMinutes: number;
}

export type DashboardTabStatus = "active" | "idle" | "awaiting-review" | "completed";

export interface DashboardOpenTab {
  id: string;
  projectName: string;
  documentName: string;
  languagePair: string;
  status: DashboardTabStatus;
  updatedAt: string;
}

export interface DashboardSnapshot {
  emails: DashboardEmail[];
  client: DashboardClientSnapshot;
  projects: DashboardProjectSummary[];
  resources: DashboardResourceLink[];
  options: DashboardOptionEntry[];
  time: DashboardTimeInsight;
  openTabs: DashboardOpenTab[];
}
