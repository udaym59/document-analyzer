import { NextResponse } from "next/server";
import { AuthError, credsSchema, login } from "@/features/auth/server/service";
import { setSessionCookie, signSession } from "@/shared/lib/auth";

export async function POST(req: Request) {
  try {
    const body = credsSchema.parse(await req.json());
    const user = await login(body);
    await setSessionCookie(await signSession({ sub: user.id, email: user.email }));
    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
}
