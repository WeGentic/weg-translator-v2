use std::convert::TryFrom;
use std::env;
use std::fs::{self, OpenOptions};
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, anyhow};
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;
use uuid::Uuid;
use weg_translator_lib::{
    ConversionOptions, DbManager, NewProject, NewProjectFile, ProjectFileConversionRequest,
    ProjectFileConversionStatus, ProjectFileImportStatus, ProjectStatus, ProjectType,
    convert_xliff,
};

const DB_FILE_NAME: &str = "weg_translator.db";

#[derive(Debug)]
struct CliConfig {
    app_dir: PathBuf,
    project_name: String,
    slug: Option<String>,
    src_lang: String,
    tgt_lang: String,
    operator: String,
    doc_path: PathBuf,
    xliff_path: PathBuf,
    overwrite: bool,
}

impl CliConfig {
    fn parse() -> Result<Self> {
        let mut args = env::args().skip(1);
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let default_doc = manifest_dir.join("../docs/jliff-editor/demo/sample.docx");
        let default_xliff = manifest_dir.join("../docs/jliff-editor/demo/sample.en-US-fr-FR.xlf");

        let mut cfg = CliConfig {
            app_dir: PathBuf::from("demo-appdata"),
            project_name: "JLIFF Demo".to_string(),
            slug: None,
            src_lang: "en-US".to_string(),
            tgt_lang: "fr-FR".to_string(),
            operator: "Demo Operator".to_string(),
            doc_path: default_doc,
            xliff_path: default_xliff,
            overwrite: false,
        };

        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--app-dir" => {
                    let value = args
                        .next()
                        .ok_or_else(|| anyhow!("--app-dir requires a path argument"))?;
                    cfg.app_dir = PathBuf::from(value);
                }
                "--project-name" => {
                    let value = args
                        .next()
                        .ok_or_else(|| anyhow!("--project-name requires a value"))?;
                    cfg.project_name = value;
                }
                "--slug" => {
                    let value = args
                        .next()
                        .ok_or_else(|| anyhow!("--slug requires a value"))?;
                    cfg.slug = Some(value);
                }
                "--src-lang" => {
                    let value = args
                        .next()
                        .ok_or_else(|| anyhow!("--src-lang requires a value"))?;
                    cfg.src_lang = value;
                }
                "--tgt-lang" | "--target-lang" => {
                    let value = args
                        .next()
                        .ok_or_else(|| anyhow!("--tgt-lang requires a value"))?;
                    cfg.tgt_lang = value;
                }
                "--operator" => {
                    let value = args
                        .next()
                        .ok_or_else(|| anyhow!("--operator requires a value"))?;
                    cfg.operator = value;
                }
                "--doc" | "--docx" => {
                    let value = args
                        .next()
                        .ok_or_else(|| anyhow!("--doc requires a path"))?;
                    cfg.doc_path = PathBuf::from(value);
                }
                "--xliff" => {
                    let value = args
                        .next()
                        .ok_or_else(|| anyhow!("--xliff requires a path"))?;
                    cfg.xliff_path = PathBuf::from(value);
                }
                "--overwrite" | "-f" => {
                    cfg.overwrite = true;
                }
                "--help" | "-h" => {
                    print_usage();
                    std::process::exit(0);
                }
                other => {
                    return Err(anyhow!("Unrecognised argument: {other}"));
                }
            }
        }

        Ok(cfg)
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let config = CliConfig::parse()?;
    run(config).await
}

async fn run(config: CliConfig) -> Result<()> {
    let app_dir = config.app_dir;
    let app_dir = if app_dir.is_absolute() {
        app_dir
    } else {
        std::env::current_dir()?.join(app_dir)
    };

    fs::create_dir_all(&app_dir).with_context(|| {
        format!(
            "Unable to create or access app directory {}",
            app_dir.display()
        )
    })?;
    let app_dir = app_dir
        .canonicalize()
        .with_context(|| format!("Unable to canonicalise app directory {}", app_dir.display()))?;

    let db_path = app_dir.join(DB_FILE_NAME);
    if !db_path.exists() {
        OpenOptions::new()
            .create(true)
            .write(true)
            .open(&db_path)
            .with_context(|| format!("Unable to create database file {}", db_path.display()))?;
    }

    let projects_dir = app_dir.join("projects");
    fs::create_dir_all(&projects_dir).with_context(|| {
        format!(
            "Unable to create projects directory {}",
            projects_dir.display()
        )
    })?;

    let project_id = Uuid::new_v4();
    let slug = config
        .slug
        .unwrap_or_else(|| default_slug(&config.project_name, project_id));
    let project_root = projects_dir.join(&slug);

    if project_root.exists() {
        if config.overwrite {
            fs::remove_dir_all(&project_root).with_context(|| {
                format!(
                    "Unable to remove existing project directory {}",
                    project_root.display()
                )
            })?;
        } else {
            return Err(anyhow!(
                "Project directory {} already exists. Pass --overwrite to replace it.",
                project_root.display()
            ));
        }
    }

    fs::create_dir_all(&project_root).with_context(|| {
        format!(
            "Unable to create project directory {}",
            project_root.display()
        )
    })?;

    let doc_source = canonicalise_existing(&config.doc_path)?;
    let xliff_source = canonicalise_existing(&config.xliff_path)?;

    let doc_filename = doc_source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| anyhow!("DOC/DOCX filename must be valid UTF-8"))?;
    let doc_target = project_root.join(doc_filename);
    fs::copy(&doc_source, &doc_target).with_context(|| {
        format!(
            "Failed to copy document {} -> {}",
            doc_source.display(),
            doc_target.display()
        )
    })?;

    let doc_metadata = fs::metadata(&doc_target)
        .with_context(|| format!("Unable to stat {}", doc_target.display()))?;
    let doc_size = i64::try_from(doc_metadata.len()).ok();

    let stem = Path::new(doc_filename)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or_else(|| anyhow!("Document stem must be valid UTF-8"))?;

    let xliff_dir = project_root.join("xliff");
    fs::create_dir_all(&xliff_dir)
        .with_context(|| format!("Unable to create {}", xliff_dir.display()))?;
    let xliff_filename = format!("{}.{}-{}.xlf", stem, config.src_lang, config.tgt_lang);
    let xliff_target = xliff_dir.join(&xliff_filename);
    fs::copy(&xliff_source, &xliff_target).with_context(|| {
        format!(
            "Failed to copy XLIFF {} -> {}",
            xliff_source.display(),
            xliff_target.display()
        )
    })?;

    let jliff_dir = project_root.join("jliff");
    fs::create_dir_all(&jliff_dir)
        .with_context(|| format!("Unable to create {}", jliff_dir.display()))?;

    let mut options = ConversionOptions::new(
        xliff_target.clone(),
        jliff_dir.clone(),
        config.project_name.clone(),
        project_id.to_string(),
        config.operator.clone(),
    );
    options.pretty = true;
    let artifacts = convert_xliff(&options).context("Failed to convert demo XLIFF to JLIFF")?;
    if artifacts.is_empty() {
        return Err(anyhow!("Conversion did not produce any artifacts"));
    }
    let primary_artifact = &artifacts[0];

    let xliff_rel = to_rel_path(&xliff_target, &project_root)?;
    let jliff_rel = to_rel_path(&primary_artifact.jliff_path, &project_root)?;
    let tag_map_rel = to_rel_path(&primary_artifact.tag_map_path, &project_root)?;

    let doc_ext = Path::new(doc_filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_string();

    let file_id = Uuid::new_v4();

    let project_record = NewProject {
        id: project_id,
        name: config.project_name.clone(),
        slug: slug.clone(),
        project_type: ProjectType::Translation,
        root_path: project_root.to_string_lossy().to_string(),
        status: ProjectStatus::Active,
        default_src_lang: Some(config.src_lang.clone()),
        default_tgt_lang: Some(config.tgt_lang.clone()),
        metadata: None,
    };

    let project_file = NewProjectFile {
        id: file_id,
        project_id,
        original_name: doc_filename.to_string(),
        original_path: doc_source.to_string_lossy().to_string(),
        stored_rel_path: doc_filename.to_string(),
        ext: doc_ext,
        size_bytes: doc_size,
        checksum_sha256: None,
        import_status: ProjectFileImportStatus::Imported,
    };

    let db = DbManager::new_with_base_dir(&app_dir)
        .await
        .context("Failed to initialise database in app directory")?;

    db.insert_project_with_files(&project_record, &[project_file])
        .await
        .context("Failed to insert demo project")?;

    let conversion_request =
        ProjectFileConversionRequest::new(&config.src_lang, &config.tgt_lang, "2.0");
    let conversion = db
        .find_or_create_conversion_for_file(file_id, &conversion_request)
        .await
        .context("Failed to create project conversion record")?;

    let timestamp = OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| OffsetDateTime::now_utc().to_string());

    db.upsert_conversion_status(
        conversion.id,
        ProjectFileConversionStatus::Completed,
        Some(xliff_rel.clone()),
        Some(jliff_rel.clone()),
        Some(tag_map_rel.clone()),
        None,
        Some(timestamp.clone()),
        Some(timestamp.clone()),
        None,
    )
    .await
    .context("Failed to finalise conversion status")?;

    println!("Seeded demo project:");
    println!("  App folder       : {}", app_dir.display());
    println!("  Project ID       : {}", project_id);
    println!("  Project slug     : {}", slug);
    println!("  Project root     : {}", project_root.display());
    println!("  File ID          : {}", file_id);
    println!("  Conversion ID    : {}", conversion.id);
    println!("  JLIFF artifact   : {}", jliff_rel);
    println!("  Tag map artifact : {}", tag_map_rel);

    Ok(())
}

fn default_slug(name: &str, id: Uuid) -> String {
    let base = name
        .chars()
        .map(|c| match c {
            'a'..='z' | '0'..='9' | '-' => c,
            'A'..='Z' => c.to_ascii_lowercase(),
            _ => '-',
        })
        .collect::<String>();
    let trimmed = base.trim_matches('-');
    let condensed = trimmed
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    let short_id = &id.to_string()[..8];
    if condensed.is_empty() {
        format!("demo-{short_id}")
    } else {
        format!("{condensed}-{short_id}")
    }
}

fn canonicalise_existing(path: &Path) -> Result<PathBuf> {
    if !path.exists() {
        return Err(anyhow!("Path not found: {}", path.display()));
    }
    Ok(path
        .canonicalize()
        .with_context(|| format!("Unable to canonicalise {}", path.display()))?)
}

fn to_rel_path(path: &Path, base: &Path) -> Result<String> {
    let rel = path
        .strip_prefix(base)
        .with_context(|| format!("{} is not inside {}", path.display(), base.display()))?;
    Ok(rel.to_string_lossy().replace('\\', "/"))
}

fn print_usage() {
    println!("Seed demo project data for the Weg Translator JLIFF editor.\n");
    println!("Usage: seed-demo-project [options]\n");
    println!("Options:");
    println!(
        "  --app-dir <path>       Target application data directory (default: ./demo-appdata)"
    );
    println!("  --project-name <text>  Friendly project name (default: JLIFF Demo)");
    println!("  --slug <text>          Override generated project slug");
    println!("  --src-lang <code>      Source language code (default: en-US)");
    println!("  --tgt-lang <code>      Target language code (default: fr-FR)");
    println!("  --operator <name>      Operator stored in JLIFF metadata");
    println!(
        "  --doc <path>           Source DOC/DOCX to attach (default: ../docs/jliff-editor/demo/sample.docx)"
    );
    println!(
        "  --xliff <path>         Prepared XLIFF to convert (default: ../docs/jliff-editor/demo/sample.en-US-fr-FR.xlf)"
    );
    println!("  --overwrite            Replace existing project directory if present");
    println!("  -h, --help             Show this help message");
}
