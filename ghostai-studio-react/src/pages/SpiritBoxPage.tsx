import { RadioTower, Volume2 } from "lucide-react";
import { useState } from "react";
import GlassPanel from "@/components/common/GlassPanel";
import OscilloscopeCanvas from "@/components/common/OscilloscopeCanvas";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestTextFromActiveProvider } from "@/services/aiService";
import { playNarration } from "@/services/ttsService";

export default function SpiritBoxPage() {
  const [question, setQuestion] = useState("มีใครอยากพูดอะไรไหม");
  const [answer, setAnswer] = useState("รอเสียงจากอีกฝั่ง...");
  const [loading, setLoading] = useState(false);
  const [frequency, setFrequency] = useState(91.7);

  async function askSpiritBox() {
    setLoading(true);
    setAnswer("กำลังสแกนคลื่น...");
    const prompt = `คุณคือวิญญาณในอุปกรณ์ Spirit Box ถูกถามว่า: "${question}"
จงตอบกลับสั้นๆ ลึกลับ น่าตื่นตระหนก ไม่เกิน 15 คำ ภาษาไทย`;

    try {
      const text = await requestTextFromActiveProvider(prompt, undefined, { temperature: 0.9, maxTokens: 180 });
      setAnswer(text);
      setFrequency(88 + Math.random() * 20);
      await playNarration({ text, voiceId: "Vindemiatrix", speakingRate: 0.78, pitch: -6, hauntedFx: true });
    } catch {
      const fallback = "...ใครบางคน...อยู่ข้างหลังคุณ...";
      setAnswer(fallback);
      await playNarration({ text: fallback, voiceId: "Vindemiatrix", speakingRate: 0.78, pitch: -6, hauntedFx: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <PageHeader
        icon={<RadioTower className="h-8 w-8 text-crimson-500" />}
        title="Spirit Box"
        highlight="EVP"
        description="ระบบถามตอบวิญญาณแบบคลื่นวิทยุจาก legacy spirit-box พร้อม oscilloscope และ TTS หลอน"
      />

      <GlassPanel className="space-y-6">
        <div className="relative h-56 overflow-hidden rounded-3xl border border-dark-700 bg-black">
          <OscilloscopeCanvas active={loading} color="#22c55e" intensity={loading ? 1.6 : 0.55} className="absolute inset-0 h-full w-full" />
          <div className="relative z-10 flex h-full flex-col items-center justify-center bg-black/20 text-center">
            <p className="font-mono text-5xl font-bold tracking-tighter text-green-400">{frequency.toFixed(1)} MHz</p>
            <p className="mt-2 text-xs uppercase tracking-[0.4em] text-gray-500">{loading ? "Scanning EVP Signal" : "Signal Waiting"}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <Input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="ถามผ่าน Spirit Box..." />
          <Button variant="crimson" onClick={askSpiritBox} disabled={loading}>
            <Volume2 className="h-4 w-4" />
            {loading ? "กำลังรับคลื่น..." : "ถามวิญญาณ"}
          </Button>
        </div>

        <div className="rounded-2xl border border-green-900/40 bg-green-950/10 p-5">
          <p className="text-xs uppercase tracking-[0.35em] text-green-500">EVP Response</p>
          <p className="mt-3 text-xl text-gray-100">{answer}</p>
        </div>
      </GlassPanel>
    </section>
  );
}
