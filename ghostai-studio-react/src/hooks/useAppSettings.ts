import { useCallback, useEffect, useState } from "react";
import { loadSettings, saveSettings as persistSettings } from "@/services/settingsStorage";
import type { AppSettings } from "@/types/settings";

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [saved, setSaved] = useState(false);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    setSaved(false);
  }, []);

  const saveSettings = useCallback(() => {
    persistSettings(settings);
    setSaved(true);
  }, [settings]);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 1600);
    return () => window.clearTimeout(timer);
  }, [saved]);

  return { settings, updateSettings, saveSettings, saved };
}
