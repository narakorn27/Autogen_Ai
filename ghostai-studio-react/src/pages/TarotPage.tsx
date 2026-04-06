import { Clover, Sparkles } from "lucide-react";
import AudioPlayer from "@/components/common/AudioPlayer";
import GlassPanel from "@/components/common/GlassPanel";
import PageHeader from "@/components/common/PageHeader";

export default function TarotPage() {
  return (
    <section>
      <PageHeader
        icon={<Clover className="h-8 w-8 text-crimson-500" />}
        title="SPIRIT TAROT"
        description="หน้า placeholder สำหรับย้าย spirit-tarot.js และ TTS flow ในเฟสถัดไป"
      />
      <GlassPanel className="space-y-4">
        <Sparkles className="h-8 w-8 text-crimson-500" />
        <p className="text-sm leading-7 text-gray-400">
          โครงหน้า tarot พร้อมแล้ว จุดต่อไปคือแยก logic ไพ่และเสียงเข้ามาใน features/tarot และ services/ttsService
        </p>
        <AudioPlayer disabled label="รอย้าย TTS tarot" />
      </GlassPanel>
    </section>
  );
}
