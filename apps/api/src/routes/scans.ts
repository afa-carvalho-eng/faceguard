import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { PLAN_LIMITS } from "@faceguard/shared";
import { db } from "../db";
import { requireAuth, AuthedRequest } from "../auth";
import { validateFacePhoto } from "../services/faceValidation";
import { runScan, getScan, listScans, scansThisMonth } from "../services/scanService";

export const scansRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

/** Record an explicit consent attestation tied to this user + request. */
function recordConsent(userId: string, ip?: string): string {
  const id = nanoid();
  db.prepare(
    `INSERT INTO consents (id, user_id, own_photo_attested, terms_accepted, ip_address, created_at)
     VALUES (?, ?, 1, 1, ?, ?)`
  ).run(id, userId, ip || null, new Date().toISOString());
  return id;
}

scansRouter.post(
  "/",
  requireAuth,
  upload.single("photo"),
  async (req: AuthedRequest, res) => {
    const userId = req.userId!;

    // Consent gate: the user must explicitly attest the photo is of themselves
    // and accept the terms. No scan runs without both.
    const ownPhoto = req.body.ownPhotoAttested === "true" || req.body.ownPhotoAttested === true;
    const terms = req.body.termsAccepted === "true" || req.body.termsAccepted === true;
    if (!ownPhoto || !terms) {
      return res.status(403).json({
        error:
          "Consent required: you must confirm this is a photo of yourself and accept the terms.",
        code: "CONSENT_REQUIRED",
      });
    }

    if (!req.file) return res.status(400).json({ error: "No photo uploaded" });

    // Plan quota.
    const user: any = db.prepare(`SELECT plan FROM users WHERE id=?`).get(userId);
    const limit = PLAN_LIMITS[user.plan as "free" | "pro"].scansPerMonth;
    if (scansThisMonth(userId) >= limit) {
      return res.status(402).json({
        error: `Monthly scan limit reached for the ${user.plan} plan.`,
        code: "QUOTA_EXCEEDED",
      });
    }

    const validation = await validateFacePhoto(req.file.buffer);
    if (!validation.ok) return res.status(422).json({ error: validation.reason });

    const consentId = recordConsent(userId, req.ip);
    const scan = await runScan({
      userId,
      consentId,
      imageBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });
    res.status(201).json(scan);
  }
);

scansRouter.get("/", requireAuth, (req: AuthedRequest, res) => {
  res.json(listScans(req.userId!));
});

scansRouter.get("/:id", requireAuth, (req: AuthedRequest, res) => {
  const scan = getScan(req.params.id, req.userId!);
  if (!scan) return res.status(404).json({ error: "Not found" });
  res.json(scan);
});
