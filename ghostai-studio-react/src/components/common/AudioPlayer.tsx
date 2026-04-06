import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type AudioPlayerProps = {
  label?: string;
  disabled?: boolean;
  onPlay?: () => void;
};

export default function AudioPlayer({ label = "เล่นเสียงตัวอย่าง", disabled, onPlay }: AudioPlayerProps) {
  return (
    <Button variant="panel" disabled={disabled} onClick={onPlay}>
      <Volume2 className="h-4 w-4 text-crimson-400" />
      {label}
    </Button>
  );
}
