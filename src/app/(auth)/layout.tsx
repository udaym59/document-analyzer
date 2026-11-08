import { ThemeToggle } from "@/shared/components/ThemeToggle";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 px-6 flex items-center justify-between border-b border-border">
        <div className="font-semibold tracking-tight">Document Analyzer</div>
        <ThemeToggle />
      </header>
      <main className="flex-1 grid place-items-center p-6">{children}</main>
    </div>
  );
}
