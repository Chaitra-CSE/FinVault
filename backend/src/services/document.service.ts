import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import { prisma } from "../db.js";
import { putObject, deleteObject, getSignedDownloadUrl } from "../storage.js";
import { recordAudit } from "./audit.service.js";

export async function createDocument(params: {
    title: string; description?: string; category: string; classification: string;
    ownerId: string; folderId?: string | null;
}) {
    return prisma.document.create({
        data: {
            title: params.title, description: params.description, category: params.category,
            classification: params.classification, ownerId: params.ownerId, folderId: params.folderId ?? null,
        },
    });
}

export async function uploadVersion(params: {
    documentId: string; userId: string; filename: string; mimeType: string;
    buffer: Buffer; comment?: string; ip?: string; userAgent?: string;
}) {
    const sha256 = createHash("sha256").update(params.buffer).digest("hex");
    const last = await prisma.version.findFirst({
        where: { documentId: params.documentId },
        orderBy: { version: "desc" },
    });
    const nextVersion = (last?.version ?? 0) + 1;
    const key = `docs/${params.documentId}/v${nextVersion}-${nanoid(8)}-${params.filename}`;

    await putObject(key, params.buffer, params.mimeType);

    const version = await prisma.version.create({
        data: {
            documentId: params.documentId, version: nextVersion, filename: params.filename,
            mimeType: params.mimeType, sizeBytes: params.buffer.length, sha256,
            storageKey: key, uploadedById: params.userId, comment: params.comment,
        },
    });

    await prisma.document.update({
        where: { id: params.documentId },
        data: { currentVersionId: version.id, status: "DRAFT" },
    });

    await recordAudit({
        actorId: params.userId, action: "doc.version.upload", targetType: "Document",
        targetId: params.documentId,
        metadata: { versionId: version.id, version: nextVersion, sha256, size: params.buffer.length },
        ip: params.ip, userAgent: params.userAgent,
    });

    return version;
}

export async function signedDownload(params: {
    documentId: string; versionId?: string; userId: string; ip?: string; userAgent?: string;
}) {
    const doc = await prisma.document.findUnique({
        where: { id: params.documentId },
        include: { currentVersion: true },
    });
    if (!doc) throw new Error("Document not found");
    const version = params.versionId
        ? await prisma.version.findUnique({ where: { id: params.versionId } })
        : doc.currentVersion;
    if (!version) throw new Error("Version not found");

    const url = await getSignedDownloadUrl(version.storageKey, version.filename);

    await recordAudit({
        actorId: params.userId, action: "doc.download", targetType: "Document",
        targetId: doc.id, metadata: { versionId: version.id, version: version.version, sha256: version.sha256 },
        ip: params.ip, userAgent: params.userAgent,
    });

    return { url, version };
}

export async function softDelete(documentId: string, userId: string) {
    await prisma.document.update({ where: { id: documentId }, data: { deletedAt: new Date() } });
    await recordAudit({
        actorId: userId, action: "doc.delete", targetType: "Document", targetId: documentId,
    });
}

export async function hardDeleteVersion(versionId: string, userId: string) {
    const v = await prisma.version.findUnique({ where: { id: versionId } });
    if (!v) return;
    await deleteObject(v.storageKey);
    await prisma.version.delete({ where: { id: versionId } });
    await recordAudit({
        actorId: userId, action: "doc.version.delete", targetType: "Version", targetId: versionId,
    });
}