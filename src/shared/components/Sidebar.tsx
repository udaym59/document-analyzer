"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, LogOut, User as UserIcon } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";

export function Sidebar({ user }: { user: { name: string; email: string } }) {
  const pathname = usePathname();
  const router = useRouter();

  const items = [
    { href: "/documents", label: "Documents", icon: FileText },
    { href: "/account",   label: "Account",   icon: UserIcon },
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface flex flex-col">
      <div className="h-14 px-4 flex items-center justify-between border-b border-border">
        <div className="font-semibold tracking-tight">Document Analyzer</div>
        <ThemeToggle />
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                active ? "bg-surface-2 text-fg font-medium" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <div className="px-2 pb-2">
          <div className="text-sm font-medium truncate">{user.name}</div>
          <div className="text-xs text-muted truncate">{user.email}</div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
          <LogOut className="h-4 w-4" /> Log out
        </Button>
      </div>
    </aside>
  );
}
