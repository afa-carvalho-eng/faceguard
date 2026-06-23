import { Router } from "express";
import { requireAuth, AuthedRequest } from "../auth";
import { exportUserData, deleteUserAccount } from "../services/accountService";

export const accountRouter = Router();

// GDPR data export (Art. 20). Downloads everything we hold as JSON.
accountRouter.get("/export", requireAuth, (req: AuthedRequest, res) => {
  const data = exportUserData(req.userId!);
  if (!data.user) return res.status(404).json({ error: "Not found" });
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="faceguard-export.json"`);
  res.send(JSON.stringify(data, null, 2));
});

// GDPR right to erasure (Art. 17). Deletes the account and all associated data.
accountRouter.delete("/", requireAuth, (req: AuthedRequest, res) => {
  const summary = deleteUserAccount(req.userId!);
  res.json({ ok: true, ...summary });
});
