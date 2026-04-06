import { LoaderCircle } from "lucide-react";

type LoadingStateProps = {
  label?: string;
};

export default function LoadingState({ label = "กำลังโหลด..." }: LoadingStateProps) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-crimson-500/80">
      <LoaderCircle className="h-10 w-10 animate-spin" />
      <p className="text-sm font-semibold tracking-widest">{label}</p>
    </div>
  );
}
