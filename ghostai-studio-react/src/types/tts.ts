export type TtsSynthesisRequest = {
  text: string;
  voiceId: string;
  secondaryVoiceId?: string;
  provider?: TtsProvider;
  modelId?: string;
  dialogueMode?: boolean;
  speakingRate?: number;
  pitch?: number;
  volumeGainDb?: number;
  hauntedFx?: boolean;
  audioFx?: TtsAudioFxSettings;
};

export type TtsProvider = "google" | "elevenlabs";

export type TtsEngineOption = {
  id: string;
  provider: TtsProvider;
  label: string;
  modelId: string;
  description: string;
  recommendation?: string;
  charLimit?: number;
  creditsPerChar?: number;
  supportsThai?: boolean;
};

export type TtsPlaybackState = {
  playing: boolean;
  preparing: boolean;
  error: string | null;
};

export type TtsVoice = {
  id: string;
  name: string;
  desc: string;
  gender: "M" | "F";
  provider?: TtsProvider;
  locale?: string;
  previewUrl?: string;
  category?: string;
};

export type TtsAudioFxSettings = {
  reverb: boolean;
  pitchLow: boolean;
  whisper: boolean;
  staticNoise: boolean;
  ambientMix: boolean;
  masterVolume: number;
};
