import { GoogleGenAI } from "@google/genai";
import { env } from "./env";

/*
 * Provider-agnostic AI surface. Today backed entirely by Gemini — but the
 * exports (embed, streamChat, AIError, ChatMessage) are all the shape a
 * second provider would need. When one is added, this file splits into
 * src/shared/lib/ai/{types,providers/*}.ts; the exports stay the same.
 */

/* ─── Internals: Gemini-backed implementation ─────────────────────────── */

const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const CHAT_MODEL  = "gemini-3.5-flash";
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIM   = 768;

/* ─── Public types ────────────────────────────────────────────────────── */

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatChunk   = { text: string };

export class AIError extends Error {
  constructor(message: string, public status: number | null, public retryable: boolean) {
    super(message);
    this.name = "AIError";
  }
  /** Vendor-agnostic, action-oriented. Safe to show directly in the UI. */
  get userMessage(): string {
    switch (this.status) {
      case 429:
        return "The AI assistant is busy at the moment. Please wait a few seconds and send your message again.";
      case 503:
        return "The AI assistant is temporarily unavailable. Please try again in a moment.";
      case 500:
      case 502:
      case 504:
        return "Something went wrong while generating a response. Please try again.";
      case 408:
        return "The request took too long to complete. Please try again.";
      default:
        return "We couldn't process your request right now. Please try again.";
    }
  }
}

/* ─── Retry: logic is generic, extraction is provider-specific ────────── */

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function parseGeminiError(e: unknown): { status: number | null; retryAfterMs: number | null; message: string } {
  const err = e as Record<string, unknown> & { message?: string };
  const message = typeof err?.message === "string" ? err.message : String(e);

  let status: number | null = null;
  if (typeof err?.status === "number") status = err.status as number;
  if (status == null && typeof err?.statusCode === "number") status = err.statusCode as number;
  if (status == null) {
    const m = message.match(/\b(4\d{2}|5\d{2})\b/);
    if (m) status = Number(m[1]);
  }

  let retryAfterMs: number | null = null;

  const headers = (err?.headers ?? (err?.response as Record<string, unknown>)?.headers) as
    Record<string, string> | undefined;
  const ra = headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (ra) {
    const secs = Number(ra);
    if (!Number.isNaN(secs)) retryAfterMs = secs * 1000;
  }

  const details =
    (err?.errorDetails as Array<Record<string, unknown>> | undefined) ??
    (((err?.response as Record<string, unknown>)?.data as
      | { error?: { details?: Array<Record<string, unknown>> } }
      | undefined)?.error?.details);
  if (Array.isArray(details)) {
    for (const d of details) {
      const t = typeof d["@type"] === "string" ? (d["@type"] as string) : "";
      if (t.includes("RetryInfo") && typeof d.retryDelay === "string") {
        const match = d.retryDelay.match(/(\d+(?:\.\d+)?)s/);
        if (match) retryAfterMs = Math.round(parseFloat(match[1]) * 1000);
      }
    }
  }

  return { status, retryAfterMs, message };
}

type RetryOpts = { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number; label?: string };

async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 4;
  const baseDelay   = opts.baseDelayMs ?? 1000;
  const maxDelay    = opts.maxDelayMs ?? 30_000;
  const label       = opts.label ?? "ai";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const { status, retryAfterMs, message } = parseGeminiError(e);
      const retryable = status !== null && RETRYABLE_STATUS.has(status);

      if (!retryable || attempt === maxAttempts) {
        throw new AIError(message, status, retryable);
      }
      const backoff = Math.min(maxDelay, baseDelay * 2 ** (attempt - 1));
      const jitter  = Math.floor(Math.random() * 500);
      const wait    = retryAfterMs ?? backoff + jitter;
      console.warn(`[${label}] ${status} received; retry ${attempt}/${maxAttempts - 1} in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new AIError("retry loop exhausted", null, false);
}

/* ─── Public API ──────────────────────────────────────────────────────── */

/**
 * Batched embeddings. Called from the background indexer, so retries are
 * aggressive (5 attempts, 2s → 60s).
 */
export async function embed(texts: string[]): Promise<number[][]> {
  const BATCH = 100;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const res = await withRetry(
      () => genai.models.embedContent({
        model: EMBED_MODEL,
        contents: slice,
        config: { outputDimensionality: EMBED_DIM },
      }),
      { maxAttempts: 5, baseDelayMs: 2000, maxDelayMs: 60_000, label: "ai:embed" },
    );
    const vectors = (res.embeddings ?? []).map((e) => e.values ?? []);
    if (vectors.length !== slice.length) {
      throw new Error(`embed: expected ${slice.length} vectors, got ${vectors.length}`);
    }
    out.push(...vectors);
  }
  return out;
}

/**
 * Streaming chat. The user is waiting, so retries are tight (2 attempts,
 * sub-2s delays). Returns a normalized async iterable of { text } chunks —
 * provider-specific stream shapes are flattened inside.
 */
export async function streamChat(opts: {
  history: ChatMessage[];
  user: string;
}): Promise<AsyncIterable<ChatChunk>> {
  // Gemini uses "model" for assistant turns; translate here, not at call sites.
  const contents = [
    ...opts.history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: opts.user }] },
  ];

  const rawStream = await withRetry(
    () => genai.models.generateContentStream({ model: CHAT_MODEL, contents }),
    { maxAttempts: 2, baseDelayMs: 800, maxDelayMs: 2000, label: "ai:chat" },
  );

  // Normalize to { text }. Consumers never see Gemini-specific chunk shape.
  return (async function* () {
    for await (const chunk of rawStream) {
      const text = chunk.text ?? "";
      if (text) yield { text };
    }
  })();
}
