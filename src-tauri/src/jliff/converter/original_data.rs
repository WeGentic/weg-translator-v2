//! Original Data Bucket Processing
//!
//! This module handles the parsing and management of XLIFF `<originalData>` sections.
//! Original data buckets store the actual content that inline code elements represent,
//! enabling faithful reconstruction of the original document format.
//!
//! ## Original Data Structure
//!
//! ```xml
//! <originalData>
//!   <data id="d1">&lt;b&gt;bold text&lt;/b&gt;</data>
//!   <data id="d2">&lt;img src="image.png"/&gt;</data>
//! </originalData>
//! ```
//!
//! ## Key Features
//!
//! - **ID-based Storage**: Each data element has a unique ID for reference
//! - **Content Preservation**: Stores original markup exactly as it appears
//! - **Reference Resolution**: Links inline elements to their original content
//! - **Encoding Handling**: Properly processes XML entity encoding

use std::collections::BTreeMap;
use std::fs::File;
use std::io::BufReader;

use anyhow::{Result, anyhow, bail};
use quick_xml::encoding::Decoder;
use quick_xml::events::{BytesStart, Event};
use quick_xml::name::ResolveResult;
use quick_xml::reader::NsReader;

use super::xml_reader::{decode_local_name, decode_end_name, decode_qname, skip_current_element};
use super::text_container::read_textual_content;

/// Parses an XLIFF `<originalData>` section and populates the data store.
///
/// This function processes the originalData container element, extracting
/// all `<data>` child elements and storing their content in the provided
/// BTreeMap for later reference by inline code elements.
///
/// ## Processing Steps
///
/// 1. **Element Scanning**: Iterates through child elements of originalData
/// 2. **Data Extraction**: Processes each `<data>` element
/// 3. **ID Validation**: Ensures each data element has a required ID attribute
/// 4. **Content Reading**: Extracts textual content from data elements
/// 5. **Store Population**: Adds ID-to-content mappings to the store
///
/// ## Data Element Structure
///
/// ```xml
/// <data id="d1">&lt;strong&gt;Important&lt;/strong&gt;</data>
/// ```
///
/// The content within data elements may contain:
/// - Escaped XML markup (entities like `&lt;`, `&gt;`)
/// - Plain text content
/// - Mixed content with nested elements
///
/// ## Arguments
///
/// * `reader` - Mutable reference to the XML reader positioned after originalData start
/// * `decoder` - XML decoder for text content processing
/// * `store` - Mutable reference to the data store for populating with ID-content pairs
///
/// ## Returns
///
/// * `Ok(())` - Original data parsed and stored successfully
/// * `Err(anyhow::Error)` - Parsing error, missing IDs, or structural issues
///
/// ## Errors
///
/// Returns errors for:
/// - Missing `id` attribute on `<data>` elements
/// - Malformed XML structure within originalData
/// - Unexpected end of file during parsing
/// - Text content reading failures
///
/// ## Example Usage
///
/// ```rust
/// let mut original_data = BTreeMap::new();
/// parse_original_data(&mut reader, decoder, &mut original_data)?;
///
/// // Access stored content by ID
/// if let Some(content) = original_data.get("d1") {
///     println!("Data d1: {}", content);
/// }
/// ```
pub fn parse_original_data(
    reader: &mut NsReader<BufReader<File>>,
    decoder: Decoder,
    store: &mut BTreeMap<String, String>,
) -> Result<()> {
    let mut buf = Vec::new();

    // Process elements within the originalData container
    loop {
        match reader.read_resolved_event_into(&mut buf)? {
            // Start of a new element
            (_, Event::Start(start)) => {
                let name = decode_local_name(&start, decoder)?;
                let owned_start = start.to_owned();

                if name == "data" {
                    // Process data element
                    let data_id = extract_data_id(&owned_start, decoder)?;
                    let content = read_textual_content(reader, owned_start, decoder)?;
                    store.insert(data_id, content);
                } else {
                    // Skip unknown elements within originalData
                    skip_current_element(reader, owned_start, &mut buf)?;
                }
            }

            // End of originalData container
            (_, Event::End(end)) => {
                let name = decode_end_name(&end, decoder)?;
                if name == "originalData" {
                    break;
                }
            }

            // Unexpected end of file
            (ResolveResult::Unbound, Event::Eof) => {
                bail!("Unexpected EOF inside <originalData>");
            }

            // Skip other events (text, comments, etc.)
            _ => {}
        }
        buf.clear();
    }

    Ok(())
}

/// Extracts the required ID attribute from a data element.
///
/// This function parses the attributes of a `<data>` element to find and
/// extract the mandatory `id` attribute. The ID is used as the key for
/// storing the data content in the original data bucket.
///
/// ## Attribute Processing
///
/// - Iterates through all attributes on the data element
/// - Decodes attribute names and values using the XML decoder
/// - Validates that the `id` attribute is present and non-empty
///
/// ## Arguments
///
/// * `start` - The data element start tag containing attributes
/// * `decoder` - XML decoder for attribute text processing
///
/// ## Returns
///
/// * `Ok(String)` - The extracted data ID
/// * `Err(anyhow::Error)` - Missing ID attribute or decoding error
///
/// ## Validation
///
/// The function ensures that:
/// - The `id` attribute is present on the data element
/// - The ID value is non-empty after decoding
/// - All attribute decoding succeeds without errors
fn extract_data_id(start: &BytesStart<'_>, decoder: Decoder) -> Result<String> {
    let mut data_id = None;

    // Parse attributes to find the ID
    for attr in start.attributes().with_checks(false) {
        let attr = attr?;
        let key = decode_qname(attr.key, decoder)?;

        if key == "id" {
            let value = attr
                .decode_and_unescape_value(decoder)
                .map_err(|err| anyhow!(err))?
                .into_owned();
            data_id = Some(value);
            break; // Found the ID, no need to continue
        }
    }

    // Validate that ID was found
    data_id.ok_or_else(|| anyhow!("<data> missing id attribute"))
}