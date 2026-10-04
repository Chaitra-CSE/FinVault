import { z } from "zod";
import "dotenv/config";
const schema = z.object({
    NODE_ENV: z.string().default("development"),
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().default("postgresql://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable"),
    REDIS_URL: z.string().optional().default("redis://localhost:6379"),
    JWT_SECRET: z.string().min(16).default("finvault-jwt-secret-min-32-chars-long-value"),
    JWT_REFRESH_SECRET: z.string().min(16).default("finvault-jwt-refresh-secret-min-32-chars-long-value"),
    ACCESS_TOKEN_TTL: z.coerce.number().default(900),
    REFRESH_TOKEN_TTL: z.coerce.number().default(604800),
    S3_ENDPOINT: z.string().default("http://localhost:9000"),
    S3_REGION: z.string().default("us-east-1"),
    S3_ACCESS_KEY: z.string().default("minioadmin"),
    S3_SECRET_KEY: z.string().default("minioadmin"),
    S3_BUCKET: z.string().default("finvault-docs"),
    S3_FORCE_PATH_STYLE: z.string().default("true"),
});
export const config = schema.parse(process.env);
