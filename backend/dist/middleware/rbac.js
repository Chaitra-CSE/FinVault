const ROLE_RANK = { VIEWER: 1, UPLOADER: 2, APPROVER: 3, AUDITOR: 3, ADMIN: 4 };
export function requireRole(...allowed) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        if (!allowed.includes(req.user.role))
            return res.status(403).json({ error: "Forbidden" });
        next();
    };
}
export function requireAtLeast(role) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        if (ROLE_RANK[req.user.role] < ROLE_RANK[role])
            return res.status(403).json({ error: "Forbidden" });
        next();
    };
}
