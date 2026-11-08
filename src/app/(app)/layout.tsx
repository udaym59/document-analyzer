import { redirect } from "next/navigation";
import { readSession } from "@/shared/lib/auth";
import { getUser } from "@/features/auth/server/service";
import { Sidebar } from "@/shared/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await readSession();
  if (!s) redirect("/login");
  const user = await getUser(s.sub);
  if (!user) redirect("/login");
  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar user={{ name: user.name, email: user.email }} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
