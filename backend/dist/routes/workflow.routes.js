import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { startWorkflow, decide } from "../services/workflow.service.js";
import { requireAtLeast } from "../middleware/rbac.js";
export const wfRouter = Router();
wfRouter.get("/templates", requireAuth, async (_req, res) => {
    res.json(await prisma.workflowTemplate.findMany());
});
wfRouter.post("/templates", requireAuth, requireAtLeast("ADMIN"), async (req, res) => {
    const parsed = z.object({
        name: z.string().min(1),
        steps: z.array(z.object({
            order: z.number().int(), name: z.string(),
            role: z.enum(["ADMIN", "AUDITOR", "APPROVER", "UPLOADER", "VIEWER"]),
            requiredApprovals: z.number().int().min(1).default(1),
        })),
    }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const t = await prisma.workflowTemplate.create({ data: parsed.data });
    res.status(201).json(t);
});
wfRouter.post("/", requireAuth, requireAtLeast("UPLOADER"), async (req, res) => {
    const parsed = z.object({ documentId: z.string(), templateId: z.string() }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const wf = await startWorkflow({ ...parsed.data, userId: req.user.id });
    res.status(201).json(wf);
});
wfRouter.post("/:id/decide", requireAuth, requireAtLeast("APPROVER"), async (req, res) => {
    const parsed = z.object({
        decision: z.enum(["APPROVED", "REJECTED"]),
        comment: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    try {
        const wf = await decide({
            workflowId: req.params.id, userId: req.user.id,
            userRole: req.user.role,
            decision: parsed.data.decision, comment: parsed.data.comment,
        });
        res.json(wf);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
