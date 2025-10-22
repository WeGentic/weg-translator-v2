import type { DraftFileEntry, FileRoleValue, WizardDraftSnapshot, WizardStep } from "./types";

const STORAGE_KEY = "weg-translator:wizard:create-project:draft";
const SNAPSHOT_VERSION = 1;

type PersistedDraftPayload = {
  version: number;
  snapshot: PersistedDraftSnapshot;
};

type PersistedDraftSnapshot = {
  step?: unknown;
  projectName?: unknown;
  clientName?: unknown;
  selectedClientUuid?: unknown;
  projectField?: unknown;
  notes?: unknown;
  sourceLanguage?: unknown;
  targetLanguages?: unknown;
  files?: unknown;
  updatedAt?: unknown;
};

type PersistedDraftFile = {
  id?: unknown;
  name?: unknown;
  extension?: unknown;
  role?: unknown;
  path?: unknown;
};

export function loadWizardDraftSnapshot(): WizardDraftSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedDraftPayload | PersistedDraftSnapshot;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const payload = isPersistedDraftPayload(parsed) ? parsed.snapshot : parsed;
    const snapshot = sanitizePersistedSnapshot(payload);
    if (!snapshot) {
      return null;
    }

    return snapshot;
  } catch {
    return null;
  }
}

export function persistWizardDraftSnapshot(snapshot: WizardDraftSnapshot): void {
  if (typeof window === "undefined") {
    return;
  }

  const serializable: PersistedDraftPayload = {
    version: SNAPSHOT_VERSION,
    snapshot: {
      step: snapshot.step,
      projectName: snapshot.projectName,
      clientName: snapshot.clientName,
      selectedClientUuid: snapshot.selectedClientUuid,
      projectField: snapshot.projectField,
      notes: snapshot.notes,
      sourceLanguage: snapshot.sourceLanguage,
      targetLanguages: [...snapshot.targetLanguages],
      files: snapshot.files.map((entry) => ({
        id: entry.id,
        name: entry.name,
        extension: entry.extension,
        role: entry.role,
        path: entry.path,
      })),
      updatedAt: snapshot.updatedAt,
    },
  };

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch (error) {
    console.warn("[wizard] unable to persist draft snapshot", error);
  }
}

export function clearWizardDraftSnapshot(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("[wizard] unable to clear draft snapshot", error);
  }
}

function isPersistedDraftPayload(candidate: unknown): candidate is PersistedDraftPayload {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }

  if (!("version" in candidate) || !("snapshot" in candidate)) {
    return false;
  }

  return typeof (candidate as PersistedDraftPayload).snapshot === "object";
}

function sanitizePersistedSnapshot(input: PersistedDraftSnapshot): WizardDraftSnapshot | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const projectName = pickString(input.projectName);
  const clientName = pickString(input.clientName);
  const projectField = pickString(input.projectField);
  const notes = pickString(input.notes);

  const selectedClientUuid = pickNullableString(input.selectedClientUuid);
  const sourceLanguage = pickNullableString(input.sourceLanguage);

  const targetLanguages = Array.isArray(input.targetLanguages)
    ? Array.from(
        new Set(
          input.targetLanguages
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter((value) => value.length > 0),
        ),
      )
    : [];

  const files = Array.isArray(input.files)
    ? sanitizeFiles(input.files as PersistedDraftFile[])
    : [];

  const step = resolveStep(input.step);
  const updatedAt = typeof input.updatedAt === "number" && Number.isFinite(input.updatedAt)
    ? input.updatedAt
    : Date.now();

  return {
    step,
    projectName,
    clientName,
    selectedClientUuid,
    projectField,
    notes,
    sourceLanguage,
    targetLanguages,
    files,
    updatedAt,
  };
}

function sanitizeFiles(entries: PersistedDraftFile[]): DraftFileEntry[] {
  const sanitized: DraftFileEntry[] = [];
  const seenPaths = new Set<string>();

  for (const entry of entries) {
    const id = pickString(entry.id);
    const name = pickString(entry.name);
    const extension = pickString(entry.extension);
    const role = pickRole(entry.role);
    const path = pickString(entry.path);

    if (!id || !path || !role) {
      continue;
    }

    const normalizedPath = path.trim();
    if (normalizedPath.length === 0 || seenPaths.has(normalizedPath)) {
      continue;
    }

    sanitized.push({
      id,
      name,
      extension,
      role,
      path: normalizedPath,
    });

    seenPaths.add(normalizedPath);
  }

  return sanitized;
}

function resolveStep(value: unknown): WizardStep {
  if (value === "files") {
    return "files";
  }
  return "details";
}

function pickString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value;
}

function pickNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

function pickRole(value: unknown): FileRoleValue | null {
  if (
    value === "undefined" ||
    value === "processable" ||
    value === "reference" ||
    value === "instructions" ||
    value === "image" ||
    value === "ocr"
  ) {
    return value;
  }
  return null;
}
