export type DateParts = {
  label: string;
  detail: string;
  relative: string;
  // New responsive formats
  compact: string;
  short: string;
  medium: string;
  full: string;
};

const LABEL_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const DETAIL_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "full",
  timeStyle: "long",
});

// Enhanced formatters for responsive design
const COMPACT_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const SHORT_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "2-digit",
});

const MEDIUM_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const FULL_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function toRelative(from: Date, to: Date): string {
  const diffMs = from.getTime() - to.getTime();
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (abs < minute) {
    const seconds = Math.round(diffMs / 1000);
    return RELATIVE_FORMATTER.format(seconds, "second");
  }
  if (abs < hour) {
    const minutes = Math.round(diffMs / minute);
    return RELATIVE_FORMATTER.format(minutes, "minute");
  }
  if (abs < day) {
    const hours = Math.round(diffMs / hour);
    return RELATIVE_FORMATTER.format(hours, "hour");
  }
  if (abs < week) {
    const days = Math.round(diffMs / day);
    return RELATIVE_FORMATTER.format(days, "day");
  }
  const weeks = Math.round(diffMs / week);
  return RELATIVE_FORMATTER.format(weeks, "week");
}

export function formatDateParts(isoDate: string | Date | null | undefined): DateParts {
  if (!isoDate) return {
    label: "—",
    detail: "—",
    relative: "—",
    compact: "—",
    short: "—",
    medium: "—",
    full: "—"
  };
  const parsed = isoDate instanceof Date ? isoDate : new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return {
    label: "—",
    detail: "—",
    relative: "—",
    compact: "—",
    short: "—",
    medium: "—",
    full: "—"
  };
  const now = new Date();
  return {
    label: LABEL_FORMATTER.format(parsed),
    detail: DETAIL_FORMATTER.format(parsed),
    relative: toRelative(parsed, now),
    compact: COMPACT_FORMATTER.format(parsed),
    short: SHORT_FORMATTER.format(parsed),
    medium: MEDIUM_FORMATTER.format(parsed),
    full: FULL_FORMATTER.format(parsed),
  };
}

/**
 * Get responsive date format based on viewport size
 * @param dateParts - DateParts object
 * @param breakpoint - Current breakpoint info
 * @returns appropriate date string for the screen size
 */
export function getResponsiveDateFormat(dateParts: DateParts, isMobile: boolean, isTablet: boolean): string {
  if (isMobile) return dateParts.relative;
  if (isTablet) return dateParts.compact;
  return dateParts.full;
}

