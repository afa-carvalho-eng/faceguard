import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { config } from "./config";

// Uses Node's built-in SQLite (node:sqlite) — no native build step required,
// so the app installs and runs with zero compiler toolchain.

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

export const db = new DatabaseSync(config.dbPath);
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  own_photo_attested INTEGER NOT NULL,
  terms_accepted INTEGER NOT NULL,
  ip_address TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  consent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  image_ref TEXT NOT NULL,
  provider TEXT NOT NULL,
  match_count INTEGER NOT NULL DEFAULT 0,
  face_detected INTEGER NOT NULL DEFAULT 0,
  matches_json TEXT NOT NULL DEFAULT '[]',
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS monitors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  image_ref TEXT NOT NULL,
  consent_id TEXT NOT NULL,
  frequency TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  known_match_urls TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  monitor_id TEXT NOT NULL,
  match_json TEXT NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
`);

// Safe migrations for databases created by earlier versions.
try {
  const ucols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!ucols.some((c) => c.name === "stripe_customer_id")) {
    db.exec("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT");
  }
  const scols = db.prepare("PRAGMA table_info(scans)").all() as { name: string }[];
  if (!scols.some((c) => c.name === "face_detected")) {
    db.exec("ALTER TABLE scans ADD COLUMN face_detected INTEGER NOT NULL DEFAULT 0");
  }
} catch (e) {
  console.warn("[db] migration check failed", e);
}
