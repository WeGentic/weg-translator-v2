use std::collections::BTreeMap;

use serde::Serialize;

/// Metadata about inline tags mapped to placeholders for a single XLIFF <file>.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct TagMapDoc {
    pub file_id: String,
    pub original_path: String,
    pub source_language: String,
    pub target_language: String,
    pub placeholder_style: String,
    pub units: Vec<TagMapUnit>,
}

/// Tag mapping for a specific <unit>.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct TagMapUnit {
    pub unit_id: String,
    pub segments: Vec<TagMapSegment>,
}

/// Tag mapping for a specific <segment> inside a unit.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct TagMapSegment {
    pub segment_id: String,
    #[serde(rename = "placeholders_in_order")]
    pub placeholders: Vec<TagInstance>,
    #[serde(rename = "originalData_bucket")]
    pub original_data_bucket: BTreeMap<String, String>,
}

/// Details for a single placeholder emitted in the output JSON.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct TagInstance {
    pub placeholder: String,
    pub elem: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub attrs: BTreeMap<String, Option<String>>,
    #[serde(rename = "originalData", skip_serializing_if = "Option::is_none")]
    pub original_data: Option<String>,
}
