import { NextResponse } from "next/server";
import { requireSession } from "@/shared/lib/auth";
import { deleteUserDocument, getUserDocument, UploadError } from "@/features/documents/server/service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession();
    const { id } = await params;
    const doc = await getUserDocument(s.sub, id);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ document: doc });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession();
    const { id } = await params;
    await deleteUserDocument(s.sub, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
