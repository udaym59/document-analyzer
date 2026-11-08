import { requireSession } from "@/shared/lib/auth";
import { getUserDocument } from "@/features/documents/server/service";
import { persistTurn, recentHistory, streamAnswer } from "@/features/chat/server/rag";
import { AIError } from "@/shared/lib/ai";

export const runtime = "nodejs";

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession();
    const { id } = await params;
    const { question } = (await req.json()) as { question: string };

    if (!question?.trim())  return text("Please type a question first.", 400);

    const doc = await getUserDocument(s.sub, id);
    if (!doc)                       return text("We couldn't find that document.", 404);
    if (doc.status === "processing") return text("This document is still being prepared. Please wait a moment and try again.", 409);
    if (doc.status === "failed")     return text("This document couldn't be prepared for chat. Try re-uploading it.", 409);
    if (doc.status !== "ready")      return text("This document isn't ready yet. Please try again shortly.", 409);

    const history = await recentHistory(doc.id);

    // Pre-stream errors (connect / first-token) land here with a proper status.
    let stream;
    try {
      stream = await streamAnswer({ documentId: doc.id, docName: doc.name, question, history });
    } catch (e) {
      if (e instanceof AIError) {
        console.error("[query] gemini pre-stream", { status: e.status, message: e.message });
        return text(e.userMessage, e.status === 429 ? 429 : 503);
      }
      console.error("[query] pre-stream unexpected", e);
      return text("Something went wrong on our side. Please try again.", 500);
    }

    let full = "";
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.text ?? "";
            if (text) { full += text; controller.enqueue(encoder.encode(text)); }
          }
          await persistTurn(doc.id, question, full);
          controller.close();
        } catch (err) {
          // Mid-stream failure — append a readable note; keep what we got.
          const friendly = err instanceof AIError
            ? err.userMessage
            : "The response was cut short. Please try your question again.";
          console.error("[query] mid-stream", err);
          const note = `\n\n_${friendly}_`;
          controller.enqueue(encoder.encode(note));
          if (full) await persistTurn(doc.id, question, full + note).catch(() => {});
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[query] top-level", e);
    return text("Something went wrong. Please try again.", 500);
  }
}
