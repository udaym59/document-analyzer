import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/shared/lib/auth";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
