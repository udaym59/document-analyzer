import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/shared/lib/cn";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full h-9 px-3 rounded-md text-sm bg-surface border border-border",
          "placeholder:text-muted/70 focus:border-accent",
          className,
        )}
        {...rest}
      />
    );
  }
);
