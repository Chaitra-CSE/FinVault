import { ZodError } from "zod";
export function errorHandler(err, _req, res, _next) {
    if (err instanceof ZodError)
        return res.status(400).json({ error: err.flatten() });
    console.error(err);
    res.status(err.status ?? 500).json({ error: err.message ?? "Internal error" });
}
