//! Text Container Processing
//!
//! This module handles the parsing of XLIFF text containers such as `<source>`
//! and `<target>` elements. It processes mixed content including text nodes,
//! CDATA sections, and inline code elements.
//!
//! ## Key Features
//!
//! - **Mixed Content Processing**: Handles text, CDATA, and inline elements
//! - **Inline Code Integration**: Processes inline elements through SegmentBuilder
//! - **Nested Element Support**: Handles arbitrary nested XML content
//! - **Content Reconstruction**: Preserves original structure for data elements
//!
//! ## Supported Content Types
//!
//! - Plain text nodes
//! - CDATA sections with literal content
//! - Inline code elements (ph, pc, sc, ec, cp)
//! - Nested XML elements (for originalData content)

use std::fs::File;
use std::io::BufReader;

use anyhow::{Result, bail};
use quick_xml::encoding::Decoder;
use quick_xml::events::{BytesStart, Event};
use quick_xml::name::ResolveResult;
use quick_xml::reader::NsReader;

use super::xml_reader::{
    decode_local_name, decode_end_name, decode_start_name, decode_text, decode_cdata, decode_qname,
    skip_current_element
};
use super::inline_tags::is_inline_code;
use super::segment_builder::SegmentBuilder;

/// Parses a text container element (source or target) with inline code processing.
///
/// This function processes XLIFF text containers, handling mixed content that
/// includes text nodes, CDATA sections, and inline code elements. Inline codes
/// are processed through the provided SegmentBuilder for placeholder generation
/// and tag map metadata collection.
///
/// ## Processing Flow
///
/// 1. **Text Content**: Accumulated as translatable text
/// 2. **CDATA Sections**: Processed as literal text content
/// 3. **Inline Codes**: Handled through SegmentBuilder for placeholder generation
/// 4. **Other Elements**: Skipped as unsupported content
///
/// ## Inline Code Processing
///
/// The function distinguishes between:
/// - **Empty Elements**: Self-closing inline codes (e.g., `<ph id="1"/>`)
/// - **Container Elements**: Paired codes with content (e.g., `<pc id="1">text</pc>`)
/// - **End Elements**: Closing tags for paired codes
///
/// ## Arguments
///
/// * `reader` - Mutable reference to the XML reader positioned after container start
/// * `start` - The container element start tag (source or target)
/// * `decoder` - XML decoder for text content processing
/// * `builder` - Mutable reference to SegmentBuilder for inline code handling
///
/// ## Returns
///
/// * `Ok(())` - Text container parsed successfully
/// * `Err(anyhow::Error)` - Parsing error or unexpected content structure
///
/// ## Example Container Structure
///
/// ```xml
/// <source>Hello <ph id="ph1"/> <pc id="pc1">world</pc>!</source>
/// ```
///
/// This would be processed as:
/// - Text: "Hello "
/// - Placeholder: Generated for ph1
/// - Text: " "
/// - Start placeholder: Generated for pc1 start
/// - Text: "world"
/// - End placeholder: Generated for pc1 end
/// - Text: "!"
pub fn parse_text_container(
    reader: &mut NsReader<BufReader<File>>,
    start: BytesStart<'static>,
    decoder: Decoder,
    builder: &mut SegmentBuilder,
) -> Result<()> {
    let mut buf = Vec::new();
    let container_name = decode_start_name(&start, decoder)?;

    // Process mixed content within the text container
    loop {
        match reader.read_resolved_event_into(&mut buf)? {
            // Plain text content
            (_, Event::Text(text)) => {
                let text_content = decode_text(&text)?;
                builder.push_text(text_content);
            }

            // CDATA section with literal content
            (_, Event::CData(cdata)) => {
                let cdata_content = decode_cdata(&cdata, decoder)?;
                builder.push_text(cdata_content);
            }

            // Start of nested element
            (_, Event::Start(start)) => {
                let name = decode_local_name(&start, decoder)?;
                if is_inline_code(&name) {
                    // Process inline code start element
                    builder.handle_start(&name, &start, decoder)?;
                    // Continue processing - non-empty inline nodes may have content
                } else {
                    // Skip unsupported nested elements
                    let owned_start = start.to_owned();
                    skip_current_element(reader, owned_start, &mut buf)?;
                }
            }

            // Empty (self-closing) element
            (_, Event::Empty(empty)) => {
                let name = decode_local_name(&empty, decoder)?;
                if is_inline_code(&name) {
                    // Process self-closing inline code
                    builder.handle_empty(&name, &empty, decoder)?;
                }
                // Skip other empty elements
            }

            // End element
            (_, Event::End(end)) => {
                let end_name = decode_end_name(&end, decoder)?;
                if end_name == container_name {
                    // End of text container - exit loop
                    break;
                }
                if is_inline_code(&end_name) {
                    // Process inline code end element
                    builder.handle_end(&end_name)?;
                }
                // Skip other end elements
            }

            // Unexpected end of file
            (ResolveResult::Unbound, Event::Eof) => {
                bail!("Unexpected EOF inside text container");
            }

            // Skip other events (comments, processing instructions, etc.)
            _ => {}
        }
        buf.clear();
    }

    Ok(())
}

/// Reads and reconstructs textual content from an XML element.
///
/// This function extracts all textual content from an XML element, including
/// text nodes, CDATA sections, and serialized nested elements. It's primarily
/// used for reading content from `<data>` elements in originalData sections.
///
/// ## Content Reconstruction
///
/// The function handles:
/// - **Text Nodes**: Direct text content
/// - **CDATA Sections**: Literal content without XML parsing
/// - **Nested Elements**: Re-serialized as XML markup
///
/// For nested elements, the function recursively processes child content
/// and reconstructs the complete XML structure, preserving:
/// - Element names and attributes
/// - Nested element hierarchy
/// - Text content and CDATA sections
///
/// ## Arguments
///
/// * `reader` - Mutable reference to the XML reader positioned after element start
/// * `start` - The element start tag to read content from
/// * `decoder` - XML decoder for text content processing
///
/// ## Returns
///
/// * `Ok(String)` - Complete textual content with reconstructed markup
/// * `Err(anyhow::Error)` - Reading error or unexpected content structure
///
/// ## Example Input/Output
///
/// Input XML:
/// ```xml
/// <data id="d1">Hello &lt;b&gt;world&lt;/b&gt;</data>
/// ```
///
/// Output String:
/// ```text
/// Hello <b>world</b>
/// ```
///
/// For nested elements:
/// ```xml
/// <data id="d2">Text <nested attr="value">content</nested> more</data>
/// ```
///
/// Output:
/// ```text
/// Text <nested attr="value">content</nested> more
/// ```
pub fn read_textual_content(
    reader: &mut NsReader<BufReader<File>>,
    start: BytesStart<'static>,
    decoder: Decoder,
) -> Result<String> {
    let mut buf = Vec::new();
    let mut output = String::new();
    let container_name = decode_start_name(&start, decoder)?;

    // Process all content within the element
    loop {
        match reader.read_resolved_event_into(&mut buf)? {
            // Plain text content - append directly
            (_, Event::Text(text)) => {
                let text_content = decode_text(&text)?;
                output.push_str(&text_content);
            }

            // CDATA content - append as literal text
            (_, Event::CData(cdata)) => {
                let cdata_content = decode_cdata(&cdata, decoder)?;
                output.push_str(&cdata_content);
            }

            // End of the container element
            (_, Event::End(end)) => {
                let end_name = decode_end_name(&end, decoder)?;
                if end_name == container_name {
                    break;
                }
            }

            // Nested element start - reconstruct as XML
            (_, Event::Start(child_start)) => {
                let child_name = decode_local_name(&child_start, decoder)?;

                // Build opening tag
                output.push('<');
                output.push_str(&child_name);

                // Add attributes
                let owned_child = child_start.to_owned();
                for attr in owned_child.attributes().with_checks(false) {
                    let attr = attr?;
                    let key = decode_qname(attr.key, decoder)?;
                    let value = attr
                        .decode_and_unescape_value(decoder)
                        .map_err(|err| anyhow::anyhow!(err))?
                        .into_owned();

                    output.push(' ');
                    output.push_str(&key);
                    output.push_str("=\"");
                    output.push_str(&value);
                    output.push('"');
                }
                output.push('>');

                // Recursively read nested content
                let inner_content = read_textual_content(reader, owned_child, decoder)?;
                output.push_str(&inner_content);

                // Close the element
                output.push_str("</");
                output.push_str(&child_name);
                output.push('>');
            }

            // Unexpected end of file
            (ResolveResult::Unbound, Event::Eof) => {
                bail!("Unexpected EOF while reading text");
            }

            // Skip other events
            _ => {}
        }
        buf.clear();
    }

    Ok(output)
}