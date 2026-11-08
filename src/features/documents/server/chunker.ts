import "server-only";

// Approximate token count — Gemini roughly 4 chars per token.
export const approxTokens = (s: string) => Math.ceil(s.length / 4);

/**
 * Simple character-based sliding window with paragraph awareness.
 * target ~1000 chars (~250 tokens), overlap 150 chars.
 */
export function chunk(text: string, target = 1000, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];

  const paragraphs = clean.split(/\n{2,}/);
  const out: string[] = [];
  let buf = "";

  for (const p of paragraphs) {
    if (buf.length + p.length + 2 <= target) {
      buf = buf ? `${buf}\n\n${p}` : p;
      continue;
    }
    if (buf) out.push(buf);
    if (p.length <= target) { buf = p; continue; }

    // Oversized paragraph — slice with overlap.
    let i = 0;
    while (i < p.length) {
      const slice = p.slice(i, i + target);
      out.push(slice);
      if (i + target >= p.length) break;
      i += target - overlap;
    }
    buf = "";
  }
  if (buf) out.push(buf);

  // Add overlap between chunks for context continuity.
  if (out.length <= 1) return out;
  const withOverlap: string[] = [out[0]];
  for (let i = 1; i < out.length; i++) {
    const prevTail = out[i - 1].slice(-overlap);
    withOverlap.push(`${prevTail}\n\n${out[i]}`);
  }
  return withOverlap;
}
