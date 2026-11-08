"use client";
import { useEffect, useRef, useState } from "react";
import type { Document } from "@/db/schema";
import { DocumentCard } from "./DocumentCard";

/** Poll while any doc is processing. Stops when none are. */
function usePollWhileProcessing(initial: Document[]) {
  const [docs, setDocs] = useState(initial);
  const anyProcessing = docs.some((d) => d.status === "processing");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setDocs(initial); }, [initial]);

  useEffect(() => {
    if (!anyProcessing) { if (timer.current) { clearInterval(timer.current); timer.current = null; } return; }
    timer.current = setInterval(async () => {
      const res = await fetch("/api/documents");
      if (res.ok) { const j = await res.json(); setDocs(j.documents); }
    }, 2000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [anyProcessing]);

  return docs;
}

export function DocumentList({ initial }: { initial: Document[] }) {
  const docs = usePollWhileProcessing(initial);
  if (!docs.length) {
    return <div className="text-sm text-muted">No documents yet. Upload one to get started.</div>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {docs.map((d) => <DocumentCard key={d.id} doc={d} />)}
    </div>
  );
}
