import { CalendarDays, Copy, ExternalLink, FileText, Play, Radio, RefreshCcw, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import GlassPanel from "@/components/common/GlassPanel";
import LoadingState from "@/components/common/LoadingState";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { requestTextFromActiveProvider } from "@/services/aiService";
import { fetchGhostRadioFeed } from "@/services/feedService";
import { playNarration } from "@/services/ttsService";
import type { FeedItem } from "@/types/feed";
import { formatThaiDate } from "@/utils/formatDate";

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);
  const [summary, setSummary] = useState("");
  const [rewrite, setRewrite] = useState("");
  const [status, setStatus] = useState("เลือกคลิปเพื่อสร้างเวอร์ชัน GhostAI");

  async function loadFeed() {
    setLoading(true);
    setItems(await fetchGhostRadioFeed());
    setLoading(false);
  }

  function selectItem(item: FeedItem) {
    setSelectedItem(item);
    setSummary("");
    setRewrite("");
    setStatus("เลือกคลิปแล้ว ขั้นต่อไปลองสรุปหรือ Ghost Rewrite");
  }

  async function summarizeClip(item = selectedItem) {
    if (!item) return;
    setSelectedItem(item);
    setStatus("กำลังสรุปจากข้อมูลคลิป...");

    const prompt = `สรุปไอเดียจากชื่อคลิปเรื่องผีนี้เป็นภาษาไทย โดยยังไม่อ้างว่าเป็นเรื่องจริงถ้าไม่มี transcript

ชื่อคลิป: ${item.title}
แหล่งที่มา: YouTube RSS

จัดรูปแบบเป็น:
Hook:
ประเด็นหลอน:
มุมที่ GhostAI เอาไปเล่าต่อได้:
คำเตือนเรื่องลิขสิทธิ์/การดัดแปลง:`;

    try {
      setSummary(await requestTextFromActiveProvider(prompt, undefined, { temperature: 0.55, maxTokens: 700 }));
      setStatus("สรุปคลิปเสร็จแล้ว");
    } catch (error) {
      setSummary(`Hook: ${item.title}

ประเด็นหลอน: ใช้ชื่อคลิปนี้เป็นแรงบันดาลใจสำหรับสร้างเรื่องเล่าใหม่ในโทน GhostAI

มุมที่ GhostAI เอาไปเล่าต่อได้: เปิดด้วยคำถามว่าคลิปนี้กำลังซ่อนอะไรอยู่ แล้วสร้างเหตุการณ์ใหม่โดยไม่อ้างว่าเป็น transcript จริง

คำเตือน: ตอนนี้ยังไม่มี transcript จึงควรใช้เป็นแรงบันดาลใจ ไม่ควรคัดลอกเนื้อหาต้นฉบับ`);
      setStatus(error instanceof Error ? `ใช้ fallback เพราะ: ${error.message}` : "ใช้ fallback");
    }
  }

  async function createGhostRewrite(item = selectedItem) {
    if (!item) return;
    setSelectedItem(item);
    setStatus("กำลัง rewrite เป็นเวอร์ชัน GhostAI...");
    const prompt = `จากข้อมูลคลิปเรื่องผีนี้ ช่วยสร้างสคริปต์เล่าใหม่ภาษาไทย 2-3 นาที โดยไม่คัดลอกต้นฉบับ และไม่อ้างว่าเป็นเรื่องจริงถ้าไม่มีหลักฐาน

ชื่อคลิป: ${item.title}
สรุปที่มี: ${summary || "ยังไม่มีสรุป ใช้ชื่อคลิปเป็นแรงบันดาลใจเท่านั้น"}

ให้มี hook เปิดเรื่อง, บรรยากาศ, จุดพีก, และปิดท้ายชวนหลอน
ห้ามใส่ markdown`;

    try {
      setRewrite(await requestTextFromActiveProvider(prompt, undefined, { temperature: 0.75, maxTokens: 1200 }));
      setStatus("สร้าง Ghost Rewrite เสร็จแล้ว");
    } catch (error) {
      setRewrite(`ชื่อเรื่อง: ${item.title}

คืนนี้เราจะหยิบแรงบันดาลใจจากชื่อคลิปนี้มาเล่าใหม่ในโทน GhostAI โดยไม่ยืนยันว่าเป็นเรื่องจริง และไม่คัดลอกจากต้นฉบับ

ทุกอย่างเริ่มจากเสียงหนึ่งที่เหมือนไม่ควรมีอยู่ในภาพ... เสียงที่ทำให้คนฟังรู้สึกเหมือนมีใครยืนอยู่หลังประตู`);
      setStatus(error instanceof Error ? `ใช้ fallback เพราะ: ${error.message}` : "ใช้ fallback");
    }
  }

  async function playRewrite() {
    if (!rewrite) return;
    setStatus("กำลังพากย์ rewrite...");
    try {
      await playNarration({ text: rewrite, voiceId: "Charon" });
      setStatus("กำลังเล่นเสียง");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function copyRewrite() {
    await navigator.clipboard.writeText(rewrite || summary || "");
    setStatus("คัดลอกเนื้อหาแล้ว");
  }

  useEffect(() => {
    void loadFeed();
  }, []);

  return (
    <section>
      <PageHeader
        icon={<Radio className="h-8 w-8 text-crimson-500" />}
        title="คลื่นหลอน"
        highlight="THE GHOST RADIO"
        description="ฟีด RSS จาก YouTube พร้อม workflow สำหรับต่อยอดเป็นสรุป, Ghost Rewrite และ TTS"
        action={
          <Button variant="panel" onClick={loadFeed}>
            <RefreshCcw className="h-4 w-4" />
            รีเฟรชคลื่น
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <div>
          {loading ? (
            <LoadingState label="กำลังปรับจูนคลื่นวิญญาณ..." />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {items.map((item) => (
                <Card key={`${item.link}-${item.pubDate}`} className="group h-full overflow-hidden transition-all hover:-translate-y-1 hover:border-crimson-700">
                  <div className="relative aspect-video overflow-hidden bg-black">
                    <img
                      src={item.thumbnail || "https://images.unsplash.com/photo-1505635552518-3448ff116af3?q=80&w=600&auto=format&fit=crop"}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute right-3 top-3 flex items-center gap-1 rounded-md border border-white/10 bg-black/70 px-3 py-1 text-[10px] text-white">
                      <Play className="h-3 w-3 text-red-500" />
                      YouTube
                    </div>
                  </div>
                  <CardContent className="space-y-3 pt-4">
                    <h3 className="line-clamp-2 font-semibold leading-snug text-gray-100">{item.title}</h3>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <StatusBadge>{item.source === "youtube" ? "เรื่องเล่า" : "Mock"}</StatusBadge>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatThaiDate(item.pubDate)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant="panel" size="sm" onClick={() => selectItem(item)}>
                        เลือกคลิป
                      </Button>
                      <a href={item.link} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-dark-600 bg-dark-800/80 text-sm font-semibold text-gray-300 transition hover:border-crimson-600 hover:text-white">
                        <ExternalLink className="h-4 w-4" />
                        ต้นฉบับ
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <GlassPanel className="sticky top-24 h-fit space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-crimson-500">Content Pipeline</p>
            <h2 className="mt-1 text-xl font-semibold text-gray-100">{selectedItem?.title || "ยังไม่ได้เลือกคลิป"}</h2>
            <p className="mt-2 text-sm text-gray-400">{status}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <Button variant="panel" onClick={() => void summarizeClip()} disabled={!selectedItem}>
              <FileText className="h-4 w-4" />
              สรุปจากคลิป
            </Button>
            <Button variant="crimson" onClick={() => void createGhostRewrite()} disabled={!selectedItem}>
              <Wand2 className="h-4 w-4" />
              Ghost Rewrite
            </Button>
          </div>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.25em] text-gray-500">Summary / Notes</span>
            <Textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={8} placeholder="สรุปหรือ note จากคลิปจะอยู่ตรงนี้" />
          </label>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.25em] text-gray-500">Ghost Rewrite Script</span>
            <Textarea value={rewrite} onChange={(event) => setRewrite(event.target.value)} rows={12} placeholder="สคริปต์ rewrite จะอยู่ตรงนี้" />
          </label>

          <div className="flex flex-wrap gap-3">
            <Button variant="panel" onClick={copyRewrite} disabled={!rewrite && !summary}>
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button variant="crimson" onClick={playRewrite} disabled={!rewrite}>
              พากย์ Rewrite
            </Button>
          </div>
        </GlassPanel>
      </div>
    </section>
  );
}
