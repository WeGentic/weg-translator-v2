use serde::{Deserialize, Serialize};

/// Representation of the custom JLIFF document defined by `schema/jliff.schema.json`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct JliffDocument {
    #[serde(rename = "Project_name")]
    pub project_name: String,
    #[serde(rename = "Project_ID")]
    pub project_id: String,
    #[serde(rename = "File")]
    pub file: String,
    #[serde(rename = "User")]
    pub user: String,
    #[serde(rename = "Source_language")]
    pub source_language: String,
    #[serde(rename = "Target_language")]
    pub target_language: String,
    #[serde(rename = "Transunits")]
    pub transunits: Vec<TransUnit>,
}

/// Translation unit payload mirroring the schema's `Transunits` entries.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TransUnit {
    #[serde(rename = "unit id")]
    pub unit_id: String,
    #[serde(rename = "transunit_id")]
    pub transunit_id: String,
    #[serde(rename = "Source")]
    pub source: String,
    #[serde(rename = "Target_translation")]
    pub target_translation: String,
    #[serde(
        rename = "Target_QA_1",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub target_qa_1: Option<String>,
    #[serde(
        rename = "Target_QA_2",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub target_qa_2: Option<String>,
    #[serde(
        rename = "Target_Postedit",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub target_postedit: Option<String>,
    #[serde(
        rename = "Translation_notes",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub translation_notes: Option<NoteBlock>,
    #[serde(rename = "QA_notes", default, skip_serializing_if = "Option::is_none")]
    pub qa_notes: Option<NoteBlock>,
    #[serde(
        rename = "Source_notes",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub source_notes: Option<SourceNotes>,
}

/// Notes container with WARNING/CRITICAL/SOURCE_ERROR buckets.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct NoteBlock {
    #[serde(rename = "WARNING", default, skip_serializing_if = "Vec::is_empty")]
    pub warning: Vec<String>,
    #[serde(rename = "CRITICAL", default, skip_serializing_if = "Vec::is_empty")]
    pub critical: Vec<String>,
    #[serde(
        rename = "SOURCE_ERROR",
        default,
        skip_serializing_if = "Vec::is_empty"
    )]
    pub source_error: Vec<String>,
}

/// Source notes omit the CRITICAL category per schema.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct SourceNotes {
    #[serde(rename = "WARNING", default, skip_serializing_if = "Vec::is_empty")]
    pub warning: Vec<String>,
    #[serde(
        rename = "SOURCE_ERROR",
        default,
        skip_serializing_if = "Vec::is_empty"
    )]
    pub source_error: Vec<String>,
}
