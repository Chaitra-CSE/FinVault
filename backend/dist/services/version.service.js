// backend/src/services/version.service.ts
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import { prisma } from "../db.js";
import { putObject, getObjectBuffer, deleteObject, getSignedDownloadUrl, } from "../storage.js";
import { recordAudit } from "./audit.service.js";
/**
 * Compute SHA-256 over a buffer. Centralized so callers can't drift.
 */
export function hashBuffer(buf) {
    return createHash("sha256").update(buf).digest("hex");
}
/**
 * Return the next sequential version number for a document (1-based).
 */
export async function nextVersionNumber(documentId) {
    const last = await prisma.version.findFirst({
        where: { documentId },
        orderBy: { version: "desc" },
        select: { version: true },
    });
    return (last?.version ?? 0) + 1;
}
/**
 * Persist a new version: store blob, create row, point document.currentVersionId
 * at the new version. Wrapped in a transaction so a partial write can't leave
 * the document without a current version.
 */
export async function createVersion(params) {
    const sha256 = hashBuffer(params.buffer);
    const versionNumber = await nextVersionNumber(params.documentId);
    // Deduplicate: if an identical byte-for-byte version already exists for this
    // document, we still create a new version row (auditable history) but we can
    // reuse the storage key to save space.
    const existing = await prisma.version.findFirst({
        where: { documentId: params.documentId, sha256 },
        select: { storageKey: true },
    });
    let storageKey;
    if (existing) {
        storageKey = existing.storageKey;
    }
    else {
        storageKey = `docs/${params.documentId}/v${versionNumber}-${nanoid(8)}-${sanitizeFilename(params.filename)}`;
        await putObject(storageKey, params.buffer, params.mimeType);
    }
    const result = await prisma.$transaction(async (tx) => {
        const version = await tx.version.create({
            data: {
                documentId: params.documentId,
                version: versionNumber,
                filename: params.filename,
                mimeType: params.mimeType,
                sizeBytes: params.buffer.length,
                sha256,
                storageKey,
                uploadedById: params.uploadedById,
                comment: params.comment ?? null,
            },
        });
        await tx.document.update({
            where: { id: params.documentId },
            data: {
                currentVersionId: version.id,
                // Any new upload resets status — review is invalidated by new content.
                status: "DRAFT",
            },
        });
        return version;
    });
    await recordAudit({
        actorId: params.uploadedById,
        action: "doc.version.upload",
        targetType: "Document",
        targetId: params.documentId,
        metadata: {
            versionId: result.id,
            version: result.version,
            sha256: result.sha256,
            sizeBytes: result.sizeBytes,
            deduplicated: !!existing,
        },
        ip: params.ip,
        userAgent: params.userAgent,
    });
    return result;
}
/**
 * Fetch a specific version (or the current one) and return a pre-signed URL.
 * Caller is responsible for ACL checks — this service assumes the actor is
 * already authorized.
 */
export async function getDownloadUrl(params) {
    let version;
    if (params.versionId) {
        version = await prisma.version.findFirst({
            where: { id: params.versionId, documentId: params.documentId },
        });
    }
    else {
        const doc = await prisma.document.findUnique({
            where: { id: params.documentId },
            include: { currentVersion: true },
        });
        version = doc?.currentVersion ?? null;
    }
    if (!version)
        throw Object.assign(new Error("Version not found"), { status: 404 });
    const url = await getSignedDownloadUrl(version.storageKey, version.filename);
    await recordAudit({
        actorId: params.actorId,
        action: "doc.download",
        targetType: "Document",
        targetId: params.documentId,
        metadata: {
            versionId: version.id,
            version: version.version,
            sha256: version.sha256,
        },
        ip: params.ip,
        userAgent: params.userAgent,
    });
    return { url, version };
}
/**
 * Verify a stored version's bytes still match the SHA-256 recorded at upload.
 * Useful for compliance checks and detecting storage tampering.
 */
export async function verifyVersionIntegrity(versionId) {
    const version = await prisma.version.findUnique({ where: { id: versionId } });
    if (!version)
        throw Object.assign(new Error("Version not found"), { status: 404 });
    const buf = await getObjectBuffer(version.storageKey);
    const actual = hashBuffer(buf);
    return {
        versionId: version.id,
        expected: version.sha256,
        actual,
        ok: actual === version.sha256,
    };
}
/**
 * Delete a single version (its blob and row). Admin-only at the route layer.
 * Refuses to delete the current version unless it's explicitly reassigned.
 */
export async function deleteVersion(params) {
    const version = await prisma.version.findUnique({
        where: { id: params.versionId },
        include: { document: true },
    });
    if (!version)
        throw Object.assign(new Error("Version not found"), { status: 404 });
    if (version.document.currentVersionId === version.id) {
        throw Object.assign(new Error("Cannot delete the current version; upload a new one first"), { status: 409 });
    }
    // Only delete the blob if no other version shares this storage key
    // (deduplication may have produced shared keys).
    const siblings = await prisma.version.count({
        where: { storageKey: version.storageKey, id: { not: version.id } },
    });
    await prisma.version.delete({ where: { id: version.id } });
    if (siblings === 0) {
        await deleteObject(version.storageKey).catch(() => {
            /* best-effort — log but don't fail the request */
        });
    }
    await recordAudit({
        actorId: params.actorId,
        action: "doc.version.delete",
        targetType: "Version",
        targetId: version.id,
        metadata: {
            documentId: version.documentId,
            version: version.version,
            sha256: version.sha256,
        },
    });
    return { ok: true };
}
/**
 * Restore an old version by uploading its bytes as a NEW version.
 * Preserves full history — never rewrites pointers.
 */
export async function restoreVersion(params) {
    const source = await prisma.version.findFirst({
        where: { id: params.sourceVersionId, documentId: params.documentId },
    });
    if (!source)
        throw Object.assign(new Error("Source version not found"), { status: 404 });
    const buf = await getObjectBuffer(source.storageKey);
    const created = await createVersion({
        documentId: params.documentId,
        uploadedById: params.actorId,
        filename: source.filename,
        mimeType: source.mimeType,
        buffer: buf,
        comment: params.comment ?? `Restored from v${source.version}`,
    });
    await recordAudit({
        actorId: params.actorId,
        action: "doc.version.restore",
        targetType: "Document",
        targetId: params.documentId,
        metadata: { sourceVersion: source.version, newVersion: created.version },
    });
    return created;
}
function sanitizeFilename(name) {
    return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}
