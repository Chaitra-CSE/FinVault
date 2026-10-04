import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { fromNodeSocket } from "pg-gateway/node";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function isPortInUse(port, host = "127.0.0.1") {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(800);
        socket.on("connect", () => {
            socket.destroy();
            resolve(true);
        });
        socket.on("timeout", () => {
            socket.destroy();
            resolve(false);
        });
        socket.on("error", () => {
            resolve(false);
        });
        socket.connect(port, host);
    });
}
export async function ensureDatabase(port = 5432) {
    const active = await isPortInUse(port, "127.0.0.1");
    if (active) {
        console.log(`[DB] Database server already active on 127.0.0.1:${port}`);
        return;
    }
    console.log(`[DB] Starting embedded PGlite PostgreSQL server on port ${port}...`);
    let db;
    try {
        db = new PGlite();
        await db.waitReady;
        console.log(`[DB] PGlite in-memory database engine ready.`);
    }
    catch (err) {
        console.error(`[DB] Failed to start PGlite: ${err.message}`);
        throw err;
    }
    // Always ensure schema and seed in embedded instance
    console.log("[DB] Initializing database schema...");
    const ddl = execSync("npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script", {
        cwd: path.resolve(__dirname, ".."),
        encoding: "utf8",
    });
    await db.exec(ddl);
    console.log("[DB] Schema initialized successfully!");
    const server = net.createServer(async (socket) => {
        try {
            await fromNodeSocket(socket, {
                serverVersion: "16.3 (PGlite)",
                auth: { method: "trust" },
                async onMessage(data) {
                    return await db.execProtocolRaw(data);
                },
            });
        }
        catch {
            // socket closed
        }
    });
    await new Promise((resolve, reject) => {
        server.listen(port, "127.0.0.1", () => {
            console.log(`[DB] PostgreSQL wire protocol server listening on 127.0.0.1:${port}`);
            resolve();
        });
        server.on("error", reject);
    });
    // Run seed data
    try {
        console.log("[DB] Running seed data...");
        const { seedData } = await import("./seed-data.js");
        await seedData();
        console.log("[DB] Seed data populated!");
    }
    catch (err) {
        console.warn(`[DB] Seed warning: ${err.message}`);
    }
}
