//! XLIFF to JLIFF Conversion Module
//!
//! This module provides comprehensive functionality for converting XLIFF 2.0 documents
//! into JLIFF (JSON-based XLIFF) format with companion tag-map metadata.
//!
//! ## Overview
//!
//! The conversion process transforms XLIFF documents into two complementary outputs:
//! - **JLIFF Document**: A JSON representation containing translatable text units
//! - **Tag Map**: Metadata preserving inline tag information for reconstruction
//!
//! ## Architecture
//!
//! The converter is organized into specialized modules:
//! - `xml_reader`: Low-level XML parsing utilities
//! - `xliff_parser`: XLIFF structure parsing (root, file, unit, segment)
//! - `segment_builder`: Text content assembly with placeholder management
//! - `inline_tags`: Processing of XLIFF inline code elements
//! - `original_data`: Original data bucket handling
//! - `text_container`: Text container parsing with nested element support
//!
//! ## Usage
//!
//! ```rust
//! use crate::jliff::converter::convert;
//! use crate::jliff::options::ConversionOptions;
//!
//! let options = ConversionOptions::new(
//!     input_path,
//!     output_dir,
//!     "Project Name".to_string(),
//!     "project-id".to_string(),
//!     "user@example.com".to_string(),
//! );
//!
//! let conversions = convert(&options)?;
//! ```

mod inline_tags;
mod original_data;
mod segment_builder;
mod text_container;
mod xliff_parser;
mod xml_reader;

use anyhow::Result;

use super::model::JliffDocument;
use super::options::ConversionOptions;
use super::tag_map::TagMapDoc;

/// Represents the complete conversion output for a single XLIFF `<file>` element.
///
/// Each FileConversion contains:
/// - The JLIFF document with translatable content
/// - Tag map metadata for inline element reconstruction
/// - File identifier for tracking purposes
#[derive(Debug, Clone)]
pub struct FileConversion {
    /// The JLIFF document containing translatable text units
    pub jliff: JliffDocument,
    /// Tag map metadata preserving inline tag information
    pub tag_map: TagMapDoc,
    /// Unique identifier for the source XLIFF file element
    pub file_id: String,
}

/// Converts an XLIFF document into JLIFF/tag-map payloads held in memory.
///
/// This is the main entry point for XLIFF conversion. The function:
/// 1. Validates XLIFF format and namespace compatibility
/// 2. Extracts source and target language information
/// 3. Processes each `<file>` element in the document
/// 4. Returns complete conversion results for further processing
///
/// ## Arguments
///
/// * `opts` - Configuration options controlling the conversion process
///
/// ## Returns
///
/// * `Ok(Vec<FileConversion>)` - Successfully converted file elements
/// * `Err(anyhow::Error)` - Conversion failure with detailed context
///
/// ## Errors
///
/// The function returns errors for:
/// - Unsupported XLIFF namespace or version
/// - Missing required language attributes
/// - Malformed XML structure
/// - I/O errors during file reading
///
/// ## Example
///
/// ```rust
/// let options = ConversionOptions::new(
///     PathBuf::from("input.xlf"),
///     PathBuf::from("output/"),
///     "My Project".to_string(),
///     "proj-123".to_string(),
///     "converter@example.com".to_string(),
/// );
///
/// let conversions = convert(&options)?;
/// for conversion in conversions {
///     println!("Converted file: {}", conversion.file_id);
///     println!("Translation units: {}", conversion.jliff.transunits.len());
/// }
/// ```
pub fn convert(opts: &ConversionOptions) -> Result<Vec<FileConversion>> {
    xliff_parser::parse_xliff_document(opts)
}
