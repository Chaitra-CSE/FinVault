import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_UPLOADS_DIR = path.resolve(__dirname, "../uploads");

let isS3Available = false;

export const s3 = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY },
    forcePathStyle: config.S3_FORCE_PATH_STYLE === "true",
    maxAttempts: 1,
});

export async function ensureBucket() {
    await fs.mkdir(LOCAL_UPLOADS_DIR, { recursive: true });
    try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1500));
        await Promise.race([
            s3.send(new HeadBucketCommand({ Bucket: config.S3_BUCKET })).catch(async () => {
                await s3.send(new CreateBucketCommand({ Bucket: config.S3_BUCKET }));
            }),
            timeoutPromise,
        ]);
        isS3Available = true;
        console.log(`[storage] Connected to S3/MinIO bucket "${config.S3_BUCKET}"`);
    } catch {
        isS3Available = false;
        console.log(`[storage] S3/MinIO not reachable; using local disk storage at ${LOCAL_UPLOADS_DIR}`);
    }
}

export async function putObject(key: string, body: Buffer, contentType: string) {
    if (isS3Available) {
        try {
            await s3.send(new PutObjectCommand({
                Bucket: config.S3_BUCKET, Key: key, Body: body, ContentType: contentType,
                ServerSideEncryption: "AES256",
            }));
            return;
        } catch (err: any) {
            console.warn(`[storage] S3 upload failed, falling back to disk: ${err.message}`);
            isS3Available = false;
        }
    }

    const filePath = path.join(LOCAL_UPLOADS_DIR, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
    if (isS3Available) {
        try {
            const res = await s3.send(new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }));
            if (res.Body) {
                const bytes = await res.Body.transformToByteArray();
                return Buffer.from(bytes);
            }
        } catch {
            // fall back to disk
        }
    }

    const filePath = path.join(LOCAL_UPLOADS_DIR, key);
    return await fs.readFile(filePath);
}

export async function getSignedDownloadUrl(key: string, filename: string, ttlSec = 300): Promise<string> {
    if (isS3Available) {
        try {
            const cmd = new GetObjectCommand({
                Bucket: config.S3_BUCKET, Key: key,
                ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, "")}"`,
            });
            return await getSignedUrl(s3, cmd, { expiresIn: ttlSec });
        } catch {
            // fall back
        }
    }

    // Local download endpoint
    return `/api/documents/raw-file/${encodeURIComponent(key)}?filename=${encodeURIComponent(filename)}`;
}

export async function deleteObject(key: string) {
    if (isS3Available) {
        try {
            await s3.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: key }));
            return;
        } catch {
            // ignore
        }
    }

    try {
        const filePath = path.join(LOCAL_UPLOADS_DIR, key);
        await fs.unlink(filePath);
    } catch {
        // ignore if not found
    }
}