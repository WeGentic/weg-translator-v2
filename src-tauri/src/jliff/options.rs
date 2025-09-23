use std::path::PathBuf;

/// Supported placeholder flavours for inline code substitution.
#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum PlaceholderStyle {
    /// `{{ph:1}}` style placeholders.
    DoubleCurly,
}

impl PlaceholderStyle {
    /// Returns the canonical identifier used downstream when formatting placeholders.
    pub fn as_str(self) -> &'static str {
        match self {
            PlaceholderStyle::DoubleCurly => "double-curly",
        }
    }
}

/// Configuration required to convert an XLIFF document into JLIFF/tag-map JSON artifacts.
#[derive(Debug, Clone)]
pub struct ConversionOptions {
    /// Path to the input XLIFF file that should be converted.
    pub input: PathBuf,
    /// Directory where generated JSON artifacts will be stored.
    pub output_dir: PathBuf,
    /// Human readable project name stored in the resulting payload.
    pub project_name: String,
    /// Stable project identifier added to the payload.
    pub project_id: String,
    /// User or operator responsible for the conversion, stored in the payload.
    pub user: String,
    /// Optional prefix used when generating output filenames. Defaults to the input stem.
    pub file_prefix: Option<String>,
    /// Optional schema path used to validate the generated JLIFF payload. Missing or unreadable
    /// paths are treated as "no validation".
    pub schema_path: Option<PathBuf>,
    /// Placeholder style to use when replacing inline codes.
    pub placeholder_style: PlaceholderStyle,
    /// When `true`, inline tags are preserved in the source text instead of placeholder tokens.
    pub keep_inline_in_source: bool,
    /// When `true`, JSON payloads are pretty formatted.
    pub pretty: bool,
}

impl ConversionOptions {
    /// Helper constructor with sane defaults for optional fields.
    pub fn new(
        input: PathBuf,
        output_dir: PathBuf,
        project_name: String,
        project_id: String,
        user: String,
    ) -> Self {
        Self {
            input,
            output_dir,
            project_name,
            project_id,
            user,
            file_prefix: None,
            schema_path: None,
            placeholder_style: PlaceholderStyle::DoubleCurly,
            keep_inline_in_source: false,
            pretty: false,
        }
    }
}
