import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(err);
  if (err?.type === "entity.too.large" || err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Image too large (max 8MB)." });
  }
  res.status(err.status || 500).json({ error: err.message || "Internal error" });
}
