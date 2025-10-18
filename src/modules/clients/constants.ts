export const CLIENT_FILTER_OPTIONS = [
  { value: "all", label: "All clients" },
  { value: "with-contact", label: "With contact info" },
  { value: "missing-contact", label: "Missing contact info" },
] as const;

export type ClientsFilterValue = (typeof CLIENT_FILTER_OPTIONS)[number]["value"];

export const DEFAULT_CLIENT_FILTER: ClientsFilterValue = "all";
