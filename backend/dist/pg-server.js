// backend/src/pg-server.ts
// Embedded in-memory Postgres for development without Docker.
// Uses pg-mem which supports full DDL (CREATE TABLE, enums, indexes, etc.)
// so Prisma db push / migrate works out of the box.
//
// Usage (standalone):  npx tsx src/pg-server.ts
// The server blocks until killed. Start it BEFORE running
//   npx prisma db push  or  npm run dev
import { newDb } from "pg-mem";
const PORT = Number(process.env.PGPORT ?? 5432);
const db = newDb({ autoCreateForeignKeyIndices: true });
// Adapt pg-mem to the raw Node.js TCP socket the Postgres wire protocol
// expects, using pg-mem's built-in server helper.
const { Server } = await import("pg-mem");
const server = new Server((socket) => {
    db.adapt({ type: "socket", socket });
});
server.listen(PORT, "0.0.0.0", () => {
    console.log(`[pg-mem] In-memory Postgres listening on 0.0.0.0:${PORT}`);
});
