"use client";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/cn";

export function ChunkPanel({
  documentId, idx, onClose,
}: { documentId: string; idx: number | null; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (idx == null) return;
    let cancelled = false;
    setLoading(true); setErr(null); setContent(null);
    fetch(`/api/documents/${documentId}/chunks/${idx}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Couldn't load the source for this citation.")))
      .then((j) => { if (!cancelled) setContent(j.chunk.content); })
      .catch((e) => { if (!cancelled) setErr(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [documentId, idx]);

  const open = idx != null;

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 bg-black/20 backdrop-blur-[1px] transition-opacity z-30",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
      />
      <aside
        className={cn(
          "fixed top-0 right-0 h-screen w-[420px] max-w-[90vw] bg-surface border-l border-border z-40",
          "shadow-xl transition-transform duration-200 flex flex-col",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <header className="h-14 px-5 flex items-center justify-between border-b border-border shrink-0">
          <div>
            <div className="text-xs text-muted">Source</div>
            <div className="text-sm font-semibold">Chunk #{idx ?? ""}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed">
          {loading && <div className="text-muted">Loading…</div>}
          {err && <div className="text-danger">{err}</div>}
          {content && <pre className="whitespace-pre-wrap font-sans">{content}</pre>}
        </div>
      </aside>
    </>
  );
}
