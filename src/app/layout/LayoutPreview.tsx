interface LayoutPreviewProps {
  label: string;
}

export function LayoutPreview({ label }: LayoutPreviewProps) {
  return (
    <div className="flex h-full w-full items-center justify-center border border-dashed border-neutral-500/60 bg-neutral-900/60 text-xs uppercase tracking-wide text-neutral-200">
      {label}
    </div>
  );
}
