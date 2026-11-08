import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/shared/lib/auth";
import { AuthError, changePassword } from "@/features/auth/server/service";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

export async function PUT(req: Request) {
  try {
    const s = await requireSession();
    const { currentPassword, newPassword } = bodySchema.parse(await req.json());
    await changePassword(s.sub, currentPassword, newPassword);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
}
