import { Skull } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description: string;
};

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-crimson-950/70 bg-dark-900/60 p-8 text-center">
      <Skull className="mb-4 h-10 w-10 text-crimson-700" />
      <h3 className="font-semibold text-gray-100">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-gray-500">{description}</p>
    </div>
  );
}
