import { createHashRouter } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import DevToolsPage from "./pages/DevToolsPage";
import FeedPage from "./pages/FeedPage";
import OuijaPage from "./pages/OuijaPage";
import ProvinceSeriesPage from "./pages/ProvinceSeriesPage";
import SettingsPage from "./pages/SettingsPage";
import SpiritBoxPage from "./pages/SpiritBoxPage";
import StoryRitualPage from "./pages/StoryRitualPage";
import StudioPage from "./pages/StudioPage";
import TarotPage from "./pages/TarotPage";

// ใช้ Hash Router เพื่อให้ static hosting เปิด route ได้โดยไม่ต้องตั้งค่า server fallback
export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <StudioPage /> },
      { path: "province-series", element: <ProvinceSeriesPage /> },
      { path: "feed", element: <FeedPage /> },
      { path: "spirit-box", element: <SpiritBoxPage /> },
      { path: "tarot", element: <TarotPage /> },
      { path: "ouija", element: <OuijaPage /> },
      { path: "story-ritual", element: <StoryRitualPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "dev-tools", element: <DevToolsPage /> }
    ]
  }
]);
