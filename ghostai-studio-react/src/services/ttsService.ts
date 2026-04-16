import type { TtsEngineOption, TtsProvider, TtsSynthesisRequest, TtsVoice } from "@/types/tts";

const GOOGLE_TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";
const GOOGLE_TTS_VOICES_ENDPOINT = "https://texttospeech.googleapis.com/v1/voices";
const ELEVENLABS_VOICES_ENDPOINT = "https://api.elevenlabs.io/v1/voices";
const ELEVENLABS_TTS_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
const BLOCKED_ELEVEN_VOICE_IDS = new Set([
  "EkK5I93UQWFDigLMpZcX"
]);
const TTS_MAX_CHARS = 220;
const TTS_CONCURRENCY = 3;
const ELEVEN_TTS_CONCURRENCY = 1;
const ELEVEN_TTS_MAX_RETRIES = 2;
const TTS_CROSSFADE_SECONDS = 0.035;
const TTS_SPEAKER_GAP_SECONDS = 0.12;
const TTS_SENTENCE_MAX_CHARS = 140;
const DEFAULT_TTS_VOICE = "Neural2C";
const BREAK_TAG_GLOBAL_REGEX = /<break\s+time\s*=\s*"([^"]+)"\s*\/>/gi;
const BREAK_TOKEN_REGEX = /^\[\[gh_break:(\d+ms)\]\]$/i;

export const TTS_ENGINE_OPTIONS: readonly TtsEngineOption[] = [
  {
    id: "eleven-v3",
    provider: "elevenlabs",
    label: "ElevenLabs v3",
    modelId: "eleven_v3",
    description: "รองรับภาษาไทยตาม docs ของ ElevenLabs และให้โทนอารมณ์ได้ดีกว่า",
    recommendation: "ไทย",
    charLimit: 5000,
    creditsPerChar: 1,
    supportsThai: true
  },
  {
    id: "google-neural2",
    provider: "google",
    label: "Google TTS",
    modelId: "th-TH-Neural2-C",
    description: "นิ่ง เสถียร และเข้ากับเสียงไทยในโปรเจกต์เดิม",
    recommendation: "สำรอง",
    supportsThai: true
  }
] as const;

export const TTS_VOICES: readonly TtsVoice[] = [
  { id: "th-TH-Chirp3-HD-Algenib", name: "Algenib", gender: "M", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Algieba", name: "Algieba", gender: "M", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Alnilam", name: "Alnilam", gender: "M", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Aoede", name: "Aoede", gender: "F", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Autonoe", name: "Autonoe", gender: "F", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Achernar", name: "Achernar", gender: "F", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Achird", name: "Achird", gender: "M", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Callirrhoe", name: "Callirrhoe", gender: "F", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Charon", name: "Charon", gender: "M", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Despina", name: "Despina", gender: "F", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Enceladus", name: "Enceladus", gender: "M", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Erinome", name: "Erinome", gender: "F", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Fenrir", name: "Fenrir", gender: "M", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Gacrux", name: "Gacrux", gender: "F", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Iapetus", name: "Iapetus", gender: "M", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Kore", name: "Kore", gender: "F", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Laomedeia", name: "Laomedeia", gender: "F", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Leda", name: "Leda", gender: "F", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Orus", name: "Orus", gender: "M", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Puck", name: "Puck", gender: "M", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Pulcherrima", name: "Pulcherrima", gender: "F", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Rasalgethi", name: "Rasalgethi", gender: "M", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Sadachbia", name: "Sadachbia", gender: "M", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Sadaltager", name: "Sadaltager", gender: "M", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Schedar", name: "Schedar", gender: "F", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Sulafat", name: "Sulafat", gender: "F", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Umbriel", name: "Umbriel", gender: "M", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Vindemiatrix", name: "Vindemiatrix", gender: "F", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Zephyr", name: "Zephyr", gender: "F", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Chirp3-HD-Zubenelgenubi", name: "Zubenelgenubi", gender: "M", desc: "Chirp 3 HD voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Neural2-C", name: "Thai Neural2-C", gender: "F", desc: "Neural2 fallback voice", provider: "google", locale: "th-TH" },
  { id: "th-TH-Standard-A", name: "Thai Standard-A", gender: "F", desc: "Standard fallback voice", provider: "google", locale: "th-TH" }
] as const;

const GOOGLE_TTS_VOICE_MAP: Record<string, string> = {
  Algenib: "th-TH-Chirp3-HD-Algenib",
  Algieba: "th-TH-Chirp3-HD-Algieba",
  Alnilam: "th-TH-Chirp3-HD-Alnilam",
  Aoede: "th-TH-Chirp3-HD-Aoede",
  Autonoe: "th-TH-Chirp3-HD-Autonoe",
  Achernar: "th-TH-Chirp3-HD-Achernar",
  Achird: "th-TH-Chirp3-HD-Achird",
  Callirrhoe: "th-TH-Chirp3-HD-Callirrhoe",
  Charon: "th-TH-Chirp3-HD-Charon",
  Despina: "th-TH-Chirp3-HD-Despina",
  Enceladus: "th-TH-Chirp3-HD-Enceladus",
  Erinome: "th-TH-Chirp3-HD-Erinome",
  Fenrir: "th-TH-Chirp3-HD-Fenrir",
  Gacrux: "th-TH-Chirp3-HD-Gacrux",
  Iapetus: "th-TH-Chirp3-HD-Iapetus",
  Kore: "th-TH-Chirp3-HD-Kore",
  Laomedeia: "th-TH-Chirp3-HD-Laomedeia",
  Leda: "th-TH-Chirp3-HD-Leda",
  Orus: "th-TH-Chirp3-HD-Orus",
  Aurus: "th-TH-Chirp3-HD-Orus",
  Puck: "th-TH-Chirp3-HD-Puck",
  Pulcherrima: "th-TH-Chirp3-HD-Pulcherrima",
  Rasalgethi: "th-TH-Chirp3-HD-Rasalgethi",
  Sadachbia: "th-TH-Chirp3-HD-Sadachbia",
  Sadaltager: "th-TH-Chirp3-HD-Sadaltager",
  Schedar: "th-TH-Chirp3-HD-Schedar",
  Sulafat: "th-TH-Chirp3-HD-Sulafat",
  Umbriel: "th-TH-Chirp3-HD-Umbriel",
  Vindemiatrix: "th-TH-Chirp3-HD-Vindemiatrix",
  Zephyr: "th-TH-Chirp3-HD-Zephyr",
  Zubenelgenubi: "th-TH-Chirp3-HD-Zubenelgenubi",
  Neural2C: "th-TH-Neural2-C",
  StandardA: "th-TH-Standard-A",
  "th-TH-Neural2-C": "th-TH-Neural2-C",
  "th-TH-Standard-A": "th-TH-Standard-A",
  spirit: "th-TH-Chirp3-HD-Charon"
};

type TtsTextUnit =
  | { type: "text"; text: string }
  | { type: "break"; time: string };

type TtsChunk = {
  units: TtsTextUnit[];
  text: string;
};

type TtsSegment = {
  chunks: TtsChunk[];
  voiceId: string;
};

type ActiveFxGraph = {
  audio: HTMLAudioElement;
  whisperDryGain: GainNode;
  whisperWetGain: GainNode;
  dryGain: GainNode;
  reverbWetGain: GainNode;
  staticGain: GainNode;
  staticFilter: BiquadFilterNode;
  staticPanner?: StereoPannerNode;
  staticSource: AudioBufferSourceNode;
  toneLowShelf: BiquadFilterNode;
  toneHighCut: BiquadFilterNode;
  master: GainNode;
};

let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let activeAudioContext: AudioContext | null = null;
let decodeAudioContext: AudioContext | null = null;
let activeFxGraph: ActiveFxGraph | null = null;
let playbackGeneration = 0;
const voiceFallbackCache = new Set<string>();
let cachedGoogleVoices: TtsVoice[] | null = null;
let cachedElevenVoices: TtsVoice[] | null = null;

function getTtsKey() {
  return window.localStorage.getItem("gh_api_tts")?.trim() || "";
}

function getElevenKey() {
  return window.localStorage.getItem("gh_api_eleven")?.trim() || "";
}

function normalizeGender(gender?: string): TtsVoice["gender"] {
  return gender === "FEMALE" || gender === "female" ? "F" : "M";
}

function prettifyGoogleVoiceName(voiceName: string) {
  return voiceName
    .replace(/^th-TH-/, "")
    .replace(/^Chirp3-HD-/, "")
    .replace(/^Neural2-/, "Thai Neural2-")
    .replace(/^Standard-/, "Thai Standard-");
}

function getGoogleVoiceDescription(voiceName: string) {
  if (voiceName.includes("Chirp3-HD")) return "Chirp 3 HD voice";
  if (voiceName.includes("Neural2")) return "Neural2 fallback voice";
  if (voiceName.includes("Standard")) return "Standard fallback voice";
  return "Google TTS voice";
}

function resolveGoogleVoiceName(voiceId: string) {
  if (voiceId.startsWith("th-TH-")) return voiceId;
  return GOOGLE_TTS_VOICE_MAP[voiceId] || GOOGLE_TTS_VOICE_MAP[DEFAULT_TTS_VOICE];
}

export async function listGoogleTtsVoices(): Promise<TtsVoice[]> {
  if (cachedGoogleVoices?.length) return cachedGoogleVoices;

  const apiKey = getTtsKey();
  if (!apiKey) return [...TTS_VOICES];

  const response = await fetch(`${GOOGLE_TTS_VOICES_ENDPOINT}?key=${apiKey}&languageCode=th-TH`);
  if (!response.ok) return [...TTS_VOICES];

  const data = await response.json() as {
    voices?: Array<{ name?: string; languageCodes?: string[]; ssmlGender?: string }>;
  };

  const voices: TtsVoice[] = (data.voices || [])
    .filter((voice) => voice.name?.startsWith("th-TH-"))
    .map((voice) => ({
      id: voice.name as string,
      name: prettifyGoogleVoiceName(voice.name as string),
      gender: normalizeGender(voice.ssmlGender),
      desc: getGoogleVoiceDescription(voice.name as string),
      provider: "google" as const,
      locale: voice.languageCodes?.[0] || "th-TH"
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  cachedGoogleVoices = voices.length ? voices : [...TTS_VOICES];
  return cachedGoogleVoices;
}

export async function listElevenVoices(): Promise<TtsVoice[]> {
  if (cachedElevenVoices?.length) return cachedElevenVoices;

  const apiKey = getElevenKey();
  if (!apiKey) return [];

  const response = await fetch(ELEVENLABS_VOICES_ENDPOINT, {
    headers: { "xi-api-key": apiKey }
  });
  if (!response.ok) return [];

  const data = await response.json() as {
    voices?: Array<{
      voice_id?: string;
      name?: string;
      category?: string;
      preview_url?: string;
      labels?: Record<string, string>;
    }>;
  };

  const voices: TtsVoice[] = (data.voices || [])
    .filter((voice) => voice.voice_id && voice.name && !BLOCKED_ELEVEN_VOICE_IDS.has(voice.voice_id))
    .map((voice) => ({
      id: voice.voice_id as string,
      name: voice.name as string,
      gender: normalizeGender(voice.labels?.gender),
      desc: voice.category ? `ElevenLabs ${voice.category} voice` : "ElevenLabs voice",
      provider: "elevenlabs" as const,
      previewUrl: voice.preview_url || undefined,
      category: voice.category || undefined
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  cachedElevenVoices = voices;
  return voices;
}

function getRequestProvider(request: TtsSynthesisRequest): TtsProvider {
  return request.provider || "google";
}

function getDecodeContext() {
  if (!decodeAudioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    decodeAudioContext = new AudioContextClass();
  }
  return decodeAudioContext;
}

function normalizeBreakDuration(duration: string) {
  const raw = String(duration || "").trim().toLowerCase();
  if (/^\d+ms$/.test(raw)) return raw;
  if (/^\d+(?:\.\d+)?s$/.test(raw)) {
    const ms = Math.round(parseFloat(raw) * 1000);
    return `${Math.min(2000, Math.max(150, ms))}ms`;
  }
  return "500ms";
}

function makeBreakToken(duration: string) {
  return `[[gh_break:${normalizeBreakDuration(duration)}]]`;
}

function normalizeThaiSpeechText(text: string, preserveLineBreaks = false) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, "-")
    .replace(/\bAI\b/gi, "เอไอ")
    .replace(/\bAPI\b/gi, "เอพีไอ")
    .replace(/\bTTS\b/gi, "ทีทีเอส")
    .replace(/\bSSML\b/gi, "เอสเอสเอ็มแอล")
    .replace(/\bGoogle\b/gi, "กูเกิล")
    .replace(/\bGroq\b/gi, "กร็อก")
    .replace(/\bOpenRouter\b/gi, "โอเพนเราเตอร์")
    .replace(/(?:^|[\s(])((?:[\u0E01-\u0E4E\u0E30-\u0E3A\u0E40-\u0E44]\s+){2,}[\u0E01-\u0E4E\u0E30-\u0E3A\u0E40-\u0E44])(?=$|[\s),.!?])/g, (full, group: string) => full.replace(group, group.replace(/\s+/g, "")))
    .replace(/([\u0E01-\u0E59])[ \t]+([\u0E31-\u0E4E\u0E33])+/g, "$1$2")
    .replace(preserveLineBreaks ? /[ \t]{2,}/g : /\s{2,}/g, " ")
    .trim();
}

function cleanTtsText(text: string) {
  return normalizeThaiSpeechText(text)
    .replace(/\[JUMP_SCARE\]/gi, " ")
    .replace(/<break[^>]*\/>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\[\]*#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNarrationMarkup(text: string) {
  return addNarrationBreathingBreaks(
    normalizeThaiSpeechText(text, true)
    .replace(/\r/g, "")
    .replace(BREAK_TAG_GLOBAL_REGEX, (_, duration: string) => ` ${makeBreakToken(duration)} `)
    .replace(/\[JUMP_SCARE\]/gi, ` ${makeBreakToken("650ms")} `)
    .replace(/<[^>]+>/g, " ")
    .replace(/[\*#]/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, ` ${makeBreakToken("950ms")} `)
    .replace(/\n{2}/g, ` ${makeBreakToken("750ms")} `)
    .replace(/\n/g, ` ${makeBreakToken("420ms")} `)
    .replace(/[ \t]{2,}/g, " ")
    .trim()
  );
}

function addNarrationBreathingBreaks(text: string) {
  return text
    .split(/(\[\[gh_break:\d+ms\]\])/g)
    .map((part) => {
      if (!part || BREAK_TOKEN_REGEX.test(part.trim())) return part;
      return part
        .replace(/([,ï¼Œ])(?!\s*\[\[gh_break:)/g, `$1 ${makeBreakToken("180ms")} `)
        .replace(/([.!?â€¦à¸¯])(?!\s*\[\[gh_break:)/g, `$1 ${makeBreakToken("320ms")} `)
        .replace(/\s+/g, " ");
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureSentenceEnding(text: string) {
  const trimmed = String(text || "").trim();
  return trimmed;
}

function splitByHardLimit(text: string, maxLength = TTS_SENTENCE_MAX_CHARS) {
  const clean = cleanTtsText(text);
  if (!clean) return [];
  if (clean.length <= maxLength) return [ensureSentenceEnding(clean)];

  const fragments: string[] = [];
  let cursor = 0;

  while (cursor < clean.length) {
    let end = Math.min(cursor + maxLength, clean.length);
    if (end < clean.length) {
      const searchStart = Math.max(cursor + Math.floor(maxLength * 0.55), cursor);
      const slice = clean.slice(searchStart, end);
      const splitAt = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf(","), slice.lastIndexOf(";"), slice.lastIndexOf(":"));
      if (splitAt > 0) end = searchStart + splitAt;
    }

    const fragment = clean.slice(cursor, end).trim();
    if (fragment) fragments.push(ensureSentenceEnding(fragment));
    cursor = end;
    while (clean[cursor] === " ") cursor += 1;
  }

  return fragments;
}

function splitTextToSentenceUnits(text: string): TtsTextUnit[] {
  const clean = cleanTtsText(text);
  if (!clean) return [];

  const sentences = clean
    .split(/(?<=[.!?â€¦à¸¯])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const baseUnits = sentences.length ? sentences : splitByHardLimit(clean, TTS_SENTENCE_MAX_CHARS);
  return baseUnits.flatMap((unit) => {
    if (unit.length > TTS_SENTENCE_MAX_CHARS) {
      return splitByHardLimit(unit, TTS_SENTENCE_MAX_CHARS).map((text) => ({ type: "text" as const, text }));
    }

    const normalized = ensureSentenceEnding(unit);
    return normalized ? [{ type: "text" as const, text: normalized }] : [];
  });
}

function tokenizeTtsInput(text: string): TtsTextUnit[] {
  const normalized = normalizeNarrationMarkup(text);
  if (!normalized) return [];

  return normalized
    .split(/(\[\[gh_break:\d+ms\]\])/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const breakMatch = part.match(BREAK_TOKEN_REGEX);
      if (breakMatch) return [{ type: "break" as const, time: breakMatch[1] }];
      return splitTextToSentenceUnits(part);
    });
}

function chunkHasText(units: TtsTextUnit[]) {
  return units.some((unit) => unit.type === "text" && unit.text.trim());
}

function chunkPreview(units: TtsTextUnit[]) {
  return units
    .map((unit) => (unit.type === "break" ? `<break time="${unit.time}"/>` : unit.text))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitTtsText(text: string, maxLength = TTS_MAX_CHARS): TtsChunk[] {
  const units = tokenizeTtsInput(text);
  if (!units.length) return [];

  const chunks: TtsChunk[] = [];
  let currentUnits: TtsTextUnit[] = [];
  let currentTextLength = 0;

  for (const unit of units) {
    if (unit.type === "break") {
      if (currentUnits.length) currentUnits.push(unit);
      continue;
    }

    const candidateLength = currentTextLength ? currentTextLength + 1 + unit.text.length : unit.text.length;
    if (candidateLength > maxLength && chunkHasText(currentUnits)) {
      chunks.push({ units: [...currentUnits], text: chunkPreview(currentUnits) });
      currentUnits = [];
      currentTextLength = 0;
    }

    currentUnits.push(unit);
    currentTextLength = currentTextLength ? currentTextLength + 1 + unit.text.length : unit.text.length;
  }

  if (chunkHasText(currentUnits)) chunks.push({ units: [...currentUnits], text: chunkPreview(currentUnits) });
  return chunks;
}

function decodeBase64Audio(base64Data: string) {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function decodeAudioContentToBuffer(base64Data: string) {
  const bytes = decodeBase64Audio(base64Data);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return await getDecodeContext().decodeAudioData(arrayBuffer.slice(0));
}

function escapeSsml(text: string) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildChunkSsml(chunk: TtsChunk) {
  const ssmlParts = chunk.units.map((unit) => {
    if (unit.type === "break") return `<break time="${unit.time}"/>`;
    const text = ensureSentenceEnding(unit.text);
    return text ? `<s>${escapeSsml(text)}</s>` : "";
  });
  return `<speak>${ssmlParts.join("")}</speak>`;
}

function buildChunkPlainText(chunk: TtsChunk) {
  return chunk.units
    .map((unit) => {
      if (unit.type === "break") {
        const milliseconds = Number.parseInt(unit.time, 10);
        if (Number.isFinite(milliseconds) && milliseconds >= 700) return "\n\n";
        if (Number.isFinite(milliseconds) && milliseconds >= 320) return "\n";
        return ", ";
      }
      return unit.text;
    })
    .join(" ")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function getVoiceRequestConfig(voiceId: string, request: TtsSynthesisRequest) {
  const voiceName = resolveGoogleVoiceName(voiceId);
  const defaultSpeakingRate = voiceName.includes("Neural2") ? 0.88 : voiceName.includes("Standard") ? 0.9 : 0.92;
  return {
    voiceName,
    speakingRate: request.speakingRate ?? defaultSpeakingRate
  };
}

async function readGoogleTtsError(response: Response) {
  const raw = await response.text();
  try {
    const data = JSON.parse(raw) as { error?: { message?: string; status?: string } };
    return data.error?.message || data.error?.status || raw;
  } catch {
    return raw || `HTTP ${response.status}`;
  }
}

async function readElevenError(response: Response) {
  const raw = await response.text();
  try {
    const data = JSON.parse(raw) as { detail?: { message?: string } | string };
    const detail = typeof data.detail === "string" ? data.detail : data.detail?.message || raw;
    if (response.status === 429) {
      return `ElevenLabs 429: rate limit or free-plan concurrency is temporarily full (${detail}). Wait a bit and try again.`;
    }
    return detail;
  } catch {
    if (response.status === 429) {
      return "ElevenLabs 429: rate limit or free-plan concurrency is temporarily full. Wait a bit and try again.";
    }
    return raw || `HTTP ${response.status}`;
  }
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function getRetryAfterMilliseconds(response: Response) {
  const retryAfter = response.headers.get("retry-after")?.trim();
  if (!retryAfter) return null;

  const asSeconds = Number.parseFloat(retryAfter);
  if (Number.isFinite(asSeconds)) {
    return Math.max(250, Math.round(asSeconds * 1000));
  }

  const asDate = Date.parse(retryAfter);
  if (Number.isFinite(asDate)) {
    return Math.max(250, asDate - Date.now());
  }

  return null;
}

function isFatalGoogleTtsError(message: string) {
  return /api key not valid|API_KEY_INVALID|API has not been used|has not been enabled|permission|PERMISSION_DENIED|billing|quota/i.test(message);
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function fetchGoogleTtsBuffer(chunk: TtsChunk, request: TtsSynthesisRequest, voiceName: string, useVoiceControls = true): Promise<AudioBuffer | null> {
  const apiKey = getTtsKey();
  const response = await fetch(`${GOOGLE_TTS_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { ssml: buildChunkSsml(chunk) },
      voice: { languageCode: "th-TH", name: voiceName },
      audioConfig: {
        audioEncoding: "LINEAR16",
        ...(useVoiceControls ? { speakingRate: getVoiceRequestConfig(request.voiceId, request).speakingRate } : {})
      }
    })
  });

  if (!response.ok) {
    const errorMessage = await readGoogleTtsError(response);
    if (response.status === 400 && /sentences that are too long/i.test(errorMessage) && chunk.text.length > 80) {
      const fallbackChunks = splitTtsText(chunk.text, Math.max(90, Math.floor(TTS_MAX_CHARS * 0.7)));
      const fallbackBuffers = await mapWithConcurrency(
        fallbackChunks,
        Math.min(2, fallbackChunks.length),
        async (fragment) => await fetchGoogleTtsBuffer(fragment, request, voiceName, useVoiceControls)
      );
      return await renderAudioSequence(fallbackBuffers);
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  if (!data.audioContent) return null;
  return await decodeAudioContentToBuffer(data.audioContent);
}

async function getElevenVoiceId(requestedVoiceId?: string) {
  if (requestedVoiceId) return requestedVoiceId;
  const apiKey = getElevenKey();
  if (!apiKey) throw new Error("Missing ElevenLabs API Key. Please add it in Settings first.");

  const response = await fetch(ELEVENLABS_VOICES_ENDPOINT, {
    headers: { "xi-api-key": apiKey }
  });

  if (!response.ok) {
    throw new Error(await readElevenError(response));
  }

  const data = await response.json() as { voices?: Array<{ voice_id?: string; category?: string }> };
  const voices = (data.voices || []).filter((voice) => voice.voice_id && !BLOCKED_ELEVEN_VOICE_IDS.has(voice.voice_id));
  const preferredVoice =
    voices.find((voice) => voice.category === "premade" && voice.voice_id) ||
    voices.find((voice) => voice.voice_id);

  if (!preferredVoice?.voice_id) {
    throw new Error("No ElevenLabs voice found for this account.");
  }

  return preferredVoice.voice_id;
}

async function callElevenLabsTts(chunk: TtsChunk, request: TtsSynthesisRequest) {
  const apiKey = getElevenKey();
  if (!apiKey) throw new Error("Missing ElevenLabs API Key. Please add it in Settings first.");

  const voiceId = await getElevenVoiceId(request.voiceId);
  let attempt = 0;

  while (attempt <= ELEVEN_TTS_MAX_RETRIES) {
    const response = await fetch(`${ELEVENLABS_TTS_ENDPOINT}/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey
      },
      body: JSON.stringify({
        text: buildChunkPlainText(chunk),
        model_id: request.modelId || "eleven_v3",
        ...(request.modelId === "eleven_v3" ? { language_code: "th" } : {}),
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75
        },
        output_format: "mp3_44100_128"
      })
    });

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      return await getDecodeContext().decodeAudioData(arrayBuffer.slice(0));
    }

    if (response.status === 429 && attempt < ELEVEN_TTS_MAX_RETRIES) {
      const waitMilliseconds = getRetryAfterMilliseconds(response) ?? 1200 * (attempt + 1);
      await sleep(waitMilliseconds);
      attempt += 1;
      continue;
    }

    throw new Error(await readElevenError(response));
  }

  throw new Error("ElevenLabs rate limit: retry failed. Wait a bit and try again.");
}

async function callGoogleTts(chunk: TtsChunk, request: TtsSynthesisRequest) {
  const apiKey = getTtsKey();
  if (!apiKey) throw new Error("à¹„à¸¡à¹ˆà¸¡à¸µ Google Cloud TTS Key à¸à¸£à¸¸à¸“à¸²à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¹ƒà¸™à¸«à¸™à¹‰à¸² Settings à¸à¹ˆà¸­à¸™");

  const voiceName = getVoiceRequestConfig(request.voiceId, request).voiceName;
  if (voiceFallbackCache.has(voiceName)) {
    return await fetchGoogleTtsBuffer(chunk, { ...request, voiceId: DEFAULT_TTS_VOICE, pitch: 0 }, GOOGLE_TTS_VOICE_MAP[DEFAULT_TTS_VOICE], true);
  }

  try {
    return await fetchGoogleTtsBuffer(chunk, request, voiceName, true);
  } catch (firstError) {
    const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
    if (isFatalGoogleTtsError(firstMessage)) throw new Error(firstMessage);

    try {
      return await fetchGoogleTtsBuffer(chunk, request, voiceName, false);
    } catch (secondError) {
      const secondMessage = secondError instanceof Error ? secondError.message : String(secondError);
      if (isFatalGoogleTtsError(secondMessage)) throw new Error(secondMessage);

      if (voiceName !== GOOGLE_TTS_VOICE_MAP[DEFAULT_TTS_VOICE]) {
        voiceFallbackCache.add(voiceName);
        console.warn(`[GhostAI] Google TTS voice ${voiceName} failed, fallback to ${GOOGLE_TTS_VOICE_MAP[DEFAULT_TTS_VOICE]}: ${secondMessage}`);
        try {
          return await fetchGoogleTtsBuffer(chunk, { ...request, voiceId: DEFAULT_TTS_VOICE, pitch: 0 }, GOOGLE_TTS_VOICE_MAP[DEFAULT_TTS_VOICE], true);
        } catch {
          throw new Error(`Google Cloud TTS voice ${voiceName} failed and Neural2-C fallback also failed: ${secondMessage}`);
        }
      }
      throw new Error(firstMessage);
    }
  }
}

function stripSpeakerName(text: string) {
  return text.replace(/^[^:ï¼š]{1,28}[:ï¼š]\s*/, "").trim();
}

function createTtsSegments(request: TtsSynthesisRequest): TtsSegment[] {
  if (!request.dialogueMode || !request.secondaryVoiceId) {
    return [{ chunks: splitTtsText(request.text), voiceId: request.voiceId }];
  }

  const lines = request.text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  return lines.map((line, index) => {
    const voiceId = index % 2 === 0 ? request.voiceId : request.secondaryVoiceId || request.voiceId;
    const cleanLine = stripSpeakerName(line) || line;
    return { chunks: splitTtsText(cleanLine), voiceId };
  });
}

function createSilentAudioBuffer(sampleRate: number, numberOfChannels: number, durationSeconds: number) {
  return new AudioBuffer({
    length: Math.max(1, Math.floor(sampleRate * durationSeconds)),
    numberOfChannels,
    sampleRate
  });
}

async function renderAudioSequence(audioBuffers: Array<AudioBuffer | null>, { gapSeconds = 0, crossfadeSeconds = TTS_CROSSFADE_SECONDS } = {}) {
  const usableBuffers = audioBuffers.filter((buffer): buffer is AudioBuffer => Boolean(buffer));
  if (!usableBuffers.length) return null;
  if (usableBuffers.length === 1 && gapSeconds <= 0) return usableBuffers[0];

  const sampleRate = usableBuffers[0].sampleRate;
  const numberOfChannels = usableBuffers.reduce((max, buffer) => Math.max(max, buffer.numberOfChannels), 1);
  const overlapSeconds = gapSeconds > 0 ? 0 : crossfadeSeconds;
  const overlapFrames = Math.max(0, Math.floor(sampleRate * overlapSeconds));
  const gapFrames = Math.max(0, Math.floor(sampleRate * gapSeconds));

  let totalFrames = 0;
  for (let index = 0; index < usableBuffers.length; index += 1) {
    totalFrames += usableBuffers[index].length;
    if (index > 0) {
      totalFrames += gapFrames;
      totalFrames -= overlapFrames;
    }
  }

  const offline = new OfflineAudioContext(numberOfChannels, Math.max(totalFrames, 1), sampleRate);
  let cursorSeconds = 0;

  usableBuffers.forEach((buffer, index) => {
    const source = offline.createBufferSource();
    source.buffer = buffer;

    const gainNode = offline.createGain();
    source.connect(gainNode);
    gainNode.connect(offline.destination);

    const startTime = cursorSeconds;
    const endTime = startTime + buffer.duration;
    const fadeDuration = Math.min(crossfadeSeconds, buffer.duration / 4);

    if (gapSeconds <= 0 && fadeDuration > 0) {
      if (index > 0) {
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(1, startTime + fadeDuration);
      } else {
        gainNode.gain.setValueAtTime(1, startTime);
      }

      if (index < usableBuffers.length - 1) {
        gainNode.gain.setValueAtTime(1, Math.max(startTime, endTime - fadeDuration));
        gainNode.gain.linearRampToValueAtTime(0, endTime);
      } else {
        gainNode.gain.setValueAtTime(1, endTime);
      }
    } else {
      gainNode.gain.setValueAtTime(1, startTime);
    }

    source.start(startTime);
    cursorSeconds = endTime + gapSeconds - overlapSeconds;
  });

  return await offline.startRendering();
}

async function synthesizeSegment(segment: TtsSegment, request: TtsSynthesisRequest) {
  const concurrency = getRequestProvider(request) === "elevenlabs" ? ELEVEN_TTS_CONCURRENCY : TTS_CONCURRENCY;
  const buffers = await mapWithConcurrency(segment.chunks, concurrency, async (chunk) => {
    const nextRequest = { ...request, voiceId: segment.voiceId };
    if (getRequestProvider(nextRequest) === "elevenlabs") {
      return await callElevenLabsTts(chunk, nextRequest);
    }
    return await callGoogleTts(chunk, nextRequest);
  });
  return await renderAudioSequence(buffers);
}

export async function synthesizeNarration(request: TtsSynthesisRequest): Promise<Blob | null> {
  const segments = createTtsSegments(request).filter((segment) => segment.chunks.length);
  if (!segments.length) return null;

  const renderedSegments: AudioBuffer[] = [];
  for (const segment of segments) {
    const rendered = await synthesizeSegment(segment, request);
    if (rendered) {
      renderedSegments.push(rendered);
      if (request.dialogueMode) {
        renderedSegments.push(createSilentAudioBuffer(rendered.sampleRate, rendered.numberOfChannels, TTS_SPEAKER_GAP_SECONDS));
      }
    }
  }

  if (request.dialogueMode && renderedSegments.length > 1) renderedSegments.pop();
  const finalBuffer = await renderAudioSequence(renderedSegments, { crossfadeSeconds: TTS_CROSSFADE_SECONDS });
  return finalBuffer ? audioBufferToWavBlob(finalBuffer) : null;
}

export async function playNarration(request: TtsSynthesisRequest) {
  const generation = playbackGeneration + 1;
  playbackGeneration = generation;
  cleanupActiveNarration();

  const blob = await synthesizeNarration(request);
  if (!blob) return null;
  if (generation !== playbackGeneration) return null;

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.preload = "auto";
  activeAudio = audio;
  activeObjectUrl = url;
  if (request.hauntedFx || request.audioFx) applyHauntedFx(audio, request.audioFx);
  audio.onended = () => {
    if (activeAudio !== audio) {
      URL.revokeObjectURL(url);
      return;
    }

    URL.revokeObjectURL(url);
    activeAudio = null;
    if (activeObjectUrl === url) activeObjectUrl = null;
    void activeAudioContext?.close();
    activeAudioContext = null;
  };
  await audio.play();
  return audio;
}

export function stopNarration() {
  playbackGeneration += 1;
  cleanupActiveNarration();
}

function cleanupActiveNarration() {
  if (activeFxGraph) {
    try { activeFxGraph.staticSource.stop(); } catch {}
    activeFxGraph = null;
  }
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
  void activeAudioContext?.close();
  activeAudioContext = null;
}

export async function downloadNarration(request: TtsSynthesisRequest, filename = "ghostai-narration.wav") {
  const blob = await synthesizeNarration(request);
  if (!blob) return null;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = ensureWavFilename(filename);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return blob;
}

export async function downloadElevenPreviewMp3(request: TtsSynthesisRequest, filename = "ghostai-eleven-preview.mp3") {
  const apiKey = getElevenKey();
  if (!apiKey) throw new Error("Missing ElevenLabs API Key. Please add it in Settings first.");

  const voiceId = await getElevenVoiceId(request.voiceId);
  const text = buildChunkPlainText({
    units: tokenizeTtsInput(request.text),
    text: request.text
  });

  const response = await fetch(`${ELEVENLABS_TTS_ENDPOINT}/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey
    },
    body: JSON.stringify({
      text,
      model_id: request.modelId || "eleven_v3",
      ...(request.modelId === "eleven_v3" ? { language_code: "th" } : {}),
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75
      },
      output_format: "mp3_44100_128"
    })
  });

  if (!response.ok) {
    throw new Error(await readElevenError(response));
  }

  const blob = new Blob([await response.arrayBuffer()], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/\.[^.]+$/, "") + ".mp3";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return blob;
}

export async function downloadNarrationWithFx(request: TtsSynthesisRequest, filename = "ghostai-narration-fx.wav") {
  const sourceBlob = await synthesizeNarration(request);
  if (!sourceBlob) return null;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("This browser does not support AudioContext for FX export");

  const decodeContext = new AudioContextClass();
  const sourceBuffer = await decodeContext.decodeAudioData(await sourceBlob.arrayBuffer());
  await decodeContext.close();

  const fx = request.audioFx || {
    reverb: true,
    pitchLow: false,
    whisper: false,
    staticNoise: false,
    ambientMix: true,
    masterVolume: 0.8
  };
  const playbackRate = fx.pitchLow ? 0.92 : 1;
  const sampleRate = sourceBuffer.sampleRate;
  const tailSeconds = fx.reverb ? 0.6 : 0.15;
  const length = Math.ceil((sourceBuffer.duration / playbackRate + tailSeconds) * sampleRate);
  const offline = new OfflineAudioContext(sourceBuffer.numberOfChannels, length, sampleRate);
  renderFxGraph(offline, sourceBuffer, fx);
  const rendered = await offline.startRendering();
  const wavBlob = audioBufferToWavBlob(rendered);

  const url = URL.createObjectURL(wavBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = ensureWavFilename(filename);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return wavBlob;
}

function ensureWavFilename(filename: string) {
  return filename.replace(/\.[^.]+$/, "") + ".wav";
}

function applyHauntedFx(audio: HTMLAudioElement, fx = {
  reverb: true,
  pitchLow: false,
  whisper: false,
  staticNoise: false,
  ambientMix: true,
  masterVolume: 0.8
}) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const source = context.createMediaElementSource(audio);
  const inputGain = context.createGain();
  const toneLowShelf = context.createBiquadFilter();
  const toneHighCut = context.createBiquadFilter();
  const whisperDryGain = context.createGain();
  const whisperWetGain = context.createGain();
  const whisperFilter = context.createBiquadFilter();
  const postVoiceGain = context.createGain();
  const dryGain = context.createGain();
  const convolver = context.createConvolver();
  const reverbWetGain = context.createGain();
  const master = context.createGain();

  toneLowShelf.type = "lowshelf";
  toneLowShelf.frequency.value = 220;
  toneHighCut.type = "lowpass";
  whisperFilter.type = "bandpass";
  whisperFilter.frequency.value = 3000;
  whisperFilter.Q.value = 0.8;
  convolver.buffer = createReverbBuffer(context, 1.8, 1.7);

  source.connect(inputGain);
  inputGain.connect(toneLowShelf);
  toneLowShelf.connect(toneHighCut);
  toneHighCut.connect(whisperDryGain);
  toneHighCut.connect(whisperFilter);
  whisperFilter.connect(whisperWetGain);
  whisperDryGain.connect(postVoiceGain);
  whisperWetGain.connect(postVoiceGain);
  postVoiceGain.connect(dryGain);
  dryGain.connect(master);
  postVoiceGain.connect(convolver);
  convolver.connect(reverbWetGain);
  reverbWetGain.connect(master);

  const staticSource = context.createBufferSource();
  const staticFilter = context.createBiquadFilter();
  const staticPanner = "createStereoPanner" in context ? context.createStereoPanner() : null;
  const staticGain = context.createGain();
  const staticBuffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
  const staticChannel = staticBuffer.getChannelData(0);
  let crackle = 0;
  for (let index = 0; index < staticChannel.length; index += 1) {
    if (Math.random() < 0.018) crackle = (Math.random() * 2 - 1) * 0.95;
    crackle *= 0.88;
    staticChannel[index] = (Math.random() * 2 - 1) * 0.58 + crackle;
  }
  staticSource.buffer = staticBuffer;
  staticSource.loop = true;
  staticFilter.type = "bandpass";
  staticFilter.frequency.value = 1500;
  staticFilter.Q.value = 2.0;
  if (staticPanner) staticPanner.pan.value = (Math.random() - 0.5) * 0.35;
  staticSource.connect(staticFilter);
  if (staticPanner) {
    staticFilter.connect(staticPanner);
    staticPanner.connect(staticGain);
  } else {
    staticFilter.connect(staticGain);
  }
  staticGain.connect(master);
  staticSource.start();

  master.connect(context.destination);
  activeAudioContext = context;
  activeFxGraph = {
    audio,
    whisperDryGain,
    whisperWetGain,
    dryGain,
    reverbWetGain,
    staticGain,
    staticFilter,
    staticPanner: staticPanner || undefined,
    staticSource,
    toneLowShelf,
    toneHighCut,
    master
  };
  updateNarrationFx(fx);
}

export function updateNarrationFx(fx = {
  reverb: true,
  pitchLow: false,
  whisper: false,
  staticNoise: false,
  ambientMix: true,
  masterVolume: 0.8
}) {
  if (!activeFxGraph || !activeAudioContext) return;

  const now = activeAudioContext.currentTime;
  const targetPitch = fx.pitchLow ? 0.96 : 1.0;
  const whisperDry = fx.whisper ? 0 : 1;
  const whisperWet = fx.whisper ? 1 : 0;
  const reverbWet = fx.reverb ? 0.3 : 0;
  const dryLevel = fx.reverb ? 0.92 : 1.0;
  const staticLevel = fx.staticNoise ? 0.11 : fx.ambientMix ? 0.01 : 0;
  const volume = Math.max(0, Math.min(1, fx.masterVolume || 0.8));

  activeFxGraph.audio.playbackRate = targetPitch;
  activeFxGraph.whisperDryGain.gain.cancelScheduledValues(now);
  activeFxGraph.whisperDryGain.gain.setTargetAtTime(whisperDry, now, 0.03);
  activeFxGraph.whisperWetGain.gain.cancelScheduledValues(now);
  activeFxGraph.whisperWetGain.gain.setTargetAtTime(whisperWet, now, 0.03);
  activeFxGraph.dryGain.gain.cancelScheduledValues(now);
  activeFxGraph.dryGain.gain.setTargetAtTime(dryLevel, now, 0.04);
  activeFxGraph.reverbWetGain.gain.cancelScheduledValues(now);
  activeFxGraph.reverbWetGain.gain.setTargetAtTime(reverbWet, now, 0.05);
  activeFxGraph.toneLowShelf.gain.cancelScheduledValues(now);
  activeFxGraph.toneLowShelf.gain.setTargetAtTime(fx.pitchLow ? 5 : 0, now, 0.05);
  activeFxGraph.toneHighCut.frequency.cancelScheduledValues(now);
  activeFxGraph.toneHighCut.frequency.setTargetAtTime(fx.pitchLow ? 3600 : 18000, now, 0.05);
  activeFxGraph.staticGain.gain.cancelScheduledValues(now);
  activeFxGraph.staticGain.gain.setTargetAtTime(staticLevel, now, 0.05);
  activeFxGraph.staticFilter.frequency.cancelScheduledValues(now);
  activeFxGraph.staticFilter.frequency.setTargetAtTime(fx.staticNoise ? 1650 : 900, now, 0.08);
  activeFxGraph.staticFilter.Q.cancelScheduledValues(now);
  activeFxGraph.staticFilter.Q.setTargetAtTime(fx.staticNoise ? 2.6 : 1.2, now, 0.08);
  if (activeFxGraph.staticPanner) {
    activeFxGraph.staticPanner.pan.cancelScheduledValues(now);
    activeFxGraph.staticPanner.pan.setTargetAtTime(fx.staticNoise ? (Math.random() - 0.5) * 0.5 : 0, now, 0.08);
  }
  activeFxGraph.master.gain.cancelScheduledValues(now);
  activeFxGraph.master.gain.setTargetAtTime(volume, now, 0.03);
}

function renderFxGraph(context: BaseAudioContext, sourceBuffer: AudioBuffer, fx: NonNullable<TtsSynthesisRequest["audioFx"]>) {
  const source = context.createBufferSource();
  const lowpass = context.createBiquadFilter();
  const delay = context.createDelay();
  const delayGain = context.createGain();
  const whisper = context.createBiquadFilter();
  const master = context.createGain();

  source.buffer = sourceBuffer;
  source.playbackRate.value = fx.pitchLow ? 0.92 : 1;
  lowpass.type = "lowpass";
  lowpass.frequency.value = fx.whisper ? 2100 : 3300;
  lowpass.Q.value = 0.8;
  delay.delayTime.value = 0.18;
  delayGain.gain.value = fx.reverb ? 0.18 : 0;
  whisper.type = "highpass";
  whisper.frequency.value = fx.whisper ? 520 : 90;
  master.gain.value = Math.max(0, Math.min(1, fx.masterVolume || 0.8));

  source.connect(lowpass);
  lowpass.connect(whisper);
  whisper.connect(master);
  lowpass.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(master);

  if (fx.staticNoise || fx.ambientMix) {
    const noiseSource = context.createBufferSource();
    const noiseGain = context.createGain();
    const noiseFilter = context.createBiquadFilter();
    const noiseBuffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * sourceBuffer.duration)), context.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    let crackle = 0;
    for (let index = 0; index < channel.length; index += 1) {
      if (Math.random() < 0.018) crackle = (Math.random() * 2 - 1) * 0.95;
      crackle *= 0.88;
      channel[index] = (Math.random() * 2 - 1) * (fx.staticNoise ? 0.58 : 0.2) + crackle;
    }
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = fx.staticNoise ? 1650 : 900;
    noiseFilter.Q.value = fx.staticNoise ? 2.6 : 1.2;
    noiseGain.gain.value = fx.staticNoise ? 0.11 : 0.01;
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noiseSource.start();
  }

  master.connect(context.destination);
  source.start();
}

function createReverbBuffer(context: BaseAudioContext, duration: number, decay: number) {
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const impulse = context.createBuffer(2, length, context.sampleRate);

  for (let channelIndex = 0; channelIndex < impulse.numberOfChannels; channelIndex += 1) {
    const channel = impulse.getChannelData(channelIndex);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / channel.length, decay);
    }
  }

  return impulse;
}

function audioBufferToWavBlob(buffer: AudioBuffer) {
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numberOfChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  let offset = 0;

  writeString(view, offset, "RIFF"); offset += 4;
  view.setUint32(offset, length - 8, true); offset += 4;
  writeString(view, offset, "WAVE"); offset += 4;
  writeString(view, offset, "fmt "); offset += 4;
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, numberOfChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * numberOfChannels * 2, true); offset += 4;
  view.setUint16(offset, numberOfChannels * 2, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeString(view, offset, "data"); offset += 4;
  view.setUint32(offset, length - offset - 4, true); offset += 4;

  for (let index = 0; index < buffer.length; index += 1) {
    for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channelIndex)[index] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}


