import type { Response, NextFunction } from "express";
import type { AuthedRequest } from "./auth.js";
import type { Role } from "@prisma/client";

const ROLE_RANK: Record<Role, number> = { VIEWER: 1, UPLOADER: 2, APPROVER: 3, AUDITOR: 3, ADMIN: 4 };

export function requireRole(...allowed: Role[]) {
    return (req: AuthedRequest, res: Response, next: NextFunction) => {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });
        if (!allowed.includes(req.user.role as Role)) return res.status(403).json({ error: "Forbidden" });
        next();
    };
}

export function requireAtLeast(role: Role) {
    return (req: AuthedRequest, res: Response, next: NextFunction) => {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });
        if (ROLE_RANK[req.user.role as Role] < ROLE_RANK[role]) return res.status(403).json({ error: "Forbidden" });
        next();
    };
}