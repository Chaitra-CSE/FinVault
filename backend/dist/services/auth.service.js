import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../db.js";
import { config } from "../config.js";
export async function hashPassword(pw) {
    return argon2.hash(pw, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}
export async function verifyPassword(hash, pw) {
    return argon2.verify(hash, pw);
}
export function signAccess(userId, role) {
    return jwt.sign({ sub: userId, role }, config.JWT_SECRET, { expiresIn: config.ACCESS_TOKEN_TTL });
}
export function signRefresh(userId) {
    return jwt.sign({ sub: userId, jti: randomBytes(16).toString("hex") }, config.JWT_REFRESH_SECRET, { expiresIn: config.REFRESH_TOKEN_TTL });
}
export function verifyAccess(token) {
    return jwt.verify(token, config.JWT_SECRET);
}
export function verifyRefresh(token) {
    return jwt.verify(token, config.JWT_REFRESH_SECRET);
}
export async function persistRefresh(userId, token) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL * 1000);
    await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
}
export async function revokeRefresh(token) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } });
}
export async function isRefreshValid(token) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const row = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    return !!row && !row.revoked && row.expiresAt > new Date();
}
