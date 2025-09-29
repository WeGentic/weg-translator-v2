//! XLIFF Document Structure Parser
//!
//! This module handles the parsing of XLIFF 2.0 document structure, including
//! root element validation, file element processing, and unit/segment extraction.
//! It orchestrates the conversion process from XLIFF XML to JLIFF JSON format.
//!
//! ## XLIFF Structure Hierarchy
//!
//! ```text
//! <xliff> (root with namespace and language info)
//!   └── <file> (translation file container)
//!       └── <unit> (translation unit grouping)
//!           └── <segment> (individual translatable segment)
//!               ├── <source> (source text)
//!               └── <target> (target text)
//! ```
//!
//! ## Processing Flow
//!
//! 1. Validate XLIFF namespace and version compatibility
//! 2. Extract source and target language information
//! 3. Process each file element in sequence
//! 4. Parse units and segments within each file
//! 5. Build JLIFF and tag map structures

use std::collections::BTreeMap;
use std::fs::File;
use std::io::BufReader;

use anyhow::{Result, anyhow, bail};
use quick_xml::encoding::Decoder;
use quick_xml::events::{BytesStart, Event};
use quick_xml::name::ResolveResult;
use quick_xml::reader::NsReader;

use super::xml_reader::{
    open_reader, locate_root, skip_current_element, decode_local_name, decode_end_name, decode_qname
};
use super::segment_builder::SegmentBuilder;
use super::original_data::parse_original_data;
use super::text_container::parse_text_container;
use crate::jliff::model::{JliffDocument, TransUnit};
use crate::jliff::options::ConversionOptions;
use crate::jliff::tag_map::{TagMapDoc, TagMapUnit, TagMapSegment};

use super::FileConversion;

/// The official XLIFF 2.0 namespace URI as defined by OASIS.
///
/// This constant is used to validate that the input document conforms
/// to the expected XLIFF 2.0 specification.
const XLIFF_2_NAMESPACE: &str = "urn:oasis:names:tc:xliff:document:2.0";

/// Parses a complete XLIFF document and converts it to JLIFF format.
///
/// This is the main entry point for XLIFF document processing. It handles
/// the complete conversion pipeline from XML parsing to JLIFF/tag-map generation.
///
/// ## Process Overview
///
/// 1. **File Opening**: Opens and configures the XML reader
/// 2. **Root Validation**: Locates and validates the XLIFF root element
/// 3. **Language Extraction**: Extracts source and target language information
/// 4. **File Processing**: Processes each `<file>` element in the document
/// 5. **Result Assembly**: Combines results into FileConversion structures
///
/// ## Arguments
///
/// * `opts` - Conversion options containing input file path and processing preferences
///
/// ## Returns
///
/// * `Ok(Vec<FileConversion>)` - Successfully converted file elements
/// * `Err(anyhow::Error)` - Conversion failure with detailed error context
///
/// ## Supported XLIFF Features
///
/// - XLIFF 2.0 namespace and version
/// - Multiple file elements within a single document
/// - Unit and segment hierarchies
/// - Inline code elements (ph, pc, sc, ec, cp)
/// - Original data references
/// - Source and target text content
///
/// ## Errors
///
/// Returns errors for:
/// - Unsupported XLIFF namespace or version
/// - Missing required language attributes
/// - Malformed XML structure
/// - I/O errors during file reading
pub fn parse_xliff_document(opts: &ConversionOptions) -> Result<Vec<FileConversion>> {
    // Open and configure the XML reader
    let input_path = opts.input.as_path();
    let mut reader = open_reader(input_path)?;
    reader.config_mut().trim_text(false); // Preserve whitespace in translatable content
    let decoder = reader.decoder();
    let mut buf = Vec::new();

    // Locate and validate the root XLIFF element
    let (root_namespace, root_start) = locate_root(&mut reader, &mut buf, decoder)?;
    let root_ctx = RootContext::from_start(&root_start, root_namespace.as_deref(), decoder)?;

    // Validate XLIFF namespace compatibility
    if root_ctx.namespace != XLIFF_2_NAMESPACE {
        bail!(
            "Unsupported XLIFF namespace '{}', expected '{}'",
            root_ctx.namespace,
            XLIFF_2_NAMESPACE
        );
    }

    // Validate XLIFF version compatibility
    if root_ctx.version.as_deref() != Some("2.0") {
        bail!(
            "Unsupported XLIFF version {:?}, expected 2.0",
            root_ctx.version
        );
    }

    // Extract required language information
    let src_lang = root_ctx
        .src_lang
        .clone()
        .ok_or_else(|| anyhow!("Missing srcLang attribute on <xliff>"))?;
    let trg_lang = root_ctx
        .trg_lang
        .clone()
        .ok_or_else(|| anyhow!("Missing trgLang attribute on <xliff>"))?;

    let mut results = Vec::new();

    // Process file elements within the XLIFF document
    loop {
        match reader.read_resolved_event_into(&mut buf)? {
            // End of document reached
            (ResolveResult::Unbound, Event::Eof) => break,

            // Start of a new element
            (_, Event::Start(start)) => {
                let name = decode_local_name(&start, decoder)?;
                if name == "file" {
                    // Parse XLIFF file element
                    let file_ctx = FileContext::from_start(&start, decoder)?;
                    let file_result =
                        parse_file(&mut reader, &file_ctx, opts, decoder, &src_lang, &trg_lang)?;
                    results.push(file_result);
                } else {
                    // Skip unknown elements
                    let owned_start = start.to_owned();
                    skip_current_element(&mut reader, owned_start, &mut buf)?;
                }
            }

            // Empty file elements are not supported
            (_, Event::Empty(empty)) => {
                let name = decode_local_name(&empty, decoder)?;
                if name == "file" {
                    bail!("Encountered empty <file/> element, which is unsupported");
                }
            }

            // End of root element
            (_, Event::End(end)) => {
                let name = decode_end_name(&end, decoder)?;
                if name == "xliff" {
                    break;
                }
            }

            // Skip other events
            _ => {}
        }
        buf.clear();
    }

    Ok(results)
}

/// Context information extracted from the XLIFF root element.
///
/// This structure captures the essential metadata from the root `<xliff>` element
/// that affects the entire document conversion process.
#[derive(Debug)]
struct RootContext {
    /// XLIFF namespace URI
    namespace: String,
    /// XLIFF version identifier
    version: Option<String>,
    /// Source language code (e.g., "en-US")
    src_lang: Option<String>,
    /// Target language code (e.g., "es-ES")
    trg_lang: Option<String>,
}

impl RootContext {
    /// Extracts context information from an XLIFF root element.
    ///
    /// Parses the attributes of the root `<xliff>` element to extract
    /// namespace, version, and language information required for validation
    /// and conversion processing.
    ///
    /// ## Arguments
    ///
    /// * `start` - The root element start tag
    /// * `namespace` - Optional namespace URI from XML parsing
    /// * `decoder` - XML decoder for attribute processing
    ///
    /// ## Returns
    ///
    /// * `Ok(RootContext)` - Successfully extracted context information
    /// * `Err(anyhow::Error)` - Attribute parsing error
    fn from_start(
        start: &BytesStart<'_>,
        namespace: Option<&str>,
        decoder: Decoder,
    ) -> Result<Self> {
        let mut ctx = RootContext {
            namespace: namespace.unwrap_or_default().to_string(),
            version: None,
            src_lang: None,
            trg_lang: None,
        };

        // Parse attributes from the root element
        for attr in start.attributes().with_checks(false) {
            let attr = attr?;
            let key = decode_qname(attr.key, decoder)?;
            let value = attr
                .decode_and_unescape_value(decoder)
                .map_err(|err| anyhow!(err))?
                .into_owned();

            match key.as_str() {
                "version" => ctx.version = Some(value),
                "srcLang" => ctx.src_lang = Some(value),
                "trgLang" => ctx.trg_lang = Some(value),
                _ => {} // Skip unknown attributes
            }
        }

        Ok(ctx)
    }
}

/// Context information extracted from an XLIFF file element.
///
/// Each `<file>` element in an XLIFF document represents a translation file
/// with its own identifier and metadata.
#[derive(Debug)]
struct FileContext {
    /// Unique identifier for the file element
    id: String,
    /// Original file path or name
    original: String,
}

impl FileContext {
    /// Extracts context information from an XLIFF file element.
    ///
    /// Parses the required attributes from a `<file>` element to extract
    /// identification and metadata information.
    ///
    /// ## Arguments
    ///
    /// * `start` - The file element start tag
    /// * `decoder` - XML decoder for attribute processing
    ///
    /// ## Returns
    ///
    /// * `Ok(FileContext)` - Successfully extracted file context
    /// * `Err(anyhow::Error)` - Missing required attributes or parsing error
    fn from_start(start: &BytesStart<'_>, decoder: Decoder) -> Result<Self> {
        let mut id = None;
        let mut original = None;

        // Parse attributes from the file element
        for attr in start.attributes().with_checks(false) {
            let attr = attr?;
            let key = decode_qname(attr.key, decoder)?;
            let value = attr
                .decode_and_unescape_value(decoder)
                .map_err(|err| anyhow!(err))?
                .into_owned();

            match key.as_str() {
                "id" => id = Some(value),
                "original" => original = Some(value),
                _ => {} // Skip unknown attributes
            }
        }

        // Validate required attributes
        let id = id.ok_or_else(|| anyhow!("<file> missing required id attribute"))?;

        Ok(FileContext {
            id,
            original: original.unwrap_or_default(),
        })
    }
}

/// Parses a single XLIFF file element and its contained units.
///
/// This function processes a `<file>` element, extracting all translation units
/// and building the corresponding JLIFF document and tag map structures.
///
/// ## Processing Steps
///
/// 1. **Unit Discovery**: Scans for `<unit>` elements within the file
/// 2. **Unit Processing**: Parses each unit and its segments
/// 3. **Document Assembly**: Combines units into JLIFF document structure
/// 4. **Tag Map Creation**: Builds tag map metadata for inline elements
///
/// ## Arguments
///
/// * `reader` - Mutable reference to the XML reader
/// * `file_ctx` - Context information from the file element
/// * `opts` - Conversion options and preferences
/// * `decoder` - XML decoder for text processing
/// * `src_lang` - Source language code from the root element
/// * `trg_lang` - Target language code from the root element
///
/// ## Returns
///
/// * `Ok(FileConversion)` - Complete file conversion with JLIFF and tag map
/// * `Err(anyhow::Error)` - Parsing error or structural issues
fn parse_file(
    reader: &mut NsReader<BufReader<File>>,
    file_ctx: &FileContext,
    opts: &ConversionOptions,
    decoder: Decoder,
    src_lang: &str,
    trg_lang: &str,
) -> Result<FileConversion> {
    let mut buf = Vec::new();
    let mut units = Vec::new();

    // Process elements within the file
    loop {
        match reader.read_resolved_event_into(&mut buf)? {
            // Start of a new element
            (_, Event::Start(start)) => {
                let name = decode_local_name(&start, decoder)?;
                let owned_start = start.to_owned();
                if name == "unit" {
                    // Parse translation unit
                    let unit = parse_unit(reader, owned_start, opts, decoder)?;
                    units.push(unit);
                } else {
                    // Skip unsupported elements (e.g., skeleton, notes)
                    skip_current_element(reader, owned_start, &mut buf)?;
                }
            }

            // Empty unit elements are not supported
            (_, Event::Empty(empty)) => {
                let name = decode_local_name(&empty, decoder)?;
                if name == "unit" {
                    bail!("Encountered empty <unit/> element, which is unsupported");
                }
            }

            // End of file element
            (_, Event::End(end)) => {
                let name = decode_end_name(&end, decoder)?;
                if name == "file" {
                    break;
                }
            }

            // Unexpected end of document
            (ResolveResult::Unbound, Event::Eof) => {
                bail!("Unexpected EOF inside <file>");
            }

            // Skip other events
            _ => {}
        }

        buf.clear();
    }

    // Build JLIFF document structure
    let jliff = JliffDocument {
        project_name: opts.project_name.clone(),
        project_id: opts.project_id.clone(),
        file: file_ctx.original.clone(),
        user: opts.user.clone(),
        source_language: src_lang.to_string(),
        target_language: trg_lang.to_string(),
        transunits: units.iter().flat_map(|u| u.trans_units.clone()).collect(),
    };

    // Build tag map document structure
    let tag_map = TagMapDoc {
        file_id: file_ctx.id.clone(),
        original_path: file_ctx.original.clone(),
        source_language: src_lang.to_string(),
        target_language: trg_lang.to_string(),
        placeholder_style: opts.placeholder_style.as_str().to_string(),
        units: units.into_iter().map(|u| u.tag_unit).collect(),
    };

    Ok(FileConversion {
        jliff,
        tag_map,
        file_id: file_ctx.id.clone(),
    })
}

/// Output structure for a parsed translation unit.
///
/// This structure combines the JLIFF translation units with the corresponding
/// tag map metadata for a single XLIFF `<unit>` element.
#[derive(Debug)]
struct UnitOutput {
    /// Translation units for JLIFF document
    trans_units: Vec<TransUnit>,
    /// Tag map metadata for the unit
    tag_unit: TagMapUnit,
}

/// Parses a single XLIFF unit element and its contained segments.
///
/// This function processes a `<unit>` element, handling original data references
/// and extracting all segments within the unit.
///
/// ## Unit Structure
///
/// ```xml
/// <unit id="u1">
///   <originalData>
///     <data id="d1">...</data>
///   </originalData>
///   <segment id="s1">
///     <source>...</source>
///     <target>...</target>
///   </segment>
/// </unit>
/// ```
///
/// ## Arguments
///
/// * `reader` - Mutable reference to the XML reader
/// * `start` - The unit element start tag (consumed)
/// * `opts` - Conversion options and preferences
/// * `decoder` - XML decoder for text processing
///
/// ## Returns
///
/// * `Ok(UnitOutput)` - Parsed unit with translation units and tag metadata
/// * `Err(anyhow::Error)` - Parsing error or missing required attributes
fn parse_unit(
    reader: &mut NsReader<BufReader<File>>,
    start: BytesStart<'static>,
    opts: &ConversionOptions,
    decoder: Decoder,
) -> Result<UnitOutput> {
    let mut buf = Vec::new();

    // Extract unit ID from attributes
    let mut unit_id = None;
    for attr in start.attributes().with_checks(false) {
        let attr = attr?;
        if decode_qname(attr.key, decoder)?.as_str() == "id" {
            unit_id = Some(
                attr.decode_and_unescape_value(decoder)
                    .map_err(|err| anyhow!(err))?
                    .into_owned(),
            );
        }
    }
    let unit_id = unit_id.ok_or_else(|| anyhow!("<unit> missing id attribute"))?;

    // Storage for original data references
    let mut original_data: BTreeMap<String, String> = BTreeMap::new();
    let mut segments = Vec::new();

    // Process elements within the unit
    loop {
        match reader.read_resolved_event_into(&mut buf)? {
            // Start of a new element
            (_, Event::Start(start)) => {
                let name = decode_local_name(&start, decoder)?;
                let owned_start = start.to_owned();
                match name.as_str() {
                    "originalData" => {
                        // Parse original data bucket for inline element references
                        parse_original_data(reader, decoder, &mut original_data)?;
                    }
                    "segment" => {
                        // Parse translation segment
                        let segment = parse_segment(
                            reader,
                            owned_start,
                            &unit_id,
                            &original_data,
                            opts,
                            decoder,
                        )?;
                        segments.push(segment);
                    }
                    _ => {
                        // Skip unsupported elements (e.g., notes, metadata)
                        skip_current_element(reader, owned_start, &mut buf)?
                    }
                }
            }

            // End of unit element
            (_, Event::End(end)) => {
                let name = decode_end_name(&end, decoder)?;
                if name == "unit" {
                    break;
                }
            }

            // Unexpected end of document
            (ResolveResult::Unbound, Event::Eof) => bail!("Unexpected EOF inside <unit>"),

            // Skip other events
            _ => {}
        }

        buf.clear();
    }

    // Separate translation units from tag segments
    let mut trans_units = Vec::new();
    let mut tag_segments = Vec::new();
    for seg in segments {
        trans_units.push(seg.trans_unit);
        tag_segments.push(seg.tag_segment);
    }

    Ok(UnitOutput {
        trans_units,
        tag_unit: TagMapUnit {
            unit_id,
            segments: tag_segments,
        },
    })
}

/// Output structure for a parsed translation segment.
///
/// This structure combines the JLIFF translation unit with the corresponding
/// tag map segment metadata for a single XLIFF `<segment>` element.
#[derive(Debug)]
struct SegmentOutput {
    /// Translation unit for JLIFF document
    trans_unit: TransUnit,
    /// Tag map metadata for the segment
    tag_segment: TagMapSegment,
}

/// Parses a single XLIFF segment element with source and target content.
///
/// This function processes a `<segment>` element, building both the translatable
/// text content and the tag map metadata for inline element reconstruction.
///
/// ## Segment Structure
///
/// ```xml
/// <segment id="s1">
///   <source>Hello <ph id="ph1"/> world</source>
///   <target>Hola <ph id="ph1"/> mundo</target>
/// </segment>
/// ```
///
/// ## Processing Features
///
/// - Placeholder generation for inline codes
/// - Original data reference resolution
/// - Configurable inline element handling
/// - Parallel source and target processing
///
/// ## Arguments
///
/// * `reader` - Mutable reference to the XML reader
/// * `start` - The segment element start tag (consumed)
/// * `unit_id` - Parent unit identifier for reference building
/// * `original_data` - Original data bucket from the parent unit
/// * `opts` - Conversion options and preferences
/// * `decoder` - XML decoder for text processing
///
/// ## Returns
///
/// * `Ok(SegmentOutput)` - Parsed segment with translation unit and tag metadata
/// * `Err(anyhow::Error)` - Parsing error or processing failure
fn parse_segment(
    reader: &mut NsReader<BufReader<File>>,
    start: BytesStart<'static>,
    unit_id: &str,
    original_data: &BTreeMap<String, String>,
    opts: &ConversionOptions,
    decoder: Decoder,
) -> Result<SegmentOutput> {
    let mut buf = Vec::new();

    // Extract segment ID from attributes (defaults to "0" if missing)
    let mut segment_id = None;
    for attr in start.attributes().with_checks(false) {
        let attr = attr?;
        if decode_qname(attr.key, decoder)?.as_str() == "id" {
            segment_id = Some(
                attr.decode_and_unescape_value(decoder)
                    .map_err(|err| anyhow!(err))?
                    .into_owned(),
            );
        }
    }
    let segment_id = segment_id.unwrap_or_else(|| "0".to_string());

    // Initialize segment builders for source and target text
    let mut source_builder = SegmentBuilder::new(
        original_data,
        opts.placeholder_style,
        opts.keep_inline_in_source,
    );
    let mut target_builder = SegmentBuilder::new(
        original_data,
        opts.placeholder_style,
        opts.keep_inline_in_source,
    );

    // Process elements within the segment
    loop {
        match reader.read_resolved_event_into(&mut buf)? {
            // Start of a new element
            (_, Event::Start(start)) => {
                let name = decode_local_name(&start, decoder)?;
                let owned_start = start.to_owned();
                match name.as_str() {
                    "source" => {
                        // Parse source text container
                        parse_text_container(reader, owned_start, decoder, &mut source_builder)?
                    }
                    "target" => {
                        // Parse target text container
                        parse_text_container(reader, owned_start, decoder, &mut target_builder)?
                    }
                    _ => {
                        // Skip unsupported elements
                        skip_current_element(reader, owned_start, &mut buf)?
                    }
                }
            }

            // End of segment element
            (_, Event::End(end)) => {
                let name = decode_end_name(&end, decoder)?;
                if name == "segment" {
                    break;
                }
            }

            // Unexpected end of document
            (ResolveResult::Unbound, Event::Eof) => bail!("Unexpected EOF inside <segment>"),

            // Skip other events
            _ => {}
        }
        buf.clear();
    }

    // Extract placeholder information from source builder (authoritative)
    let placeholders = source_builder.placeholders.clone();

    // Build translation unit for JLIFF document
    let trans_unit = TransUnit {
        unit_id: unit_id.to_string(),
        transunit_id: format!("u{}-s{}", unit_id, segment_id),
        source: source_builder.into_text(),
        target_translation: target_builder.into_text(),
        target_qa_1: None,
        target_qa_2: None,
        target_postedit: None,
        translation_notes: None,
        qa_notes: None,
        source_notes: None,
    };

    // Build tag map segment for inline element reconstruction
    let tag_segment = TagMapSegment {
        segment_id,
        placeholders,
        original_data_bucket: original_data.clone(),
    };

    Ok(SegmentOutput {
        trans_unit,
        tag_segment,
    })
}