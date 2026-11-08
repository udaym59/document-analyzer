import { redirect } from "next/navigation";
import { readSession } from "@/shared/lib/auth";

export default async function Index() {
  const s = await readSession();
  redirect(s ? "/documents" : "/login");
}
