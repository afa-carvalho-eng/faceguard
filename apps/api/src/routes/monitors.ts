import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { z } from "zod";
import { PLAN_LIMITS } from "@faceguard/shared";
import { db } from "../db";
import { config } from "../config";
import { requireAuth, AuthedRequest } from "../auth";
import { validateFacePhoto, normalizeForSearch } from "../services/faceValidation";
import {
  createMonitor,
  listMonitors,
  getMonitor,
  setMonitorActive,
  runMonitor,
  listAlerts,
  acknowledgeAlert,
} from "../services/monitoringService";

export const monitorsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

monitorsRouter.post("/", requireAuth, upload.single("photo"), async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const ownPhoto = req.body.ownPhotoAttested === "true";
  const terms = req.body.termsAccepted === "true";
  if (!ownPhoto || !terms) {
    return res.status(403).json({ error: "Consent required.", code: "CONSENT_REQUIRED" });
  }
  if (!req.file) return res.status(400).json({ error: "No photo uploaded" });

  const user: any = db.prepare(`SELECT plan FROM users WHERE id=?`).get(userId);
  const limit = PLAN_LIMITS[user.plan as "free" | "pro"].monitors;
  if (limit === 0) {
    return res.status(402).json({
      error: "Continuous monitoring is a Pro feature. Upgrade to enable it.",
      code: "UPGRADE_REQUIRED",
    });
  }
  if (listMonitors(userId).length >= limit) {
    return res.status(402).json({ error: "Monitor limit reached for your plan.", code: "QUOTA_EXCEEDED" });
  }

  const schema = z.object({
    label: z.string().min(1).max(80),
    frequency: z.enum(["daily", "weekly", "monthly"]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const validation = await validateFacePhoto(req.file.buffer);
  if (!validation.ok) return res.status(422).json({ error: validation.reason });

  const normalized = await normalizeForSearch(req.file.buffer);
  const imageRef = `${nanoid()}.jpg`;
  fs.writeFileSync(path.join(config.uploadDir, imageRef), normalized);

  const consentId = nanoid();
  db.prepare(
    `INSERT INTO consents (id, user_id, own_photo_attested, terms_accepted, ip_address, created_at)
     VALUES (?, ?, 1, 1, ?, ?)`
  ).run(consentId, userId, req.ip || null, new Date().toISOString());

  const monitor = createMonitor({
    userId,
    consentId,
    label: parsed.data.label,
    imageRef,
    frequency: parsed.data.frequency,
  });
  // Establish a baseline immediately (so future runs only alert on NEW finds).
  await runMonitor(monitor);
  res.status(201).json(getMonitor(monitor.id, userId));
});

monitorsRouter.get("/", requireAuth, (req: AuthedRequest, res) => {
  res.json(listMonitors(req.userId!));
});

monitorsRouter.post("/:id/run", requireAuth, async (req: AuthedRequest, res) => {
  const monitor = getMonitor(req.params.id, req.userId!);
  if (!monitor) return res.status(404).json({ error: "Not found" });
  const alerts = await runMonitor(monitor);
  res.json({ newAlerts: alerts });
});

monitorsRouter.patch("/:id", requireAuth, (req: AuthedRequest, res) => {
  const monitor = getMonitor(req.params.id, req.userId!);
  if (!monitor) return res.status(404).json({ error: "Not found" });
  if (typeof req.body.active === "boolean") {
    setMonitorActive(monitor.id, req.userId!, req.body.active);
  }
  res.json(getMonitor(monitor.id, req.userId!));
});

monitorsRouter.get("/alerts/all", requireAuth, (req: AuthedRequest, res) => {
  res.json(listAlerts(req.userId!));
});

monitorsRouter.post("/alerts/:id/ack", requireAuth, (req: AuthedRequest, res) => {
  acknowledgeAlert(req.params.id, req.userId!);
  res.json({ ok: true });
});
