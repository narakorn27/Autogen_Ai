import { CheckCircle2, Key, Loader2, Save, Search, ShieldCheck, Waves, XCircle } from "lucide-react";
import { useState } from "react";
import GlassPanel from "@/components/common/GlassPanel";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppSettings } from "@/hooks/useAppSettings";
import { testAiConnection } from "@/services/aiService";
import { checkHealth, listProviders, testGoogleSttKey } from "@/services/transcriptService";
import type { ApiTestProvider } from "@/types/ai";

type StatusTone = "idle" | "success" | "warning" | "error" | "info";
type StatusState = {
  tone: StatusTone;
  text: string;
};

function getStatusClasses(tone: StatusTone) {
  switch (tone) {
    case "success":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    case "warning":
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    case "error":
      return "border-red-500/40 bg-red-500/10 text-red-200";
    case "info":
      return "border-sky-500/40 bg-sky-500/10 text-sky-200";
    default:
      return "border-dark-700 bg-black/20 text-gray-400";
  }
}

function StatusBox({ status }: { status?: StatusState }) {
  if (!status) return null;
  return <p className={`rounded-xl border px-3 py-2 text-xs ${getStatusClasses(status.tone)}`}>{status.text}</p>;
}

export default function SettingsPage() {
  const { settings, updateSettings, saveSettings, saved } = useAppSettings();
  const [testStatus, setTestStatus] = useState<Partial<Record<ApiTestProvider, StatusState>>>({});
  const [testingProvider, setTestingProvider] = useState<ApiTestProvider | null>(null);
  const [sttStatus, setSttStatus] = useState<StatusState>({ tone: "idle", text: "ยังไม่ได้ตรวจสอบ" });
  const [sttChecking, setSttChecking] = useState(false);
  const [providerSummary, setProviderSummary] = useState("Google STT ของระบบ, Google STT ของคุณเอง");
  const [googleSttKeyStatus, setGoogleSttKeyStatus] = useState<StatusState>({ tone: "idle", text: "ยังไม่ได้ทดสอบคีย์ Google STT" });
  const [googleSttKeyChecking, setGoogleSttKeyChecking] = useState(false);

  async function handleProviderTest(provider: ApiTestProvider, apiKey: string) {
    setTestingProvider(provider);
    setTestStatus((current) => ({
      ...current,
      [provider]: { tone: "info", text: "กำลังทดสอบการเชื่อมต่อ..." }
    }));

    try {
      const result = await testAiConnection(provider, apiKey);
      setTestStatus((current) => ({
        ...current,
        [provider]: {
          tone: result.success ? "success" : "error",
          text: result.success ? "เชื่อมต่อสำเร็จ" : `เชื่อมต่อไม่สำเร็จ: ${result.message}`
        }
      }));
    } catch (error) {
      setTestStatus((current) => ({
        ...current,
        [provider]: {
          tone: "error",
          text: error instanceof Error ? error.message : String(error)
        }
      }));
    } finally {
      setTestingProvider(null);
    }
  }

  async function handleTranscriptConnectorTest() {
    setSttChecking(true);
    setSttStatus({ tone: "info", text: "กำลังตรวจสอบตัวเชื่อมต่อถอดเสียง..." });
    try {
      const [health, providers] = await Promise.all([checkHealth(), listProviders()]);
      setProviderSummary(providers.map((item) => item.label).join(", ") || "ยังไม่พบโหมดที่พร้อมใช้งาน");

      if (!health.ok) {
        setSttStatus({ tone: "error", text: `ตัวเชื่อมต่อออฟไลน์: ${health.message || "ตรวจสอบไม่สำเร็จ"}` });
        return;
      }

      if (!health.ffmpegReady || !health.ytDlpReady) {
        const missing: string[] = [];
        if (!health.ffmpegReady) missing.push("ffmpeg");
        if (!health.ytDlpReady) missing.push("yt-dlp");
        setSttStatus({
          tone: "warning",
          text: `ตัวเชื่อมต่อออนไลน์ แต่ยังขาด ${missing.join(", ")}`
        });
        return;
      }

      setSttStatus({ tone: "success", text: "ตัวเชื่อมต่อออนไลน์ และเครื่องมือหลักพร้อมใช้งาน" });
    } catch (error) {
      setSttStatus({ tone: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSttChecking(false);
    }
  }

  async function handleGoogleSttKeyTest() {
    const apiKey = settings.byoGoogleApiKey.trim() || settings.ttsKey.trim();
    if (!apiKey) {
      setGoogleSttKeyStatus({ tone: "warning", text: "กรุณากรอก Google STT API Key ก่อนทดสอบ" });
      return;
    }

    setGoogleSttKeyChecking(true);
    setGoogleSttKeyStatus({ tone: "info", text: "กำลังทดสอบ Google STT API Key..." });
    try {
      const result = await testGoogleSttKey(apiKey);
      setGoogleSttKeyStatus({
        tone: result.ok ? "success" : "error",
        text: result.detail ? `${result.message} (${result.detail})` : result.message
      });
    } catch (error) {
      setGoogleSttKeyStatus({ tone: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setGoogleSttKeyChecking(false);
    }
  }

  return (
    <section>
      <PageHeader
        icon={<Key className="h-8 w-8 text-crimson-500" />}
        title="ตั้งค่า"
        highlight="API และตัวเชื่อมต่อ"
        description="ตั้งค่าคีย์ที่ใช้งานจริงในเครื่อง ตรวจสอบการเชื่อมต่อ และเตรียมระบบถอดเสียงให้พร้อมก่อนใช้งาน"
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <GlassPanel className="space-y-5">
          <div className="rounded-2xl border border-crimson-800/40 bg-gradient-to-br from-crimson-950/30 to-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-crimson-400">API Keys</p>
            <h2 className="mt-2 text-lg font-semibold text-white">คีย์สำหรับ AI และเสียง</h2>
            <p className="mt-1 text-sm text-gray-400">ค่าพวกนี้จะถูกเก็บในเบราว์เซอร์เครื่องนี้ก่อน เพื่อใช้ทดสอบและพัฒนาใน local</p>
          </div>

          <SettingInput
            label="Gemini API Key"
            provider="gemini"
            value={settings.geminiKey}
            status={testStatus.gemini}
            testing={testingProvider === "gemini"}
            onChange={(geminiKey) => updateSettings({ geminiKey })}
            onTest={() => handleProviderTest("gemini", settings.geminiKey)}
          />
          <SettingInput
            label="Groq API Key"
            provider="groq"
            value={settings.groqKey}
            status={testStatus.groq}
            testing={testingProvider === "groq"}
            onChange={(groqKey) => updateSettings({ groqKey })}
            onTest={() => handleProviderTest("groq", settings.groqKey)}
          />
          <SettingInput
            label="OpenRouter API Key"
            provider="openrouter"
            value={settings.openRouterKey}
            status={testStatus.openrouter}
            testing={testingProvider === "openrouter"}
            onChange={(openRouterKey) => updateSettings({ openRouterKey })}
            onTest={() => handleProviderTest("openrouter", settings.openRouterKey)}
          />
          <SettingInput
            label="Google Cloud API Key (TTS)"
            provider="tts"
            value={settings.ttsKey}
            status={testStatus.tts}
            testing={testingProvider === "tts"}
            onChange={(ttsKey) => updateSettings({ ttsKey })}
            onTest={() => handleProviderTest("tts", settings.ttsKey)}
            hint="ใช้สำหรับ Text-to-Speech และใช้เป็นตัวสำรองฝั่ง STT local ได้"
          />
          <SettingInput
            label="ElevenLabs API Key"
            provider="elevenlabs"
            value={settings.elevenLabsKey}
            status={testStatus.elevenlabs}
            testing={testingProvider === "elevenlabs"}
            onChange={(elevenLabsKey) => updateSettings({ elevenLabsKey })}
            onTest={() => handleProviderTest("elevenlabs", settings.elevenLabsKey)}
          />

          <label className="block space-y-2">
            <span className="text-sm font-semibold tracking-wide text-gray-200">ผู้ให้บริการ AI หลัก</span>
            <select
              className="h-11 w-full rounded-xl border border-dark-600 bg-dark-900/90 px-4 text-sm text-gray-100 outline-none transition focus:border-crimson-600"
              value={settings.activeAiProvider}
              onChange={(event) => updateSettings({ activeAiProvider: event.target.value as typeof settings.activeAiProvider })}
            >
              <option value="gemini">Gemini</option>
              <option value="groq">Groq</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </label>

          <div className="flex flex-col justify-between gap-3 border-t border-crimson-900/30 pt-5 md:flex-row md:items-center">
            <span className="flex items-center gap-2 text-xs text-sky-300">
              <ShieldCheck className="h-3 w-3" />
              จัดเก็บใน Local Storage ของเครื่องนี้
            </span>
            <Button onClick={saveSettings} className={saved ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200" : ""}>
              <Save className="h-4 w-4" />
              {saved ? "บันทึกแล้ว" : "บันทึกการตั้งค่า"}
            </Button>
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-5">
          <div className="rounded-2xl border border-sky-700/30 bg-gradient-to-br from-sky-950/25 to-black/20 p-4">
            <div className="flex items-center gap-3 text-sky-300">
              <Waves className="h-5 w-5" />
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sky-400">Transcript</p>
                <h2 className="text-lg font-semibold text-gray-100">ตัวเชื่อมต่อ PHP + Google STT</h2>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-400">ส่วนนี้ไว้ตั้งค่าเส้นทาง connector, โหมดถอดเสียง และทดสอบคีย์ Google STT ก่อนใช้งานจริง</p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold tracking-wide text-gray-200">STT Connector URL</span>
            <Input
              value={settings.sttConnectorUrl}
              onChange={(event) => updateSettings({ sttConnectorUrl: event.target.value })}
              placeholder="http://localhost:8080"
            />
            <p className="text-xs text-gray-500">Frontend จะคุยกับ REST connector นี้เป็นหลัก เพื่อให้ย้ายจาก PHP ไป TypeScript ภายหลังได้ง่าย</p>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold tracking-wide text-gray-200">โหมดถอดเสียงเริ่มต้น</span>
            <select
              className="h-11 w-full rounded-xl border border-dark-600 bg-dark-900/90 px-4 text-sm text-gray-100 outline-none transition focus:border-crimson-600"
              value={settings.defaultTranscriptMode}
              onChange={(event) => updateSettings({ defaultTranscriptMode: event.target.value as typeof settings.defaultTranscriptMode })}
            >
              <option value="managed_google">Google STT ของระบบ</option>
              <option value="byo_google">Google STT ของคุณเอง</option>
            </select>
          </label>

          <div className="space-y-3 rounded-2xl border border-sky-700/25 bg-sky-950/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-sky-100">Google STT API Key</p>
                <p className="mt-1 text-xs text-sky-200/70">ใช้สำหรับโหมด BYO หรือให้ระบบ local fallback มาใช้คีย์นี้ตอนฝั่ง managed ยังไม่ได้ตั้งค่า</p>
              </div>
              <Button type="button" variant="panel" size="sm" onClick={() => void handleGoogleSttKeyTest()} disabled={googleSttKeyChecking}>
                {googleSttKeyChecking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                เช็กคีย์ STT
              </Button>
            </div>

            <Input
              type="password"
              value={settings.byoGoogleApiKey}
              onChange={(event) => updateSettings({ byoGoogleApiKey: event.target.value })}
              placeholder="ใส่ Google Cloud Speech-to-Text API Key"
            />

            <StatusBox status={googleSttKeyStatus} />
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-dark-700 bg-black/20 px-4 py-3 text-sm text-gray-300">
            <div>
              <span className="block font-semibold text-gray-100">แสดงตัวเลือกขั้นสูงในหน้า Feed</span>
              <span className="text-xs text-gray-500">เปิดให้เลือกโหมดถอดเสียงและคีย์ STT จากหน้า Feed ได้โดยตรง</span>
            </div>
            <input
              className="h-5 w-5 accent-crimson-700"
              type="checkbox"
              checked={settings.showAdvancedTranscriptOptions}
              onChange={(event) => updateSettings({ showAdvancedTranscriptOptions: event.target.checked })}
            />
          </label>

          <div className="rounded-2xl border border-dark-700 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-100">สถานะตัวเชื่อมต่อ</p>
                <p className="mt-1 text-xs text-gray-500">เช็กว่า PHP connector ออนไลน์ไหม และเครื่องมือฝั่งเครื่องพร้อมหรือยัง</p>
              </div>
              <Button type="button" variant="panel" size="sm" onClick={() => void handleTranscriptConnectorTest()} disabled={sttChecking}>
                {sttChecking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                ตรวจสอบ
              </Button>
            </div>

            <div className="mt-4 grid gap-3">
              <StatusBox status={sttStatus} />
              <div className="rounded-xl border border-dark-700 bg-black/20 px-3 py-2 text-xs text-gray-400">
                โหมดที่รองรับ: {providerSummary}
              </div>
            </div>
          </div>
        </GlassPanel>
      </div>
    </section>
  );
}

type SettingInputProps = {
  label: string;
  provider: ApiTestProvider;
  value: string;
  status?: StatusState;
  testing?: boolean;
  onChange: (value: string) => void;
  onTest: () => void;
  hint?: string;
};

function SettingInput({ label, provider, value, status, testing, onChange, onTest, hint }: SettingInputProps) {
  return (
    <div className="space-y-2 rounded-2xl border border-dark-700/80 bg-black/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <label className="text-sm font-semibold tracking-wide text-gray-100" htmlFor={`api-${provider}`}>
            {label}
          </label>
          {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
        </div>
        <Button type="button" variant="panel" size="sm" onClick={onTest} disabled={testing}>
          {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          ทดสอบ
        </Button>
      </div>
      <Input id={`api-${provider}`} type="password" value={value} onChange={(event) => onChange(event.target.value)} placeholder="วาง API key" />
      {status ? (
        <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${getStatusClasses(status.tone)}`}>
          {status.tone === "success" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
          {status.tone === "error" ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
          <span>{status.text}</span>
        </div>
      ) : null}
    </div>
  );
}
