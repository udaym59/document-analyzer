import { NextResponse } from "next/server";
import { requireSession } from "@/shared/lib/auth";
import { createDocumentFromFile, listUserDocuments, UploadError } from "@/features/documents/server/service";

export const runtime = "nodejs";

export async function GET() {
  const s = await requireSession().catch((e) => e as Response);
  if (s instanceof Response) return s;
  const docs = await listUserDocuments(s.sub);
  return NextResponse.json({ documents: docs });
}

export async function POST(req: Request) {
  try {
    const s = await requireSession();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
    const doc = await createDocumentFromFile(s.sub, file);
    return NextResponse.json({ document: doc });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
