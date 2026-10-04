import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { ensureDatabase } from "./embedded-db.js";
import { ensureBucket } from "./storage.js";
import { auditContext } from "./middleware/audit.js";
import { authRouter } from "./routes/auth.routes.js";
import { docsRouter } from "./routes/documents.routes.js";
import { wfRouter } from "./routes/workflow.routes.js";
import { auditRouter } from "./routes/audit.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { errorHandler } from "./middleware/error.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(pinoHttp());
app.use(rateLimit({ windowMs: 60_000, max: 300 }));
app.use(auditContext as any);

app.get("/health", (_req, res) => res.json({ ok: true, service: "finvault" }));
app.use("/api/auth", authRouter);
app.use("/api/documents", docsRouter);
app.use("/api/workflows", wfRouter);
app.use("/api/audit", auditRouter);
app.use("/api/admin", adminRouter);

app.use(errorHandler);

async function start() {
    await ensureDatabase();
    await ensureBucket();
    app.listen(config.PORT, () => console.log(`FinVault API listening on :${config.PORT}`));
}
start().catch(err => { console.error(err); process.exit(1); });