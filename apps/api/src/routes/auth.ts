import { Router } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { z } from "zod";
import { User, AuthResponse } from "@faceguard/shared";
import { db } from "../db";
import { signToken, requireAuth, AuthedRequest } from "../auth";

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(80),
});

function rowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    plan: row.plan,
    createdAt: row.created_at,
  };
}

authRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const { email, password, displayName } = parsed.data;

  const existing = db.prepare(`SELECT id FROM users WHERE email=?`).get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const id = nanoid();
  const hash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, email, display_name, password_hash, plan, created_at)
     VALUES (?, ?, ?, ?, 'free', ?)`
  ).run(id, email.toLowerCase(), displayName, hash, now);

  const user = rowToUser(db.prepare(`SELECT * FROM users WHERE id=?`).get(id));
  const resp: AuthResponse = { token: signToken(id), user };
  res.status(201).json(resp);
});

authRouter.post("/login", async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const row: any = db
    .prepare(`SELECT * FROM users WHERE email=?`)
    .get(parsed.data.email.toLowerCase());
  if (!row) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(parsed.data.password, row.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const resp: AuthResponse = { token: signToken(row.id), user: rowToUser(row) };
  res.json(resp);
});

authRouter.get("/me", requireAuth, (req: AuthedRequest, res) => {
  const row = db.prepare(`SELECT * FROM users WHERE id=?`).get(req.userId);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(rowToUser(row));
});
