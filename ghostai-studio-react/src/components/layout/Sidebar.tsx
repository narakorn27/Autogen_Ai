import { Ghost } from "lucide-react";
import { appConfig } from "@/config/app";
import { navigationItems } from "@/config/navigation";
import NavItem from "./NavItem";
import SystemStatus from "./SystemStatus";

export default function Sidebar() {
  return (
    <aside className="glass-panel fixed inset-y-0 left-0 z-30 hidden h-screen w-64 flex-col overflow-hidden border-r border-crimson-900/50 md:flex">
      <div className="flex items-center gap-3 border-b border-crimson-900/50 p-6">
        <div className="animate-pulse-slow rounded-lg bg-crimson-900/30 p-2 text-crimson-500">
          <Ghost />
        </div>
        <h1 className="text-xl font-bold tracking-wider text-white">
          GhostAI<span className="text-crimson-500">.</span>
        </h1>
      </div>

      <nav className="ghost-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-6">
        {navigationItems
          .filter((item) => item.enabled)
          .map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
      </nav>

      <div className="border-t border-crimson-900/50 p-4">
        <SystemStatus label={appConfig.statusLabel} />
      </div>
    </aside>
  );
}
