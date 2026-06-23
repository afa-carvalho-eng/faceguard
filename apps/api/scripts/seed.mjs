// Seeds two demo accounts (one free, one pro) directly into the local SQLite DB.
// Run from the repo root:  node apps/api/scripts/seed.mjs
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let dbRel = "./data/faceguard.sqlite";
const envFile = path.join(apiDir, ".env");
if (fs.existsSync(envFile)) {
  const m = fs.readFileSync(envFile, "utf8").match(/^DB_PATH=(.+)$/m);
  if (m && m[1].trim()) dbRel = m[1].trim();
}
const dbPath = path.isAbsolute(dbRel) ? dbRel : path.join(apiDir, dbRel);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
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
);`);

const accounts = [
  { email: "free@faceguard.test", name: "Demo Free", plan: "free", password: "Test1234!" },
  { email: "pro@faceguard.test",  name: "Demo Pro",  plan: "pro",  password: "Test1234!" },
];

const now = new Date().toISOString();
for (const a of accounts) {
  const hash = bcrypt.hashSync(a.password, 12);
  db.prepare(`DELETE FROM users WHERE email=?`).run(a.email);
  db.prepare(
    `INSERT INTO users (id, email, display_name, password_hash, plan, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(crypto.randomUUID(), a.email, a.name, hash, a.plan, now);
  console.log(`OK  ${a.plan.toUpperCase().padEnd(4)} account  ->  ${a.email}  /  ${a.password}`);
}

console.log(`\nDatabase: ${dbPath}`);
console.log("Log in at http://localhost:3000/login");
