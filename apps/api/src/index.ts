import express from "express";
import cors from "cors";
import { config } from "./config";
import "./db";
import { authRouter } from "./routes/auth";
import { scansRouter } from "./routes/scans";
import { monitorsRouter } from "./routes/monitors";
import { billingRouter } from "./routes/billing";
import { accountRouter } from "./routes/account";
import { errorHandler } from "./middleware/error";
import { startMonitoringScheduler } from "./services/monitoringService";

const app = express();
app.use(cors({ origin: config.webOrigin === "*" ? true : config.webOrigin.split(",") }));
// Stripe webhook needs the raw body for signature verification; skip JSON there.
app.use((req, res, next) =>
  req.originalUrl === "/api/billing/webhook" ? next() : express.json()(req, res, next)
);

app.get("/health", (_req, res) =>
  res.json({ ok: true, provider: config.searchProvider, time: new Date().toISOString() })
);

app.use("/api/auth", authRouter);
app.use("/api/scans", scansRouter);
app.use("/api/monitors", monitorsRouter);
app.use("/api/billing", billingRouter);
app.use("/api/account", accountRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[faceguard-api] listening on :${config.port} (provider=${config.searchProvider})`);
  startMonitoringScheduler();
});
