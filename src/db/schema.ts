import { pgTable, uuid, varchar, text, timestamp, integer, bigint, index, customType, pgEnum } from "drizzle-orm/pg-core";

// pgvector custom type. Embedding dim = 768 for Gemini text-embedding-004.
export const EMBEDDING_DIM = 768;
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() { return `vector(${EMBEDDING_DIM})`; },
  toDriver(v) { return `[${v.join(",")}]`; },
  fromDriver(s) { return s.slice(1, -1).split(",").map(Number); },
});

export const docStatus = pgEnum("doc_status", ["processing", "ready", "failed"]);
export const msgRole = pgEnum("msg_role", ["user", "assistant"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  storageKey: text("storage_key").notNull(),
  status: docStatus("status").notNull().default("processing"),
  error: text("error"),
  chunkCount: integer("chunk_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("documents_user_idx").on(t.userId, t.createdAt),
]);

export const chunks = pgTable("chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull(),
  content: text("content").notNull(),
  tokens: integer("tokens").notNull(),
  embedding: vector("embedding").notNull(),
}, (t) => [
  index("chunks_doc_idx").on(t.documentId, t.idx),
  // HNSW vector index is created in the SQL migration directly.
]);

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  role: msgRole("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("messages_doc_idx").on(t.documentId, t.createdAt),
]);

export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Chunk = typeof chunks.$inferSelect;
export type Message = typeof messages.$inferSelect;
