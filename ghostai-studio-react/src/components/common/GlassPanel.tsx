import type { HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export default function GlassPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-panel rounded-2xl border p-5", className)} {...props} />;
}
