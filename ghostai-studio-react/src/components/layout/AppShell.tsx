import { Outlet, useLocation } from "react-router-dom";
import GhostOverlay from "@/components/common/GhostOverlay";
import { navigationItems } from "@/config/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell() {
  const location = useLocation();
  const activeItem = navigationItems.find((item) => item.path === location.pathname);
  const pageTitle = activeItem?.label ?? "GhostAI Studio";

  return (
    <div className="flex min-h-screen overflow-x-hidden antialiased selection:bg-crimson-800 selection:text-white">
      {/* AppShell คือ layout กลาง ทุกหน้าจะได้ Sidebar/Topbar จากจุดนี้ ไม่ต้องเขียนซ้ำ */}
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col bg-transparent">
        <Topbar title={pageTitle} />
        <div className="relative flex-1 p-4 md:p-8">
          <div className="mx-auto w-full max-w-6xl animate-[fadeIn_0.35s_ease-out] pb-8">
            <Outlet />
          </div>
        </div>
      </main>
      <GhostOverlay />
    </div>
  );
}
