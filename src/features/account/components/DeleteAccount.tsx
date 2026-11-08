"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

export function DeleteAccount({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = password.length > 0 && confirmEmail.toLowerCase() === email.toLowerCase();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true); setError(null);
    const res = await fetch("/api/account", {
      method: "DELETE", headers: { "content-type": "application/json" },
      body: JSON.stringify({ password, confirmEmail }),
    });
    setLoading(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || "Delete failed"); return; }
    router.push("/signup"); router.refresh();
  }

  return (
    <Card className="p-6 border-danger/40">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-md bg-danger/10 text-danger grid place-items-center shrink-0">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Danger zone</h2>
          <p className="text-xs text-muted mt-1">
            Delete your account along with every document, embedding and chat message.
            This is irreversible.
          </p>

          {!open ? (
            <div className="mt-4">
              <Button variant="danger" size="sm" onClick={() => setOpen(true)}>Delete account…</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-3 max-w-sm">
              <div>
                <Label htmlFor="del-pw">Confirm password</Label>
                <Input id="del-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="del-em">Type <span className="font-mono text-fg">{email}</span> to confirm</Label>
                <Input id="del-em" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} required />
              </div>
              {error && <div className="text-xs text-danger">{error}</div>}
              <div className="flex items-center gap-2">
                <Button type="submit" variant="danger" size="sm" loading={loading} disabled={!canSubmit}>
                  Permanently delete
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setPassword(""); setConfirmEmail(""); setError(null); }}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Card>
  );
}
