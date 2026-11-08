"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Trash2 } from "lucide-react";
import type { Document } from "@/db/schema";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";

const toneByStatus = { processing: "warning", ready: "success", failed: "danger" } as const;
const formatSize = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
};

export function DocumentCard({ doc }: { doc: Document }) {
  const router = useRouter();

  async function remove(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(`Delete "${doc.name}"? This also removes its chat history.`)) return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <Link href={`/documents/${doc.id}`}>
      <Card className="p-4 hover:border-accent/50 transition-colors group">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-surface-2 grid place-items-center text-muted shrink-0">
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{doc.name}</div>
            <div className="text-xs text-muted mt-0.5">
              {formatSize(doc.sizeBytes)} · {doc.chunkCount} chunks · {new Date(doc.createdAt).toLocaleDateString()}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge tone={toneByStatus[doc.status]}>{doc.status}</Badge>
              {doc.status === "failed" && doc.error ? (
                <span className="text-[11px] text-danger truncate">{doc.error}</span>
              ) : null}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={remove} className="opacity-0 group-hover:opacity-100" aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </Link>
  );
}
