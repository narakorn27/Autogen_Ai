import { Flame, Layout } from "lucide-react";
import GlassPanel from "@/components/common/GlassPanel";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";

export default function OuijaPage() {
  return (
    <section>
      <PageHeader
        icon={<Layout className="h-8 w-8 text-crimson-500" />}
        title="Ouija Board"
        description="หน้า placeholder สำหรับย้าย ouija-board.js และ interaction ของกระดาน"
      />
      <GlassPanel className="space-y-4">
        <p className="text-sm leading-7 text-gray-400">
          เฟสถัดไปจะย้าย state การถาม-ตอบ และ animation ของกระดานมาเป็น component แยก
        </p>
        <Button variant="crimson" disabled>
          <Flame className="h-4 w-4" />
          เริ่มถาม
        </Button>
      </GlassPanel>
    </section>
  );
}
