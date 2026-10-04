import { prisma } from "./db.js";
import { hashPassword } from "./services/auth.service.js";

export async function seedData() {
    const pass = await hashPassword("password123");
    const users = [
        { email: "admin@finvault.local", name: "Admin", role: "ADMIN" as const },
        { email: "uploader@finvault.local", name: "Uma Uploader", role: "UPLOADER" as const },
        { email: "approver@finvault.local", name: "Al Approver", role: "APPROVER" as const },
        { email: "auditor@finvault.local", name: "Ana Auditor", role: "AUDITOR" as const },
        { email: "viewer@finvault.local", name: "Vic Viewer", role: "VIEWER" as const },
    ];

    for (const u of users) {
        const existing = await prisma.user.findUnique({ where: { email: u.email } });
        if (!existing) {
            await prisma.user.create({ data: { ...u, passwordHash: pass } });
        }
    }

    const t1 = await prisma.workflowTemplate.findUnique({ where: { name: "Invoice Approval (2-step)" } });
    if (!t1) {
        await prisma.workflowTemplate.create({
            data: {
                name: "Invoice Approval (2-step)",
                steps: [
                    { order: 1, name: "Finance Review", role: "APPROVER", requiredApprovals: 1 },
                    { order: 2, name: "Compliance Sign-off", role: "AUDITOR", requiredApprovals: 1 },
                ],
            },
        });
    }

    const t2 = await prisma.workflowTemplate.findUnique({ where: { name: "Contract Execution" } });
    if (!t2) {
        await prisma.workflowTemplate.create({
            data: {
                name: "Contract Execution",
                steps: [
                    { order: 1, name: "Legal Review", role: "APPROVER", requiredApprovals: 2 },
                    { order: 2, name: "Executive Approval", role: "ADMIN", requiredApprovals: 1 },
                ],
            },
        });
    }

    console.log("Seed complete.");
}
