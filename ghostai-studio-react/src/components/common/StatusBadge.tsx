import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = {
  children: string;
};

export default function StatusBadge({ children }: StatusBadgeProps) {
  return <Badge>{children}</Badge>;
}
