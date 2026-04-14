import { Clover, Copy, Download, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AudioPlayer from "@/components/common/AudioPlayer";
import GlassPanel from "@/components/common/GlassPanel";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestTextFromActiveProvider } from "@/services/aiService";
import { playNarration } from "@/services/ttsService";

const SPIRIT_CARDS = [
  {
    name: "The Wanderer",
    thai: "เด็กหลงทาง",
    arcana: "The Fool",
    desc: "วิญญาณเด็กที่เดินหายในป่าลึก ไร้จุดหมายและคำเตือน",
    img: "https://image.pollinations.ai/prompt/dark%20gothic%20tarot%20card%20art%20of%20a%20creepy%20ghost%20child%20standing%20in%20a%20misty%20dead%20forest,%20horror%20aesthetic,%20cinematic%20lighting?width=400&height=600&nologo=true"
  },
  {
    name: "The Reaping Shadow",
    thai: "เงาสั่งตาย",
    arcana: "Death",
    desc: "ความเปลี่ยนแปลงที่มาพร้อมกลิ่นธูปและเสียงสวด",
    img: "https://image.pollinations.ai/prompt/grim%20reaper%20tarot%20card%20horror%20art,%20dark%20shadowy%20figure%20with%20a%20scythe%20in%20a%20cemetery,%20haunting?width=400&height=600&nologo=true"
  },
  {
    name: "The Drowning Echo",
    thai: "เสียงสะท้อนใต้น้ำ",
    arcana: "The Moon",
    desc: "ความกลัวที่ซ่อนอยู่ใต้ผิวน้ำที่นิ่งสงบ",
    img: "https://image.pollinations.ai/prompt/drowned%20woman%20ghost%20underwater%20tarot%20card%20art,%20pale%20skin,%20long%20black%20hair,%20dark%20watery%20void?width=400&height=600&nologo=true"
  }
];

export default function TarotPage() {
  const [question, setQuestion] = useState("คืนนี้ควรระวังอะไร");
  const [card, setCard] = useState<(typeof SPIRIT_CARDS)[number] | null>(null);
  const [reading, setReading] = useState("");
  const [loading, setLoading] = useState(false);
  const [frequency, setFrequency] = useState(50);
  const [signalLock, setSignalLock] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    const timer = window.setInterval(() => {
      frame += 1;
      drawInterference(ctx, canvas, frequency, signalLock, frame);
    }, 44);

    return () => window.clearInterval(timer);
  }, [frequency, signalLock]);

  async function drawCard() {
    const selected = SPIRIT_CARDS[Math.floor(Math.random() * SPIRIT_CARDS.length)];
    setCard(selected);
    setSignalLock(true);
    setLoading(true);
    setReading("วิญญาณกำลังกระซิบ...");
    const prompt = `คุณคือวิญญาณในไพ่ทาโรต์ horror tarot จงทำนายเป็นภาษาไทยไม่เกิน 180 คำ
คำถาม: ${question}
ไพ่: ${selected.name} (${selected.thai})
ความหมาย: ${selected.desc}
น้ำเสียง: ลึกลับ สุขุม ชวนขนลุก แต่ยังอ่านเข้าใจง่าย`;

    try {
      setReading(await requestTextFromActiveProvider(prompt, undefined, { temperature: 0.8, maxTokens: 700 }));
    } catch {
      setReading(`ข้าเห็นเงาของ ${selected.thai} เคลื่อนผ่านคำถามของเจ้า... ${selected.desc} คำตอบไม่ได้หายไปไหน เพียงแต่ยังซ่อนอยู่ในความมืดที่เจ้าไม่กล้ามอง`);
    } finally {
      setLoading(false);
    }
  }

  async function playReading() {
    if (!reading) return;
    await playNarration({ text: reading, voiceId: "Charon" });
  }

  async function copyReading() {
    if (!reading) return;
    await navigator.clipboard.writeText(`${card?.thai || "Spirit Tarot"}\n\n${reading}`);
  }

  function exportReading() {
    if (!reading) return;
    const content = [
      `# ${card?.thai || "Spirit Tarot"}`,
      "",
      `Question: ${question}`,
      `Arcana: ${card?.arcana || "-"}`,
      `Frequency: ${(88 + (frequency / 100) * 20).toFixed(1)} MHz`,
      "",
      reading
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "spirit-tarot-reading.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section>
      <PageHeader
        icon={<Clover className="h-8 w-8 text-crimson-500" />}
        title="SPIRIT TAROT"
        description="เปิดไพ่ผีพร้อม frequency interference, AI interpretation, TTS, copy และ export"
      />
      <GlassPanel className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Sparkles className="h-8 w-8 text-crimson-500" />
          <div className="relative flex h-40 flex-col items-center justify-center overflow-hidden rounded-xl border border-dark-700 bg-dark-950/80">
            <canvas ref={canvasRef} width={420} height={190} className="absolute inset-0 h-full w-full opacity-70" />
            <div className="relative z-10 font-mono text-4xl font-bold tracking-tighter text-crimson-500">
              {(88 + (frequency / 100) * 20).toFixed(1)} <span className="text-xs">MHz</span>
            </div>
            <div className="relative z-10 mt-1 text-[10px] uppercase tracking-widest text-gray-400">
              {signalLock ? "Presence Locked" : "Searching for Presence..."}
            </div>
          </div>
          <label className="block space-y-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <span className="flex justify-between"><span>Frequency Dial</span><span>{frequency}%</span></span>
            <input className="w-full accent-crimson-700" min={0} max={100} value={frequency} type="range" onChange={(event) => setFrequency(Number(event.target.value))} />
          </label>
          <Input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="ถามไพ่..." />
          <Button variant="crimson" onClick={drawCard} disabled={loading}>
            {loading ? "กำลังเปิดไพ่..." : "เปิดไพ่"}
          </Button>
          <AudioPlayer disabled={!reading || loading} label="พากย์คำทำนาย" onPlay={playReading} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="panel" size="sm" onClick={copyReading} disabled={!reading}>
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button variant="panel" size="sm" onClick={exportReading} disabled={!reading}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {card ? (
            <div className="grid gap-5 md:grid-cols-[220px_1fr]">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-crimson-800/25 blur-2xl" />
                <img src={card.img} alt={card.name} className="relative aspect-[2/3] w-full rounded-2xl border border-crimson-900/50 object-cover shadow-2xl" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">{card.thai}</h3>
                <p className="text-xs uppercase tracking-widest text-crimson-400">{card.name} / {card.arcana}</p>
                <p className="mt-4 rounded-2xl border border-dark-700 bg-black/20 p-4 whitespace-pre-wrap text-sm leading-7 text-gray-300">{reading}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">วางคำถาม แล้วกดเปิดไพ่เพื่อเริ่มพิธี</p>
          )}
        </div>
      </GlassPanel>
    </section>
  );
}

function drawInterference(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  frequency: number,
  signalLock: boolean,
  frame: number
) {
  const width = canvas.width;
  const height = canvas.height;
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(127,29,29,0.15)");
  gradient.addColorStop(0.5, "rgba(220,38,38,0.35)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = signalLock ? "#fca5a5" : "#dc2626";
  ctx.lineWidth = signalLock ? 2 : 1;
  for (let layer = 0; layer < 3; layer += 1) {
    ctx.beginPath();
    const baseY = height * (0.35 + layer * 0.14);
    ctx.moveTo(0, baseY);
    for (let x = 0; x < width; x += 2) {
      const wave = Math.sin((x + frame * (layer + 2)) / (18 + layer * 7)) * (6 + frequency / 8);
      const noise = (Math.random() - 0.5) * (signalLock ? 14 : 34);
      ctx.lineTo(x, baseY + wave + noise);
    }
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let y = frame % 18; y < height; y += 18) {
    ctx.fillRect(0, y, width, 1);
  }
}
