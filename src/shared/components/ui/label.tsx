import type { LabelHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";
export function Label({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-xs font-medium text-muted mb-1.5", className)} {...rest} />;
}
