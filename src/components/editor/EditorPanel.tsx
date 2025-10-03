import type { ReactNode } from "react";
import { PanelContent, ThreeZonePanel } from "@wegentic/layout-three-zone";
import {
  ArrowDownWideNarrow,
  CheckCheck,
  Compass,
  GripVertical,
  Search,
  SkipBack,
  SkipForward,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { EditorFooterPlaceholder } from "@/components/editor/EditorFooterPlaceholder";
import { EditorHeader } from "@/components/editor/EditorHeader";
import { EditorPlaceholder } from "@/components/editor/EditorPlaceholder";

export interface EditorPanelProps {
  projectName?: string;
  documentName?: string;
  statusLabel?: string;
  onBackToOverview?: () => void;
  onCloseEditor?: () => void;
  children?: ReactNode;
}

export function EditorPanel({
  projectName,
  documentName,
  statusLabel = "Draft",
  onBackToOverview,
  onCloseEditor,
  children,
}: EditorPanelProps) {
  const subtitle = projectName ? `${projectName}${documentName ? ` · ${documentName}` : ""}` : documentName;

  return (
    <ThreeZonePanel
      contentOverflow="auto"
      header={
        <EditorHeader
          title={documentName ?? projectName ?? "Editor"}
          subtitle={subtitle && subtitle !== (documentName ?? projectName ?? "Editor") ? subtitle : undefined}
          onNavigateBack={onBackToOverview}
          onCloseEditor={onCloseEditor}
        />
      }
      toolbar={<EditorToolbar statusLabel={statusLabel} />}
      footer={<EditorFooterPlaceholder />}
    >
      <PanelContent>
        <div className="flex min-h-0 flex-1 flex-col">
          {children ?? <EditorPlaceholder projectName={projectName} />}
        </div>
      </PanelContent>
    </ThreeZonePanel>
  );
}

interface EditorToolbarProps {
  statusLabel: string;
}

function EditorToolbar({ statusLabel }: EditorToolbarProps) {
  return (
    <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex w-full flex-1 items-center gap-2">
          <Input
            placeholder="Search segments"
            className="sm:max-w-xs"
            aria-label="Search segments"
          />
          <Button type="button" variant="secondary" size="sm" className="whitespace-nowrap">
            <Search className="size-4" aria-hidden="true" />
            Find
          </Button>
          <Button type="button" variant="ghost" size="sm" className="whitespace-nowrap">
            Replace
          </Button>
          <Separator orientation="vertical" className="hidden h-6 sm:inline-flex" />
          <Button type="button" variant="ghost" size="icon" aria-label="Previous segment">
            <SkipBack className="size-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Next segment">
            <SkipForward className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select defaultValue="segments">
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="View" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="segments">Segment view</SelectItem>
            <SelectItem value="document">Document view</SelectItem>
            <SelectItem value="timeline">Timeline</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="sm">
          <Compass className="mr-1.5 size-4" aria-hidden="true" />
          Navigate
        </Button>
        <Button type="button" variant="ghost" size="sm">
          <GripVertical className="mr-1.5 size-4" aria-hidden="true" />
          Layout
        </Button>
        <Button type="button" variant="outline" size="sm" className="whitespace-nowrap">
          <ArrowDownWideNarrow className="mr-1.5 size-4" aria-hidden="true" />
          Filters
        </Button>
        <Button type="button" variant="default" size="sm" className="whitespace-nowrap">
          <CheckCheck className="mr-1.5 size-4" aria-hidden="true" />
          Validate
        </Button>
        <StatusTag label={statusLabel} />
      </div>
    </div>
  );
}

interface StatusTagProps {
  label: string;
}

function StatusTag({ label }: StatusTagProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <div className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
      {label}
    </span>
  );
}

export default EditorPanel;
