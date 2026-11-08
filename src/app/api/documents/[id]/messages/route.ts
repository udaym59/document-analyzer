import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { requireSession } from "@/shared/lib/auth";
import { getUserDocument } from "@/features/documents/server/service";
import { db, schema } from "@/shared/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession();
    const { id } = await params;
    const doc = await getUserDocument(s.sub, id);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const messages = await db.query.messages.findMany({
      where: eq(schema.messages.documentId, doc.id),
      orderBy: [asc(schema.messages.createdAt)],
    });
    return NextResponse.json({ messages });
  } catch (e) { if (e instanceof Response) return e; throw e; }
}
