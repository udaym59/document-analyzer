import { NextResponse } from "next/server";
import { readSession } from "@/shared/lib/auth";
import { getUser } from "@/features/auth/server/service";

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ user: null });
  const user = await getUser(s.sub);
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
}
