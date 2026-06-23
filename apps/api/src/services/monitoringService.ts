import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import cron from "node-cron";
import { Monitor, Alert, FaceMatch } from "@faceguard/shared";
import { db } from "../db";
import { config } from "../config";
import { getProvider } from "../providers";
import { verifyOwnFace } from "./faceVerification";

function rowToMonitor(row: any): Monitor {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    imageRef: row.image_ref,
    consentId: row.consent_id,
    frequency: row.frequency,
    active: !!row.active,
    lastRunAt: row.last_run_at || undefined,
    knownMatchUrls: JSON.parse(row.known_match_urls),
    createdAt: row.created_at,
  };
}

export function createMonitor(opts: {
  userId: string;
  consentId: string;
  label: string;
  imageRef: string;
  frequency: Monitor["frequency"];
}): Monitor {
  const id = nanoid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO monitors (id, user_id, label, image_ref, consent_id, frequency, active, known_match_urls, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, '[]', ?)`
  ).run(id, opts.userId, opts.label, opts.imageRef, opts.consentId, opts.frequency, now);
  return getMonitor(id, opts.userId)!;
}

export function getMonitor(id: string, userId: string): Monitor | null {
  const row = db
    .prepare(`SELECT * FROM monitors WHERE id=? AND user_id=?`)
    .get(id, userId);
  return row ? rowToMonitor(row) : null;
}

export function listMonitors(userId: string): Monitor[] {
  return db
    .prepare(`SELECT * FROM monitors WHERE user_id=? ORDER BY created_at DESC`)
    .all(userId)
    .map(rowToMonitor);
}

export function setMonitorActive(id: string, userId: string, active: boolean) {
  db.prepare(`UPDATE monitors SET active=? WHERE id=? AND user_id=?`).run(
    active ? 1 : 0,
    id,
    userId
  );
}

export function listAlerts(userId: string): Alert[] {
  return db
    .prepare(`SELECT * FROM alerts WHERE user_id=? ORDER BY created_at DESC`)
    .all(userId)
    .map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      monitorId: row.monitor_id,
      match: JSON.parse(row.match_json),
      acknowledged: !!row.acknowledged,
      createdAt: row.created_at,
    }));
}

export function acknowledgeAlert(id: string, userId: string) {
  db.prepare(`UPDATE alerts SET acknowledged=1 WHERE id=? AND user_id=?`).run(id, userId);
}

/** Run one monitor: scan, diff against baseline, raise alerts for NEW appearances. */
export async function runMonitor(monitor: Monitor): Promise<Alert[]> {
  const provider = getProvider();
  const imgPath = path.join(config.uploadDir, monitor.imageRef);
  if (!fs.existsSync(imgPath)) return [];
  const buffer = fs.readFileSync(imgPath);

  let matches: FaceMatch[] = [];
  try {
    const candidates = (await provider.search({ imageBuffer: buffer, mimeType: "image/jpeg" }))
      .filter((m) => m.confidence >= config.matchMinConfidence && m.url);
    // AI step: confirm the user's face in each candidate before alerting.
    matches = (await verifyOwnFace(buffer, candidates)).matches;
  } catch {
    return [];
  }

  const known = new Set(monitor.knownMatchUrls);
  const fresh = matches.filter((m) => !known.has(m.url));
  const newAlerts: Alert[] = [];
  const now = new Date().toISOString();

  for (const m of fresh) {
    const alert: Alert = {
      id: nanoid(),
      userId: monitor.userId,
      monitorId: monitor.id,
      match: m,
      acknowledged: false,
      createdAt: now,
    };
    db.prepare(
      `INSERT INTO alerts (id, user_id, monitor_id, match_json, acknowledged, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`
    ).run(alert.id, alert.userId, alert.monitorId, JSON.stringify(m), now);
    newAlerts.push(alert);
  }

  const allUrls = [...new Set([...monitor.knownMatchUrls, ...matches.map((m) => m.url)])];
  db.prepare(
    `UPDATE monitors SET known_match_urls=?, last_run_at=? WHERE id=?`
  ).run(JSON.stringify(allUrls), now, monitor.id);

  return newAlerts;
}

function isDue(m: Monitor): boolean {
  if (!m.active) return false;
  if (!m.lastRunAt) return true;
  const last = new Date(m.lastRunAt).getTime();
  const days = (Date.now() - last) / (1000 * 60 * 60 * 24);
  return days >= { daily: 1, weekly: 7, monthly: 30 }[m.frequency];
}

/** Background sweep — checks all active monitors hourly and runs the due ones. */
export function startMonitoringScheduler() {
  cron.schedule("0 * * * *", async () => {
    const rows = db.prepare(`SELECT * FROM monitors WHERE active=1`).all();
    for (const row of rows) {
      const m = rowToMonitor(row);
      if (isDue(m)) {
        try {
          await runMonitor(m);
        } catch (e) {
          console.error("monitor run failed", m.id, e);
        }
      }
    }
  });
  console.log("[scheduler] monitoring scheduler started (hourly check)");
}
