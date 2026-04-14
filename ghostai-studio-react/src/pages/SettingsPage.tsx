import { Key, Loader2, Save, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";
import GlassPanel from "@/components/common/GlassPanel";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppSettings } from "@/hooks/useAppSettings";
import { testAiConnection } from "@/services/aiService";
import type { ApiTestProvider } from "@/types/ai";

export default function SettingsPage() {
  const { settings, updateSettings, saveSettings, saved } = useAppSettings();
  const [testStatus, setTestStatus] = useState<Partial<Record<ApiTestProvider, string>>>({});
  const [testingProvider, setTestingProvider] = useState<ApiTestProvider | null>(null);

  async function handleProviderTest(provider: ApiTestProvider, apiKey: string) {
    setTestingProvider(provider);
    setTestStatus((current) => ({ ...current, [provider]: "กำลังทดสอบ..." }));
    const result = await testAiConnection(provider, apiKey);
    setTestStatus((current) => ({
      ...current,
      [provider]: `${result.success ? "ผ่าน" : "ไม่ผ่าน"}: ${result.message}`
    }));
    setTestingProvider(null);
  }

  return (
    <section>
      <PageHeader
        icon={<Key className="h-8 w-8 text-crimson-500" />}
        title="Settings"
        highlight="API KEYS"
        description="จัดเก็บ key ใน localStorage เหมือนระบบเดิม แต่เรียกผ่าน settingsStorage.ts เป็นตัวกลาง"
      />

      <GlassPanel className="space-y-5">
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
          label="Google Cloud TTS Key"
          provider="tts"
          value={settings.ttsKey}
          status={testStatus.tts}
          testing={testingProvider === "tts"}
          onChange={(ttsKey) => updateSettings({ ttsKey })}
          onTest={() => handleProviderTest("tts", settings.ttsKey)}
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
          <span className="text-sm font-semibold tracking-wide text-gray-200">Active AI Provider</span>
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
          <span className="flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck className="h-3 w-3" />
            Local Storage Only
          </span>
          <Button onClick={saveSettings}>
            <Save className="h-4 w-4" />
            {saved ? "SAVED" : "SAVE KEYS"}
          </Button>
        </div>
      </GlassPanel>
    </section>
  );
}

type SettingInputProps = {
  label: string;
  provider: ApiTestProvider;
  value: string;
  status?: string;
  testing?: boolean;
  onChange: (value: string) => void;
  onTest: () => void;
};

function SettingInput({ label, provider, value, status, testing, onChange, onTest }: SettingInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-semibold tracking-wide text-gray-200" htmlFor={`api-${provider}`}>
          {label}
        </label>
        <Button type="button" variant="panel" size="sm" onClick={onTest} disabled={testing}>
          {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          ทดสอบ
        </Button>
      </div>
      <Input
        id={`api-${provider}`}
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="วาง API key"
      />
      {status ? <p className="text-xs text-gray-400">{status}</p> : null}
    </div>
  );
}
