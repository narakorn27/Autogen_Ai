export type AiProvider = "gemini" | "groq" | "openrouter";

export type AppSettings = {
  geminiKey: string;
  groqKey: string;
  openRouterKey: string;
  ttsKey: string;
  elevenLabsKey: string;
  activeAiProvider: AiProvider;
  primaryVoiceId: string;
  secondaryVoiceId: string;
  reverbEnabled: boolean;
  pitchEnabled: boolean;
};
