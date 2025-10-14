use std::env;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, anyhow};
use uuid::Uuid;
use weg_translator_lib::{DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE};
use weg_translator_lib::{
    DbManager, FileTargetBackfillSummary, FilesystemArtifactBackfillSummary,
    LOCAL_OWNER_DISPLAY_NAME, LOCAL_OWNER_EMAIL, LOCAL_OWNER_USER_ID,
};

/// Command line configuration parsed from the provided arguments.
#[derive(Debug)]
struct CliConfig {
    app_dir: PathBuf,
    project_ids: Vec<Uuid>,
    ensure_owner: bool,
}

impl CliConfig {
    fn parse() -> Result<Self> {
        let mut args = env::args().skip(1);
        let mut app_dir = None;
        let mut project_ids = Vec::new();
        let mut ensure_owner = false;

        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--app-dir" => {
                    let value = args
                        .next()
                        .ok_or_else(|| anyhow!("--app-dir requires a path argument"))?;
                    app_dir = Some(PathBuf::from(value));
                }
                "--project-id" => {
                    let value = args
                        .next()
                        .ok_or_else(|| anyhow!("--project-id requires a UUID value"))?;
                    let id = Uuid::parse_str(&value)
                        .map_err(|error| anyhow!("invalid project UUID {value}: {error}"))?;
                    project_ids.push(id);
                }
                "--ensure-owner" => {
                    ensure_owner = true;
                }
                "--help" | "-h" => {
                    print_usage();
                    std::process::exit(0);
                }
                other => {
                    return Err(anyhow!("unrecognised argument: {other}"));
                }
            }
        }

        let app_dir = app_dir.ok_or_else(|| anyhow!("--app-dir must be provided"))?;
        Ok(CliConfig {
            app_dir,
            project_ids,
            ensure_owner,
        })
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let config = CliConfig::parse()?;
    run(config).await
}

async fn run(config: CliConfig) -> Result<()> {
    let app_dir = canonicalise_existing_dir(&config.app_dir)?;
    let manager = DbManager::new_with_base_dir(&app_dir)
        .await
        .with_context(|| format!("unable to open database in {}", app_dir.display()))?;

    if config.ensure_owner {
        let owner_summary = manager
            .backfill_project_owner(
                LOCAL_OWNER_USER_ID,
                LOCAL_OWNER_EMAIL,
                LOCAL_OWNER_DISPLAY_NAME,
            )
            .await
            .context("failed to backfill project owners")?;
        println!(
            "Owner backfill: ensured_user={} updated_projects={}",
            owner_summary.ensured_user, owner_summary.updated_projects
        );
    }

    let language_summary = manager
        .backfill_project_language_pairs(DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE)
        .await
        .context("failed to backfill language pairs")?;
    println!(
        "Language pair backfill: inserted_pairs={}",
        language_summary.inserted_pairs
    );

    let filter = if config.project_ids.is_empty() {
        None
    } else {
        Some(config.project_ids.as_slice())
    };

    let summary = manager
        .backfill_file_targets_from_legacy(filter)
        .await
        .context("failed to backfill file targets and artifacts")?;
    print_backfill_summary(&summary);

    let artifact_summary = manager
        .backfill_artifacts_from_disk(filter)
        .await
        .context("failed to register filesystem artifacts")?;
    print_artifact_summary(&artifact_summary);

    Ok(())
}

fn canonicalise_existing_dir(path: &Path) -> Result<PathBuf> {
    if !path.exists() {
        return Err(anyhow!("app directory {} does not exist", path.display()));
    }

    if !path.is_dir() {
        return Err(anyhow!(
            "app directory {} is not a directory",
            path.display()
        ));
    }

    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .context("unable to resolve current directory")?
            .join(path)
    };

    absolute
        .canonicalize()
        .with_context(|| format!("unable to canonicalise {}", absolute.display()))
}

fn print_backfill_summary(summary: &FileTargetBackfillSummary) {
    println!("Legacy conversion backfill complete:");
    println!("  projects scanned: {}", summary.scanned_projects);
    println!("  conversions bridged: {}", summary.bridged_conversions);
    println!(
        "  language pairs created: {}",
        summary.newly_created_language_pairs
    );
    println!(
        "  file targets created: {}",
        summary.newly_created_file_targets
    );
    println!(
        "  file target statuses updated: {}",
        summary.updated_statuses
    );
    println!(
        "  XLIFF artifacts upserted: {}",
        summary.xliff_artifacts_upserted
    );
    println!(
        "  JLIFF artifacts upserted: {}",
        summary.jliff_artifacts_upserted
    );
}

fn print_artifact_summary(summary: &FilesystemArtifactBackfillSummary) {
    println!("Filesystem artifact indexing:");
    println!("  projects scanned: {}", summary.projects_scanned);
    println!("  xliff registered: {}", summary.xliff_registered);
    println!("  jliff registered: {}", summary.jliff_registered);
    println!("  already indexed: {}", summary.already_indexed);
    println!(
        "  skipped (unknown language): {}",
        summary.skipped_unknown_language
    );
    println!("  skipped (invalid name): {}", summary.skipped_invalid_name);
    println!("  checksum failures: {}", summary.checksum_failures);
}

fn print_usage() {
    println!(
        "\
Usage: backfill-legacy-data --app-dir <path> [--project-id <uuid>] [--ensure-owner]

Options:
  --app-dir <path>       Root application data directory containing weg_translator.db
  --project-id <uuid>    Limit backfill to a specific project (repeatable)
  --ensure-owner         Backfill the placeholder local owner for orphaned projects
  -h, --help             Display this help text
"
    );
}
