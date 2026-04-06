import { Key, Save, ShieldCheck } from "lucide-react";
import GlassPanel from "@/components/common/GlassPanel";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppSettings } from "@/hooks/useAppSettings";

export default function SettingsPage() {
  const { settings, updateSettings, saveSettings, saved } = useAppSettings();

  return (
    <section>
      <PageHeader
        icon={<Key className="h-8 w-8 text-crimson-500" />}
        title="Settings"
        highlight="API KEYS"
        description="จัดเก็บ key ใน localStorage เหมือนระบบเดิม แต่เรียกผ่าน settingsStorage.ts เป็นตัวกลาง"
      />

      <GlassPanel className="space-y-5">
        <SettingInput label="Gemini API Key" value={settings.geminiKey} onChange={(geminiKey) => updateSettings({ geminiKey })} />
        <SettingInput label="Groq API Key" value={settings.groqKey} onChange={(groqKey) => updateSettings({ groqKey })} />
        <SettingInput label="OpenRouter API Key" value={settings.openRouterKey} onChange={(openRouterKey) => updateSettings({ openRouterKey })} />
        <SettingInput label="Google Cloud TTS Key" value={settings.ttsKey} onChange={(ttsKey) => updateSettings({ ttsKey })} />

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
  value: string;
  onChange: (value: string) => void;
};

function SettingInput({ label, value, onChange }: SettingInputProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold tracking-wide text-gray-200">{label}</span>
      <Input type="password" value={value} onChange={(event) => onChange(event.target.value)} placeholder="วาง API key" />
    </label>
  );
}
