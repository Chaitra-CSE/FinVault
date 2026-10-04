import { prisma } from "../db.js";
const ROLE_FLOOR = { VIEWER: 1, UPLOADER: 2, APPROVER: 3, AUDITOR: 3, ADMIN: 4 };
const PERM_FLOOR = { read: 1, write: 2, approve: 3, admin: 4 };
export async function can(userId, role, documentId, permission) {
    if (role === "ADMIN")
        return true;
    const doc = await prisma.document.findUnique({
        where: { id: documentId },
        include: { acls: true },
    });
    if (!doc)
        return false;
    // Owner has full control
    if (doc.ownerId === userId)
        return true;
    // Explicit user ACL
    const userAcl = doc.acls.find(a => a.userId === userId && a.permission === permission);
    if (userAcl)
        return true;
    // Role ACL
    const roleAcl = doc.acls.find(a => a.role === role && a.permission === permission);
    if (roleAcl)
        return true;
    // Classification floor: role must meet or exceed required floor for the permission
    if (permission === "read" && ROLE_FLOOR[role] >= 1)
        return true; // all authed users can read metadata
    return false;
}
export async function listReadable(userId, role) {
    if (role === "ADMIN" || role === "AUDITOR") {
        return prisma.document.findMany({ where: { deletedAt: null }, orderBy: { updatedAt: "desc" } });
    }
    return prisma.document.findMany({
        where: {
            deletedAt: null,
            OR: [
                { ownerId: userId },
                { acls: { some: { userId, permission: "read" } } },
                { acls: { some: { role, permission: "read" } } },
                { classification: { in: ["public", "internal"] } },
            ],
        },
        orderBy: { updatedAt: "desc" },
    });
}
