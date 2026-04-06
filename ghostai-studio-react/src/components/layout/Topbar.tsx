import { Bell } from "lucide-react";
import { appConfig } from "@/config/app";

type TopbarProps = {
  title: string;
};

export default function Topbar({ title }: TopbarProps) {
  return (
    <header className="glass-panel sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-crimson-900/30 px-4 md:px-8">
      <h2 className="text-base font-semibold tracking-wide text-gray-200 md:text-lg">{title}</h2>
      <div className="flex items-center gap-5">
        <button className="group relative text-gray-400 transition-colors hover:text-crimson-400" type="button">
          <Bell className="h-5 w-5" />
          <span className="absolute right-0 top-0 h-2 w-2 rounded-full border border-dark-900 bg-crimson-500 group-hover:animate-ping" />
        </button>
        <div className="flex h-8 items-center justify-center rounded-lg border border-crimson-500 bg-gradient-to-r from-crimson-800 to-crimson-600 px-3 text-xs font-bold tracking-wider text-white shadow-lg">
          {appConfig.editionLabel}
        </div>
      </div>
    </header>
  );
}
