import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/shared/lib/db";
import { ACCEPTED_EXT, ACCEPTED_MIMES } from "./parsers";
import { storage } from "./storage";
import { enqueueIndexing } from "./queue";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

export class UploadError extends Error {
  constructor(msg: string, public status = 400) { super(msg); }
}

export async function listUserDocuments(userId: string) {
  return db.query.documents.findMany({
    where: eq(schema.documents.userId, userId),
    orderBy: [desc(schema.documents.createdAt)],
  });
}

export async function getUserDocument(userId: string, id: string) {
  return db.query.documents.findFirst({
    where: and(eq(schema.documents.id, id), eq(schema.documents.userId, userId)),
  });
}

export async function deleteUserDocument(userId: string, id: string) {
  const doc = await getUserDocument(userId, id);
  if (!doc) throw new UploadError("Not found", 404);
  await db.delete(schema.documents).where(eq(schema.documents.id, id));
  await storage.delete(doc.storageKey);
}

export async function createDocumentFromFile(userId: string, file: File) {
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("File is larger than 20MB");
  if (!ACCEPTED_MIMES.has(file.type) && !ACCEPTED_EXT.test(file.name)) {
    throw new UploadError("Unsupported file type. Accepted: pdf, docx, csv, md, json, txt");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const { key, size } = await storage.put(userId, file.name, buf);

  const [doc] = await db.insert(schema.documents).values({
    userId, name: file.name, mimeType: file.type || "application/octet-stream",
    sizeBytes: size, storageKey: key, status: "processing",
  }).returning();

  // Hand to the durable queue. Worker fetches file from storage and indexes it.
  await enqueueIndexing(doc.id);
  return doc;
}

/** Fully delete a user: files from storage, then rows (CASCADE handles docs/chunks/messages). */
export async function deleteUserAccount(userId: string) {
  const docs = await db.query.documents.findMany({
    where: eq(schema.documents.userId, userId),
    columns: { storageKey: true },
  });
  // Delete storage first; DB CASCADE will take care of the row graph.
  await Promise.allSettled(docs.map((d) => storage.delete(d.storageKey)));
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}

export async function getChunk(userId: string, documentId: string, idx: number) {
  const doc = await getUserDocument(userId, documentId);
  if (!doc) return null;
  const row = await db.query.chunks.findFirst({
    where: and(eq(schema.chunks.documentId, documentId), eq(schema.chunks.idx, idx)),
    columns: { idx: true, content: true },
  });
  return row;
}
