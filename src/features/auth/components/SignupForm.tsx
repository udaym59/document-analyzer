"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    setLoading(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || "Sign-up failed"); return; }
    router.push("/documents"); router.refresh();
  }

  return (
    <Card className="w-full max-w-sm p-6">
      <h1 className="text-xl font-semibold mb-1">Create account</h1>
      <p className="text-sm text-muted mb-5">Get started in under a minute.</p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="text-[11px] text-muted mt-1">At least 8 characters.</p>
        </div>
        {error && <div className="text-xs text-danger">{error}</div>}
        <Button type="submit" className="w-full" loading={loading}>Create account</Button>
      </form>
      <div className="text-xs text-muted mt-4 text-center">
        Already have an account? <Link href="/login" className="text-accent hover:underline">Sign in</Link>
      </div>
    </Card>
  );
}
