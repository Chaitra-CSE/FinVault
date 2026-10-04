import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { verifyChain } from "../services/audit.service.js";

export const auditRouter = Router();

auditRouter.get("/", requireAuth, requireRole("AUDITOR", "ADMIN"), async (req, res) => {
    const { action, targetId, limit = "100" } = req.query as any;
    const events = await prisma.auditEvent.findMany({
        where: { ...(action && { action }), ...(targetId && { targetId }) },
        orderBy: { createdAt: "desc" }, take: Math.min(Number(limit), 500),
        include: { actor: { select: { id: true, name: true, email: true } } },
    });
    res.json(events);
});

auditRouter.get("/verify", requireAuth, requireRole("AUDITOR", "ADMIN"), async (_req, res) => {
    res.json(await verifyChain());
});