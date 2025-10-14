use std::fmt;
use std::str::FromStr;

use log::warn;

/// SQLite journal modes supported by the application. Acts as a whitelist to
/// prevent arbitrary SQL snippets from being injected into PRAGMA statements.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JournalMode {
    Wal,
    Delete,
    Truncate,
    Persist,
    Memory,
    Off,
}

impl JournalMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            JournalMode::Wal => "WAL",
            JournalMode::Delete => "DELETE",
            JournalMode::Truncate => "TRUNCATE",
            JournalMode::Persist => "PERSIST",
            JournalMode::Memory => "MEMORY",
            JournalMode::Off => "OFF",
        }
    }
}

impl Default for JournalMode {
    fn default() -> Self {
        JournalMode::Wal
    }
}

impl fmt::Display for JournalMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for JournalMode {
    type Err = ();

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_ascii_uppercase().as_str() {
            "WAL" => Ok(JournalMode::Wal),
            "DELETE" => Ok(JournalMode::Delete),
            "TRUNCATE" => Ok(JournalMode::Truncate),
            "PERSIST" => Ok(JournalMode::Persist),
            "MEMORY" => Ok(JournalMode::Memory),
            "OFF" => Ok(JournalMode::Off),
            _ => Err(()),
        }
    }
}

/// Supported synchronous levels for SQLite connections. Defaults to NORMAL for
/// a balance between throughput and durability.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Synchronous {
    Off,
    Normal,
    Full,
    Extra,
}

impl Synchronous {
    pub fn as_str(&self) -> &'static str {
        match self {
            Synchronous::Off => "OFF",
            Synchronous::Normal => "NORMAL",
            Synchronous::Full => "FULL",
            Synchronous::Extra => "EXTRA",
        }
    }
}

impl Default for Synchronous {
    fn default() -> Self {
        Synchronous::Normal
    }
}

impl fmt::Display for Synchronous {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for Synchronous {
    type Err = ();

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_ascii_uppercase().as_str() {
            "OFF" => Ok(Synchronous::Off),
            "NORMAL" => Ok(Synchronous::Normal),
            "FULL" => Ok(Synchronous::Full),
            "EXTRA" => Ok(Synchronous::Extra),
            _ => Err(()),
        }
    }
}

/// Database performance configuration describing the PRAGMA overrides that
/// should be applied once a SQLite pool is established.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DatabasePerformanceConfig {
    journal_mode: JournalMode,
    synchronous: Synchronous,
}

impl DatabasePerformanceConfig {
    pub const fn new(journal_mode: JournalMode, synchronous: Synchronous) -> Self {
        Self {
            journal_mode,
            synchronous,
        }
    }

    pub fn journal_mode(&self) -> JournalMode {
        self.journal_mode
    }

    pub fn synchronous(&self) -> Synchronous {
        self.synchronous
    }

    /// Builds a config from user-provided strings (e.g. settings.yaml). Invalid
    /// values fall back to defaults while emitting a warning.
    pub fn from_strings(journal_mode: &str, synchronous: &str) -> Self {
        let journal = match JournalMode::from_str(journal_mode) {
            Ok(mode) => mode,
            Err(_) => {
                warn!(
                    target: "db::config",
                    "invalid SQLite journal_mode \"{}\" supplied; defaulting to WAL",
                    journal_mode
                );
                JournalMode::default()
            }
        };
        let sync_level = match Synchronous::from_str(synchronous) {
            Ok(level) => level,
            Err(_) => {
                warn!(
                    target: "db::config",
                    "invalid SQLite synchronous \"{}\" supplied; defaulting to NORMAL",
                    synchronous
                );
                Synchronous::default()
            }
        };
        Self::new(journal, sync_level)
    }
}

impl Default for DatabasePerformanceConfig {
    fn default() -> Self {
        Self {
            journal_mode: JournalMode::default(),
            synchronous: Synchronous::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_strings_accepts_mixed_case() {
        let config = DatabasePerformanceConfig::from_strings("wal", "full");
        assert_eq!(config.journal_mode(), JournalMode::Wal);
        assert_eq!(config.synchronous(), Synchronous::Full);
    }

    #[test]
    fn from_strings_defaults_on_invalid_values() {
        let config = DatabasePerformanceConfig::from_strings("INVALID", "???");
        assert_eq!(config.journal_mode(), JournalMode::Wal);
        assert_eq!(config.synchronous(), Synchronous::Normal);
    }
}
