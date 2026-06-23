import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { Scan, FaceMatch } from "@faceguard/shared";
import { db } from "../db";
import { config } from "../config";
import { getProvider } from "../providers";
import { normalizeForSearch } from "./faceValidation";
import { verifyOwnFace } from "./faceVerification";

function rowToScan(row: any): Scan {
  return {
    id: row.id,
    userId: row.user_id,
    consentId: row.consent_id,
    status: row.status,
    imageRef: row.image_ref,
    provider: row.provider,
    matchCount: row.match_count,
    matches: JSON.parse(row.matches_json),
    faceDetected: !!row.face_detected,
    error: row.error || undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at || undefined,
  };
}

/** Persist the normalized query image and return an opaque reference. */
function storeImage(buffer: Buffer): string {
  const ref = `${nanoid()}.jpg`;
  fs.writeFileSync(path.join(config.uploadDir, ref), buffer);
  return ref;
}

export async function runScan(opts: {
  userId: string;
  consentId: string;
  imageBuffer: Buffer;
  mimeType: string;
}): Promise<Scan> {
  const provider = getProvider();
  const normalized = await normalizeForSearch(opts.imageBuffer);
  const imageRef = storeImage(normalized);
  const id = nanoid();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO scans (id, user_id, consent_id, status, image_ref, provider, match_count, matches_json, created_at)
     VALUES (?, ?, ?, 'running', ?, ?, 0, '[]', ?)`
  ).run(id, opts.userId, opts.consentId, imageRef, provider.name, now);

  try {
    const raw = await provider.search({
      imageBuffer: normalized,
      mimeType: "image/jpeg",
    });
    const candidates: FaceMatch[] = raw
      .filter((m) => m.confidence >= config.matchMinConfidence && m.url)
      .sort((a, b) => b.confidence - a.confidence);

    // AI step: confirm which candidates actually contain the user's own face.
    const { faceDetectedInReference, matches } = await verifyOwnFace(normalized, candidates);

    const completedAt = new Date().toISOString();
    db.prepare(
      `UPDATE scans SET status='completed', match_count=?, face_detected=?, matches_json=?, completed_at=? WHERE id=?`
    ).run(matches.length, faceDetectedInReference ? 1 : 0, JSON.stringify(matches), completedAt, id);
  } catch (err: any) {
    db.prepare(
      `UPDATE scans SET status='failed', error=?, completed_at=? WHERE id=?`
    ).run(String(err?.message || err), new Date().toISOString(), id);
  }

  return getScan(id, opts.userId)!;
}

export function getScan(id: string, userId: string): Scan | null {
  const row = db
    .prepare(`SELECT * FROM scans WHERE id=? AND user_id=?`)
    .get(id, userId);
  return row ? rowToScan(row) : null;
}

export function listScans(userId: string): Scan[] {
  const rows = db
    .prepare(`SELECT * FROM scans WHERE user_id=? ORDER BY created_at DESC`)
    .all(userId);
  return rows.map(rowToScan);
}

export function scansThisMonth(userId: string): number {
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM scans WHERE user_id=? AND created_at>=?`)
    .get(userId, since.toISOString()) as { n: number };
  return row.n;
}
