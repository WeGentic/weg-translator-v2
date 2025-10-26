import type {
  DashboardEmail,
  DashboardClientSnapshot,
  DashboardProjectSummary,
  DashboardResourceLink,
  DashboardOptionEntry,
  DashboardTimeInsight,
  DashboardOpenTab,
  DashboardSnapshot,
} from "./dashboard.types";

export const dashboardMockEmails: DashboardEmail[] = [
  {
    id: "email-001",
    sender: "Localization Ops",
    subject: "Weekly source files ready for review",
    preview: "New brief for the WegBank rollout is attached alongside updated term base...",
    receivedAt: "2025-02-18T08:30:00Z",
    unread: true,
    hasAttachment: true,
    priority: "high",
  },
  {
    id: "email-002",
    sender: "QA Automation",
    subject: "Automated checks passed for FR → EN legal bundle",
    preview: "Regression suite completed with 98% coverage. No blocking defects detected.",
    receivedAt: "2025-02-17T18:15:00Z",
    unread: false,
    hasAttachment: false,
  },
  {
    id: "email-003",
    sender: "Vendor Success",
    subject: "Translator availability update",
    preview: "Three new reviewers signed up for medical terminology streams next week.",
    receivedAt: "2025-02-17T14:22:00Z",
    unread: false,
    hasAttachment: false,
  },
];

export const dashboardMockClient: DashboardClientSnapshot = {
  id: "client-weg-bank",
  name: "WegBank Group",
  industry: "Financial Services",
  accountManager: "Lina Rivas",
  status: "active",
  contactEmail: "localization@wegbank.com",
  contractsExpiringInDays: 132,
};

export const dashboardMockProjects: DashboardProjectSummary[] = [
  {
    id: "project-001",
    name: "Mobile App Strings v3",
    languagePair: "EN → ES",
    progress: 82,
    status: "review",
    dueDate: "2025-02-21",
    owner: "Alex Chen",
  },
  {
    id: "project-002",
    name: "Legal Disclosures Pack",
    languagePair: "EN → DE",
    progress: 46,
    status: "in-progress",
    dueDate: "2025-02-25",
    owner: "Priya Nair",
  },
  {
    id: "project-003",
    name: "Customer Support Macros",
    languagePair: "EN → FR-CA",
    progress: 67,
    status: "planning",
    dueDate: "2025-03-02",
    owner: "Jonas Müller",
  },
];

export const dashboardMockResources: DashboardResourceLink[] = [
  {
    id: "resource-guidelines",
    label: "Terminology Guidelines",
    description: "Latest brand voice and terminology updates for WegBank locales.",
    href: "https://wegentic-resources.example/guidelines",
    category: "guidelines",
    external: true,
  },
  {
    id: "resource-style",
    label: "Style Guide PDF",
    description: "Downloadable reference styling doc for regulated industries.",
    href: "tauri://resources/style-guide.pdf",
    category: "documentation",
    external: false,
  },
  {
    id: "resource-insights",
    label: "Localization Insights",
    description: "Dashboard outlining MT quality metrics and reviewer throughput.",
    href: "https://wegentic-insights.example/dashboard",
    category: "reporting",
    external: true,
  },
];

export const dashboardMockOptions: DashboardOptionEntry[] = [
  {
    id: "option-auto-sync",
    kind: "toggle",
    title: "Auto-sync source files",
    description: "Automatically pull new source files every hour.",
    enabled: true,
  },
  {
    id: "option-desktop-notifications",
    kind: "toggle",
    title: "Desktop notifications",
    description: "Show alerts when translation jobs change status.",
    enabled: false,
  },
  {
    id: "option-preferences",
    kind: "link",
    title: "Open workspace preferences",
    description: "Adjust machine translation engines, glossaries, and reviewers.",
    href: "#open-preferences",
  },
  {
    id: "option-run-maintenance",
    kind: "action",
    title: "Run maintenance",
    description: "Trigger cache cleanup and disk usage optimization.",
    actionLabel: "Run",
  },
];

export const dashboardMockTime: DashboardTimeInsight = {
  localTime: "10:42 AM",
  utcOffset: "UTC-05:00",
  timezone: "America/New_York",
  nextSyncAt: "2025-02-18T11:00:00Z",
  dailyTranslationMinutes: 126,
};

export const dashboardMockOpenTabs: DashboardOpenTab[] = [
  {
    id: "tab-1",
    projectName: "Mobile App Strings v3",
    documentName: "authentication.json",
    languagePair: "EN → ES",
    status: "active",
    updatedAt: "2025-02-18T10:15:00Z",
  },
  {
    id: "tab-2",
    projectName: "Legal Disclosures Pack",
    documentName: "compliance.docx",
    languagePair: "EN → DE",
    status: "awaiting-review",
    updatedAt: "2025-02-18T09:58:00Z",
  },
  {
    id: "tab-3",
    projectName: "Customer Support Macros",
    documentName: "support_macros.xlsx",
    languagePair: "EN → FR-CA",
    status: "idle",
    updatedAt: "2025-02-17T21:37:00Z",
  },
];

export const dashboardMockSnapshot: DashboardSnapshot = {
  emails: dashboardMockEmails,
  client: dashboardMockClient,
  projects: dashboardMockProjects,
  resources: dashboardMockResources,
  options: dashboardMockOptions,
  time: dashboardMockTime,
  openTabs: dashboardMockOpenTabs,
};
