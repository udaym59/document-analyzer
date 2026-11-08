import { readSession } from "@/shared/lib/auth";
import { listUserDocuments } from "@/features/documents/server/service";
import { DocumentList } from "@/features/documents/components/DocumentList";
import { UploadZone } from "@/features/documents/components/UploadZone";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const s = await readSession();
  const docs = await listUserDocuments(s!.sub);
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted mt-1">Upload documents, then open one to chat about it.</p>
        </header>
        <UploadZone />
        <section>
          <h2 className="text-xs uppercase tracking-wide text-muted mb-3">Library</h2>
          <DocumentList initial={docs} />
        </section>
      </div>
    </div>
  );
}
