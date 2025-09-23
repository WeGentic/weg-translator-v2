use std::collections::{BTreeMap, HashMap};
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

use anyhow::{Context, Result, anyhow, bail};
use quick_xml::encoding::Decoder;
use quick_xml::events::{BytesCData, BytesEnd, BytesStart, BytesText, Event};
use quick_xml::name::{Namespace, QName, ResolveResult};
use quick_xml::reader::NsReader;

use super::model::{JliffDocument, TransUnit};
use super::options::{ConversionOptions, PlaceholderStyle};
use super::tag_map::{TagInstance, TagMapDoc, TagMapSegment, TagMapUnit};

/// Fully parsed and assembled output for a single XLIFF `<file>` element.
#[derive(Debug, Clone)]
pub struct FileConversion {
    pub jliff: JliffDocument,
    pub tag_map: TagMapDoc,
    pub file_id: String,
}

/// Converts the provided XLIFF document into JLIFF/tag-map payloads held in memory.
pub fn convert(opts: &ConversionOptions) -> Result<Vec<FileConversion>> {
    let input_path = opts.input.as_path();
    let mut reader = open_reader(input_path)?;
    reader.config_mut().trim_text(false);
    let decoder = reader.decoder();
    let mut buf = Vec::new();

    let (root_namespace, root_start) = locate_root(&mut reader, &mut buf, decoder)?;
    let root_ctx = RootContext::from_start(&root_start, root_namespace.as_deref(), decoder)?;

    if root_ctx.namespace != XLIFF_2_NAMESPACE {
        bail!(
            "Unsupported XLIFF namespace '{}', expected '{}'",
            root_ctx.namespace,
            XLIFF_2_NAMESPACE
        );
    }
    if root_ctx.version.as_deref() != Some("2.0") {
        bail!(
            "Unsupported XLIFF version {:?}, expected 2.0",
            root_ctx.version
        );
    }

    let src_lang = root_ctx
        .src_lang
        .clone()
        .ok_or_else(|| anyhow!("Missing srcLang attribute on <xliff>"))?;
    let trg_lang = root_ctx
        .trg_lang
        .clone()
        .ok_or_else(|| anyhow!("Missing trgLang attribute on <xliff>"))?;

    let mut results = Vec::new();

    loop {
        match reader.read_resolved_event_into(&mut buf)? {
            (ResolveResult::Unbound, Event::Eof) => break,
            (_, Event::Start(start)) => {
                let name = decode_local_name(&start, decoder)?;
                if name == "file" {
                    let file_ctx = FileContext::from_start(&start, decoder)?;
                    let file_result =
                        parse_file(&mut reader, &file_ctx, opts, decoder, &src_lang, &trg_lang)?;
                    results.push(file_result);
                } else {
                    let owned_start = start.to_owned();
                    skip_current_element(&mut reader, owned_start, &mut buf)?;
                }
            }
            (_, Event::Empty(empty)) => {
                let name = decode_local_name(&empty, decoder)?;
                if name == "file" {
                    bail!("Encountered empty <file/> element, which is unsupported");
                }
            }
            (_, Event::End(end)) => {
                let name = decode_end_name(&end, decoder)?;
                if name == "xliff" {
                    break;
                }
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(results)
}

const XLIFF_2_NAMESPACE: &str = "urn:oasis:names:tc:xliff:document:2.0";

struct RootContext {
    namespace: String,
    version: Option<String>,
    src_lang: Option<String>,
    trg_lang: Option<String>,
}

impl RootContext {
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
                _ => {}
            }
        }

        Ok(ctx)
    }
}

struct FileContext {
    id: String,
    original: String,
}

impl FileContext {
    fn from_start(start: &BytesStart<'_>, decoder: Decoder) -> Result<Self> {
        let mut id = None;
        let mut original = None;
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
                _ => {}
            }
        }

        let id = id.ok_or_else(|| anyhow!("<file> missing required id attribute"))?;
        Ok(FileContext {
            id,
            original: original.unwrap_or_default(),
        })
    }
}

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

    loop {
        match reader.read_resolved_event_into(&mut buf)? {
            (_, Event::Start(start)) => {
                let name = decode_local_name(&start, decoder)?;
                let owned_start = start.to_owned();
                if name == "unit" {
                    let unit = parse_unit(reader, owned_start, opts, decoder)?;
                    units.push(unit);
                } else {
                    skip_current_element(reader, owned_start, &mut buf)?;
                }
            }
            (_, Event::Empty(empty)) => {
                let name = decode_local_name(&empty, decoder)?;
                if name == "unit" {
                    bail!("Encountered empty <unit/> element, which is unsupported");
                }
            }
            (_, Event::End(end)) => {
                let name = decode_end_name(&end, decoder)?;
                if name == "file" {
                    break;
                }
            }
            (ResolveResult::Unbound, Event::Eof) => {
                bail!("Unexpected EOF inside <file>");
            }
            _ => {}
        }

        buf.clear();
    }

    let jliff = JliffDocument {
        project_name: opts.project_name.clone(),
        project_id: opts.project_id.clone(),
        file: file_ctx.original.clone(),
        user: opts.user.clone(),
        source_language: src_lang.to_string(),
        target_language: trg_lang.to_string(),
        transunits: units.iter().flat_map(|u| u.trans_units.clone()).collect(),
    };

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

struct UnitOutput {
    trans_units: Vec<TransUnit>,
    tag_unit: TagMapUnit,
}

fn parse_unit(
    reader: &mut NsReader<BufReader<File>>,
    start: BytesStart<'static>,
    opts: &ConversionOptions,
    decoder: Decoder,
) -> Result<UnitOutput> {
    let mut buf = Vec::new();

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

    let mut original_data: BTreeMap<String, String> = BTreeMap::new();
    let mut segments = Vec::new();

    loop {
        match reader.read_resolved_event_into(&mut buf)? {
            (_, Event::Start(start)) => {
                let name = decode_local_name(&start, decoder)?;
                let owned_start = start.to_owned();
                match name.as_str() {
                    "originalData" => {
                        parse_original_data(reader, decoder, &mut original_data)?;
                    }
                    "segment" => {
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
                    _ => skip_current_element(reader, owned_start, &mut buf)?,
                }
            }
            (_, Event::End(end)) => {
                let name = decode_end_name(&end, decoder)?;
                if name == "unit" {
                    break;
                }
            }
            (ResolveResult::Unbound, Event::Eof) => bail!("Unexpected EOF inside <unit>"),
            _ => {}
        }

        buf.clear();
    }

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

struct SegmentOutput {
    trans_unit: TransUnit,
    tag_segment: TagMapSegment,
}

fn parse_segment(
    reader: &mut NsReader<BufReader<File>>,
    start: BytesStart<'static>,
    unit_id: &str,
    original_data: &BTreeMap<String, String>,
    opts: &ConversionOptions,
    decoder: Decoder,
) -> Result<SegmentOutput> {
    let mut buf = Vec::new();

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

    loop {
        match reader.read_resolved_event_into(&mut buf)? {
            (_, Event::Start(start)) => {
                let name = decode_local_name(&start, decoder)?;
                let owned_start = start.to_owned();
                match name.as_str() {
                    "source" => {
                        parse_text_container(reader, owned_start, decoder, &mut source_builder)?
                    }
                    "target" => {
                        parse_text_container(reader, owned_start, decoder, &mut target_builder)?
                    }
                    _ => skip_current_element(reader, owned_start, &mut buf)?,
                }
            }
            (_, Event::End(end)) => {
                let name = decode_end_name(&end, decoder)?;
                if name == "segment" {
                    break;
                }
            }
            (ResolveResult::Unbound, Event::Eof) => bail!("Unexpected EOF inside <segment>"),
            _ => {}
        }
        buf.clear();
    }

    let placeholders = source_builder.placeholders.clone();
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

fn parse_original_data(
    reader: &mut NsReader<BufReader<File>>,
    decoder: Decoder,
    store: &mut BTreeMap<String, String>,
) -> Result<()> {
    let mut buf = Vec::new();

    loop {
        match reader.read_resolved_event_into(&mut buf)? {
            (_, Event::Start(start)) => {
                let name = decode_local_name(&start, decoder)?;
                let owned_start = start.to_owned();
                if name == "data" {
                    let mut data_id = None;
                    for attr in owned_start.attributes().with_checks(false) {
                        let attr = attr?;
                        if decode_qname(attr.key, decoder)?.as_str() == "id" {
                            data_id = Some(
                                attr.decode_and_unescape_value(decoder)
                                    .map_err(|err| anyhow!(err))?
                                    .into_owned(),
                            );
                        }
                    }
                    let data_id = data_id.ok_or_else(|| anyhow!("<data> missing id attribute"))?;
                    let content = read_textual_content(reader, owned_start, decoder)?;
                    store.insert(data_id, content);
                } else {
                    skip_current_element(reader, owned_start, &mut buf)?;
                }
            }
            (_, Event::End(end)) => {
                let name = decode_end_name(&end, decoder)?;
                if name == "originalData" {
                    break;
                }
            }
            (ResolveResult::Unbound, Event::Eof) => bail!("Unexpected EOF inside <originalData>"),
            _ => {}
        }
        buf.clear();
    }

    Ok(())
}

fn parse_text_container(
    reader: &mut NsReader<BufReader<File>>,
    start: BytesStart<'static>,
    decoder: Decoder,
    builder: &mut SegmentBuilder,
) -> Result<()> {
    let mut buf = Vec::new();
    let container_name = decode_start_name(&start, decoder)?;

    loop {
        match reader.read_resolved_event_into(&mut buf)? {
            (_, Event::Text(text)) => {
                builder.push_text(decode_text(&text)?);
            }
            (_, Event::CData(cdata)) => {
                builder.push_text(decode_cdata(&cdata, decoder)?);
            }
            (_, Event::Start(start)) => {
                let name = decode_local_name(&start, decoder)?;
                if is_inline_code(&name) {
                    builder.handle_start(&name, &start, decoder)?;
                    // For non-empty inline nodes (<pc>...</pc>) we continue and
                    // process inner content normally.
                } else {
                    let owned_start = start.to_owned();
                    skip_current_element(reader, owned_start, &mut buf)?;
                }
            }
            (_, Event::Empty(empty)) => {
                let name = decode_local_name(&empty, decoder)?;
                if is_inline_code(&name) {
                    builder.handle_empty(&name, &empty, decoder)?;
                }
            }
            (_, Event::End(end)) => {
                let end_name = decode_end_name(&end, decoder)?;
                if end_name == container_name {
                    break;
                }
                if is_inline_code(&end_name) {
                    builder.handle_end(&end_name)?;
                }
            }
            (ResolveResult::Unbound, Event::Eof) => bail!("Unexpected EOF inside text container"),
            _ => {}
        }
        buf.clear();
    }

    Ok(())
}

fn read_textual_content(
    reader: &mut NsReader<BufReader<File>>,
    start: BytesStart<'static>,
    decoder: Decoder,
) -> Result<String> {
    let mut buf = Vec::new();
    let mut out = String::new();
    let container_name = decode_start_name(&start, decoder)?;

    loop {
        match reader.read_resolved_event_into(&mut buf)? {
            (_, Event::Text(text)) => out.push_str(&decode_text(&text)?),
            (_, Event::CData(cdata)) => out.push_str(&decode_cdata(&cdata, decoder)?),
            (_, Event::End(end)) => {
                let end_name = decode_end_name(&end, decoder)?;
                if end_name == container_name {
                    break;
                }
            }
            (_, Event::Start(child_start)) => {
                // Re-serialize nested tags verbatim.
                let child_name = decode_local_name(&child_start, decoder)?;
                out.push('<');
                out.push_str(&child_name);
                let owned_child = child_start.to_owned();
                for attr in owned_child.attributes().with_checks(false) {
                    let attr = attr?;
                    let key = decode_qname(attr.key, decoder)?;
                    let value = attr
                        .decode_and_unescape_value(decoder)
                        .map_err(|err| anyhow!(err))?
                        .into_owned();
                    out.push(' ');
                    out.push_str(&key);
                    out.push_str("=\"");
                    out.push_str(&value);
                    out.push('"');
                }
                out.push('>');
                let inner = read_textual_content(reader, owned_child, decoder)?;
                out.push_str(&inner);
                out.push_str("</");
                out.push_str(&child_name);
                out.push('>');
            }
            (ResolveResult::Unbound, Event::Eof) => bail!("Unexpected EOF while reading text"),
            _ => {}
        }
        buf.clear();
    }

    Ok(out)
}

struct SegmentBuilder<'a> {
    text: String,
    placeholders: Vec<TagInstance>,
    original_data: &'a BTreeMap<String, String>,
    style: PlaceholderStyle,
    keep_inline: bool,
    generated: usize,
    pc_stack: Vec<PcEntry>,
}

impl<'a> SegmentBuilder<'a> {
    fn new(
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

    fn push_text(&mut self, text: String) {
        self.text.push_str(&text);
    }

    fn into_text(self) -> String {
        self.text
    }

    fn handle_start(&mut self, name: &str, start: &BytesStart<'_>, decoder: Decoder) -> Result<()> {
        let attrs = collect_attrs(start, decoder)?;
        match name {
            "pc" => {
                let id_attr = attrs.get("id").cloned().flatten();
                let (start_placeholder, effective_id) =
                    self.compose_placeholder(name, id_attr.as_deref(), Some("start"));
                self.record_placeholder(start_placeholder.clone(), name, id_attr.clone(), &attrs);
                if !self.keep_inline {
                    self.text.push_str(&start_placeholder);
                }
                self.pc_stack.push(PcEntry {
                    placeholder_id: effective_id,
                    tag_id: id_attr,
                });
            }
            _ => {
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

    fn handle_empty(&mut self, name: &str, start: &BytesStart<'_>, decoder: Decoder) -> Result<()> {
        let attrs = collect_attrs(start, decoder)?;
        match name {
            "pc" => {
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
                let (placeholder, recorded_value) = self.compose_cp_placeholder(&attrs);
                self.record_placeholder(placeholder.clone(), name, None, &attrs);
                if !self.keep_inline {
                    self.text.push_str(&placeholder);
                } else if let Some(ch) = recorded_value {
                    self.text.push(ch);
                } else {
                    self.text.push_str(&placeholder);
                }
            }
            _ => {
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

    fn handle_end(&mut self, name: &str) -> Result<()> {
        if name == "pc" {
            if let Some(entry) = self.pc_stack.pop() {
                let PcEntry {
                    placeholder_id,
                    tag_id,
                } = entry;

                let (placeholder, _) =
                    self.compose_placeholder(name, Some(placeholder_id.as_str()), Some("end"));

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

    fn compose_placeholder(
        &mut self,
        elem: &str,
        id: Option<&str>,
        suffix: Option<&str>,
    ) -> (String, String) {
        let effective_id = id
            .map(|s| s.to_string())
            .unwrap_or_else(|| self.generate_id(elem));
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

    fn compose_cp_placeholder(
        &mut self,
        attrs: &HashMap<String, Option<String>>,
    ) -> (String, Option<char>) {
        if let Some(Some(hex)) = attrs.get("hex") {
            if let Ok(code) = u32::from_str_radix(hex, 16) {
                if let Some(ch) = char::from_u32(code) {
                    if !ch.is_control() || ch == '\n' || ch == '\t' {
                        return (ch.to_string(), Some(ch));
                    }
                }
            }
        }
        let id = attrs
            .get("hex")
            .cloned()
            .flatten()
            .unwrap_or_else(|| self.generate_id("cp"));
        (format!("{{{{cp:{}}}}}", id), None)
    }

    fn record_placeholder(
        &mut self,
        placeholder: String,
        elem: &str,
        id: Option<String>,
        attrs: &HashMap<String, Option<String>>,
    ) {
        let mut ordered_attrs = BTreeMap::new();
        for (k, v) in attrs {
            ordered_attrs.insert(k.clone(), v.clone());
        }

        let original_data = resolve_original_data(self.original_data, attrs, id.as_deref());
        self.placeholders.push(TagInstance {
            placeholder,
            elem: elem.to_string(),
            id,
            attrs: ordered_attrs,
            original_data,
        });
    }

    fn generate_id(&mut self, elem: &str) -> String {
        self.generated += 1;
        format!("{}_auto{}", elem, self.generated)
    }
}

#[derive(Debug, Clone)]
struct PcEntry {
    placeholder_id: String,
    tag_id: Option<String>,
}

fn resolve_original_data(
    store: &BTreeMap<String, String>,
    attrs: &HashMap<String, Option<String>>,
    id: Option<&str>,
) -> Option<String> {
    if let Some(Some(data_ref)) = attrs.get("dataRef") {
        if let Some(value) = store.get(data_ref) {
            return Some(value.clone());
        }
    }

    if let Some(id) = id {
        if let Some(value) = store.get(id) {
            return Some(value.clone());
        }
    }

    None
}

fn is_inline_code(name: &str) -> bool {
    matches!(name, "ph" | "pc" | "sc" | "ec" | "cp")
}

fn collect_attrs(
    start: &BytesStart<'_>,
    decoder: Decoder,
) -> Result<HashMap<String, Option<String>>> {
    let mut attrs = HashMap::new();
    for attr in start.attributes().with_checks(false) {
        let attr = attr?;
        let key = decode_qname(attr.key, decoder)?;
        let value = attr
            .decode_and_unescape_value(decoder)
            .map_err(|err| anyhow!(err))?
            .into_owned();
        attrs.insert(key, Some(value));
    }
    Ok(attrs)
}

fn decode_local_name(start: &BytesStart<'_>, decoder: Decoder) -> Result<String> {
    Ok(decoder
        .decode(start.local_name().as_ref())
        .map_err(|err| anyhow!(err))?
        .into_owned())
}

fn decode_start_name(start: &BytesStart<'_>, decoder: Decoder) -> Result<String> {
    decode_local_name(start, decoder)
}

fn decode_end_name(end: &BytesEnd<'_>, decoder: Decoder) -> Result<String> {
    Ok(decoder
        .decode(end.local_name().as_ref())
        .map_err(|err| anyhow!(err))?
        .into_owned())
}

fn decode_qname(name: QName<'_>, decoder: Decoder) -> Result<String> {
    Ok(decoder
        .decode(name.as_ref())
        .map_err(|err| anyhow!(err))?
        .into_owned())
}

fn decode_text(text: &BytesText<'_>) -> Result<String> {
    Ok(text.xml_content().map_err(|err| anyhow!(err))?.into_owned())
}

fn decode_cdata(text: &BytesCData<'_>, decoder: Decoder) -> Result<String> {
    Ok(decoder
        .decode(text.as_ref())
        .map_err(|err| anyhow!(err))?
        .into_owned())
}

fn locate_root(
    reader: &mut NsReader<BufReader<File>>,
    buf: &mut Vec<u8>,
    decoder: Decoder,
) -> Result<(Option<String>, BytesStart<'static>)> {
    loop {
        match reader.read_resolved_event_into(buf)? {
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
                    bail!("Unexpected root element '{}'", name);
                }
            }
            (ResolveResult::Unbound, Event::Start(start)) => {
                let name = decode_local_name(&start, decoder)?;
                if name == "xliff" {
                    let owned = start.to_owned();
                    buf.clear();
                    return Ok((None, owned));
                } else {
                    bail!("Unexpected root element '{}'", name);
                }
            }
            (_, Event::Eof) => bail!("Reached EOF before locating <xliff> root"),
            _ => {
                buf.clear();
            }
        }
    }
}

fn skip_current_element(
    reader: &mut NsReader<BufReader<File>>,
    start: BytesStart<'static>,
    buf: &mut Vec<u8>,
) -> Result<()> {
    reader.read_to_end_into(start.to_end().name(), buf)?;
    buf.clear();
    Ok(())
}

fn open_reader(path: &Path) -> Result<NsReader<BufReader<File>>> {
    let file = File::open(path).with_context(|| format!("Failed to open {}", path.display()))?;
    Ok(NsReader::from_reader(BufReader::new(file)))
}
