"use client";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

export function PasswordForm() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNext] = useState("");
  const [status, setStatus] = useState<{ ok?: string; err?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setStatus(null);
    const res = await fetch("/api/account/password", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setLoading(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setStatus({ err: j.error || "Something went wrong. Please try again." });
    else { setStatus({ ok: "Password updated" }); setCurrent(""); setNext(""); }
  }

  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold mb-4">Change password</h2>
      <form onSubmit={submit} className="space-y-3 max-w-sm">
        <div>
          <Label htmlFor="cp">Current password</Label>
          <Input id="cp" type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="np">New password</Label>
          <Input id="np" type="password" minLength={8} value={newPassword} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" loading={loading}>Update password</Button>
          {status?.ok && <span className="text-xs text-emerald-600 dark:text-emerald-400">{status.ok}</span>}
          {status?.err && <span className="text-xs text-danger">{status.err}</span>}
        </div>
      </form>
    </Card>
  );
}
