import { NextResponse } from "next/server";
import { z } from "zod";
import { clearSessionCookie, requireSession } from "@/shared/lib/auth";
import { AuthError, getUser, updateProfile } from "@/features/auth/server/service";
import { deleteUserAccount } from "@/features/documents/server/service";
import bcrypt from "bcryptjs";

export async function PATCH(req: Request) {
  try {
    const s = await requireSession();
    const { name } = z.object({ name: z.string().min(1).max(120) }).parse(await req.json());
    const u = await updateProfile(s.sub, name);
    return NextResponse.json({ user: { id: u.id, email: u.email, name: u.name } });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
}

// zod 4: use top-level z.email() instead of z.string().email()
const deleteSchema = z.object({ password: z.string().min(1), confirmEmail: z.email() });

export async function DELETE(req: Request) {
  try {
    const s = await requireSession();
    const { password, confirmEmail } = deleteSchema.parse(await req.json());
    const user = await getUser(s.sub);
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: "Email confirmation does not match" }, { status: 400 });
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "Password is incorrect" }, { status: 400 });
    }
    await deleteUserAccount(s.sub);
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
}
