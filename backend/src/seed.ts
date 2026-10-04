import { seedData } from "./seed-data.js";
import { prisma } from "./db.js";

seedData()
    .catch((err) => {
        console.error("Seed error:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());