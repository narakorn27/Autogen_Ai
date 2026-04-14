import { BookOpen, Flame, Moon, Skull } from "lucide-react";
import { useState } from "react";
import GlassPanel from "@/components/common/GlassPanel";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requestTextFromActiveProvider } from "@/services/aiService";
import { playNarration } from "@/services/ttsService";

export default function StoryRitualPage() {
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [fear, setFear] = useState("");
  const [story, setStory] = useState("");
  const [status, setStatus] = useState("กรอกข้อมูลเพื่อเริ่มพิธีกรรม");
  const [loading, setLoading] = useState(false);

  async function invokeRitual() {
    if (!name || !place || !fear) {
      setStatus("กรุณากรอกชื่อ สถานที่ และสิ่งที่กลัวให้ครบก่อนครับ");
      return;
    }

    setLoading(true);
    setStatus("กำลังประกอบพิธีกรรม...");
    const prompt = `แต่งเรื่องผีภาษาไทยแบบ personalized creepypasta 500-700 คำ
ชื่อเป้าหมาย: ${name}
สถานที่: ${place}
สิ่งที่กลัวที่สุด: ${fear}
ให้บรรยากาศเหมือนเกิดขึ้นตอนนี้จริงๆ ใช้ประสาทสัมผัส เสียง กลิ่น ความเย็น และจบแบบทิ้งท้ายว่าเรื่องยังไม่จบ`;

    try {
      const text = await requestTextFromActiveProvider(prompt, undefined, { temperature: 0.8, maxTokens: 1600 });
      setStory(text);
      setStatus("พิธีกรรมเสร็จแล้ว");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function playStory() {
    if (!story) return;
    setStatus("กำลังพากย์เสียง...");
    try {
      await playNarration({ text: story, voiceId: "Charon" });
      setStatus("กำลังเล่นเสียง");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section>
      <PageHeader
        icon={<BookOpen className="h-8 w-8 text-crimson-500" />}
        title="Personalized Ritual"
        description="สร้างเรื่องผีเฉพาะตัวจากชื่อ สถานที่ และความกลัว แล้วส่งต่อเข้า TTS ได้ทันที"
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <GlassPanel className="relative overflow-hidden">
          <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-crimson-900/30 blur-3xl" />
          <div className="relative space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-crimson-800/60 bg-crimson-950/50 text-crimson-300">
                <Flame className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-crimson-400">Ritual Input</p>
                <h2 className="font-display text-2xl text-gray-100">ตั้งค่าพิธีกรรม</h2>
              </div>
            </div>

            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="ชื่อของเหยื่อ / ผู้ฟัง" />
            <Input value={place} onChange={(event) => setPlace(event.target.value)} placeholder="สถานที่ เช่น ห้องเช่าเก่า ป่าหลังโรงเรียน" />
            <Input value={fear} onChange={(event) => setFear(event.target.value)} placeholder="สิ่งที่กลัวที่สุด เช่น เสียงเคาะ ประตูแดง เงาในกระจก" />

            <div className="rounded-3xl border border-crimson-900/60 bg-black/30 p-5 text-sm text-gray-300">
              <div className="mb-3 flex items-center gap-2 text-crimson-300">
                <Moon className="h-4 w-4" />
                <span className="uppercase tracking-[0.25em]">Ritual Seal</span>
              </div>
              <p>ชื่อ: {name || "ยังไม่ระบุ"}</p>
              <p>สถานที่: {place || "ยังไม่ระบุ"}</p>
              <p>ความกลัว: {fear || "ยังไม่ระบุ"}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="crimson" onClick={invokeRitual} disabled={loading}>
                <Skull className="h-4 w-4" />
                {loading ? "กำลังประกอบพิธี..." : "เริ่มพิธีกรรม"}
              </Button>
              <Button variant="ghost" onClick={() => setStory("")}>
                ล้างผลลัพธ์
              </Button>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-crimson-500">Generated Manuscript</p>
              <p className="mt-1 text-sm text-gray-400">{status}</p>
            </div>
            <Button variant="panel" onClick={playStory} disabled={!story}>
              พากย์เสียง
            </Button>
          </div>
          <Textarea value={story} onChange={(event) => setStory(event.target.value)} rows={18} placeholder="ตำนานเฉพาะบุคคลจะปรากฏตรงนี้" />
        </GlassPanel>
      </div>
    </section>
  );
}
