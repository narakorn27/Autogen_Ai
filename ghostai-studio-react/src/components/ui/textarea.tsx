import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full rounded-xl border border-dark-600 bg-dark-900/90 px-4 py-3 text-sm text-gray-100 outline-none transition focus:border-crimson-600",
        className
      )}
      {...props}
    />
  );
}
