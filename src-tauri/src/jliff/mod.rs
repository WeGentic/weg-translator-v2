mod converter;
pub mod model;
mod options;
mod tag_map;

use std::cmp::Reverse;
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, anyhow};
use jsonschema::Validator;
use log::debug;
use serde_json::Value;

pub use model::JliffDocument;
pub use options::ConversionOptions;

/// Output metadata describing where generated artifacts were written.
#[derive(Debug, Clone)]
pub struct GeneratedArtifact {
    pub file_id: String,
    pub jliff_path: PathBuf,
    pub tag_map_path: PathBuf,
}

/// Convert the provided XLIFF document into JLIFF + tag-map artifacts on disk.
pub fn convert_xliff(opts: &ConversionOptions) -> Result<Vec<GeneratedArtifact>> {
    let prefix = compute_prefix(opts)?;
    fs::create_dir_all(&opts.output_dir).with_context(|| {
        format!(
            "Unable to create output directory {}",
            opts.output_dir.display()
        )
    })?;

    let validator = compile_validator(opts.schema_path.as_deref())?;
    let conversions = converter::convert(opts)?;

    let mut filtered: Vec<(converter::FileConversion, (usize, usize))> =
        Vec::with_capacity(conversions.len());
    for conversion in conversions {
        let non_empty_segments = conversion
            .jliff
            .transunits
            .iter()
            .filter(|unit| {
                !unit.source.trim().is_empty() || !unit.target_translation.trim().is_empty()
            })
            .count();
        if conversion.jliff.transunits.is_empty() || non_empty_segments == 0 {
            debug!(
                target: "jliff::convert",
                "Skipping XLIFF <file> id='{}' because it contains no translatable segments",
                conversion.file_id
            );
            continue;
        }
        let total_source_chars: usize = conversion
            .jliff
            .transunits
            .iter()
            .map(|unit| unit.source.trim().chars().count())
            .sum();
        filtered.push((conversion, (non_empty_segments, total_source_chars)));
    }

    if filtered.is_empty() {
        anyhow::bail!("No translatable <file> elements found in XLIFF document.");
    }

    filtered.sort_by_key(|(_, score)| Reverse(*score));

    cleanup_existing_artifacts(&opts.output_dir, &prefix)?;

    let mut filtered_iter = filtered.into_iter();
    let (primary, primary_score) = filtered_iter
        .next()
        .expect("filtered should contain at least one element");

    debug!(
        target: "jliff::convert",
        "Selected XLIFF <file> id='{}' (segments={}, chars={})",
        primary.file_id,
        primary_score.0,
        primary_score.1
    );

    for (conversion, score) in filtered_iter {
        debug!(
            target: "jliff::convert",
            "Discarding secondary XLIFF <file> id='{}' (segments={}, chars={})",
            conversion.file_id,
            score.0,
            score.1
        );
    }

    let (jliff_path, tag_map_path) = build_output_paths(&opts.output_dir, &prefix);

    let jliff_value =
        serde_json::to_value(&primary.jliff).context("Failed to serialize JLIFF document")?;

    if let Some(validator) = validator.as_ref() {
        let errors = collect_validation_errors(validator, &jliff_value);
        if !errors.is_empty() {
            let summary = errors
                .iter()
                .map(|(msg, ptr)| format!("{ptr}: {msg}"))
                .collect::<Vec<_>>()
                .join("; ");
            anyhow::bail!(
                "JLIFF schema validation failed for {}: {}",
                jliff_path.display(),
                summary
            );
        }
    }

    write_json(&jliff_path, &jliff_value, opts.pretty)?;

    let tag_map_value =
        serde_json::to_value(&primary.tag_map).context("Failed to serialize tag-map document")?;
    write_json(&tag_map_path, &tag_map_value, opts.pretty)?;

    Ok(vec![GeneratedArtifact {
        file_id: primary.file_id,
        jliff_path,
        tag_map_path,
    }])
}

fn compute_prefix(opts: &ConversionOptions) -> Result<String> {
    if let Some(prefix) = &opts.file_prefix {
        if prefix.trim().is_empty() {
            anyhow::bail!("File prefix cannot be empty when provided");
        }
        return Ok(prefix.clone());
    }

    let stem = opts
        .input
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| anyhow!("Input filename must be valid UTF-8"))?;

    Ok(stem.to_string())
}

fn compile_validator(path: Option<&Path>) -> Result<Option<Validator>> {
    let Some(path) = path else {
        return Ok(None);
    };
    if !path.exists() {
        log::warn!(
            target: "jliff::convert",
            "Skipping JLIFF schema validation, schema file not found: {}",
            path.display()
        );
        return Ok(None);
    }

    let schema_bytes = fs::read(path)
        .with_context(|| format!("Unable to read JLIFF schema {}", path.display()))?;
    let schema_json: Value = serde_json::from_slice(&schema_bytes)
        .with_context(|| format!("Schema {} is not valid JSON", path.display()))?;

    if let Err(err) = jsonschema::meta::validate(&schema_json) {
        log::warn!(
            target: "jliff::convert",
            "Provided JLIFF schema failed meta-validation ({}). Validation will be skipped.",
            err
        );
        return Ok(None);
    }

    match jsonschema::validator_for(&schema_json) {
        Ok(validator) => Ok(Some(validator)),
        Err(err) => {
            log::warn!(
                target: "jliff::convert",
                "Unable to build JSON schema validator ({}). Validation will be skipped.",
                err
            );
            Ok(None)
        }
    }
}

fn collect_validation_errors(validator: &Validator, value: &Value) -> Vec<(String, String)> {
    validator
        .iter_errors(value)
        .map(|err| (err.to_string(), err.instance_path.to_string()))
        .collect()
}

fn write_json(path: &Path, value: &Value, pretty: bool) -> Result<()> {
    let payload = if pretty {
        serde_json::to_string_pretty(value)?
    } else {
        serde_json::to_string(value)?
    };

    fs::write(path, payload).with_context(|| format!("Failed to write {}", path.display()))
}

fn build_output_paths(out_dir: &Path, prefix: &str) -> (PathBuf, PathBuf) {
    let jliff_name = format!("{}.jliff.json", prefix);
    let tag_map_name = format!("{}.tags.json", prefix);
    (out_dir.join(jliff_name), out_dir.join(tag_map_name))
}

fn cleanup_existing_artifacts(dir: &Path, prefix: &str) -> Result<()> {
    if !dir.exists() {
        return Ok(());
    }

    for entry in
        fs::read_dir(dir).with_context(|| format!("Failed to read directory {}", dir.display()))?
    {
        let entry = entry?;
        let ty = entry.file_type()?;
        if !ty.is_file() {
            continue;
        }

        let name = match entry.file_name().into_string() {
            Ok(value) => value,
            Err(_) => continue,
        };

        let legacy_prefix = format!("{}-file", prefix);
        let is_legacy = name.starts_with(&legacy_prefix)
            && (name.ends_with(".jliff.json") || name.ends_with(".tags.json"));
        let is_current =
            name == format!("{}.jliff.json", prefix) || name == format!("{}.tags.json", prefix);

        if is_legacy || is_current {
            fs::remove_file(entry.path()).with_context(|| {
                format!("Failed to remove stale artifact {}", entry.path().display())
            })?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use tempfile::tempdir;

    #[test]
    fn converts_minimal_xliff_document() -> Result<()> {
        let tmp_dir = tempdir()?;
        let xliff_path = tmp_dir.path().join("sample.xlf");
        let output_dir = tmp_dir.path().join("out");

        let xliff_payload = r#"<?xml version="1.0" encoding="UTF-8"?>
<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.0" srcLang="en-US" trgLang="it-IT">
  <file original="sample.docx" id="1">
    <unit id="u1">
      <segment id="s1">
        <source>Hello <ph id="ph1"/> world</source>
        <target>Ciao <ph id="ph1"/> mondo</target>
      </segment>
    </unit>
  </file>
</xliff>
"#;
        fs::write(&xliff_path, xliff_payload)?;

        let mut opts = ConversionOptions::new(
            xliff_path.clone(),
            output_dir.clone(),
            "Demo Project".to_string(),
            "proj-1".to_string(),
            "user@example.com".to_string(),
        );
        opts.file_prefix = Some("demo".to_string());

        let artifacts = convert_xliff(&opts)?;
        assert_eq!(artifacts.len(), 1);

        let jliff_json: Value =
            serde_json::from_str(&fs::read_to_string(&artifacts[0].jliff_path)?)?;
        assert_eq!(jliff_json["Project_name"], "Demo Project");
        assert_eq!(
            jliff_json["Transunits"][0]["Source"],
            "Hello {{ph:ph1}} world"
        );

        let tag_map_json: Value =
            serde_json::from_str(&fs::read_to_string(&artifacts[0].tag_map_path)?)?;
        assert_eq!(
            tag_map_json["units"][0]["segments"][0]["placeholders_in_order"]
                .as_array()
                .unwrap()
                .len(),
            1
        );

        Ok(())
    }

    #[test]
    fn skips_files_without_transunits_and_removes_stale_artifacts() -> Result<()> {
        let tmp_dir = tempdir()?;
        let xliff_path = tmp_dir.path().join("example.xlf");
        let output_dir = tmp_dir.path().join("out");

        let xliff_payload = r#"<?xml version="1.0" encoding="UTF-8"?>
<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.0" srcLang="en-US" trgLang="es-ES">
  <file original="example.skl" id="skeleton">
    <skeleton href="example.skl"/>
  </file>
  <file original="example.docx" id="content">
    <unit id="u1">
      <segment id="s1">
        <source>Hello</source>
        <target>Hola</target>
      </segment>
    </unit>
  </file>
</xliff>
"#;
        fs::write(&xliff_path, xliff_payload)?;

        fs::create_dir_all(&output_dir)?;
        fs::write(output_dir.join("example-filecontent.jliff.json"), "{}")?;
        fs::write(output_dir.join("example-fileskeleton.jliff.json"), "{}")?;
        fs::write(output_dir.join("example-fileskeleton.tags.json"), "{}")?;
        fs::write(output_dir.join("example.jliff.json"), "{}")?;
        fs::write(output_dir.join("example.tags.json"), "{}")?;

        let mut opts = ConversionOptions::new(
            xliff_path.clone(),
            output_dir.clone(),
            "Demo".to_string(),
            "proj-1".to_string(),
            "tester".to_string(),
        );
        opts.file_prefix = Some("example".to_string());

        let artifacts = convert_xliff(&opts)?;
        assert_eq!(artifacts.len(), 1);
        let artifact_name = artifacts[0]
            .jliff_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap()
            .to_string();
        assert_eq!(artifact_name, "example.jliff.json");

        let jliff_json: Value =
            serde_json::from_str(&fs::read_to_string(&artifacts[0].jliff_path)?)?;
        assert_eq!(
            jliff_json["Transunits"].as_array().map(|arr| arr.len()),
            Some(1)
        );

        let mut entries: Vec<String> = fs::read_dir(&output_dir)?
            .filter_map(|entry| entry.ok())
            .filter(|entry| {
                entry
                    .file_type()
                    .map(|kind| kind.is_file())
                    .unwrap_or(false)
            })
            .map(|entry| entry.file_name().into_string().unwrap_or_default())
            .collect();

        entries.sort();
        assert_eq!(entries, vec!["example.jliff.json", "example.tags.json"]);

        Ok(())
    }
}
