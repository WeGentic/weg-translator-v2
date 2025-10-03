/**
 * Placeholder footer surfaced when the editor is active. The real footer will
 * eventually display editor-specific status and collaboration cues.
 */
export function EditorFooterPlaceholder() {
  return (
    <div className="flex w-full items-center justify-between gap-4 text-xs text-muted-foreground">
      <div className="flex flex-col">
        <span className="font-medium text-foreground/80">Editor workspace preview</span>
        <span className="text-[11px]">Real-time translation tools will appear here.</span>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <div className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
        <span className="font-medium text-foreground/70">LLM agent idle</span>
      </div>
    </div>
  );
}

export default EditorFooterPlaceholder;
