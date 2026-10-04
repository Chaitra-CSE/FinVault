import type { Request, Response, NextFunction } from "express";
import { verifyAccess } from "../services/auth.service.js";

export interface AuthedRequest extends Request {
    user?: { id: string; role: string };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    try {
        const payload = verifyAccess(header.slice(7));
        req.user = { id: payload.sub, role: payload.role };
        next();
    } catch {
        return res.status(401).json({ error: "Invalid token" });
    }
}