/**
 * @file Feedback helpers and error mapping for the project wizard finalize flow.
 *
 * These utilities translate backend progress/error signals into UI-friendly
 * descriptors while keeping the main wizard component lean.
 */

import type {
  WizardFinalizeErrorCategory,
  WizardFinalizeErrorDescriptor,
  WizardFinalizeFeedback,
  WizardFinalizePhase,
  WizardFinalizeProgressDescriptor,
} from "./types";

type ErrorCopy = Pick<WizardFinalizeErrorDescriptor, "headline" | "hint">;

const FINALIZE_PHASE_COPY: Record<WizardFinalizePhase, WizardFinalizeProgressDescriptor> = {
  "validating-input": {
    phase: "validating-input",
    headline: "Validating project data",
    description: "Checking project details before starting the creation flow.",
    actionLabel: "Validating…",
  },
  "creating-project-record": {
    phase: "creating-project-record",
    headline: "Creating project",
    description: "Saving project information and initial metadata.",
    actionLabel: "Creating…",
  },
  "preparing-folders": {
    phase: "preparing-folders",
    headline: "Preparing project folders",
    description: "Setting up the project directory structure on disk.",
    actionLabel: "Preparing…",
  },
  "copying-assets": {
    phase: "copying-assets",
    headline: "Copying project files",
    description: "Organising files according to their selected roles.",
    actionLabel: "Copying…",
  },
  "registering-database": {
    phase: "registering-database",
    headline: "Registering files",
    description: "Recording file metadata in the database.",
    actionLabel: "Saving…",
  },
  "planning-conversions": {
    phase: "planning-conversions",
    headline: "Planning conversions",
    description: "Scheduling translation conversions for each language pair.",
    actionLabel: "Planning…",
  },
  "running-conversions": {
    phase: "running-conversions",
    headline: "Converting files",
    description: "Generating XLIFF files for each language pair.",
    actionLabel: "Converting…",
  },
};

const FINALIZE_ERROR_COPY: Record<WizardFinalizeErrorCategory, ErrorCopy> = {
  validation: {
    headline: "Check project information",
    hint: "Review the project details and language selections, then try again.",
  },
  filesystem: {
    headline: "Unable to prepare project folders",
    hint: "Verify the destination path is accessible and you have permission to create files.",
  },
  database: {
    headline: "Database update failed",
    hint: "The project was not saved. Try again or contact support if the issue persists.",
  },
  conversion: {
    headline: "Conversion planner failed",
    hint: "Check the uploaded files and language pairs before retrying.",
  },
  unknown: {
    headline: "We couldn’t complete the project setup",
    hint: "Retry the operation. If it keeps failing, gather logs and contact support.",
  },
};

const ERROR_CODE_CATEGORY: Record<string, WizardFinalizeErrorCategory> = {
  VALIDATION_FAILED: "validation",
  INVALID_PAYLOAD: "validation",
  LANGUAGE_PAIR_INVALID: "validation",
  PROJECT_NAME_CONFLICT: "validation",
  FS_CREATE_DIR_FAILED: "filesystem",
  FS_COPY_FAILED: "filesystem",
  FS_PERMISSION_DENIED: "filesystem",
  DB_TRANSACTION_FAILED: "database",
  DB_WRITE_FAILED: "database",
  DB_CONSTRAINT_VIOLATION: "database",
  CONVERSION_PLAN_FAILED: "conversion",
  CONVERSION_STREAM_FAILED: "conversion",
};

interface BackendErrorShape {
  code?: string;
  message?: string;
  detail?: string;
}

const IPC_MESSAGE_PREFIX = /^\[IPC\]\s+[\w-]+\s+failed:\s*/i;

function normalizeIpcMessage(message: string): string {
  return message.replace(IPC_MESSAGE_PREFIX, "").trim();
}

function parseBackendError(error: unknown): BackendErrorShape {
  if (error instanceof Error) {
    return { message: normalizeIpcMessage(error.message) };
  }

  if (typeof error === "string") {
    return { message: normalizeIpcMessage(error) };
  }

  if (error && typeof error === "object") {
    const candidate = error as Record<string, unknown>;
    let code: string | undefined;
    let message: string | undefined;
    let detail: string | undefined;

    if (typeof candidate.code === "string") {
      code = candidate.code;
    }

    if (typeof candidate.message === "string") {
      message = candidate.message;
    }

    if (typeof candidate.detail === "string") {
      detail = candidate.detail;
    }

    const data = candidate.data;
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      if (!code && typeof record.code === "string") {
        code = record.code;
      }
      if (!message && typeof record.message === "string") {
        message = record.message;
      }
      if (!detail && typeof record.detail === "string") {
        detail = record.detail;
      }
    }

    if (!message && typeof candidate.error === "string") {
      message = candidate.error;
    }

    return {
      code,
      message: message ? normalizeIpcMessage(message) : undefined,
      detail,
    };
  }

  return {};
}

function inferCategoryFromMessage(message?: string): WizardFinalizeErrorCategory {
  if (!message) {
    return "unknown";
  }

  const normalized = message.toLowerCase();
  if (
    normalized.includes("language") ||
    normalized.includes("valid") ||
    normalized.includes("required") ||
    normalized.includes("input")
  ) {
    return "validation";
  }

  if (
    normalized.includes("folder") ||
    normalized.includes("directory") ||
    normalized.includes("filesystem") ||
    normalized.includes("permission") ||
    normalized.includes("path")
  ) {
    return "filesystem";
  }

  if (
    normalized.includes("database") ||
    normalized.includes("sqlite") ||
    normalized.includes("constraint") ||
    normalized.includes("transaction")
  ) {
    return "database";
  }

  if (
    normalized.includes("convert") ||
    normalized.includes("xliff") ||
    normalized.includes("openxliff") ||
    normalized.includes("xlf")
  ) {
    return "conversion";
  }

  return "unknown";
}

function mapErrorCodeToCategory(code?: string, message?: string): WizardFinalizeErrorCategory {
  if (!code) {
    return inferCategoryFromMessage(message);
  }

  const normalized = code.toUpperCase();
  return ERROR_CODE_CATEGORY[normalized] ?? inferCategoryFromMessage(message);
}

export function createProgressFeedback(
  phase: WizardFinalizePhase,
  descriptionOverride?: string,
): WizardFinalizeFeedback {
  const copy = FINALIZE_PHASE_COPY[phase];
  return {
    status: "progress",
    progress: {
      phase,
      headline: copy.headline,
      description: descriptionOverride ?? copy.description,
      actionLabel: copy.actionLabel,
    },
  };
}

export function createErrorFeedback(
  category: WizardFinalizeErrorCategory,
  description: string,
  detail?: string,
): WizardFinalizeFeedback {
  const copy = FINALIZE_ERROR_COPY[category];
  return {
    status: "error",
    error: {
      category,
      headline: copy.headline,
      description,
      detail,
      hint: copy.hint,
    },
  };
}

export function isWizardFinalizePhase(value: unknown): value is WizardFinalizePhase {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(FINALIZE_PHASE_COPY, value)
  );
}

export function resolveFinalizeError(error: unknown): WizardFinalizeFeedback {
  const parsed = parseBackendError(error);
  const category = mapErrorCodeToCategory(parsed.code, parsed.message);
  const description = parsed.message ?? FINALIZE_ERROR_COPY[category].hint ?? "Unknown error";
  const detail = parsed.detail;

  return createErrorFeedback(category, description, detail);
}
