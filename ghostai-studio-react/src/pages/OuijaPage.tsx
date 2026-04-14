import { Copy, Flame, Layout, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import GlassPanel from "@/components/common/GlassPanel";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestTextFromActiveProvider } from "@/services/aiService";
import { cn } from "@/utils/cn";

type SpiritLog = {
  question: string;
  answer: string;
  board: string;
};

const BOARD_ROWS = [
  ["ก", "ข", "ค", "ฆ", "ง", "จ", "ฉ", "ช", "ซ", "ฌ"],
  ["ญ", "ฎ", "ฏ", "ฐ", "ฑ", "ฒ", "ณ", "ด", "ต", "ถ"],
  ["ท", "ธ", "น", "บ", "ป", "ผ", "ฝ", "พ", "ฟ", "ภ"],
  ["ม", "ย", "ร", "ล", "ว", "ศ", "ษ", "ส", "ห", "ฬ"],
  ["ทางเข้า", "ที่พัก", "ทางออก"],
  ["อ", "ฮ", "ะ", "า", "ำ", "ๆ", "ฤ", "ฦ", "ห์", "ฯ"],
  ["ั", "ิ", "ี", "ึ", "ื", "ุ", "ู", "เ", "แ", "โ"],
  ["ใ", "ไ", "็", "่", "้", "๊", "๋", "์", "๚", "๛"],
  ["+", "๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘"],
  ["๙", "ชาย", "หญิง", "ใช่", "ไม่ใช่"]
];

const FLAT_KEYS = BOARD_ROWS.flat();

function normalizeBoardAnswer(value: string) {
  const direct = value.trim();
  if (FLAT_KEYS.includes(direct)) return direct;
  if (/ใช่|yes|จริง/i.test(direct)) return "ใช่";
  if (/ไม่|no/i.test(direct)) return "ไม่ใช่";
  if (/ชาย/i.test(direct)) return "ชาย";
  if (/หญิง/i.test(direct)) return "หญิง";
  if (/ออก|bye|goodbye/i.test(direct)) return "ทางออก";
  return [...direct.replace(/\s+/g, "")].find((char) => FLAT_KEYS.includes(char)) || "ที่พัก";
}

function getKeyPosition(target: string) {
  for (let rowIndex = 0; rowIndex < BOARD_ROWS.length; rowIndex += 1) {
    const columnIndex = BOARD_ROWS[rowIndex].indexOf(target);
    if (columnIndex >= 0) {
      const row = BOARD_ROWS[rowIndex];
      return {
        x: ((columnIndex + 0.5) / row.length) * 100,
        y: ((rowIndex + 0.5) / BOARD_ROWS.length) * 100
      };
    }
  }
  return { x: 50, y: 50 };
}

function createBoardPath(board: string) {
  if (["ใช่", "ไม่ใช่", "ชาย", "หญิง", "ทางเข้า", "ที่พัก", "ทางออก"].includes(board)) return [board];
  const chars = [...board].filter((char) => FLAT_KEYS.includes(char));
  return chars.length ? chars : [board || "ที่พัก"];
}

export default function OuijaPage() {
  const [question, setQuestion] = useState("มีใครอยู่ที่นี่ไหม");
  const [answer, setAnswer] = useState("");
  const [boardAnswer, setBoardAnswer] = useState("");
  const [activeKey, setActiveKey] = useState("ที่พัก");
  const [boardPath, setBoardPath] = useState<string[]>(["ที่พัก"]);
  const [history, setHistory] = useState<SpiritLog[]>([]);
  const [loading, setLoading] = useState(false);

  const planchettePosition = useMemo(() => getKeyPosition(activeKey), [activeKey]);

  useEffect(() => {
    if (!boardPath.length) return;
    let index = 0;
    setActiveKey(boardPath[0]);
    const timer = window.setInterval(() => {
      index += 1;
      if (index >= boardPath.length) {
        window.clearInterval(timer);
        return;
      }
      setActiveKey(boardPath[index]);
    }, 460);
    return () => window.clearInterval(timer);
  }, [boardPath]);

  async function askSpirit() {
    setLoading(true);
    setAnswer("แก้วกำลังเคลื่อน...");
    const prompt = `ตอบคำถามผีถ้วยแก้วเป็นภาษาไทยแบบสั้นและหลอน
คำถาม: ${question}
ตอบ JSON เท่านั้น รูปแบบ {"message":"ข้อความตอบกลับ","board":"คำสั้นบนกระดาน"}
field board ควรเป็นคำสั้น เช่น ใช่, ไม่ใช่, ชาย, หญิง, ทางออก หรือคำไทยไม่เกิน 6 ตัว`;

    try {
      const raw = await requestTextFromActiveProvider(prompt, undefined, { temperature: 0.8, maxTokens: 300 });
      const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw) as { message?: string; board?: string };
      const board = normalizeBoardAnswer(json.board || json.message || raw);
      const message = json.message || raw;
      setAnswer(message);
      setBoardAnswer(board);
      setBoardPath(createBoardPath(board));
      setHistory((current) => [{ question, answer: message, board }, ...current].slice(0, 6));
    } catch {
      const board = Math.random() > 0.5 ? "ใช่" : "ไม่ใช่";
      const message = "มีบางอย่างตอบกลับมา... แต่มันไม่ยอมบอกชื่อของมัน";
      setAnswer(message);
      setBoardAnswer(board);
      setBoardPath(createBoardPath(board));
      setHistory((current) => [{ question, answer: message, board }, ...current].slice(0, 6));
    } finally {
      setLoading(false);
    }
  }

  async function copyAnswer() {
    await navigator.clipboard.writeText(`${question}\n\n${answer}\n\nแก้วหยุดที่: ${boardAnswer}`);
  }

  function clearSession() {
    setAnswer("");
    setBoardAnswer("");
    setBoardPath(["ที่พัก"]);
    setHistory([]);
  }

  return (
    <section>
      <PageHeader
        icon={<Layout className="h-8 w-8 text-crimson-500" />}
        title="Ouija Board"
        description="กระดานผีถ้วยแก้วเวอร์ชัน React พร้อม planchette animation, board path และบันทึกคำตอบ"
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <GlassPanel className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <Input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="ถามวิญญาณ..." />
            <Button variant="crimson" onClick={askSpirit} disabled={loading}>
              <Flame className="h-4 w-4" />
              {loading ? "กำลังถาม..." : "เริ่มถาม"}
            </Button>
          </div>

          <div className="rounded-[28px] border border-amber-200/20 bg-gradient-to-br from-[#5a321d] to-[#170908] p-4 shadow-2xl">
            <div className="relative overflow-hidden rounded-[22px] border-[10px] border-[#2f170d] bg-[#d5b17a] p-4 text-[#1e1107]">
              <div
                className="pointer-events-none absolute z-20 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-100/80 bg-amber-100/30 shadow-[0_18px_44px_rgba(0,0,0,0.55)] backdrop-blur-sm transition-all duration-500 ease-out"
                style={{ left: `${planchettePosition.x}%`, top: `${planchettePosition.y}%` }}
              >
                <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-100 bg-[#20100a]" />
                <div className="absolute inset-2 rounded-full border border-crimson-900/30" />
              </div>

              <div className="grid gap-1">
                {BOARD_ROWS.map((row, rowIndex) => (
                  <div key={rowIndex} className={cn("grid gap-1", row.length <= 5 ? "grid-cols-5" : "grid-cols-10")}>
                    {row.map((key) => (
                      <div
                        key={`${rowIndex}-${key}`}
                        className={cn(
                          "flex min-h-14 items-center justify-center rounded border border-[#4f2b15]/70 bg-amber-100/20 px-2 text-center font-serif text-lg font-bold transition-all duration-300",
                          key.length > 1 && "text-sm",
                          activeKey === key && "scale-105 border-crimson-700 bg-crimson-800 text-white shadow-[0_0_24px_rgba(153,27,27,0.5)]"
                        )}
                      >
                        {key}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-crimson-900/40 bg-dark-900/80 p-4">
            <div className="text-xs uppercase tracking-widest text-gray-500">Spirit Reply</div>
            <p className="mt-2 text-gray-100">{answer || "ถามคำถามเพื่อเริ่มพิธี"}</p>
            {boardAnswer ? <p className="mt-2 text-sm text-crimson-300">แก้วหยุดที่: {boardAnswer}</p> : null}
          </div>
        </GlassPanel>

        <GlassPanel className="h-fit space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-crimson-500">Session Log</p>
            <h2 className="mt-1 text-xl font-semibold text-gray-100">เสียงที่ตอบกลับมา</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="panel" size="sm" onClick={copyAnswer} disabled={!answer}>
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSession}>
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </div>
          <div className="space-y-3">
            {history.length ? history.map((entry, index) => (
              <div key={`${entry.question}-${index}`} className="rounded-2xl border border-dark-700 bg-black/20 p-3 text-sm">
                <p className="text-gray-400">ถาม: {entry.question}</p>
                <p className="mt-2 text-gray-100">ตอบ: {entry.answer}</p>
                <p className="mt-1 text-xs text-crimson-300">กระดาน: {entry.board}</p>
              </div>
            )) : (
              <p className="text-sm text-gray-500">ยังไม่มีคำตอบใน session นี้</p>
            )}
          </div>
        </GlassPanel>
      </div>
    </section>
  );
}
