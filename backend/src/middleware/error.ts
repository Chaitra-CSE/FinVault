import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
    if (err instanceof ZodError) return res.status(400).json({ error: err.flatten() });
    console.error(err);
    res.status(err.status ?? 500).json({ error: err.message ?? "Internal error" });
}