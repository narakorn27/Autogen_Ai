import type { AiProvider } from "./settings";

export type ApiTestProvider = AiProvider | "tts" | "elevenlabs";

export type StoryGenerationRequest = {
  keyword: string;
  genre: string;
  style: string;
  durationMinutes: number;
  goreLevel: number;
  provider: AiProvider;
};

export type AiConnectionResult = {
  success: boolean;
  message: string;
};
