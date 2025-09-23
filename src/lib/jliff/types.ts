export interface JliffNoteBlock {
  WARNING?: string[];
  CRITICAL?: string[];
  SOURCE_ERROR?: string[];
}

export interface JliffSourceNotes {
  WARNING?: string[];
  SOURCE_ERROR?: string[];
}

export interface JliffTransunit {
  "unit id": string;
  transunit_id: string;
  Source: string;
  Target_translation: string;
  Target_QA_1?: string;
  Target_QA_2?: string;
  Target_Postedit?: string;
  Translation_notes?: JliffNoteBlock;
  QA_notes?: JliffNoteBlock;
  Source_notes?: JliffSourceNotes;
}

export interface JliffRoot {
  Project_name: string;
  Project_ID: string;
  File: string;
  User: string;
  Source_language: string;
  Target_language: string;
  Transunits: JliffTransunit[];
}

export interface TagsPlaceholder {
  placeholder: string;
  elem: string;
  id?: string;
  attrs: Record<string, string | null>;
  originalData?: string;
}

export interface TagsSegment {
  segment_id: string;
  placeholders_in_order: TagsPlaceholder[];
  originalData_bucket: Record<string, string>;
}

export interface TagsUnit {
  unit_id: string;
  segments: TagsSegment[];
}

export interface TagsRoot {
  file_id: string;
  original_path: string;
  source_language: string;
  target_language: string;
  placeholder_style: string;
  units: TagsUnit[];
}

export type SegmentToken =
  | { kind: "text"; value: string }
  | { kind: "ph"; value: string; placeholderId?: string };

export interface PlaceholderChip {
  id: string;
  token: string;
  originalData?: string;
  elem?: string;
  attrs?: Record<string, string | null>;
}

export interface PlaceholderCounts {
  source: number;
  target: number;
  missing: number;
  extra: number;
}

export type PlaceholderParityStatus = "ok" | "missing" | "extra" | "unknown";

export interface SegmentRow {
  key: string;
  unitId: string;
  segmentId: string;
  sourceRaw: string;
  targetRaw: string;
  sourceTokens: SegmentToken[];
  targetTokens: SegmentToken[];
  placeholders: PlaceholderChip[];
  placeholderCounts: PlaceholderCounts;
  status: PlaceholderParityStatus;
}
