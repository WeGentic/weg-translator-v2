import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import {
  IPC_EVENT,
  type ProjectsChangedPayload,
  type TranslationCompletedPayload,
  type TranslationFailedPayload,
  type TranslationProgressPayload,
} from "./types";

export async function onTranslationProgress(
  handler: (payload: TranslationProgressPayload) => void,
): Promise<UnlistenFn> {
  return listen<TranslationProgressPayload>(
    IPC_EVENT.translationProgress,
    (event) => handler(event.payload),
  );
}

export async function onTranslationCompleted(
  handler: (payload: TranslationCompletedPayload) => void,
): Promise<UnlistenFn> {
  return listen<TranslationCompletedPayload>(
    IPC_EVENT.translationCompleted,
    (event) => handler(event.payload),
  );
}

export async function onTranslationFailed(
  handler: (payload: TranslationFailedPayload) => void,
): Promise<UnlistenFn> {
  return listen<TranslationFailedPayload>(
    IPC_EVENT.translationFailed,
    (event) => handler(event.payload),
  );
}

export async function onProjectsUpdated(
  handler: (payload: ProjectsChangedPayload) => void,
): Promise<UnlistenFn> {
  return listen<ProjectsChangedPayload>(
    IPC_EVENT.projectsUpdated,
    (event) => handler(event.payload),
  );
}

export interface TranslationEventHandlers {
  onProgress?: (payload: TranslationProgressPayload) => void;
  onCompleted?: (payload: TranslationCompletedPayload) => void;
  onFailed?: (payload: TranslationFailedPayload) => void;
}

export async function subscribeTranslationEvents(handlers: TranslationEventHandlers) {
  const unlistenAll: UnlistenFn[] = [];

  if (handlers.onProgress) {
    unlistenAll.push(await onTranslationProgress(handlers.onProgress));
  }

  if (handlers.onCompleted) {
    unlistenAll.push(await onTranslationCompleted(handlers.onCompleted));
  }

  if (handlers.onFailed) {
    unlistenAll.push(await onTranslationFailed(handlers.onFailed));
  }

  return () => {
    unlistenAll.forEach((unsubscribe) => unsubscribe());
  };
}
