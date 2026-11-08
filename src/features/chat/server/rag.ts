import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/shared/lib/db";
import { embed, streamChat } from "@/shared/lib/ai";

const TOP_K = 5;
const HISTORY_TURNS = 6;

export async function retrieveContext(documentId: string, query: string) {
  const [qvec] = await embed([query]);
  const vecLiteral = `[${qvec.join(",")}]`;
  const rows = await db
    .select({
      idx: schema.chunks.idx,
      content: schema.chunks.content,
      distance: sql<number>`${schema.chunks.embedding} <=> ${vecLiteral}::vector`,
    })
    .from(schema.chunks)
    .where(eq(schema.chunks.documentId, documentId))
    .orderBy(sql`${schema.chunks.embedding} <=> ${vecLiteral}::vector`)
    .limit(TOP_K);
  return rows;
}

export async function recentHistory(documentId: string) {
  const rows = await db.query.messages.findMany({
    where: eq(schema.messages.documentId, documentId),
    orderBy: [asc(schema.messages.createdAt)],
  });
  return rows.slice(-HISTORY_TURNS);
}

const SYSTEM = `You are an assistant answering questions grounded in a single document.
Follow these rules:
- Use only the provided context. If the answer is not in the context, say you don't know.
- Be concise and well-structured. Prefer bullet points for lists.
- When quoting the document, keep quotes short and in quotation marks.
- When useful, cite chunk numbers like [#3] so the user can find the section.`;

function buildPrompt(docName: string, contexts: { idx: number; content: string }[], question: string) {
  const ctx = contexts.map((c) => `[#${c.idx}]\n${c.content}`).join("\n\n---\n\n");
  return `${SYSTEM}

DOCUMENT: ${docName}

CONTEXT:
${ctx}

QUESTION: ${question}

ANSWER:`;
}

/**
 * Retrieves context, assembles the prompt, and asks the AI layer to stream
 * an answer. Returns an AsyncIterable<{ text }> — no provider details leak.
 */
export async function streamAnswer(opts: {
  documentId: string;
  docName: string;
  question: string;
  history: { role: "user" | "assistant"; content: string }[];
}) {
  const contexts = await retrieveContext(opts.documentId, opts.question);
  const prompt = buildPrompt(opts.docName, contexts, opts.question);

  return await streamChat({
    history: opts.history,
    user: prompt,
  });
}

export async function persistTurn(documentId: string, userMsg: string, assistantMsg: string) {
  await db.insert(schema.messages).values([
    { documentId, role: "user", content: userMsg },
    { documentId, role: "assistant", content: assistantMsg },
  ]);
}
