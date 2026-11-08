import "server-only";
import Papa from "papaparse";

export const ACCEPTED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc (we only reliably handle .docx; .doc may fail)
  "text/csv",
  "application/csv",
  "text/markdown",
  "text/x-markdown",
  "application/json",
  "text/plain",
]);

export const ACCEPTED_EXT = /\.(pdf|docx?|csv|md|markdown|json|txt)$/i;

export function detectKind(name: string, mime: string): "pdf" | "docx" | "csv" | "md" | "json" | "txt" {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  if (n.endsWith(".docx") || n.endsWith(".doc") || mime.includes("word")) return "docx";
  if (n.endsWith(".csv") || mime.includes("csv")) return "csv";
  if (n.endsWith(".md") || n.endsWith(".markdown") || mime.includes("markdown")) return "md";
  if (n.endsWith(".json") || mime === "application/json") return "json";
  return "txt";
}

export async function extractText(kind: ReturnType<typeof detectKind>, buf: Buffer): Promise<string> {
  switch (kind) {
    case "pdf": {
      const { extractText } = await import("unpdf");
      const { text } = await extractText(new Uint8Array(buf), { mergePages: true });
      return (Array.isArray(text) ? text.join("\n\n") : text).trim();
    }
    case "docx": {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer: buf });
      return value.trim();
    }
    case "csv": {
      const text = buf.toString("utf8");
      // Keep structure as "col: value" rows so the LLM can read them.
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      const headers = parsed.meta.fields ?? [];
      return parsed.data.map((row, i) =>
        `Row ${i + 1}\n` + headers.map((h) => `  ${h}: ${row[h] ?? ""}`).join("\n")
      ).join("\n\n");
    }
    case "json": {
      const text = buf.toString("utf8");
      try { return JSON.stringify(JSON.parse(text), null, 2); }
      catch { return text; } // fall back to raw if malformed
    }
    case "md":
    case "txt":
    default:
      return buf.toString("utf8").trim();
  }
}
