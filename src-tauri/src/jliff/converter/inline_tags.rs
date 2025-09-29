//! Inline Tag Processing Utilities
//!
//! This module provides utilities for handling XLIFF 2.0 inline code elements
//! and their attributes. It includes functions for tag type identification,
//! attribute collection, and original data resolution.
//!
//! ## Supported Inline Elements
//!
//! - `ph`: Standalone placeholder (e.g., `<ph id="1"/>`)
//! - `pc`: Paired code container (e.g., `<pc id="1">text</pc>`)
//! - `sc`: Start code (opening tag only)
//! - `ec`: End code (closing tag only)
//! - `cp`: Code point (Unicode character reference)
//!
//! ## Original Data Resolution
//!
//! Inline elements can reference content stored in the `<originalData>` section
//! through `dataRef` attributes or by using their ID as a lookup key.

use std::collections::{BTreeMap, HashMap};

use anyhow::{Result, anyhow};
use quick_xml::encoding::Decoder;
use quick_xml::events::BytesStart;

use super::xml_reader::decode_qname;

/// Checks if an element name represents an XLIFF inline code element.
///
/// This function identifies the standard XLIFF 2.0 inline code elements
/// that require special processing during conversion to JLIFF format.
///
/// ## Recognized Elements
///
/// - `ph`: Placeholder for standalone inline content
/// - `pc`: Paired code for container elements with start/end
/// - `sc`: Start code for opening tags
/// - `ec`: End code for closing tags
/// - `cp`: Code point for Unicode character references
///
/// ## Arguments
///
/// * `name` - The element local name to check
///
/// ## Returns
///
/// `true` if the element is a recognized inline code type, `false` otherwise
///
/// ## Example
///
/// ```rust
/// assert_eq!(is_inline_code("ph"), true);
/// assert_eq!(is_inline_code("pc"), true);
/// assert_eq!(is_inline_code("source"), false);
/// ```
pub fn is_inline_code(name: &str) -> bool {
    matches!(name, "ph" | "pc" | "sc" | "ec" | "cp")
}

/// Collects all attributes from an XML start element into a map.
///
/// This function extracts and decodes all attributes from an XML element,
/// creating a HashMap that maps attribute names to their values. This is
/// used for preserving inline element attributes in tag map metadata.
///
/// ## Attribute Processing
///
/// - All attributes are decoded using the provided XML decoder
/// - Attribute values are stored as `Some(String)` for present attributes
/// - The function handles XML entity references and escaping
///
/// ## Arguments
///
/// * `start` - The XML start element containing attributes
/// * `decoder` - XML decoder for text processing
///
/// ## Returns
///
/// * `Ok(HashMap<String, Option<String>>)` - Map of attribute names to values
/// * `Err(anyhow::Error)` - Attribute parsing or decoding error
///
/// ## Example
///
/// ```rust
/// // For element: <ph id="ph1" dataRef="d1"/>
/// let attrs = collect_attrs(&start, decoder)?;
/// assert_eq!(attrs.get("id"), Some(&Some("ph1".to_string())));
/// assert_eq!(attrs.get("dataRef"), Some(&Some("d1".to_string())));
/// ```
pub fn collect_attrs(
    start: &BytesStart<'_>,
    decoder: Decoder,
) -> Result<HashMap<String, Option<String>>> {
    let mut attrs = HashMap::new();

    // Iterate through all attributes on the element
    for attr in start.attributes().with_checks(false) {
        let attr = attr?;

        // Decode attribute name
        let key = decode_qname(attr.key, decoder)?;

        // Decode and unescape attribute value
        let value = attr
            .decode_and_unescape_value(decoder)
            .map_err(|err| anyhow!(err))?
            .into_owned();

        attrs.insert(key, Some(value));
    }

    Ok(attrs)
}

/// Resolves original data content for an inline element.
///
/// This function looks up content from the original data bucket using
/// the element's `dataRef` attribute or its ID. Original data provides
/// the actual content that inline codes represent, which is essential
/// for reconstructing the original document format.
///
/// ## Resolution Strategy
///
/// 1. **dataRef Attribute**: If present, look up content by this reference
/// 2. **Element ID**: If no dataRef, try using the element ID as a key
/// 3. **No Match**: Return None if no content is found
///
/// ## Arguments
///
/// * `store` - The original data bucket containing ID-to-content mappings
/// * `attrs` - Element attributes that may contain dataRef
/// * `id` - Optional element ID to use as fallback lookup key
///
/// ## Returns
///
/// * `Some(String)` - Original content if found
/// * `None` - No matching content in the original data bucket
///
/// ## Example
///
/// ```rust
/// let mut original_data = BTreeMap::new();
/// original_data.insert("d1".to_string(), "<b>bold</b>".to_string());
///
/// let mut attrs = HashMap::new();
/// attrs.insert("dataRef".to_string(), Some("d1".to_string()));
///
/// let content = resolve_original_data(&original_data, &attrs, None);
/// assert_eq!(content, Some("<b>bold</b>".to_string()));
/// ```
pub fn resolve_original_data(
    store: &BTreeMap<String, String>,
    attrs: &HashMap<String, Option<String>>,
    id: Option<&str>,
) -> Option<String> {
    // First, try to resolve using dataRef attribute
    if let Some(Some(data_ref)) = attrs.get("dataRef") {
        if let Some(value) = store.get(data_ref) {
            return Some(value.clone());
        }
    }

    // Fallback to using element ID as lookup key
    if let Some(id) = id {
        if let Some(value) = store.get(id) {
            return Some(value.clone());
        }
    }

    // No matching content found
    None
}