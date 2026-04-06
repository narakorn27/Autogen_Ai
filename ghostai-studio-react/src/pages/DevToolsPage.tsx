import { Stethoscope } from "lucide-react";
import GlassPanel from "@/components/common/GlassPanel";
import PageHeader from "@/components/common/PageHeader";

export default function DevToolsPage() {
  return (
    <section>
      <PageHeader
        icon={<Stethoscope className="h-8 w-8 text-crimson-500" />}
        title="Dev Tools"
        description="พื้นที่สำหรับย้าย tts-api-test และ tts-diagnostic โดยไม่ปนกับ nav หลักของ product"
      />
      <GlassPanel>
        <p className="text-sm leading-7 text-gray-400">
          ตอนนี้เป็น route สำหรับเครื่องมือทดสอบ ภายหลังจะย้าย diagnostic UI เข้ามาเป็น tab หรือ card แยก
        </p>
      </GlassPanel>
    </section>
  );
}
