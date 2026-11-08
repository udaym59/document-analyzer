import Link from "next/link";
export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-center space-y-2">
        <div className="text-5xl font-semibold tracking-tight">404</div>
        <div className="text-sm text-muted">That page doesn't exist.</div>
        <Link href="/documents" className="text-accent text-sm hover:underline">Back to Documents</Link>
      </div>
    </div>
  );
}
