import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full min-h-[80px] px-3 py-2 rounded-md text-sm bg-surface border border-border",
          "placeholder:text-muted/70 focus:border-accent resize-none",
          className,
        )}
        {...rest}
      />
    );
  }
);
