import "server-only";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, schema } from "@/shared/lib/db";

export const credsSchema = z.object({
  email: z.email().toLowerCase(),               // zod 4: top-level z.email()
  password: z.string().min(8).max(200),
});
export const signupSchema = credsSchema.extend({
  name: z.string().min(1).max(120),
});

export class AuthError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function signup(input: z.infer<typeof signupSchema>) {
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, input.email) });
  if (existing) throw new AuthError("Email already in use", 409);
  const passwordHash = await bcrypt.hash(input.password, 12);
  const [user] = await db.insert(schema.users).values({
    email: input.email, name: input.name, passwordHash,
  }).returning();
  return user;
}

export async function login(input: z.infer<typeof credsSchema>) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, input.email) });
  if (!user) throw new AuthError("Invalid email or password", 401);
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new AuthError("Invalid email or password", 401);
  return user;
}

export async function changePassword(userId: string, current: string, next: string) {
  if (next.length < 8) throw new AuthError("New password must be at least 8 characters");
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user) throw new AuthError("Not found", 404);
  const ok = await bcrypt.compare(current, user.passwordHash);
  if (!ok) throw new AuthError("Current password is incorrect", 400);
  const passwordHash = await bcrypt.hash(next, 12);
  await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, userId));
}

export async function updateProfile(userId: string, name: string) {
  if (!name.trim()) throw new AuthError("Name is required");
  const [u] = await db.update(schema.users).set({ name }).where(eq(schema.users.id, userId)).returning();
  return u;
}

export async function getUser(userId: string) {
  return db.query.users.findFirst({ where: eq(schema.users.id, userId) });
}
