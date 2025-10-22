const PROJECT_FILE_FORMAT_GROUP_DEFINITION = [
  {
    label: "XLIFF",
    extensions: ["xlf", "xliff", "mqxliff", "sdlxliff"] as const,
  },
  {
    label: "Microsoft Office",
    extensions: ["doc", "docx", "ppt", "pptx", "xls", "xlsx", "pdf"] as const,
  },
  {
    label: "OpenDocument",
    extensions: ["odt", "odp", "ods"] as const,
  },
  {
    label: "Markup",
    extensions: ["html", "xml", "dita", "md"] as const,
  },
] as const;

type ProjectFileFormatGroup = (typeof PROJECT_FILE_FORMAT_GROUP_DEFINITION)[number];
type ProjectFileExtension = ProjectFileFormatGroup["extensions"][number];

const FLATTENED_EXTENSIONS = PROJECT_FILE_FORMAT_GROUP_DEFINITION.flatMap((group) => group.extensions);

export const PROJECT_FILE_EXTENSIONS = FLATTENED_EXTENSIONS as readonly ProjectFileExtension[];

export const PROJECT_FILE_EXTENSIONS_WITH_DOT = FLATTENED_EXTENSIONS.map(
  (ext) => `.${ext}` as const,
) as readonly `.${ProjectFileExtension}`[];

export const PROJECT_FILE_FORMAT_GROUPS = PROJECT_FILE_FORMAT_GROUP_DEFINITION.map((group) => ({
  label: group.label,
  extensions: group.extensions.map((ext) => `.${ext}` as const),
})) as readonly {
  label: ProjectFileFormatGroup["label"];
  extensions: readonly `.${ProjectFileExtension}`[];
}[];

export const PROJECT_FILE_DIALOG_FILTERS = [
  {
    name: "Translation Files",
    extensions: [...FLATTENED_EXTENSIONS],
  },
] as const;

export const PROJECT_FILE_FORMAT_DESCRIPTION = PROJECT_FILE_FORMAT_GROUPS.map(
  (group) => `${group.label} (${group.extensions.join(", ")})`,
).join("; ");

export const PROJECT_FILE_FORMAT_ACCESSIBILITY_TEXT = `Supported formats: ${PROJECT_FILE_FORMAT_DESCRIPTION}`;
