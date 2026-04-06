import { BookOpen, Skull } from "lucide-react";
import GlassPanel from "@/components/common/GlassPanel";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";

export default function StoryRitualPage() {
  return (
    <section>
      <PageHeader
        icon={<BookOpen className="h-8 w-8 text-crimson-500" />}
        title="Personalized Ritual"
        description="หน้า placeholder สำหรับย้าย story-ritual.js เป็น feature module"
      />
      <GlassPanel className="space-y-4">
        <p className="text-sm leading-7 text-gray-400">
          หน้านี้จะเชื่อมกับ story ritual state และ output panel ในเฟส migration ถัดไป
        </p>
        <Button variant="crimson" disabled>
          <Skull className="h-4 w-4" />
          เริ่มพิธีกรรม
        </Button>
      </GlassPanel>
    </section>
  );
}
