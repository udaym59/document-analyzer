"use client";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/cn";

export function UploadZone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null); setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/documents", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || "Upload failed"); return; }
    router.refresh();
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragging(false);
        const f = e.dataTransfer.files?.[0]; if (f) void upload(f);
      }}
      className={cn(
        "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
        dragging ? "border-accent bg-accent/5" : "border-border bg-surface",
      )}
    >
      <div className="mx-auto w-10 h-10 rounded-full bg-surface-2 grid place-items-center mb-3">
        <Upload className="h-5 w-5 text-muted" />
      </div>
      <div className="text-sm font-medium mb-1">Drop a document to upload</div>
      <div className="text-xs text-muted mb-4">PDF, Word, CSV, Markdown, JSON · up to 20MB</div>
      <input
        ref={inputRef} type="file" className="hidden"
        accept=".pdf,.docx,.doc,.csv,.md,.markdown,.json,.txt"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }}
      />
      <Button onClick={() => inputRef.current?.click()} loading={uploading} variant="secondary" size="sm">
        {uploading ? "Uploading…" : "Choose file"}
      </Button>
      {error && <div className="mt-3 text-xs text-danger">{error}</div>}
    </div>
  );
}
