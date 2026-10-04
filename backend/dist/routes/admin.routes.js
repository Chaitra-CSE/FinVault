import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { recordAudit } from "../services/audit.service.js";
export const adminRouter = Router();
adminRouter.get("/users", requireAuth, requireRole("ADMIN"), async (_req, res) => {
    res.json(await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    }));
});
adminRouter.patch("/users/:id/role", requireAuth, requireRole("ADMIN"), async (req, res) => {
    const parsed = z.object({ role: z.enum(["ADMIN", "AUDITOR", "APPROVER", "UPLOADER", "VIEWER"]) }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: "Invalid role" });
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { role: parsed.data.role } });
    await recordAudit({ actorId: req.user.id, action: "admin.user.role", targetType: "User", targetId: user.id, metadata: { role: user.role } });
    res.json({ id: user.id, role: user.role });
});
adminRouter.patch("/users/:id/active", requireAuth, requireRole("ADMIN"), async (req, res) => {
    const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: "Invalid body" });
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { active: parsed.data.active } });
    await recordAudit({ actorId: req.user.id, action: "admin.user.active", targetType: "User", targetId: user.id, metadata: { active: user.active } });
    res.json({ id: user.id, active: user.active });
});
