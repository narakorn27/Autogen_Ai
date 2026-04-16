import { Copy, Dice5, Map, Send, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassPanel from "@/components/common/GlassPanel";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cleanupGeneratedStory, requestTextFromActiveProvider } from "@/services/aiService";
import { savePendingStudioTransfer } from "@/services/studioTransferService";
import type { AiProvider } from "@/types/settings";
import { cn } from "@/utils/cn";
import { getRandomThaiProvince, THAI_PROVINCES } from "@/utils/thaiProvinces";

const NARRATOR_NAMES = ["พฤกษ์", "ป้อม", "ชิน", "ธีร์", "คม", "นันท์", "เมฆ", "ภพ", "อิงฟ้า", "แพร"];
const SHOW_NAMES = ["เรื่องลับข้างทาง", "คืนหลอนเมืองไทย", "เงาใต้โคมไฟ", "ผีกระซิบ", "เล่าหลอนก่อนนอน", "เสียงจากต่างจังหวัด"];
const STYLE_OPTIONS = ["เรื่องเล่า", "ข่าว", "ตำนาน", "ประสบการณ์ตรง"] as const;
const DURATION_OPTIONS = [2, 3, 5, 10] as const;

export default function ProvinceSeriesPage() {
  const navigate = useNavigate();
  const [aiProvider, setAiProvider] = useState<AiProvider>((window.localStorage.getItem("gh_active_ai") as AiProvider) || "gemini");
  const [selectedProvinceId, setSelectedProvinceId] = useState("sa-kaeo");
  const [style, setStyle] = useState<(typeof STYLE_OPTIONS)[number]>("เรื่องเล่า");
  const [durationMinutes, setDurationMinutes] = useState<(typeof DURATION_OPTIONS)[number]>(5);
  const [goreLevel, setGoreLevel] = useState(65);
  const [notes, setNotes] = useState("");
  const [story, setStory] = useState("");
  const [status, setStatus] = useState("พร้อมสร้างเรื่องผีรายจังหวัด");
  const [loading, setLoading] = useState(false);

  const selectedProvince = useMemo(
    () => THAI_PROVINCES.find((province) => province.id === selectedProvinceId) || THAI_PROVINCES[0],
    [selectedProvinceId]
  );

  const selectedIndex = THAI_PROVINCES.findIndex((province) => province.id === selectedProvince.id);
  const wordCount = story.trim() ? story.trim().split(/\s+/).filter(Boolean).length : 0;
  const estimatedMinutes = Math.max(1, Math.ceil(wordCount / 130));

  function randomizeProvince() {
    const next = getRandomThaiProvince(selectedProvince.id);
    setSelectedProvinceId(next.id);
    setStatus(`สุ่มจังหวัดใหม่แล้ว: ${next.name}`);
  }

  async function handleGenerate() {
    setLoading(true);
    setStatus(`กำลังสร้างเรื่องผีจากจังหวัด${selectedProvince.name}...`);

    try {
      const narrator = pickRandom(NARRATOR_NAMES);
      const showName = pickRandom(SHOW_NAMES);
      const prompt = buildProvinceStoryPrompt({
        provinceName: selectedProvince.name,
        provinceRegion: selectedProvince.region,
        narrator,
        showName,
        style,
        durationMinutes,
        goreLevel,
        notes
      });

      const raw = await requestTextFromActiveProvider(prompt, aiProvider, {
        temperature: 0.88,
        maxTokens: Math.max(1600, durationMinutes * 700)
      });

      const cleaned = cleanupGeneratedStory(raw, durationMinutes);
      setStory(cleaned);
      setStatus(`สร้างสคริปต์จากจังหวัด${selectedProvince.name} เสร็จแล้ว`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!story.trim()) return;
    await navigator.clipboard.writeText(story);
    setStatus("คัดลอกสคริปต์แล้ว");
  }

  function handleSendToStudio() {
    if (!story.trim()) {
      setStatus("ต้องมีสคริปต์ก่อน ถึงจะส่งเข้า Studio ได้");
      return;
    }

    savePendingStudioTransfer({
      title: extractTitle(story, selectedProvince.name),
      script: story,
      sourceTitle: `เรื่องผีจังหวัด${selectedProvince.name}`,
      statusMessage: `นำสคริปต์จากจังหวัด${selectedProvince.name} เข้า Studio แล้ว`
    });

    navigate("/");
  }

  return (
    <section>
      <PageHeader
        icon={<Map className="h-8 w-8 text-crimson-500" />}
        title="Series 77 จังหวัด"
        description="เลือกจังหวัดในไทยหรือกดสุ่มจังหวัด แล้วสร้างเรื่องผีตามพื้นที่จริงด้วยโครงสร้างสคริปต์แบบพร้อมเล่า"
        action={
          <Button variant="panel" onClick={randomizeProvince}>
            <Dice5 className="h-4 w-4" />
            สุ่มจังหวัด
          </Button>
        }
      />

      <div className="space-y-6">
        <GlassPanel className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">เลือกจังหวัดสำหรับเรื่องผี</p>
              <p className="text-xs text-gray-400">
                จังหวัดที่เลือก: {selectedProvince.name} • {selectedProvince.region} • {selectedIndex + 1}/{THAI_PROVINCES.length}
              </p>
            </div>
            <div className="rounded-xl border border-crimson-900/40 bg-dark-900/80 px-3 py-2 text-xs text-crimson-200">
              จังหวัดที่เลือกจะถูกใช้เป็นแกนหลักของ Hook, Setup และบรรยากาศในเรื่อง
            </div>
          </div>

          <div className="ghost-scrollbar max-h-72 overflow-y-auto pr-2">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              {THAI_PROVINCES.map((province) => {
                const active = province.id === selectedProvince.id;
                return (
                  <button
                    key={province.id}
                    type="button"
                    onClick={() => setSelectedProvinceId(province.id)}
                    className={cn(
                      "rounded-lg border px-3 py-3 text-left text-sm transition",
                      active
                        ? "border-crimson-600 bg-crimson-950/45 text-white shadow-[0_0_0_1px_rgba(220,38,38,0.2)]"
                        : "border-dark-600 bg-dark-900/70 text-gray-300 hover:border-crimson-800 hover:text-white"
                    )}
                  >
                    <div className="truncate font-semibold">{province.name}</div>
                    <div className="mt-1 text-[11px] text-gray-500">{province.region}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-semibold text-white">เงื่อนไขการสร้างเรื่อง</p>
                <p className="text-xs text-gray-400">
                  ระบบจะสุ่มชื่อผู้เล่าและชื่อรายการให้เอง แล้วสร้างสคริปต์ตามจังหวัดที่เลือก โดยบังคับโครง Hook, Setup, Build-up, Climax และ Closing ครบ
                </p>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">รายละเอียดเสริม</span>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="เพิ่มแนวที่อยากได้ เช่น บ้านไม้เก่า, วัดร้าง, ไร่มัน, ป่าชายแดน, คดีหายตัว"
                  className="min-h-32"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">AI Model</span>
                  <select
                    value={aiProvider}
                    onChange={(event) => {
                      const next = event.target.value as AiProvider;
                      setAiProvider(next);
                      window.localStorage.setItem("gh_active_ai", next);
                    }}
                    className="h-11 w-full rounded-xl border border-dark-600 bg-dark-900/90 px-4 text-sm text-gray-100 outline-none transition focus:border-crimson-600"
                  >
                    <option value="gemini">Gemini</option>
                    <option value="groq">Groq</option>
                    <option value="openrouter">OpenRouter</option>
                  </select>
                </label>

                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">สไตล์การเล่า</span>
                  <div className="grid grid-cols-2 gap-2">
                    {STYLE_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setStyle(option)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-sm transition",
                          style === option
                            ? "border-crimson-600 bg-crimson-950/45 text-white"
                            : "border-dark-600 bg-dark-900/80 text-gray-300 hover:border-crimson-800 hover:text-white"
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">ความยาวสคริปต์</span>
                  <div className="grid grid-cols-2 gap-2">
                    {DURATION_OPTIONS.map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => setDurationMinutes(minutes)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-sm transition",
                          durationMinutes === minutes
                            ? "border-crimson-600 bg-crimson-950/45 text-white"
                            : "border-dark-600 bg-dark-900/80 text-gray-300 hover:border-crimson-800 hover:text-white"
                        )}
                      >
                        {minutes} นาที
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="block space-y-2">
                <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-gray-400">
                  <span>ระดับความโหด</span>
                  <span className="text-crimson-300">{goreLevel}%</span>
                </span>
                <input
                  type="range"
                  min={20}
                  max={95}
                  value={goreLevel}
                  onChange={(event) => setGoreLevel(Number(event.target.value))}
                  className="w-full accent-crimson-600"
                />
              </label>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-dark-700 bg-dark-950/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-crimson-400">Status</p>
                <p className="mt-3 text-lg font-semibold text-white">{status}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <MetricCard label="จังหวัด" value={selectedProvince.name} hint={selectedProvince.region} tone="crimson" />
                  <MetricCard label="คำโดยประมาณ" value={wordCount ? String(wordCount) : "0"} hint="หลังสร้างสคริปต์" tone="blue" />
                  <MetricCard label="เวลาพากย์" value={`${estimatedMinutes} นาที`} hint="ประเมินจากสคริปต์ปัจจุบัน" tone="violet" />
                </div>
              </div>

              <div className="rounded-2xl border border-dark-700 bg-dark-950/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400">โครงสร้างที่บังคับ</p>
                <ul className="mt-3 space-y-2 text-sm text-gray-300">
                  <li>ชื่อเรื่องบรรทัดแรก + เว้นบรรทัด</li>
                  <li>Hook เปิดรายการพร้อมชื่อผู้เล่าและชื่อรายการที่สุ่ม</li>
                  <li>Setup ใช้ประสาทสัมผัสทั้ง 5 และบรรยากาศจังหวัด</li>
                  <li>มี [JUMP_SCARE] 2 จุดในช่วงพีก</li>
                  <li>Closing ปิดด้วยคำถามค้างคา</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="crimson" onClick={handleGenerate} disabled={loading}>
              <Sparkles className="h-4 w-4" />
              {loading ? "กำลังสร้างเรื่อง..." : `สร้างจากจังหวัด ${selectedProvince.name}`}
            </Button>
            <Button variant="panel" onClick={randomizeProvince} disabled={loading}>
              <Dice5 className="h-4 w-4" />
              สุ่มจังหวัดใหม่
            </Button>
            <Button variant="panel" onClick={handleCopy} disabled={!story.trim()}>
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button variant="panel" onClick={handleSendToStudio} disabled={!story.trim()}>
              <Send className="h-4 w-4" />
              ส่งเข้า Studio
            </Button>
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">สคริปต์ที่สร้างจากจังหวัด</p>
              <p className="text-xs text-gray-400">ผลลัพธ์จะใช้จังหวัดที่เลือกเป็นแกนของเรื่อง และคงรูปแบบพร้อมเล่าไว้เลย</p>
            </div>
            <div className="rounded-xl border border-dark-700 bg-dark-950/70 px-3 py-2 text-xs text-gray-300">
              {story.trim() ? `${wordCount} คำ` : "ยังไม่มีสคริปต์"}
            </div>
          </div>

          <Textarea
            value={story}
            onChange={(event) => setStory(event.target.value)}
            placeholder="เมื่อสร้างเสร็จ สคริปต์จะขึ้นที่นี่"
            className="min-h-[28rem]"
          />
        </GlassPanel>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone
}: {
  label: string;
  value: string;
  hint: string;
  tone: "crimson" | "blue" | "violet";
}) {
  const toneClass =
    tone === "blue"
      ? "border-blue-900/70 bg-blue-950/20"
      : tone === "violet"
        ? "border-violet-900/70 bg-violet-950/20"
        : "border-crimson-900/70 bg-crimson-950/20";

  return (
    <div className={cn("rounded-2xl border p-3", toneClass)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gray-400">{label}</p>
      <p className="mt-2 text-xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  );
}

function buildProvinceStoryPrompt({
  provinceName,
  provinceRegion,
  narrator,
  showName,
  style,
  durationMinutes,
  goreLevel,
  notes
}: {
  provinceName: string;
  provinceRegion: string;
  narrator: string;
  showName: string;
  style: string;
  durationMinutes: number;
  goreLevel: number;
  notes: string;
}) {
  const extraNotes = notes.trim() ? `\nรายละเอียดเพิ่มจากผู้ใช้: ${notes.trim()}` : "";

  return `คุณคือผู้เขียนสคริปต์เรื่องผีภาษาไทยสำหรับเล่าในช่องหรือพอดแคสต์

ภารกิจ:
- เขียนเรื่องผีที่อิงจังหวัด "${provinceName}" ในภาค${provinceRegion}
- แนวการเล่า: ${style}
- ความยาวเป้าหมาย: ${durationMinutes} นาที
- ระดับความโหด/ความเข้มของภาพในหัว: ${goreLevel}/100
- ผู้เล่าที่ต้องใช้ใน Hook: "${narrator}"
- ชื่อรายการที่ต้องใช้ใน Hook: "${showName}"

กติกาสำคัญ:
- เขียนเป็นภาษาไทยล้วน
- ห้ามใช้ markdown, ตัวหนา, bullet list หรือคำอธิบายนอกเรื่อง
- บรรทัดแรกสุดต้องเป็น "ชื่อเรื่อง" แบบสั้น กระชับ น่าสนใจ
- จากนั้นเว้น 1 บรรทัด แล้วค่อยเข้าเนื้อหา
- ต้องมี [JUMP_SCARE] จำนวน 2 จุดพอดี ตรงช่วงที่เรื่องน่ากลัวที่สุด
- ใส่ <break time="500ms"/> หรือ <break time="900ms"/> ได้ตามจังหวะ แต่ใช้เท่าที่จำเป็น
- ให้บรรยากาศสมจริง ผูกกับพื้นที่ อาชีพ ผู้คน ภูมิประเทศ หรือสภาพแวดล้อมของจังหวัดนี้อย่างเป็นธรรมชาติ

โครงสร้างสคริปต์ที่ต้องมีครบ:
1) ชื่อเรื่อง
2) Hook / เปิดรายการ
   - ทักทายผู้ฟัง
   - แนะนำตัวด้วยชื่อ "${narrator}"
   - แนะนำรายการ "${showName}"
   - บอกว่าเรื่องนี้เกิดที่จังหวัด "${provinceName}"
   - บอกใบ้ว่าทำไมมันถึงน่ากลัว
3) Setup / ปูเรื่อง
   - แนะนำตัวละครหลัก สถานที่ และช่วงเวลา
   - ใช้ประสาทสัมผัสทั้ง 5
   - บรรยายกลิ่นละเอียด เช่น กลิ่นดินเปียก กลิ่นน้ำเน่า กลิ่นธูป กลิ่นเลือดคาว
   - บรรยายเสียงรอบข้าง เช่น เสียงจิ้งหรีด เสียงน้ำกระเพื่อม เสียงลมพัดกรูเกราว
   - บรรยายความรู้สึกทางกาย เช่น ขนลุกซู่ เหงื่อกาฬ หัวใจเต้นแรง ร่างกายแข็งทื่อ
4) Build-up & Climax
   - เริ่มจากสิ่งผิดปกติเล็กๆ ก่อน
   - ค่อยๆ เปิดเผยว่าสิ่งที่เจอไม่ใช่สิ่งปกติ
   - จุดพีกต้องทำให้ผู้ฟังขนลุก
   - ใช้ [JUMP_SCARE] 2 จุดในช่วงพีก
5) Closing
   - สรุปว่าเกิดอะไรขึ้นกับตัวละครหลังเหตุการณ์
   - ทิ้งคำถามปลายเปิดให้ผู้ฟัง
   - จบด้วยประโยคชวนขนลุกอีกครั้ง

ความต้องการเสริม:
- เลี่ยงตอนจบอ่อนแรงหรือสรุปแบบแห้งๆ
- ใช้ภาษาพูดที่เล่าออกเสียงได้จริง
- ทำให้รู้สึกเหมือนเรื่องนี้ถูกส่งตรงมาจากคนในพื้นที่
${extraNotes}`;
}

function pickRandom<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)] || items[0];
}

function extractTitle(story: string, provinceName: string) {
  const firstLine = story.split(/\n/).map((line) => line.trim()).find(Boolean);
  return firstLine?.replace(/^#+\s*/, "").slice(0, 80) || `เรื่องผีจาก${provinceName}`;
}
