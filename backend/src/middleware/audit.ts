// backend/src/middleware/audit.ts
import type { Request, Response, NextFunction } from "express";
import type { AuthedRequest } from "./auth.js";
import { recordAudit } from "../services/audit.service.js";

/**
 * Shape attached to every request. Services can accept this to record events
 * without duplicating IP/UA extraction logic.
 */
export interface AuditContext {
    actorId?: string;
    ip?: string;
    userAgent?: string;
    requestId: string;
    method: string;
    path: string;
}

declare module "express-serve-static-core" {
    interface Request {
        audit?: AuditContext;
    }
}

/**
 * Attach audit context to every request. Runs after auth middleware in the
 * chain so req.user is populated when available (routes that don't require
 * auth — /login, /register — will have actorId undefined, which is fine).
 *
 * Global install in index.ts means this runs before route handlers.
 */
export function auditContext(req: AuthedRequest, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) ?? cryptoRandomId();

    req.audit = {
        actorId: req.user?.id,
        ip: clientIp(req),
        userAgent: req.headers["user-agent"],
        requestId,
        method: req.method,
        path: req.originalUrl,
    };

    // Echo request id back for correlation with logs / client traces
    res.setHeader("x-request-id", requestId);
    next();
}

/**
 * Route-level helper: emit an audit event tied to the current request.
 * Prefer service-layer calls with explicit target/metadata; use this for
 * cross-cutting events like 403s and validation failures.
 */
export async function auditFromRequest(
    req: AuthedRequest,
    event: { action: string; targetType: string; targetId: string; metadata?: any },
) {
    const ctx = req.audit;
    await recordAudit({
        actorId: ctx?.actorId ?? req.user?.id,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        metadata: {
            ...(event.metadata ?? {}),
            requestId: ctx?.requestId,
            method: ctx?.method,
            path: ctx?.path,
        },
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
    });
}

/**
 * Middleware factory for logging authorization denials.
 * Wrap specific routes to get an audit row when a user is rejected.
 *
 * Usage:
 *   router.delete("/:id", requireAuth, denyAudit("doc.delete.denied"),
 *     handler)
 */
export function denyAudit(action: string) {
    return async (req: AuthedRequest, res: Response, next: NextFunction) => {
        // Attach a one-shot listener: if the response ends as 401/403, record it.
        res.on("finish", () => {
            if (res.statusCode === 401 || res.statusCode === 403) {
                const ctx = req.audit;
                recordAudit({
                    actorId: req.user?.id,
                    action,
                    targetType: "Route",
                    targetId: `${req.method} ${req.originalUrl}`,
                    metadata: { statusCode: res.statusCode, requestId: ctx?.requestId },
                    ip: ctx?.ip,
                    userAgent: ctx?.userAgent,
                }).catch(() => {
                    /* never let audit failure break the response */
                });
            }
        });
        next();
    };
}

function clientIp(req: Request): string | undefined {
    // `trust proxy` is set on the app, so req.ip honors X-Forwarded-For.
    return req.ip ?? undefined;
}

function cryptoRandomId(): string {
    // Small, dependency-free request id. Swap for nanoid/uuid if preferred.
    return (
        Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
    );
}