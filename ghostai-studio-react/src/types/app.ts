import type { LucideIcon } from "lucide-react";

export type NavItemConfig = {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  enabled: boolean;
};
