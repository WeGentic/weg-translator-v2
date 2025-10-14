PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  user_id      TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS clients (
  client_id TEXT PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS domains (
  domain_id TEXT PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE
);
