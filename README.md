# Document Analyzer

Upload PDFs, Word, CSV, Markdown or JSON documents and chat with them. Each
document gets its own conversation thread powered by Gemini embeddings and
`gemini-3.5-flash`, with clickable chunk citations so every answer traces
back to its source.

## Stack

- **Next.js 16** (App Router, Route Handlers) · **React 19.3** · **TypeScript 6**
- **Tailwind CSS 4** — CSS-first config in `src/app/globals.css` (no `tailwind.config.ts`)
- **Postgres + pgvector** via **Drizzle ORM 0.45**
- **pg-boss 12** durable job queue for background indexing
- **Zod 4** for input validation · **jose 6** for JWT · **bcryptjs 3** for password hashing
- **Gemini** via `@google/genai` 2.x (`gemini-embedding-001` @ 768-dim, `gemini-3.5-flash`)
- Pluggable storage: **local disk** or **S3-compatible** (AWS, R2, B2, MinIO, Spaces)

## Prerequisites

- **Node 22+** (Node 24 fine; `engines` enforces `>=22.0.0`)
- Postgres 14+ with the `pgvector` extension (0.5.0+ for HNSW)
- A Gemini API key from Google AI Studio

## Setup

```bash
# 1. install
pnpm install    # or npm / yarn

# 2. environment
cp .env.example .env
# fill: DATABASE_URL, JWT_SECRET (openssl rand -base64 32), GEMINI_API_KEY
# optional: STORAGE_DRIVER=s3 and S3_* vars

# 3. create database + enable pgvector (one-time, as superuser)
createdb docanalyzer
psql -d docanalyzer -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 4. apply schema
psql -d docanalyzer -f src/db/migrations/0000_init.sql
# pg-boss creates its own tables under the "pgboss" schema on first start.

# 5. run
pnpm run dev
# → http://localhost:3000
```

> **Note on migrations.** `src/db/migrations/` contains two files sharing the
> `0000_` prefix: the hand-written `0000_init.sql` (which this README points to —
> it includes the HNSW index and pgvector-specific DDL that `drizzle-kit generate`
> can't emit), and a `0000_first_omega_sentinel.sql` left by a prior
> `drizzle-kit generate` run. Use `0000_init.sql` for a fresh database. If you
> prefer to drive migrations through `drizzle-kit`, delete the hand-written SQL,
> keep the generated one, and append the HNSW index statement into a follow-up
> migration.

Dev starts an **inline worker** via `instrumentation.ts`. For production:

```bash
# Terminal 1 — web
DISABLE_INLINE_WORKER=1 pnpm start

# Terminal 2 — worker(s)
pnpm run worker
```

## Project layout (feature-based)

```
src/
├── app/                           # Routing only — thin files
│   ├── (auth)/{login,signup}
│   ├── (app)/{documents,documents/[id],account}
│   └── api/
│       ├── auth/{signup,login,logout,me}
│       ├── account/{route,password}
│       └── documents/
│           ├── route.ts
│           └── [id]/{route,query,messages,chunks/[idx]}
├── features/
│   ├── auth/{components,server}
│   ├── documents/
│   │   ├── components/{UploadZone,DocumentList,DocumentCard}
│   │   └── server/{service,storage,parsers,chunker,indexer,queue}
│   ├── chat/
│   │   ├── components/{ChatPanel,MessageBubble,ChunkPanel,CitationContext}
│   │   └── server/rag.ts
│   └── account/components/{ProfileForm,PasswordForm,DeleteAccount}
├── shared/
│   ├── components/{ui,ThemeProvider,ThemeToggle,Sidebar}
│   └── lib/{db,env,auth,ai,cn}       # ai.ts carries the retry layer
├── db/{schema.ts,migrations}
├── middleware.ts                   # session gate for pages
└── instrumentation.ts              # boots in-process worker
scripts/worker.ts                   # standalone worker
```

## How it works

### Upload → index pipeline

1. **Upload handler** validates, stores the file via `StorageDriver`, inserts
   a row with `status='processing'`, and **enqueues** a `pg-boss` job
   with `singletonKey = documentId` (dedupes concurrent enqueues). pg-boss 12
   requires `createQueue()` on boot, which `queue.ts` does once per process.
2. **Worker** (inline or standalone) re-fetches the file from storage,
   extracts text (`unpdf` / `mammoth` / `papaparse` / plain), chunks it
   (~1000 chars with 150-char overlap), batch-embeds with
   `gemini-embedding-001` at `outputDimensionality: 768` (up to 100 per
   call), and writes `chunks` rows inside a transaction that also flips
   status to `ready`. On failure, writes the error and flips to `failed`;
   pg-boss retries 3× with backoff on top of the Gemini-level retries below.
3. **Idempotence** — on retry the transaction first `DELETE`s existing
   chunks for the document so partial writes from a crashed attempt can't
   accumulate.

### Chat (RAG with citations)

1. Question is embedded; top-5 chunks retrieved via pgvector's cosine
   distance (`<=>`) backed by an HNSW index.
2. Prompt is assembled with doc name, numbered chunks, and last 6 message
   turns. The system prompt instructs the model to cite like `[#3]`.
3. `gemini-3.5-flash` streams the answer over a plain `text/plain`
   `ReadableStream`.
4. Client pre-processes assistant content, rewriting `[#3]` into a markdown
   link `[#3](da-cite:3)`. A custom `urlTransform` keeps the `da-cite:`
   scheme past react-markdown's safe-URL filter (which strips unknown
   schemes), and a custom `<a>` renderer turns it into a pill button.
   Click → right-side `ChunkPanel` fetches
   `GET /api/documents/[id]/chunks/[idx]` and shows the source text.

### AI resilience (`src/shared/lib/ai.ts`)

Every Gemini call goes through `withGeminiRetry(fn, opts)` which:

- Catches the SDK's thrown error and parses `status` from `err.status`,
  `err.statusCode`, or (last resort) a regex scrape of the error message.
- Retries on `408, 429, 500, 502, 503, 504`.
- Honors a server-sent `Retry-After` header or `google.rpc.RetryInfo`
  `retryDelay` detail; otherwise exponential backoff with jitter.
- Wraps the final failure in a `GeminiError` with a `.userMessage` getter
  that produces vendor-agnostic, action-oriented copy ("The AI assistant is
  busy at the moment. Please wait a few seconds and send your message
  again.") suitable for direct display in the chat bubble.

Two policies in use:

| Call site | Attempts | Delay range |
|---|---|---|
| `embed()` (background indexer) | 5 | 2s → 60s |
| `generateContentStream()` (chat) | 2 | 0.8s → 2s |

The HTTP `query` route catches `GeminiError` on both pre-stream and
mid-stream failure paths, logs the technical detail to `console.error`, and
sends only `.userMessage` to the client. The chat panel renders the text as
an italic assistant message so partial answers aren't lost.

## Storage drivers

Toggle via `STORAGE_DRIVER`:

- `local` — writes to `./uploads/<userId>/<uuid>-<filename>`.
- `s3` — any S3-compatible endpoint. Set `S3_BUCKET`, `S3_REGION`,
  `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and optionally `S3_ENDPOINT`
  (R2, MinIO, Backblaze B2, DigitalOcean Spaces). Uses `@aws-sdk/lib-storage`'s
  `Upload` for automatic multipart. `forcePathStyle` enabled when a custom
  endpoint is set.

Call sites don't change — everything above the `StorageDriver` interface
is driver-agnostic.

## Account

- **Edit profile** — change display name.
- **Change password** — bcrypt (cost 12) with current-password check.
- **Delete account** — Danger Zone: requires password + typing your email.
  Deletes every file from storage, then the user row; `ON DELETE CASCADE`
  wipes documents, chunks and messages.

## Theming

Tailwind 4 CSS-first config lives entirely in `src/app/globals.css`:

- `@theme { --color-* }` defines the design tokens as CSS variables; every
  utility (`bg-bg`, `text-fg`, `border-border`, …) is generated from them.
- `@custom-variant dark (&:where(.dark, .dark *))` wires the `dark:` prefix
  to the `.dark` class that `next-themes` sets on `<html>`.
- `.dark { --color-* }` redefines the same tokens; every themed utility
  flips automatically via the CSS variable cascade.
- `.user-bubble ::selection` provides a scoped high-contrast selection
  color on user chat bubbles so copied text stays legible.

`tailwind.config.ts` is a dormant stub kept for sandboxes that can't
delete it — v4 does not auto-detect JS config files.

## Free-tier Gemini notes

- `gemini-3.5-flash` is free-tier available (RPM/TPM limits apply).
- `gemini-embedding-001` is used at `outputDimensionality: 768` to match
  the pgvector column size — matches `text-embedding-004` in storage shape.
- Rate-limited responses (`429` / `503`) retry automatically; if retries
  exhaust, the chat shows a short user-facing message and the technical
  detail goes to `console.error` on the server.

## Security

- Passwords: bcrypt (cost 12) via `bcryptjs` 3.x (promise-only API).
- Sessions: `HS256` JWT (jose 6) in a httpOnly, SameSite=Lax cookie, 7-day TTL.
- Page gating: edge middleware. API gating: `requireSession()` in every
  handler. Per-user scoping is enforced in queries; client-supplied IDs
  are never trusted. Chunks endpoint checks document ownership before
  returning any content.
- All API error responses are plain text with user-safe copy; technical
  details (SDK message, status, stack) stay in server logs only.

## Known trade-offs

- **CSV flattening** — small/medium CSVs become `col: value` rows. Great
  for the LLM; wrong tool for huge analytical tables (use SQL).
- **`.doc` legacy** — only `.docx` is reliable via mammoth.
- **Upload buffering** — entire file read into memory, capped at 20MB. For
  larger uploads, stream multipart with `busboy` and pass the stream into
  `storage.put` (interface already takes `Buffer | Readable`).
- **HNSW index** — pgvector 0.5.0+ required. On older versions, swap
  `USING hnsw` for `USING ivfflat` in the migration.
- **Inline worker in dev** — the Next.js process also runs the pg-boss
  worker (see `instrumentation.ts`). Fine locally; in production either
  keep it inline for single-server deploys or set `DISABLE_INLINE_WORKER=1`
  on the web process and run `pnpm run worker` separately.
