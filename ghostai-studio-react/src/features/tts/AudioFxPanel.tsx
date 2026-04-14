import { Check, Download, Home, Loader2, Pause, Play, Radio, RefreshCw, SlidersHorizontal, Sparkles, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TtsAudioFxSettings, TtsEngineOption } from "@/types/tts";
import { cn } from "@/utils/cn";

type AudioFxPanelProps = {
  settings: TtsAudioFxSettings;
  status: string;
  assetsReady?: boolean;
  engineOptions?: readonly TtsEngineOption[];
  selectedEngineId?: string;
  audioProviderLabel?: string;
  providerStatus?: string;
  modelLabel?: string;
  voiceLabel?: string;
  apiReady?: boolean;
  checkingApi?: boolean;
  onCheckApi?: () => void;
  onSelectEngine?: (engineId: string) => void;
  onGenerateAssets?: () => void;
  generatingAssets?: boolean;
  scriptChars?: number;
  estimatedCredits?: number | null;
  limitSummary?: string;
  playing?: boolean;
  preparing?: boolean;
  disabled?: boolean;
  onChange: (settings: TtsAudioFxSettings) => void;
  onPlay: () => void;
  onStop: () => void;
  onExportFx: () => void;
  onExportRaw: () => void;
  onExportImage: () => void;
};

const FX_ITEMS = [
  { key: "reverb", title: "Reverb", desc: "เสียงก้องวังว้าง", icon: Home },
  { key: "pitchLow", title: "Pitch Low", desc: "เสียงต่ำเกินกลัว", icon: Volume2 },
  { key: "whisper", title: "Whisper", desc: "เสียงกระซิบ", icon: Radio },
  { key: "staticNoise", title: "Static", desc: "วิทยุเก่า", icon: SlidersHorizontal }
] as const;

export default function AudioFxPanel({
  settings,
  status,
  assetsReady = true,
  engineOptions = [],
  selectedEngineId,
  audioProviderLabel,
  providerStatus,
  modelLabel,
  voiceLabel,
  apiReady = false,
  checkingApi = false,
  onCheckApi,
  onSelectEngine,
  onGenerateAssets,
  generatingAssets = false,
  scriptChars = 0,
  estimatedCredits = null,
  limitSummary,
  playing = false,
  preparing = false,
  disabled,
  onChange,
  onPlay,
  onStop,
  onExportFx,
  onExportRaw,
  onExportImage
}: AudioFxPanelProps) {
  function setSetting(key: keyof TtsAudioFxSettings, value: boolean | number) {
    onChange({ ...settings, [key]: value });
  }

  if (!assetsReady) {
    return (
      <div className="space-y-6 rounded-3xl border border-crimson-950/60 bg-[#0c0b0b]/90 p-6">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-crimson-400">
            <SlidersHorizontal className="h-4 w-4" />
            เสียงพากย์ + Realtime FX
          </h3>
          <div className="mt-4 rounded-2xl border border-dark-700 bg-black/80 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-crimson-500">Narration Engine</p>
                <h4 className="mt-2 text-xl font-black text-gray-100">เลือก model ก่อนสร้างเสียง</h4>
                <p className="mt-2 text-sm text-gray-400">การ์ดนี้จะใช้เลือก engine ก่อน แล้วค่อยเปิด player, export และ Audio FX realtime ใน container เดียวกัน</p>
              </div>
              <div className="rounded-full border border-dark-700 bg-dark-900/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                {audioProviderLabel || "พร้อมเลือก"}
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {engineOptions.map((engine) => {
                const selected = engine.id === selectedEngineId;
                return (
                  <button
                    key={engine.id}
                    type="button"
                    onClick={() => onSelectEngine?.(engine.id)}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition",
                      selected ? "border-crimson-600 bg-crimson-950/25 shadow-[0_0_0_1px_rgba(220,38,38,0.2)]" : "border-dark-700 bg-dark-950/70 hover:border-crimson-800 hover:bg-dark-950"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-gray-100">{engine.label}</span>
                          {engine.recommendation ? (
                            <span className="rounded border border-crimson-800/80 bg-crimson-950/40 px-2 py-0.5 text-[10px] font-bold uppercase text-crimson-300">
                              {engine.recommendation}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">{engine.modelId}</p>
                        <p className="mt-2 text-sm text-gray-400">{engine.description}</p>
                      </div>
                      {selected ? <Check className="h-5 w-5 shrink-0 text-crimson-400" /> : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-2xl border border-dark-700 bg-dark-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-100">พร้อมสร้างเสียง</p>
                  <p className="mt-1 text-xs text-gray-500">เลือก voice ทางซ้ายไว้ก่อน แล้วกดสร้างเพื่อเปิดส่วนฟังและ export</p>
                </div>
                <Button variant="crimson" onClick={onGenerateAssets} disabled={disabled || generatingAssets}>
                  <Sparkles className="h-4 w-4" />
                  {generatingAssets ? "กำลังเตรียม..." : "สร้างเสียง"}
                </Button>
              </div>
              <div className="mt-4 grid gap-3 border-t border-dark-700 pt-4 sm:grid-cols-3">
                <div className="rounded-xl border border-dark-700 bg-black/40 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Script</p>
                  <p className="mt-1 text-sm font-bold text-gray-100">{scriptChars.toLocaleString()} chars</p>
                </div>
                <div className="rounded-xl border border-dark-700 bg-black/40 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Quota Est.</p>
                  <p className="mt-1 text-sm font-bold text-gray-100">{estimatedCredits === null ? "-" : `${estimatedCredits.toLocaleString()} credits`}</p>
                </div>
                <div className="rounded-xl border border-dark-700 bg-black/40 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Limit</p>
                  <p className="mt-1 text-sm font-bold text-gray-100">{limitSummary || "เช็กจาก docs / dashboard"}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500">เช็กเครดิตคงเหลือจริงได้จากหน้า ElevenLabs dashboard / request log ส่วนตัวเลขในแอปนี้เป็นการประมาณจากความยาวสคริปต์</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-3xl border border-crimson-950/60 bg-[#0c0b0b]/90 p-6">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-crimson-400">
          <SlidersHorizontal className="h-4 w-4" />
          เสียงพากย์ + Realtime FX
        </h3>
        <div className="mt-4 rounded-2xl border border-dark-700 bg-black/80 p-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={playing || preparing ? onStop : onPlay}
              disabled={disabled}
              className={cn(
                "grid h-14 w-14 place-items-center rounded-full text-white shadow-[0_0_28px_rgba(220,38,38,0.45)] transition disabled:cursor-not-allowed disabled:opacity-60",
                playing ? "bg-dark-700 hover:bg-dark-600" : "bg-crimson-700 hover:bg-crimson-600"
              )}
              aria-label={preparing ? "กำลังสร้างเสียง" : playing ? "หยุดเสียง" : "เล่นเสียง"}
            >
              {preparing ? <Loader2 className="h-6 w-6 animate-spin" /> : playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </button>
            <div>
              <p className="font-bold text-white">{status}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded border border-crimson-800/80 bg-crimson-950/40 px-2 py-1 text-[10px] font-bold uppercase text-crimson-300">Ambient Mix</span>
                <span className={cn("rounded border px-2 py-1 text-[10px] font-bold uppercase", settings.ambientMix ? "border-blue-800 bg-blue-950/40 text-blue-300" : "border-dark-700 bg-dark-900 text-gray-500")}>Ambient</span>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500">toggle FX ของเสียงนี้ได้ เพื่อฟังก่อนนำไป export</p>
        </div>
      </div>

      <div className="rounded-2xl border border-dark-700 bg-black/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-crimson-400">Narration Status</p>
            <p className="mt-1 text-sm text-gray-400">เช็กสถานะการเชื่อมต่อและดู engine ที่กำลังใช้สำหรับอ่านสคริปต์</p>
          </div>
          <Button variant="panel" size="sm" onClick={onCheckApi} disabled={checkingApi}>
            {checkingApi ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Check API
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DetailBox label="Provider" value={audioProviderLabel || "-"} />
          <DetailBox label="Model" value={modelLabel || "-"} />
          <DetailBox label="Voice" value={voiceLabel || "-"} />
          <DetailBox
            label="API Status"
            value={providerStatus || (apiReady ? "พร้อมใช้งาน" : "ยังไม่ได้ตรวจสอบ")}
            tone={apiReady ? "ok" : "muted"}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Button className="min-w-0 whitespace-nowrap px-3 text-xs sm:text-sm" variant="crimson" onClick={onExportFx} disabled={disabled}>
          <Download className="h-4 w-4" />
          Export with FX
        </Button>
        <Button className="min-w-0 whitespace-nowrap px-3 text-xs sm:text-sm" variant="panel" onClick={onExportRaw} disabled={disabled}>
          <Download className="h-4 w-4" />
          Raw no FX
        </Button>
        <Button className="min-w-0 whitespace-nowrap px-3 text-xs sm:text-sm" variant="panel" onClick={onExportImage}>
          <Download className="h-4 w-4" />
          ภาพ .png
        </Button>
      </div>

      <div className="space-y-4 rounded-2xl border border-dark-700 bg-black/30 p-4">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-gray-200">
          <SlidersHorizontal className="h-4 w-4 text-crimson-500" />
          Audio FX Realtime
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {FX_ITEMS.map((item) => {
            const Icon = item.icon;
            const checked = Boolean(settings[item.key]);
            return (
              <label key={item.key} className="flex min-h-20 items-center justify-between gap-3 rounded-2xl border border-dark-700 bg-dark-950/70 p-4">
                <span className="flex min-w-0 items-center gap-3">
                  <Icon className="h-5 w-5 text-crimson-300" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-gray-100">{item.title}</span>
                    <span className="block truncate text-xs text-gray-500">{item.desc}</span>
                  </span>
                </span>
                <input className="h-5 w-5 accent-crimson-700" type="checkbox" checked={checked} onChange={(event) => setSetting(item.key, event.target.checked)} />
              </label>
            );
          })}
        </div>
        <label className="block space-y-2">
          <span className="flex justify-between text-xs font-bold uppercase tracking-widest text-gray-400">
            <span>Main Volume</span>
            <span>{Math.round(settings.masterVolume * 100)}%</span>
          </span>
          <input className="w-full accent-crimson-700" type="range" min={0.2} max={1} step={0.01} value={settings.masterVolume} onChange={(event) => setSetting("masterVolume", Number(event.target.value))} />
        </label>
      </div>
    </div>
  );
}

type DetailBoxProps = {
  label: string;
  value: string;
  tone?: "ok" | "muted";
};

function DetailBox({ label, value, tone = "muted" }: DetailBoxProps) {
  return (
    <div className="rounded-xl border border-dark-700 bg-dark-950/70 px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">{label}</p>
      <p className={cn("mt-1 text-sm font-bold", tone === "ok" ? "text-emerald-300" : "text-gray-100")}>{value}</p>
    </div>
  );
}
