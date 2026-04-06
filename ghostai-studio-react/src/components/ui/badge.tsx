import type { HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-crimson-900/50 bg-crimson-950/60 px-2.5 py-1 text-xs font-semibold text-crimson-300",
        className
      )}
      {...props}
    />
  );
}
