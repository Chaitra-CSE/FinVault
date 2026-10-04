import { prisma } from "../db.js";
import { recordAudit } from "./audit.service.js";
export async function startWorkflow(params) {
    const template = await prisma.workflowTemplate.findUnique({ where: { id: params.templateId } });
    if (!template)
        throw new Error("Template not found");
    const steps = template.steps;
    if (!Array.isArray(steps) || steps.length === 0)
        throw new Error("Template has no steps");
    const wf = await prisma.workflow.create({
        data: {
            documentId: params.documentId, templateId: template.id, startedById: params.userId,
            steps: {
                create: steps.map(s => ({
                    order: s.order, name: s.name, role: s.role,
                    requiredApprovals: s.requiredApprovals ?? 1,
                })),
            },
        },
        include: { steps: true },
    });
    await prisma.document.update({ where: { id: params.documentId }, data: { status: "IN_REVIEW" } });
    await recordAudit({
        actorId: params.userId, action: "wf.start", targetType: "Workflow", targetId: wf.id,
        metadata: { documentId: params.documentId, templateId: template.id },
    });
    return wf;
}
export async function decide(params) {
    const wf = await prisma.workflow.findUnique({
        where: { id: params.workflowId },
        include: { steps: { orderBy: { order: "asc" }, include: { decisionsList: true } } },
    });
    if (!wf)
        throw new Error("Workflow not found");
    if (wf.status !== "PENDING")
        throw new Error("Workflow already closed");
    const current = wf.steps.find(s => s.decision === "PENDING");
    if (!current)
        throw new Error("No pending step");
    if (current.role !== params.userRole && params.userRole !== "ADMIN") {
        throw new Error("Not authorized for this step");
    }
    await prisma.workflowDecision.create({
        data: {
            stepId: current.id, userId: params.userId,
            decision: params.decision, comment: params.comment,
        },
    });
    if (params.decision === "REJECTED") {
        await prisma.workflowStep.update({ where: { id: current.id }, data: { decision: "REJECTED" } });
        await prisma.workflow.update({ where: { id: wf.id }, data: { status: "REJECTED", completedAt: new Date() } });
        await prisma.document.update({ where: { id: wf.documentId }, data: { status: "REJECTED" } });
    }
    else {
        const approvals = current.decisionsList.filter(d => d.decision === "APPROVED").length + 1;
        if (approvals >= current.requiredApprovals) {
            await prisma.workflowStep.update({ where: { id: current.id }, data: { decision: "APPROVED" } });
            const allApproved = wf.steps
                .map(s => (s.id === current.id ? { ...s, decision: "APPROVED" } : s))
                .every(s => s.decision === "APPROVED");
            if (allApproved) {
                await prisma.workflow.update({ where: { id: wf.id }, data: { status: "APPROVED", completedAt: new Date() } });
                await prisma.document.update({ where: { id: wf.documentId }, data: { status: "APPROVED" } });
            }
        }
    }
    await recordAudit({
        actorId: params.userId, action: `wf.${params.decision.toLowerCase()}`,
        targetType: "Workflow", targetId: wf.id,
        metadata: { stepId: current.id, comment: params.comment ?? null },
    });
    return prisma.workflow.findUnique({ where: { id: wf.id }, include: { steps: true } });
}
