import {
  BookOpen,
  Clover,
  Layout,
  Radio,
  RadioTower,
  Settings,
  Stethoscope,
  Wand2
} from "lucide-react";
import type { NavItemConfig } from "@/types/app";

// ถ้าจะเพิ่ม/แก้เมนู ให้แก้ที่ไฟล์นี้เป็นหลัก ไม่ต้องแก้ Sidebar ทุกหน้า
export const navigationItems: NavItemConfig[] = [
  { id: "studio", label: "AI Studio", path: "/", icon: Wand2, enabled: true },
  { id: "feed", label: "The Ghost Radio", path: "/feed", icon: Radio, enabled: true },
  { id: "spirit-box", label: "Spirit Box", path: "/spirit-box", icon: RadioTower, enabled: true },
  { id: "ouija", label: "Ouija Board", path: "/ouija", icon: Layout, enabled: true },
  { id: "story-ritual", label: "Personalized Ritual", path: "/story-ritual", icon: BookOpen, enabled: true },
  { id: "tarot", label: "Spirit Tarot", path: "/tarot", icon: Clover, enabled: true },
  { id: "settings", label: "ตั้งค่า", path: "/settings", icon: Settings, enabled: true },
  { id: "dev-tools", label: "Dev Tools", path: "/dev-tools", icon: Stethoscope, enabled: false }
];
