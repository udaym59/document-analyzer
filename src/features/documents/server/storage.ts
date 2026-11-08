import "server-only";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, unlink, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "@/shared/lib/env";

export interface StorageDriver {
  put(userId: string, filename: string, data: Buffer | Readable): Promise<{ key: string; size: number }>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}

/* ─── Local disk ─────────────────────────────────────────────────────────── */

class LocalDriver implements StorageDriver {
  private root = resolve(env.STORAGE_LOCAL_DIR);

  async put(userId: string, filename: string, data: Buffer | Readable) {
    const safe = filename.replace(/[^\w.\-]+/g, "_");
    const key = `${userId}/${randomUUID()}-${safe}`;
    const abs = join(this.root, key);
    await mkdir(dirname(abs), { recursive: true });
    await pipeline(Buffer.isBuffer(data) ? Readable.from(data) : data, createWriteStream(abs));
    const { size } = await stat(abs);
    return { key, size };
  }

  async getStream(key: string) { return createReadStream(join(this.root, key)); }
  async delete(key: string) { try { await unlink(join(this.root, key)); } catch { /* ignore */ } }
}

/* ─── S3 / S3-compatible (R2, B2, MinIO, Spaces) ─────────────────────────── */

class S3Driver implements StorageDriver {
  private clientPromise: ReturnType<typeof this.buildClient> | null = null;
  private bucket = env.S3_BUCKET!;

  private async buildClient() {
    const { S3Client } = await import("@aws-sdk/client-s3");
    return new S3Client({
      region: env.S3_REGION || "auto",
      endpoint: env.S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
      // Non-AWS providers (MinIO, Backblaze) typically need path-style.
      forcePathStyle: Boolean(env.S3_ENDPOINT),
    });
  }

  private client() {
    if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      throw new Error("S3 driver requires S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY");
    }
    this.clientPromise ??= this.buildClient();
    return this.clientPromise;
  }

  async put(userId: string, filename: string, data: Buffer | Readable) {
    const { Upload } = await import("@aws-sdk/lib-storage");
    const safe = filename.replace(/[^\w.\-]+/g, "_");
    const key = `${userId}/${randomUUID()}-${safe}`;
    const client = await this.client();
    const body: Buffer | Readable = Buffer.isBuffer(data) ? data : data;

    // Upload handles multipart automatically for streams above the part size.
    const up = new Upload({
      client,
      params: { Bucket: this.bucket, Key: key, Body: body },
      queueSize: 4,
      partSize: 5 * 1024 * 1024, // 5 MB — AWS minimum per non-final part
      leavePartsOnError: false,
    });
    const result = await up.done();
    // ContentLength isn't always echoed by the upstream; fall back to buffer size.
    const size = Buffer.isBuffer(data) ? data.length : Number((result as { Size?: number }).Size ?? 0);
    return { key, size };
  }

  async getStream(key: string): Promise<Readable> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    const res = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const body = res.Body;
    if (!body) throw new Error(`S3 object ${key} has no body`);
    // In Node, Body is a Readable stream.
    return body as unknown as Readable;
  }

  async delete(key: string) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

export const storage: StorageDriver = env.STORAGE_DRIVER === "s3" ? new S3Driver() : new LocalDriver();
