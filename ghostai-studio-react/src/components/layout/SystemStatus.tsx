type SystemStatusProps = {
  label: string;
};

export default function SystemStatus({ label }: SystemStatusProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-dark-600 bg-dark-900/80 px-4 py-3 shadow-inner">
      <span className="text-xs font-semibold tracking-wider text-gray-400">SYSTEM</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium tracking-wider text-green-500">{label}</span>
        <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
      </div>
    </div>
  );
}
