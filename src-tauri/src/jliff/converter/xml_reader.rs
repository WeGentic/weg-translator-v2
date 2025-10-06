//! XML Reading Utilities
//!
//! This module provides low-level XML parsing utilities for XLIFF document processing.
//! It contains helper functions for decoding XML elements, handling text content,
//! and managing XML namespaces.
//!
//! ## Key Features
//!
//! - Safe XML element name decoding with error handling
//! - Text content extraction from XML elements and CDATA sections
//! - Namespace-aware element processing
//! - Element skipping for unsupported content
//! - File reader initialization with proper buffering

use std::fs::File;
use std::io::BufReader;
use std::path::Path;

use anyhow::{Context, Result, anyhow};
use quick_xml::encoding::Decoder;
use quick_xml::events::{BytesCData, BytesEnd, BytesStart, BytesText, Event};
use quick_xml::name::{Namespace, QName, ResolveResult};
use quick_xml::reader::NsReader;

/// Opens an XML file and returns a configured namespace-aware reader.
///
/// This function initializes a buffered XML reader with namespace support,
/// suitable for processing XLIFF documents. The reader is configured to
/// preserve whitespace text content as it may be significant in translation units.
///
/// ## Arguments
///
/// * `path` - Path to the XML file to open
///
/// ## Returns
///
/// * `Ok(NsReader<BufReader<File>>)` - Configured XML reader ready for parsing
/// * `Err(anyhow::Error)` - File access error with context
///
/// ## Example
///
/// ```rust
/// let reader = open_reader(Path::new("document.xlf"))?;
/// ```
pub fn open_reader(path: &Path) -> Result<NsReader<BufReader<File>>> {
    let file = File::open(path).with_context(|| format!("Failed to open {}", path.display()))?;
    Ok(NsReader::from_reader(BufReader::new(file)))
}

/// Locates the root `<xliff>` element in an XML document.
///
/// This function scans through the XML document to find the root XLIFF element,
/// extracting its namespace information. It handles both namespace-bound and
/// unbound root elements.
///
/// ## Arguments
///
/// * `reader` - Mutable reference to the XML reader
/// * `buf` - Reusable buffer for XML event processing
/// * `decoder` - XML decoder for text content processing
///
/// ## Returns
///
/// * `Ok((Option<String>, BytesStart<'static>))` - Namespace and root element
/// * `Err(anyhow::Error)` - Parsing error or unexpected document structure
///
/// The returned tuple contains:
/// - `Option<String>`: The namespace URI if present, None for unbound elements
/// - `BytesStart<'static>`: The root element for further attribute processing
pub fn locate_root(
    reader: &mut NsReader<BufReader<File>>,
    buf: &mut Vec<u8>,
    decoder: Decoder,
) -> Result<(Option<String>, BytesStart<'static>)> {
    loop {
        match reader.read_resolved_event_into(buf)? {
            // Namespace-bound root element
            (ResolveResult::Bound(Namespace(ns)), Event::Start(start)) => {
                let name = decode_local_name(&start, decoder)?;
                if name == "xliff" {
                    let namespace = decoder
                        .decode(ns.as_ref())
                        .map_err(|err| anyhow!(err))?
                        .into_owned();
                    let owned = start.to_owned();
                    buf.clear();
                    return Ok((Some(namespace), owned));
                } else {
                    return Err(anyhow!("Unexpected root element '{}'", name));
                }
            }
            // Unbound root element (no namespace declaration)
            (ResolveResult::Unbound, Event::Start(start)) => {
                let name = decode_local_name(&start, decoder)?;
                if name == "xliff" {
                    let owned = start.to_owned();
                    buf.clear();
                    return Ok((None, owned));
                } else {
                    return Err(anyhow!("Unexpected root element '{}'", name));
                }
            }
            // End of file reached without finding root element
            (_, Event::Eof) => {
                return Err(anyhow!("Reached EOF before locating <xliff> root"));
            }
            // Skip other events (comments, processing instructions, etc.)
            _ => {
                buf.clear();
            }
        }
    }
}

/// Skips over the current XML element and all its children.
///
/// This utility function efficiently skips over XML elements that are not
/// needed for JLIFF conversion, such as metadata elements or unsupported
/// XLIFF extensions.
///
/// ## Arguments
///
/// * `reader` - Mutable reference to the XML reader
/// * `start` - The starting element to skip (consumed)
/// * `buf` - Reusable buffer for XML event processing
///
/// ## Example
///
/// ```rust
/// // Skip unknown elements during parsing
/// let owned_start = start.to_owned();
/// skip_current_element(reader, owned_start, &mut buf)?;
/// ```
pub fn skip_current_element(
    reader: &mut NsReader<BufReader<File>>,
    start: BytesStart<'static>,
    buf: &mut Vec<u8>,
) -> Result<()> {
    reader.read_to_end_into(start.to_end().name(), buf)?;
    buf.clear();
    Ok(())
}

/// Decodes the local name of an XML start element.
///
/// Extracts and decodes the local name (without namespace prefix) from
/// an XML start element using the provided decoder.
///
/// ## Arguments
///
/// * `start` - Reference to the XML start element
/// * `decoder` - XML decoder for text processing
///
/// ## Returns
///
/// * `Ok(String)` - Decoded local element name
/// * `Err(anyhow::Error)` - Decoding error
pub fn decode_local_name(start: &BytesStart<'_>, decoder: Decoder) -> Result<String> {
    Ok(decoder
        .decode(start.local_name().as_ref())
        .map_err(|err| anyhow!(err))?
        .into_owned())
}

/// Decodes the local name of an XML start element (convenience wrapper).
///
/// This is an alias for `decode_local_name` to provide consistent naming
/// when specifically working with start elements.
pub fn decode_start_name(start: &BytesStart<'_>, decoder: Decoder) -> Result<String> {
    decode_local_name(start, decoder)
}

/// Decodes the local name of an XML end element.
///
/// Extracts and decodes the local name from an XML end element,
/// useful for matching start/end element pairs during parsing.
///
/// ## Arguments
///
/// * `end` - Reference to the XML end element
/// * `decoder` - XML decoder for text processing
///
/// ## Returns
///
/// * `Ok(String)` - Decoded local element name
/// * `Err(anyhow::Error)` - Decoding error
pub fn decode_end_name(end: &BytesEnd<'_>, decoder: Decoder) -> Result<String> {
    Ok(decoder
        .decode(end.local_name().as_ref())
        .map_err(|err| anyhow!(err))?
        .into_owned())
}

/// Decodes a qualified name (QName) to a string.
///
/// Processes XML qualified names (which may include namespace prefixes)
/// and returns the decoded string representation.
///
/// ## Arguments
///
/// * `name` - The qualified name to decode
/// * `decoder` - XML decoder for text processing
///
/// ## Returns
///
/// * `Ok(String)` - Decoded qualified name
/// * `Err(anyhow::Error)` - Decoding error
pub fn decode_qname(name: QName<'_>, decoder: Decoder) -> Result<String> {
    Ok(decoder
        .decode(name.as_ref())
        .map_err(|err| anyhow!(err))?
        .into_owned())
}

/// Decodes text content from XML text nodes.
///
/// Extracts and processes text content from XML text nodes, handling
/// XML entity references and character escaping appropriately.
///
/// ## Arguments
///
/// * `text` - Reference to the XML text content
///
/// ## Returns
///
/// * `Ok(String)` - Decoded text content
/// * `Err(anyhow::Error)` - Text processing error
pub fn decode_text(text: &BytesText<'_>) -> Result<String> {
    Ok(text.xml_content().map_err(|err| anyhow!(err))?.into_owned())
}

/// Decodes text content from XML CDATA sections.
///
/// Processes CDATA sections which contain literal text that should not
/// be parsed as XML markup. CDATA content is decoded using the XML decoder
/// but does not undergo XML entity processing.
///
/// ## Arguments
///
/// * `cdata` - Reference to the XML CDATA section
/// * `decoder` - XML decoder for text processing
///
/// ## Returns
///
/// * `Ok(String)` - Decoded CDATA content
/// * `Err(anyhow::Error)` - Decoding error
pub fn decode_cdata(cdata: &BytesCData<'_>, decoder: Decoder) -> Result<String> {
    Ok(decoder
        .decode(cdata.as_ref())
        .map_err(|err| anyhow!(err))?
        .into_owned())
}
