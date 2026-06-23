// Verifies the GDPR erasure cascade SQL against a real in-memory SQLite DB
// using Node's built-in node:sqlite (Node >= 22.5).
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert";

const db = new DatabaseSync(":memory:");
db.exec(`
CREATE TABLE users (id TEXT PRIMARY KEY, plan TEXT, stripe_customer_id TEXT);
CREATE TABLE consents (id TEXT PRIMARY KEY, user_id TEXT);
CREATE TABLE scans (id TEXT PRIMARY KEY, user_id TEXT, image_ref TEXT);
CREATE TABLE monitors (id TEXT PRIMARY KEY, user_id TEXT, image_ref TEXT);
CREATE TABLE alerts (id TEXT PRIMARY KEY, user_id TEXT);
`);

// Seed two users so we can prove erasure is scoped to one user only.
for (const u of ["u1", "u2"]) {
  db.prepare("INSERT INTO users (id, plan) VALUES (?, 'pro')").run(u);
  db.prepare("INSERT INTO consents (id, user_id) VALUES (?, ?)").run(u + "-c", u);
  db.prepare("INSERT INTO scans (id, user_id, image_ref) VALUES (?, ?, ?)").run(u + "-s", u, u + ".jpg");
  db.prepare("INSERT INTO monitors (id, user_id, image_ref) VALUES (?, ?, ?)").run(u + "-m", u, u + "-mon.jpg");
  db.prepare("INSERT INTO alerts (id, user_id) VALUES (?, ?)").run(u + "-a", u);
}

// Collect image refs (mirrors accountService.userImageRefs)
const refs = [
  ...db.prepare("SELECT image_ref FROM scans WHERE user_id=?").all("u1"),
  ...db.prepare("SELECT image_ref FROM monitors WHERE user_id=?").all("u1"),
].map((r) => r.image_ref);
assert.deepEqual(refs.sort(), ["u1-mon.jpg", "u1.jpg"], "should collect both image refs");

// Run the exact erasure order from accountService.deleteUserAccount
const removed = {
  alerts: db.prepare("DELETE FROM alerts WHERE user_id=?").run("u1").changes,
  monitors: db.prepare("DELETE FROM monitors WHERE user_id=?").run("u1").changes,
  scans: db.prepare("DELETE FROM scans WHERE user_id=?").run("u1").changes,
  consents: db.prepare("DELETE FROM consents WHERE user_id=?").run("u1").changes,
  users: db.prepare("DELETE FROM users WHERE id=?").run("u1").changes,
};
assert.deepEqual(removed, { alerts: 1, monitors: 1, scans: 1, consents: 1, users: 1 });

// u1 fully gone
for (const t of ["users", "consents", "scans", "monitors", "alerts"]) {
  const col = t === "users" ? "id" : "user_id";
  const n = db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE ${col}=?`).get("u1").n;
  assert.equal(n, 0, `${t} should have no u1 rows`);
}
// u2 untouched
const u2 = db.prepare("SELECT COUNT(*) AS n FROM scans WHERE user_id=?").get("u2").n;
assert.equal(u2, 1, "u2 data must be untouched");

console.log("DELETION CASCADE TEST PASSED (erasure scoped to one user, refs collected)");
