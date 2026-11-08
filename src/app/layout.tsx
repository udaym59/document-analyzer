import type { Metadata } from "next";
import { ThemeProvider } from "@/shared/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Document Analyzer",
  description: "Upload documents and query them with AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
