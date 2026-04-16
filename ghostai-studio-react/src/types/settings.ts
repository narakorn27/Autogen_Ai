export type AiProvider = "gemini" | "groq" | "openrouter";

export type AppSettings = {
  geminiKey: string;
  groqKey: string;
  openRouterKey: string;
  ttsKey: string;
  elevenLabsKey: string;
  sttConnectorUrl: string;
  defaultTranscriptMode: "managed_google" | "byo_google";
  byoGoogleApiKey: string;
  showAdvancedTranscriptOptions: boolean;
  activeAiProvider: AiProvider;
  primaryVoiceId: string;
  secondaryVoiceId: string;
  reverbEnabled: boolean;
  pitchEnabled: boolean;
};
