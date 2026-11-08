import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/shared/lib/db";
import { embed } from "@/shared/lib/ai";
import { approxTokens, chunk } from "./chunker";
import { detectKind, extractText } from "./parsers";
import { storage } from "./storage";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const parts: Buffer[] = [];
  for await (const c of stream) parts.push(Buffer.isBuffer(c) ? c : Buffer.from(c as string));
  return Buffer.concat(parts);
}

/** Reads the stored file, chunks + embeds it, writes rows, flips status. */
export async function indexDocument(documentId: string) {
  const doc = await db.query.documents.findFirst({ where: eq(schema.documents.id, documentId) });
  if (!doc) throw new Error(`document ${documentId} not found`);

  try {
    const stream = await storage.getStream(doc.storageKey);
    const buffer = await streamToBuffer(stream);

    const kind = detectKind(doc.name, doc.mimeType);
    const text = await extractText(kind, buffer);
    if (!text) throw new Error("We couldn't read any text from this document. If it's a scanned image or password-protected PDF, try a different file.");

    const parts = chunk(text);
    if (!parts.length) throw new Error("This document didn't produce any content we could index.");

    const vectors = await embed(parts);

    await db.transaction(async (tx) => {
      // Clean up any previous attempt first — makes the job idempotent on retry.
      await tx.delete(schema.chunks).where(eq(schema.chunks.documentId, documentId));
      await tx.insert(schema.chunks).values(
        parts.map((content, idx) => ({
          documentId, idx, content, tokens: approxTokens(content), embedding: vectors[idx],
        }))
      );
      await tx.update(schema.documents)
        .set({ status: "ready", chunkCount: parts.length, error: null })
        .where(eq(schema.documents.id, documentId));
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(schema.documents)
      .set({ status: "failed", error: msg })
      .where(eq(schema.documents.id, documentId));
    throw e;
  }
}
