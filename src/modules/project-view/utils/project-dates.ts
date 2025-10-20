const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat(undefined, {
  style: "short",
  numeric: "auto",
});

export interface ProjectUpdatedFormat {
  relative: string;
  absolute: string;
}

export function formatProjectUpdated(iso: string): ProjectUpdatedFormat {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return { relative: "—", absolute: "—" };
  }

  const date = new Date(parsed);
  const diffMs = Date.now() - date.getTime();
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  let relative: string;
  if (diffMs < hourMs) {
    relative = RELATIVE_TIME_FORMATTER.format(-Math.round(diffMs / minuteMs), "minute");
  } else if (diffMs < dayMs) {
    relative = RELATIVE_TIME_FORMATTER.format(-Math.round(diffMs / hourMs), "hour");
  } else {
    relative = RELATIVE_TIME_FORMATTER.format(-Math.round(diffMs / dayMs), "day");
  }

  return { relative, absolute: DATE_TIME_FORMATTER.format(date) };
}

export function formatProjectCreated(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return "—";
  }
  return DATE_TIME_FORMATTER.format(new Date(parsed));
}

