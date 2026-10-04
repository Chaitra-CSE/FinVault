import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import {
    hashPassword, verifyPassword, signAccess, signRefresh, persistRefresh,
    revokeRefresh, isRefreshValid, verifyRefresh,
} from "../services/auth.service.js";
import { recordAudit } from "../services/audit.service.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const authRouter = Router();

const creds = z.object({ email: z.string().email(), password: z.string().min(8) });

authRouter.post("/register", async (req, res) => {
    const parsed = creds.extend({ name: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });
    const user = await prisma.user.create({
        data: {
            email: parsed.data.email, name: parsed.data.name,
            passwordHash: await hashPassword(parsed.data.password),
            role: "VIEWER",
        },
    });
    await recordAudit({ actorId: user.id, action: "auth.register", targetType: "User", targetId: user.id, ip: req.ip });
    res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

authRouter.post("/login", async (req, res) => {
    const parsed = creds.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !user.active) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await verifyPassword(user.passwordHash, parsed.data.password);
    if (!ok) {
        await recordAudit({ actorId: user.id, action: "auth.login.fail", targetType: "User", targetId: user.id, ip: req.ip });
        return res.status(401).json({ error: "Invalid credentials" });
    }
    const access = signAccess(user.id, user.role);
    const refresh = signRefresh(user.id);
    await persistRefresh(user.id, refresh);
    await recordAudit({ actorId: user.id, action: "auth.login", targetType: "User", targetId: user.id, ip: req.ip });
    res.json({ access, refresh, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

authRouter.post("/refresh", async (req, res) => {
    const { refresh } = req.body ?? {};
    if (!refresh) return res.status(400).json({ error: "Missing refresh" });
    try {
        verifyRefresh(refresh);
    } catch {
        return res.status(401).json({ error: "Invalid refresh" });
    }
    if (!(await isRefreshValid(refresh))) return res.status(401).json({ error: "Refresh revoked" });
    const { sub } = verifyRefresh(refresh);
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user || !user.active) return res.status(401).json({ error: "Invalid user" });
    res.json({ access: signAccess(user.id, user.role) });
});

authRouter.post("/logout", async (req, res) => {
    const { refresh } = req.body ?? {};
    if (refresh) await revokeRefresh(refresh);
    res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});