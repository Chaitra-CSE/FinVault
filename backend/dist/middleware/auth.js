import { verifyAccess } from "../services/auth.service.js";
export function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
        return res.status(401).json({ error: "Unauthorized" });
    try {
        const payload = verifyAccess(header.slice(7));
        req.user = { id: payload.sub, role: payload.role };
        next();
    }
    catch {
        return res.status(401).json({ error: "Invalid token" });
    }
}
