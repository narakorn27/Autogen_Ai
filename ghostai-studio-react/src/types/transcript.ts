export type TranscriptMode = "managed_google" | "byo_google";

export type TranscriptSourceType = "youtube" | "upload";

export type TranscriptLanguageHint = "th-TH" | "en-US" | "auto";

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type TranscriptResult = {
  mode: TranscriptMode;
  providerLabel: "Google Cloud STT";
  sourceType: TranscriptSourceType;
  sourceTitle?: string;
  sourceThumbnail?: string;
  sourceDurationSec?: number;
  detectedLanguage?: string;
  text: string;
  segments: TranscriptSegment[];
  warnings: string[];
};

export type TranscriptHealth = {
  ok: boolean;
  connector: string;
  phpVersion?: string;
  ffmpegReady?: boolean;
  ytDlpReady?: boolean;
  tempWritable?: boolean;
  uploadWritable?: boolean;
  message?: string;
};

export type TranscriptProviderInfo = {
  mode: TranscriptMode;
  label: string;
  requiresUserKey: boolean;
  sourceTypes: TranscriptSourceType[];
};

export type TranscriptYoutubeRequest = {
  youtubeUrl: string;
  mode: TranscriptMode;
  byoGoogleApiKey?: string;
  languageHint?: TranscriptLanguageHint;
};

export type TranscriptUploadRequest = {
  file: File;
  mode: TranscriptMode;
  byoGoogleApiKey?: string;
  languageHint?: TranscriptLanguageHint;
};

export type ExtractedYoutubeAudio = {
  ok: boolean;
  title?: string;
  thumbnail?: string;
  audioPath?: string;
  audioUrl?: string;
  warnings: string[];
};
