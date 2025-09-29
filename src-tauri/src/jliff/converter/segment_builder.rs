//! Segment Text Building and Placeholder Management
//!
//! This module provides the core functionality for building translatable text segments
//! from XLIFF source and target containers. It handles the conversion of inline code
//! elements to placeholders and manages the tag mapping metadata.
//!
//! ## Key Features
//!
//! - **Placeholder Generation**: Converts inline codes to configurable placeholder tokens
//! - **Tag Stack Management**: Handles nested inline elements like `<pc>` containers
//! - **Original Data Resolution**: Links placeholders to original content via references
//! - **Configurable Processing**: Supports different placeholder styles and inline preservation
//!
//! ## Placeholder Styles
//!
//! Currently supports double-curly bracket style:
//! - `{{ph:id}}` for standalone elements
//! - `{{pc:id:start}}` and `{{pc:id:end}}` for paired container elements
//!
//! ## Inline Element Types
//!
//! - `ph`: Standalone placeholder
//! - `pc`: Paired code (container with start/end)
//! - `sc`: Start code (opening tag only)
//! - `ec`: End code (closing tag only)
//! - `cp`: Code point (character reference)

use std::collections::{BTreeMap, HashMap};

use anyhow::Result;
use quick_xml::encoding::Decoder;
use quick_xml::events::BytesStart;

use crate::jliff::options::PlaceholderStyle;
use crate::jliff::tag_map::TagInstance;
use super::inline_tags::{collect_attrs, resolve_original_data};

/// Builder for assembling translatable text segments with placeholder management.
///
/// The SegmentBuilder processes text content and inline code elements from XLIFF
/// source or target containers, converting inline elements to placeholders while
/// maintaining metadata for reconstruction.
///
/// ## Processing Modes
///
/// - **Placeholder Mode** (default): Replaces inline codes with placeholder tokens
/// - **Inline Preservation Mode**: Keeps certain inline codes in the text
///
/// ## State Management
///
/// The builder maintains:
/// - Accumulated text content
/// - Placeholder metadata for tag reconstruction
/// - Stack for tracking nested paired codes
/// - Generator for auto-assigning IDs to unnamed elements
pub struct SegmentBuilder<'a> {
    /// Accumulated text content with placeholders
    text: String,
    /// Ordered list of placeholder metadata for tag reconstruction
    pub placeholders: Vec<TagInstance>,
    /// Reference to original data bucket from parent unit
    original_data: &'a BTreeMap<String, String>,
    /// Placeholder style configuration
    style: PlaceholderStyle,
    /// Whether to preserve inline codes in source text
    keep_inline: bool,
    /// Counter for generating automatic IDs
    generated: usize,
    /// Stack for tracking nested paired code elements
    pc_stack: Vec<PcEntry>,
}

impl<'a> SegmentBuilder<'a> {
    /// Creates a new segment builder with the specified configuration.
    ///
    /// ## Arguments
    ///
    /// * `original_data` - Reference to original data bucket for content resolution
    /// * `style` - Placeholder style for inline code replacement
    /// * `keep_inline` - Whether to preserve inline codes instead of replacing with placeholders
    ///
    /// ## Example
    ///
    /// ```rust
    /// let builder = SegmentBuilder::new(
    ///     &original_data,
    ///     PlaceholderStyle::DoubleCurly,
    ///     false // Use placeholders
    /// );
    /// ```
    pub fn new(
        original_data: &'a BTreeMap<String, String>,
        style: PlaceholderStyle,
        keep_inline: bool,
    ) -> Self {
        Self {
            text: String::new(),
            placeholders: Vec::new(),
            original_data,
            style,
            keep_inline,
            generated: 0,
            pc_stack: Vec::new(),
        }
    }

    /// Appends text content to the segment.
    ///
    /// This method accumulates text content from XML text nodes and CDATA sections,
    /// building the translatable text string.
    ///
    /// ## Arguments
    ///
    /// * `text` - Text content to append to the segment
    pub fn push_text(&mut self, text: String) {
        self.text.push_str(&text);
    }

    /// Consumes the builder and returns the assembled text content.
    ///
    /// ## Returns
    ///
    /// The complete text content with placeholders substituted for inline elements.
    pub fn into_text(self) -> String {
        self.text
    }

    /// Handles the start of an inline code element.
    ///
    /// This method processes opening tags for inline elements, generating appropriate
    /// placeholders and maintaining the tag stack for paired elements.
    ///
    /// ## Supported Elements
    ///
    /// - `pc`: Paired code - generates start placeholder and pushes to stack
    /// - Other inline codes: Generate single placeholder
    ///
    /// ## Arguments
    ///
    /// * `name` - Element name (e.g., "ph", "pc", "sc")
    /// * `start` - XML start element for attribute extraction
    /// * `decoder` - XML decoder for text processing
    ///
    /// ## Returns
    ///
    /// * `Ok(())` - Element processed successfully
    /// * `Err(anyhow::Error)` - Attribute parsing error
    pub fn handle_start(&mut self, name: &str, start: &BytesStart<'_>, decoder: Decoder) -> Result<()> {
        let attrs = collect_attrs(start, decoder)?;
        match name {
            "pc" => {
                // Paired code element - generate start placeholder
                let id_attr = attrs.get("id").cloned().flatten();
                let (start_placeholder, effective_id) =
                    self.compose_placeholder(name, id_attr.as_deref(), Some("start"));
                self.record_placeholder(start_placeholder.clone(), name, id_attr.clone(), &attrs);

                // Add placeholder to text unless preserving inline codes
                if !self.keep_inline {
                    self.text.push_str(&start_placeholder);
                }

                // Push to stack for end tag processing
                self.pc_stack.push(PcEntry {
                    placeholder_id: effective_id,
                    tag_id: id_attr,
                });
            }
            _ => {
                // Other inline elements - single placeholder
                let id = attrs.get("id").cloned().flatten();
                let (placeholder, _) = self.compose_placeholder(name, id.as_deref(), None);
                self.record_placeholder(placeholder.clone(), name, id, &attrs);

                if !self.keep_inline {
                    self.text.push_str(&placeholder);
                }
            }
        }
        Ok(())
    }

    /// Handles empty (self-closing) inline code elements.
    ///
    /// This method processes self-closing inline elements, handling special cases
    /// for different element types and character point references.
    ///
    /// ## Special Handling
    ///
    /// - `pc`: Empty paired code - generates both start and end placeholders
    /// - `ec`: End code - uses startRef attribute if available
    /// - `cp`: Code point - may render as actual character for printable codes
    ///
    /// ## Arguments
    ///
    /// * `name` - Element name (e.g., "ph", "cp", "ec")
    /// * `start` - XML element for attribute extraction
    /// * `decoder` - XML decoder for text processing
    ///
    /// ## Returns
    ///
    /// * `Ok(())` - Element processed successfully
    /// * `Err(anyhow::Error)` - Attribute parsing error
    pub fn handle_empty(&mut self, name: &str, start: &BytesStart<'_>, decoder: Decoder) -> Result<()> {
        let attrs = collect_attrs(start, decoder)?;
        match name {
            "pc" => {
                // Empty paired code - generate both start and end placeholders
                let id = attrs.get("id").cloned().flatten();
                let (start_placeholder, effective_id) =
                    self.compose_placeholder(name, id.as_deref(), Some("start"));
                let (end_placeholder, _) =
                    self.compose_placeholder(name, Some(effective_id.as_str()), Some("end"));

                self.record_placeholder(start_placeholder.clone(), name, id.clone(), &attrs);
                self.record_placeholder(end_placeholder.clone(), name, id, &attrs);

                if !self.keep_inline {
                    self.text.push_str(&start_placeholder);
                    self.text.push_str(&end_placeholder);
                }
            }
            "ec" => {
                // End code - may reference start code via startRef
                let id = attrs
                    .get("startRef")
                    .cloned()
                    .flatten()
                    .or_else(|| attrs.get("id").cloned().flatten());
                let (placeholder, _) = self.compose_placeholder(name, id.as_deref(), None);
                self.record_placeholder(placeholder.clone(), name, id, &attrs);

                if !self.keep_inline {
                    self.text.push_str(&placeholder);
                }
            }
            "cp" => {
                // Code point - special handling for character references
                let (placeholder, recorded_value) = self.compose_cp_placeholder(&attrs);
                self.record_placeholder(placeholder.clone(), name, None, &attrs);

                if !self.keep_inline {
                    self.text.push_str(&placeholder);
                } else if let Some(ch) = recorded_value {
                    // Render printable character directly when preserving inline codes
                    self.text.push(ch);
                } else {
                    // Use placeholder for non-printable characters
                    self.text.push_str(&placeholder);
                }
            }
            _ => {
                // Standard inline element processing
                let id = attrs.get("id").cloned().flatten();
                let (placeholder, _) = self.compose_placeholder(name, id.as_deref(), None);
                self.record_placeholder(placeholder.clone(), name, id, &attrs);

                if !self.keep_inline {
                    self.text.push_str(&placeholder);
                }
            }
        }
        Ok(())
    }

    /// Handles the end of a paired inline code element.
    ///
    /// This method processes closing tags for paired inline elements,
    /// matching them with their corresponding opening tags from the stack.
    ///
    /// ## Stack Management
    ///
    /// For `pc` elements:
    /// 1. Pops the corresponding entry from the stack
    /// 2. Generates end placeholder using the stored ID
    /// 3. Records placeholder metadata
    ///
    /// ## Arguments
    ///
    /// * `name` - Element name (should be "pc" for paired codes)
    ///
    /// ## Returns
    ///
    /// * `Ok(())` - Element processed successfully
    /// * `Err(anyhow::Error)` - Stack underflow or processing error
    pub fn handle_end(&mut self, name: &str) -> Result<()> {
        if name == "pc" {
            if let Some(entry) = self.pc_stack.pop() {
                let PcEntry {
                    placeholder_id,
                    tag_id,
                } = entry;

                // Generate end placeholder using stored ID
                let (placeholder, _) =
                    self.compose_placeholder(name, Some(placeholder_id.as_str()), Some("end"));

                // Reconstruct attributes for metadata recording
                let mut attrs = HashMap::new();
                if let Some(ref id_val) = tag_id {
                    attrs.insert("id".to_string(), Some(id_val.clone()));
                }

                self.record_placeholder(placeholder.clone(), name, tag_id, &attrs);

                if !self.keep_inline {
                    self.text.push_str(&placeholder);
                }
            }
        }
        Ok(())
    }

    /// Composes a placeholder string for an inline element.
    ///
    /// This method generates placeholder tokens according to the configured style,
    /// creating appropriate identifiers for inline elements.
    ///
    /// ## Placeholder Format
    ///
    /// For double-curly style:
    /// - Standard elements: `{{elem:id}}`
    /// - Paired elements: `{{elem:id:suffix}}`
    ///
    /// ## Arguments
    ///
    /// * `elem` - Element name (e.g., "ph", "pc")
    /// * `id` - Optional element ID (auto-generated if None)
    /// * `suffix` - Optional suffix for paired elements ("start" or "end")
    ///
    /// ## Returns
    ///
    /// A tuple containing:
    /// - `String`: The composed placeholder string
    /// - `String`: The effective ID used (original or generated)
    fn compose_placeholder(
        &mut self,
        elem: &str,
        id: Option<&str>,
        suffix: Option<&str>,
    ) -> (String, String) {
        // Use provided ID or generate automatic ID
        let effective_id = id
            .map(|s| s.to_string())
            .unwrap_or_else(|| self.generate_id(elem));

        // Build placeholder according to style
        let placeholder = match (self.style, suffix) {
            (PlaceholderStyle::DoubleCurly, Some(suffix)) => {
                format!("{{{{{}:{}:{}}}}}", elem, effective_id, suffix)
            }
            (PlaceholderStyle::DoubleCurly, None) => {
                format!("{{{{{}:{}}}}}", elem, effective_id)
            }
        };
        (placeholder, effective_id)
    }

    /// Composes a placeholder for code point (cp) elements.
    ///
    /// Code point elements represent Unicode characters by hexadecimal value.
    /// This method attempts to render printable characters directly or creates
    /// a placeholder for control/non-printable characters.
    ///
    /// ## Character Handling
    ///
    /// - Printable characters (except control codes): Rendered directly
    /// - Allowed control characters (newline, tab): Rendered directly
    /// - Other control characters: Placeholder generated
    ///
    /// ## Arguments
    ///
    /// * `attrs` - Element attributes containing hex value
    ///
    /// ## Returns
    ///
    /// A tuple containing:
    /// - `String`: Placeholder or character representation
    /// - `Option<char>`: The character if directly renderable
    fn compose_cp_placeholder(
        &mut self,
        attrs: &HashMap<String, Option<String>>,
    ) -> (String, Option<char>) {
        if let Some(Some(hex)) = attrs.get("hex") {
            if let Ok(code) = u32::from_str_radix(hex, 16) {
                if let Some(ch) = char::from_u32(code) {
                    // Render printable characters and safe control characters directly
                    if !ch.is_control() || ch == '\n' || ch == '\t' {
                        return (ch.to_string(), Some(ch));
                    }
                }
            }
        }

        // Generate placeholder for non-printable characters
        let id = attrs
            .get("hex")
            .cloned()
            .flatten()
            .unwrap_or_else(|| self.generate_id("cp"));
        (format!("{{{{cp:{}}}}}", id), None)
    }

    /// Records placeholder metadata for tag reconstruction.
    ///
    /// This method creates and stores TagInstance metadata that will be used
    /// to reconstruct the original inline elements from placeholders.
    ///
    /// ## Metadata Captured
    ///
    /// - Placeholder string used in the text
    /// - Element name and ID
    /// - All element attributes
    /// - Original data content (if referenced)
    ///
    /// ## Arguments
    ///
    /// * `placeholder` - The placeholder string used in text
    /// * `elem` - Element name
    /// * `id` - Element ID (if any)
    /// * `attrs` - Element attributes for reconstruction
    fn record_placeholder(
        &mut self,
        placeholder: String,
        elem: &str,
        id: Option<String>,
        attrs: &HashMap<String, Option<String>>,
    ) {
        // Convert to ordered map for consistent serialization
        let mut ordered_attrs = BTreeMap::new();
        for (k, v) in attrs {
            ordered_attrs.insert(k.clone(), v.clone());
        }

        // Resolve original data content
        let original_data = resolve_original_data(self.original_data, attrs, id.as_deref());

        // Create and store tag instance
        self.placeholders.push(TagInstance {
            placeholder,
            elem: elem.to_string(),
            id,
            attrs: ordered_attrs,
            original_data,
        });
    }

    /// Generates an automatic ID for unnamed inline elements.
    ///
    /// This method creates unique IDs for inline elements that don't have
    /// explicit ID attributes, ensuring all placeholders can be tracked.
    ///
    /// ## ID Format
    ///
    /// Generated IDs follow the pattern: `{element}_auto{counter}`
    /// For example: `ph_auto1`, `pc_auto2`
    ///
    /// ## Arguments
    ///
    /// * `elem` - Element name for ID prefix
    ///
    /// ## Returns
    ///
    /// A unique generated ID string
    fn generate_id(&mut self, elem: &str) -> String {
        self.generated += 1;
        format!("{}_auto{}", elem, self.generated)
    }
}

/// Stack entry for tracking nested paired code elements.
///
/// This structure maintains the state needed to match opening and closing
/// tags for paired code (pc) elements that span multiple text nodes.
#[derive(Debug, Clone)]
struct PcEntry {
    /// The effective placeholder ID for the paired element
    placeholder_id: String,
    /// The original element ID attribute (if any)
    tag_id: Option<String>,
}