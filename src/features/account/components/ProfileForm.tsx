"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

export function ProfileForm({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [status, setStatus] = useState<{ ok?: string; err?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setStatus(null);
    const res = await fetch("/api/account", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLoading(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setStatus({ err: j.error || "Could not save" });
    else { setStatus({ ok: "Saved" }); router.refresh(); }
  }

  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold mb-4">Profile</h2>
      <form onSubmit={save} className="space-y-3 max-w-sm">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user.email} disabled />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" loading={loading}>Save changes</Button>
          {status?.ok && <span className="text-xs text-emerald-600 dark:text-emerald-400">{status.ok}</span>}
          {status?.err && <span className="text-xs text-danger">{status.err}</span>}
        </div>
      </form>
    </Card>
  );
}
