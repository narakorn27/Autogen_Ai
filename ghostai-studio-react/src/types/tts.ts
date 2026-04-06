export type TtsSynthesisRequest = {
  text: string;
  voiceId: string;
  secondaryVoiceId?: string;
  dialogueMode?: boolean;
};

export type TtsPlaybackState = {
  playing: boolean;
  preparing: boolean;
  error: string | null;
};
