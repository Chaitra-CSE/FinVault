import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { can, listReadable } from "../services/acl.service.js";
import { createDocument, uploadVersion, signedDownload, softDelete, hardDeleteVersion } from "../services/document.service.js";
import { recordAudit } from "../services/audit.service.js";
import { requireAtLeast } from "../middleware/rbac.js";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
export const docsRouter = Router();
docsRouter.get("/", requireAuth, async (req, res) => {
    const docs = await listReadable(req.user.id, req.user.role);
    res.json(docs);
});
docsRouter.post("/", requireAuth, requireAtLeast("UPLOADER"), async (req, res) => {
    const parsed = z.object({
        title: z.string().min(1), description: z.string().optional(),
        category: z.string().min(1), classification: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
        folderId: z.string().nullable().optional(),
    }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const doc = await createDocument({ ...parsed.data, ownerId: req.user.id });
    await recordAudit({ actorId: req.user.id, action: "doc.create", targetType: "Document", targetId: doc.id });
    res.status(201).json(doc);
});
docsRouter.get("/:id", requireAuth, async (req, res) => {
    const ok = await can(req.user.id, req.user.role, req.params.id, "read");
    if (!ok)
        return res.status(403).json({ error: "Forbidden" });
    const doc = await prisma.document.findUnique({
        where: { id: req.params.id },
        include: {
            versions: { orderBy: { version: "desc" } },
            currentVersion: true, owner: { select: { id: true, name: true, email: true } },
            workflows: { include: { steps: true } },
        },
    });
    if (!doc)
        return res.status(404).json({ error: "Not found" });
    res.json(doc);
});
docsRouter.post("/:id/versions", requireAuth, requireAtLeast("UPLOADER"), upload.single("file"), async (req, res) => {
    const ok = await can(req.user.id, req.user.role, req.params.id, "write");
    if (!ok)
        return res.status(403).json({ error: "Forbidden" });
    if (!req.file)
        return res.status(400).json({ error: "Missing file" });
    const version = await uploadVersion({
        documentId: req.params.id, userId: req.user.id,
        filename: req.file.originalname, mimeType: req.file.mimetype,
        buffer: req.file.buffer, comment: req.body.comment,
        ip: req.ip, userAgent: req.headers["user-agent"],
    });
    res.status(201).json(version);
});
docsRouter.get("/:id/download", requireAuth, async (req, res) => {
    const ok = await can(req.user.id, req.user.role, req.params.id, "read");
    if (!ok)
        return res.status(403).json({ error: "Forbidden" });
    const versionId = req.query.versionId;
    const result = await signedDownload({
        documentId: req.params.id, versionId, userId: req.user.id,
        ip: req.ip, userAgent: req.headers["user-agent"],
    });
    res.json(result);
});
docsRouter.delete("/:id", requireAuth, requireAtLeast("UPLOADER"), async (req, res) => {
    const ok = await can(req.user.id, req.user.role, req.params.id, "admin");
    if (!ok)
        return res.status(403).json({ error: "Forbidden" });
    await softDelete(req.params.id, req.user.id);
    res.json({ ok: true });
});
docsRouter.delete("/:id/versions/:versionId", requireAuth, requireAtLeast("ADMIN"), async (req, res) => {
    await hardDeleteVersion(req.params.versionId, req.user.id);
    res.json({ ok: true });
});
docsRouter.get("/raw-file/:key", async (req, res) => {
    try {
        const { getObjectBuffer } = await import("../storage.js");
        const key = decodeURIComponent(req.params.key);
        const filename = req.query.filename || "download";
        const buf = await getObjectBuffer(key);
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/octet-stream");
        res.send(buf);
    }
    catch {
        res.status(404).json({ error: "File not found" });
    }
});
