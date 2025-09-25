import "./css-styles/layout-preview.css";

interface LayoutPreviewProps {
  label: string;
}

export function LayoutPreview({ label }: LayoutPreviewProps) {
  return (
    <div className="layout-preview">
      {label}
    </div>
  );
}
