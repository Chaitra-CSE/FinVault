import { createHash } from "node:crypto";
import { prisma } from "../db.js";
function sha256(input) {
    return createHash("sha256").update(input).digest("hex");
}
export async function recordAudit(params) {
    // Serialize with last hash for chain integrity
    const last = await prisma.auditEvent.findFirst({ orderBy: { createdAt: "desc" } });
    const prevHash = last?.hash ?? null;
    const payload = JSON.stringify({
        actorId: params.actorId ?? null,
        action: params.action, targetType: params.targetType, targetId: params.targetId,
        metadata: params.metadata ?? null, ip: params.ip ?? null, userAgent: params.userAgent ?? null,
        prevHash,
    });
    const hash = sha256(payload);
    return prisma.auditEvent.create({
        data: {
            actorId: params.actorId ?? null,
            action: params.action, targetType: params.targetType, targetId: params.targetId,
            metadata: params.metadata ?? {}, ip: params.ip, userAgent: params.userAgent,
            prevHash, hash,
        },
    });
}
export async function verifyChain() {
    const events = await prisma.auditEvent.findMany({ orderBy: { createdAt: "asc" } });
    let prev = null;
    for (const e of events) {
        const payload = JSON.stringify({
            actorId: e.actorId, action: e.action, targetType: e.targetType,
            targetId: e.targetId, metadata: e.metadata, ip: e.ip, userAgent: e.userAgent,
            prevHash: prev,
        });
        const expected = sha256(payload);
        if (expected !== e.hash)
            return { ok: false, brokenAt: e.id };
        prev = e.hash;
    }
    return { ok: true };
}
