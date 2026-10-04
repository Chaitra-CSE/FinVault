// backend/src/pg-gateway-server.ts
// Embedded PostgreSQL server using PGlite + pg-gateway
// Start BEFORE Prisma migrations and app startup
import net from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { fromNodeSocket } from "pg-gateway/node";
export async function startPgServer(port = 5432) {
    const db = new PGlite();
    await db.waitReady;
    const server = net.createServer(async (socket) => {
        try {
            await fromNodeSocket(socket, {
                serverVersion: "16.3 (PGlite 0.5.8)",
                auth: { method: "trust" },
                async onMessage(data) {
                    return await db.execProtocolRaw(data);
                },
            });
        }
        catch {
            // ignore socket close errors
        }
    });
    return new Promise((resolve) => {
        server.listen(port, "0.0.0.0", () => {
            console.log(`[PGlite] Embedded Postgres listening on 0.0.0.0:${port}`);
            resolve();
        });
    });
}
// When run standalone
const port = Number(process.argv[2] ?? 5432);
startPgServer(port);
