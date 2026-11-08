import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { readSession } from "@/shared/lib/auth";
import { getUserDocument } from "@/features/documents/server/service";
import { db, schema } from "@/shared/lib/db";
import { ChatPanel } from "@/features/chat/components/ChatPanel";

export const dynamic = "force-dynamic";

export default async function DocumentChatPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await readSession();
  const { id } = await params;
  const doc = await getUserDocument(s!.sub, id);
  if (!doc) notFound();
  const messages = await db.query.messages.findMany({
    where: eq(schema.messages.documentId, doc.id),
    orderBy: [asc(schema.messages.createdAt)],
  });
  return <ChatPanel doc={doc} initialMessages={messages} />;
}
