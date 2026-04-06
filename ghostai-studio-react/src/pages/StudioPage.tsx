import { Sparkles, Wand2 } from "lucide-react";
import GlassPanel from "@/components/common/GlassPanel";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";

export default function StudioPage() {
  return (
    <section>
      <PageHeader
        icon={<Wand2 className="h-8 w-8 text-crimson-500" />}
        title="AI Studio"
        highlight="CONTROL"
        description="หน้า shell ใหม่สำหรับย้ายระบบสร้างเรื่อง, TTS, metadata และ thumbnail จาก index.html เดิม"
      />

      <GlassPanel className="space-y-4">
        <div className="flex items-center gap-3 text-crimson-300">
          <Sparkles className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Scaffold พร้อมย้าย logic</h2>
        </div>
        <p className="text-sm leading-7 text-gray-400">
          หน้านี้ตั้งใจให้เป็นปลายทางของ logic จาก `index.html` เดิม แต่ยังไม่ย้ายทั้งหมดใน scaffold รอบแรก
          เพื่อไม่ให้โค้ดใหม่รกตั้งแต่เริ่มต้น
        </p>
        <Button variant="crimson">เริ่มย้ายฟีเจอร์ในเฟสถัดไป</Button>
      </GlassPanel>
    </section>
  );
}
