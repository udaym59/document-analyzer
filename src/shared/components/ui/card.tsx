import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-surface border border-border rounded-xl shadow-card", className)} {...rest} />;
}
