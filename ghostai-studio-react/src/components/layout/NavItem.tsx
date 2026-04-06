import { NavLink } from "react-router-dom";
import type { NavItemConfig } from "@/types/app";
import { cn } from "@/utils/cn";

type NavItemProps = {
  item: NavItemConfig;
};

export default function NavItem({ item }: NavItemProps) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      className={({ isActive }) =>
        cn(
          "flex w-full items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-gray-400 transition-all hover:bg-crimson-900/20 hover:text-gray-200",
          isActive && "crimson-glow border-crimson-800/50 bg-crimson-900/10 text-gray-200"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("h-5 w-5 text-gray-500", isActive && "text-crimson-400")} />
          <span className="font-medium tracking-wide">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}
