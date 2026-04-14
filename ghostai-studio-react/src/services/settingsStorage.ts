import type { AppSettings } from "@/types/settings";

const STORAGE_KEYS = {
  geminiKey: "gh_api_gemini",
  groqKey: "gh_api_groq",
  openRouterKey: "gh_api_openrouter",
  ttsKey: "gh_api_tts",
  elevenLabsKey: "gh_api_eleven",
  activeAiProvider: "gh_active_ai",
  primaryVoiceId: "gh_primary_voice",
  secondaryVoiceId: "gh_secondary_voice",
  reverbEnabled: "gh_fx_reverb",
  pitchEnabled: "gh_fx_pitch"
} as const;

export const defaultSettings: AppSettings = {
  geminiKey: "",
  groqKey: "",
  openRouterKey: "",
  ttsKey: "",
  elevenLabsKey: "",
  activeAiProvider: "gemini",
  primaryVoiceId: "Charon",
  secondaryVoiceId: "Kore",
  reverbEnabled: false,
  pitchEnabled: false
};

function getItem(key: string) {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(key) ?? "";
}

function setItem(key: string, value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

// ไฟล์นี้เป็นตัวกลาง localStorage หน้าอื่นไม่ควรเรียก localStorage ตรงๆ ถ้าไม่จำเป็น
export function loadSettings(): AppSettings {
  return {
    geminiKey: getItem(STORAGE_KEYS.geminiKey),
    groqKey: getItem(STORAGE_KEYS.groqKey),
    openRouterKey: getItem(STORAGE_KEYS.openRouterKey),
    ttsKey: getItem(STORAGE_KEYS.ttsKey),
    elevenLabsKey: getItem(STORAGE_KEYS.elevenLabsKey),
    activeAiProvider: (getItem(STORAGE_KEYS.activeAiProvider) || "gemini") as AppSettings["activeAiProvider"],
    primaryVoiceId: getItem(STORAGE_KEYS.primaryVoiceId) || defaultSettings.primaryVoiceId,
    secondaryVoiceId: getItem(STORAGE_KEYS.secondaryVoiceId) || defaultSettings.secondaryVoiceId,
    reverbEnabled: getItem(STORAGE_KEYS.reverbEnabled) === "true",
    pitchEnabled: getItem(STORAGE_KEYS.pitchEnabled) === "true"
  };
}

export function saveSettings(settings: AppSettings) {
  setItem(STORAGE_KEYS.geminiKey, settings.geminiKey);
  setItem(STORAGE_KEYS.groqKey, settings.groqKey);
  setItem(STORAGE_KEYS.openRouterKey, settings.openRouterKey);
  setItem(STORAGE_KEYS.ttsKey, settings.ttsKey);
  setItem(STORAGE_KEYS.elevenLabsKey, settings.elevenLabsKey);
  setItem(STORAGE_KEYS.activeAiProvider, settings.activeAiProvider);
  setItem(STORAGE_KEYS.primaryVoiceId, settings.primaryVoiceId);
  setItem(STORAGE_KEYS.secondaryVoiceId, settings.secondaryVoiceId);
  setItem(STORAGE_KEYS.reverbEnabled, String(settings.reverbEnabled));
  setItem(STORAGE_KEYS.pitchEnabled, String(settings.pitchEnabled));
}
