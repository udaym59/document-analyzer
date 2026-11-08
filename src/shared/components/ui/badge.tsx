import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";
type Tone = "default" | "success" | "warning" | "danger";
const tones: Record<Tone, string> = {
  default: "bg-surface-2 text-muted border-border",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  danger: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
};
export function Badge({ className, tone = "default", ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium", tones[tone], className)} {...rest} />;
}
