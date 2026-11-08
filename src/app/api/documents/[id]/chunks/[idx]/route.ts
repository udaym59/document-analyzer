import { NextResponse } from "next/server";
import { requireSession } from "@/shared/lib/auth";
import { getChunk } from "@/features/documents/server/service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; idx: string }> }) {
  try {
    const s = await requireSession();
    const { id, idx } = await params;
    const n = Number(idx);
    if (!Number.isInteger(n) || n < 0) return NextResponse.json({ error: "Bad idx" }, { status: 400 });
    const row = await getChunk(s.sub, id, n);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ chunk: row });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
