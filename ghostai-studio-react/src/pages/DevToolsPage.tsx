import { Download, Square, Stethoscope, Volume2 } from "lucide-react";
import { useState } from "react";
import GlassPanel from "@/components/common/GlassPanel";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { downloadNarration, playNarration, splitTtsText, stopNarration, TTS_VOICES } from "@/services/ttsService";

export default function DevToolsPage() {
  const [text, setText] = useState("คืนนั้นไม่มีใครกล้าเดินผ่านบ้านหลังนั้นอีก เพราะทุกครั้งที่ไฟดับ จะมีเสียงเคาะจากด้านในตู้เสื้อผ้า");
  const [voiceId, setVoiceId] = useState("Charon");
  const [speakingRate, setSpeakingRate] = useState(0.92);
  const [pitch, setPitch] = useState(-1);
  const [hauntedFx, setHauntedFx] = useState(true);
  const [status, setStatus] = useState("พร้อมทดสอบ TTS");
  const chunks = splitTtsText(text);

  async function playTest() {
    setStatus("กำลังสร้างเสียง...");
    try {
      await playNarration({ text, voiceId, speakingRate, pitch, hauntedFx });
      setStatus("กำลังเล่นเสียง");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function exportTest() {
    setStatus("กำลัง export wav...");
    try {
      await downloadNarration({ text, voiceId, speakingRate, pitch }, "ghostai-tts-test.wav");
      setStatus("export wav แล้ว");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  function stopTest() {
    stopNarration();
    setStatus("หยุดเสียงแล้ว");
  }

  return (
    <section>
      <PageHeader
        icon={<Stethoscope className="h-8 w-8 text-crimson-500" />}
        title="Dev Tools"
        description="พื้นที่ทดสอบ TTS, split chunk, voice, rate, pitch และ export wav โดยไม่ปนกับ nav หลักของ product"
      />
      <GlassPanel className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={10} />
          <div className="space-y-4 rounded-2xl border border-dark-700 bg-black/20 p-4">
            <label className="block space-y-2 text-sm text-gray-300">
              <span className="block text-xs uppercase tracking-widest text-gray-500">Voice</span>
              <select
                className="h-11 w-full rounded-xl border border-dark-600 bg-dark-900/90 px-4 text-sm text-gray-100 outline-none"
                value={voiceId}
                onChange={(event) => setVoiceId(event.target.value)}
              >
                {TTS_VOICES.map((voice) => (
                  <option key={voice.id} value={voice.id}>{voice.name}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-2 text-sm text-gray-300">
              <span className="flex justify-between text-xs uppercase tracking-widest text-gray-500"><span>Rate</span><span>{speakingRate.toFixed(2)}</span></span>
              <input className="h-10 w-full accent-crimson-700" type="range" min={0.75} max={1.2} step={0.01} value={speakingRate} onChange={(event) => setSpeakingRate(Number(event.target.value))} />
            </label>
            <label className="block space-y-2 text-sm text-gray-300">
              <span className="flex justify-between text-xs uppercase tracking-widest text-gray-500"><span>Pitch</span><span>{pitch}</span></span>
              <input className="h-10 w-full accent-crimson-700" type="range" min={-8} max={4} step={1} value={pitch} onChange={(event) => setPitch(Number(event.target.value))} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-dark-700 bg-black/20 px-3 py-2 text-sm text-gray-300">
              <span>
                <span className="block text-xs uppercase tracking-widest text-gray-500">Haunted FX</span>
                <span className="text-xs text-gray-500">preview เท่านั้น</span>
              </span>
              <input className="h-5 w-5 accent-crimson-700" type="checkbox" checked={hauntedFx} onChange={(event) => setHauntedFx(event.target.checked)} />
            </label>
            <div className="grid gap-2">
              <Button variant="crimson" onClick={playTest}>
                <Volume2 className="h-4 w-4" />
                ทดสอบเสียง
              </Button>
              <Button variant="panel" onClick={stopTest}>
                <Square className="h-4 w-4" />
                หยุดเสียง
              </Button>
              <Button variant="ghost" onClick={exportTest}>
                <Download className="h-4 w-4" />
                Export wav
              </Button>
            </div>
            <p className="text-xs text-gray-500">{status}</p>
          </div>
        </div>
        <div className="rounded-xl border border-dark-600 bg-dark-900/80 p-4">
          <h3 className="text-sm font-semibold text-gray-200">Preview Split: {chunks.length} chunk(s)</h3>
          <pre className="mt-3 whitespace-pre-wrap text-xs leading-6 text-gray-400">
            {chunks.map((chunk, index) => `[${index}] len=${chunk.text.length}\n${chunk.text}`).join("\n\n")}
          </pre>
        </div>
      </GlassPanel>
    </section>
  );
}
