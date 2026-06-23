import fs from "fs";
import path from "path";
import { db } from "../db";
import { config } from "../config";

/**
 * GDPR Article 20 — data portability. Returns everything we hold for a user.
 */
export function exportUserData(userId: string) {
  const user = db.prepare(`SELECT id, email, display_name, plan, created_at FROM users WHERE id=?`).get(userId);
  const consents = db.prepare(`SELECT * FROM consents WHERE user_id=?`).all(userId);
  const scans = db.prepare(`SELECT * FROM scans WHERE user_id=?`).all(userId);
  const monitors = db.prepare(`SELECT * FROM monitors WHERE user_id=?`).all(userId);
  const alerts = db.prepare(`SELECT * FROM alerts WHERE user_id=?`).all(userId);
  return {
    exportedAt: new Date().toISOString(),
    user,
    consents,
    scans,
    monitors,
    alerts,
  };
}

/** Collect the stored image refs that belong to a user (scans + monitors). */
export function userImageRefs(userId: string): string[] {
  const fromScans = db.prepare(`SELECT image_ref FROM scans WHERE user_id=?`).all(userId) as { image_ref: string }[];
  const fromMonitors = db.prepare(`SELECT image_ref FROM monitors WHERE user_id=?`).all(userId) as { image_ref: string }[];
  return [...fromScans, ...fromMonitors].map((r) => r.image_ref).filter(Boolean);
}

/**
 * GDPR Article 17 — right to erasure. Deletes all DB rows and uploaded files
 * for the user, in a single transaction. Returns a summary of what was removed.
 */
export function deleteUserAccount(userId: string) {
  const refs = userImageRefs(userId);

  // node:sqlite has no transaction() helper — run a manual transaction.
  let removedRows: Record<string, number>;
  db.exec("BEGIN");
  try {
    const a = Number(db.prepare(`DELETE FROM alerts WHERE user_id=?`).run(userId).changes);
    const m = Number(db.prepare(`DELETE FROM monitors WHERE user_id=?`).run(userId).changes);
    const s = Number(db.prepare(`DELETE FROM scans WHERE user_id=?`).run(userId).changes);
    const c = Number(db.prepare(`DELETE FROM consents WHERE user_id=?`).run(userId).changes);
    const u = Number(db.prepare(`DELETE FROM users WHERE id=?`).run(userId).changes);
    db.exec("COMMIT");
    removedRows = { alerts: a, monitors: m, scans: s, consents: c, users: u };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  let filesRemoved = 0;
  for (const ref of refs) {
    const p = path.join(config.uploadDir, ref);
    try {
      if (fs.existsSync(p)) { fs.unlinkSync(p); filesRemoved++; }
    } catch {
      /* best effort */
    }
  }

  return { removedRows, filesRemoved };
}
