import type { AiConnectionResult, ApiTestProvider, StoryGenerationRequest } from "@/types/ai";
import type { AiProvider } from "@/types/settings";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const GOOGLE_TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";
const ELEVENLABS_MODELS_ENDPOINT = "https://api.elevenlabs.io/v1/models";
const STORY_BREAK_TAG_REGEX = /<break\s+time\s*=\s*"([^"]+)"\s*\/>/i;
const STORY_BREAK_TAG_GLOBAL_REGEX = /<break\s+time\s*=\s*"([^"]+)"\s*\/>/gi;
const STORY_WORDS_PER_MINUTE = 95;
const STORY_MIN_RATIO = 0.82;
const STORY_MAX_RATIO = 1.08;
const THAI_SENTENCE_SPLIT_REGEX = /(?<=[.!?…]|[ก-๙][\u0E2F])\s+/u;

async function getErrorDetail(response: Response) {
  try {
    const data = await response.json();
    if (data.error?.message) return data.error.message;
    if (data.error?.status) return `${data.error.status}: ${data.error.message || ""}`;
    return JSON.stringify(data).slice(0, 180);
  } catch {
    return `HTTP ${response.status}`;
  }
}

// ฟังก์ชันนี้ย้ายมาจาก testAIConnection เดิม แต่ทำให้เป็น service กลางสำหรับ React
export async function testAiConnection(provider: ApiTestProvider, apiKey: string): Promise<AiConnectionResult> {
  if (!apiKey.trim()) {
    return { success: false, message: "กรุณากรอก API Key ก่อนทดสอบครับ" };
  }

  try {
    if (provider === "gemini") {
      const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "สวัสดี" }] }] })
      });
      if (response.ok) return { success: true, message: "เชื่อมต่อ Gemini สำเร็จ" };
      return { success: false, message: `ข้อผิดพลาด: ${await getErrorDetail(response)}` };
    }

    if (provider === "groq") {
      const response = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: "Hi, reply OK" }],
          max_tokens: 5
        })
      });
      if (response.ok) return { success: true, message: "เชื่อมต่อ Groq สำเร็จ" };
      return { success: false, message: `ข้อผิดพลาด: ${await getErrorDetail(response)}` };
    }

    if (provider === "openrouter") {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": window.location.href,
          "X-Title": "GhostAI Studio"
        },
        body: JSON.stringify({
          model: "openrouter/auto",
          messages: [{ role: "user", content: "Hi, reply OK" }],
          max_tokens: 5
        })
      });
      if (response.ok) return { success: true, message: "เชื่อมต่อ OpenRouter สำเร็จ" };
      return { success: false, message: `ข้อผิดพลาด: ${await getErrorDetail(response)}` };
    }

    if (provider === "tts") {
      const response = await fetch(`${GOOGLE_TTS_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text: "ทดสอบระบบเสียงภาษาไทย" },
          voice: { languageCode: "th-TH", name: "th-TH-Neural2-C" },
          audioConfig: { audioEncoding: "LINEAR16" }
        })
      });
      if (response.ok) return { success: true, message: "เชื่อมต่อ Google Cloud TTS สำเร็จ" };
      return { success: false, message: `ข้อผิดพลาด: ${await getErrorDetail(response)}` };
    }

    if (provider === "elevenlabs") {
      const response = await fetch(ELEVENLABS_MODELS_ENDPOINT, {
        headers: {
          "xi-api-key": apiKey
        }
      });
      if (response.ok) return { success: true, message: "เชื่อมต่อ ElevenLabs สำเร็จ" };
      return { success: false, message: `ข้อผิดพลาด: ${await getErrorDetail(response)}` };
    }
  } catch (error) {
    return {
      success: false,
      message: `ล้มเหลวหรือติด CORS: ${error instanceof Error ? error.message : String(error)}`
    };
  }

  return { success: false, message: "ไม่รู้จัก provider ที่เลือก" };
}

export async function generateStoryDraft(request: StoryGenerationRequest): Promise<string> {
  const duration = getDurationWordTarget(request.durationMinutes);
  const prompt = `คุณคือนักเขียนสคริปต์เรื่องผีภาษาไทยสำหรับเล่าในช่องหรือพอดแคสต์

คีย์เวิร์ด: ${request.keyword}
แนวเรื่อง: ${request.genre}
สไตล์การเล่า: ${request.style}
ระดับความหลอน/ความโหด: ${request.goreLevel}/100
ความยาวที่ต้องการ: ${duration.minutes} นาที
จำนวนคำเป้าหมาย: ประมาณ ${duration.target} คำ
จำนวนคำสูงสุด: ห้ามเกิน ${duration.max} คำ

กติกา:
- เขียนเป็นภาษาไทยล้วน
- บรรทัดแรกเป็นชื่อเรื่อง
- เว้นหนึ่งบรรทัด แล้วค่อยเริ่มเนื้อเรื่อง
- ใช้บรรยากาศกดดัน หลอน และมีภาพจำชัด
- ปรับความแรงของฉากพีคตามระดับความหลอน/ความโหด โดยไม่ต้องยัด gore ถ้าไม่จำเป็น
- ใส่ <break time="500ms"/> ได้ไม่เกิน 2 จุด เฉพาะจุดพักใหญ่
- ห้ามเขียนประโยควนซ้ำหรือปิดท้ายด้วยการสรุปซ้ำหลังจบเรื่อง
- ห้ามใส่ markdown หรือ bullet`;

  try {
    const raw = await requestTextFromActiveProvider(prompt, request.provider, {
      temperature: 0.75,
      maxTokens: Math.max(900, duration.minutes * 550)
    });
    return cleanupGeneratedStory(raw, duration.minutes);
  } catch {
    return cleanupGeneratedStory(getMockStory(request.keyword, request.provider), duration.minutes);
  }
}

function normalizeBreakDuration(duration: unknown) {
  const raw = String(duration || "").trim().toLowerCase();
  if (/^\d+ms$/.test(raw)) return raw;
  if (/^\d+(?:\.\d+)?s$/.test(raw)) {
    const ms = Math.round(parseFloat(raw) * 1000);
    return `${Math.min(2000, Math.max(150, ms))}ms`;
  }
  return "500ms";
}

function normalizeBreakTag(tagOrDuration: unknown) {
  const match = String(tagOrDuration || "").match(STORY_BREAK_TAG_REGEX);
  const duration = match ? match[1] : tagOrDuration;
  return `<break time="${normalizeBreakDuration(duration)}"/>`;
}

export function getDurationWordTarget(durationMinutes = 3) {
  const safeMinutes = Math.min(10, Math.max(1, Number(durationMinutes) || 3));
  const target = Math.round(safeMinutes * STORY_WORDS_PER_MINUTE);
  return {
    minutes: safeMinutes,
    target,
    min: Math.max(70, Math.round(target * STORY_MIN_RATIO)),
    max: Math.max(100, Math.round(target * STORY_MAX_RATIO))
  };
}

function normalizeStoryLine(line: unknown) {
  return String(line || "")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .trim();
}

export function countThaiWords(text: string) {
  return String(text || "")
    .replace(STORY_BREAK_TAG_GLOBAL_REGEX, " ")
    .replace(/\[JUMP_SCARE\]/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function normalizeForDedup(text: string) {
  return String(text || "")
    .replace(STORY_BREAK_TAG_GLOBAL_REGEX, " ")
    .replace(/\[JUMP_SCARE\]/gi, " ")
    .replace(/[“”"']/g, "")
    .replace(/[,.!?…:;()[\]-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function splitIntoSentences(paragraph: string) {
  return String(paragraph || "")
    .split(THAI_SENTENCE_SPLIT_REGEX)
    .map((sentence) => normalizeStoryLine(sentence))
    .filter(Boolean);
}

function isBreakOnly(paragraph: string) {
  return STORY_BREAK_TAG_REGEX.test(paragraph) && paragraph.replace(STORY_BREAK_TAG_GLOBAL_REGEX, "").trim() === "";
}

function dedupeRepeatedSentences(text: string) {
  const paragraphs = String(text || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const seenSentences = new Set<string>();
  const cleanedParagraphs: string[] = [];

  for (const paragraph of paragraphs) {
    if (isBreakOnly(paragraph)) {
      const normalizedBreak = normalizeBreakTag(paragraph);
      if (cleanedParagraphs[cleanedParagraphs.length - 1] !== normalizedBreak) cleanedParagraphs.push(normalizedBreak);
      continue;
    }

    const keptSentences: string[] = [];
    for (const sentence of splitIntoSentences(paragraph)) {
      const normalized = normalizeForDedup(sentence);
      if (!normalized) continue;
      if (normalized.length > 35 && seenSentences.has(normalized)) continue;
      seenSentences.add(normalized);
      keptSentences.push(sentence);
    }

    const merged = keptSentences.join(" ").trim();
    if (merged) cleanedParagraphs.push(merged);
  }

  return cleanedParagraphs.join("\n\n").trim();
}

function trimRepeatedTail(text: string) {
  let cleaned = String(text || "").trim();
  const loopingTailPatterns = [
    /(และเราก็ไม่แน่ใจว่า[\s\S]{40,})$/u,
    /(แต่สิ่งที่เรารู้ก็คือ[\s\S]{40,})$/u,
    /(เรื่องราวของ["“][^"”]+["”][\s\S]{40,})$/u,
    /(หวังว่าคุณจะชอบเรื่องนี้[\s\S]{40,})$/u,
    /(คุณคิดว่ามันคืออะไรกันแน่ครับ[\s\S]{180,})$/u
  ];

  for (const pattern of loopingTailPatterns) {
    const match = cleaned.match(pattern);
    if (match && typeof match.index === "number") cleaned = cleaned.slice(0, match.index).trim();
  }

  const paragraphs = cleaned.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const compacted: string[] = [];
  const seenTail = new Set<string>();

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    if (isBreakOnly(paragraph)) {
      const normalizedBreak = normalizeBreakTag(paragraph);
      if (compacted[compacted.length - 1] !== normalizedBreak) compacted.push(normalizedBreak);
      continue;
    }

    const normalized = normalizeForDedup(paragraph);
    if (index >= Math.max(1, paragraphs.length - 3) && normalized.length > 40) {
      if (seenTail.has(normalized)) continue;
      seenTail.add(normalized);
    }

    compacted.push(paragraph);
  }

  return compacted.join("\n\n").trim();
}

function trimParagraphsToWordLimit(text: string, maxWords: number) {
  const paragraphs = String(text || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!paragraphs.length) return "";
  const kept: string[] = [];
  let wordCount = 0;

  for (const paragraph of paragraphs) {
    if (isBreakOnly(paragraph)) {
      const normalizedBreak = normalizeBreakTag(paragraph);
      if (kept.length && kept[kept.length - 1] !== normalizedBreak) kept.push(normalizedBreak);
      continue;
    }

    const paragraphWords = countThaiWords(paragraph);
    if (!kept.length || wordCount + paragraphWords <= maxWords) {
      kept.push(paragraph);
      wordCount += paragraphWords;
      continue;
    }

    const partial: string[] = [];
    for (const sentence of splitIntoSentences(paragraph)) {
      const sentenceWords = countThaiWords(sentence);
      if (wordCount + sentenceWords > maxWords && partial.length) break;
      if (wordCount + sentenceWords > maxWords && !partial.length) continue;
      partial.push(sentence);
      wordCount += sentenceWords;
    }

    if (partial.length) kept.push(partial.join(" "));
    break;
  }

  while (kept.length && STORY_BREAK_TAG_REGEX.test(kept[kept.length - 1])) kept.pop();
  return kept.join("\n\n").trim();
}

function enforceStoryDuration(text: string, durationMinutes: number) {
  const duration = getDurationWordTarget(durationMinutes);
  return countThaiWords(text) <= duration.max ? text : trimParagraphsToWordLimit(text, duration.max);
}

export function cleanupGeneratedStory(text: string, durationMinutes = 3) {
  const raw = String(text || "")
    .replace(/\r/g, "")
    .replace(STORY_BREAK_TAG_GLOBAL_REGEX, (_, duration) => `\n\n${normalizeBreakTag(duration)}\n\n`)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!raw) return "";
  const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return "";

  const title = normalizeStoryLine(lines.shift() || "เรื่องเล่าคืนหลอน");
  const cleanedParagraphs: string[] = [];
  const seenParagraphs = new Map<string, number>();

  for (const line of lines) {
    if (isBreakOnly(line)) {
      const normalizedBreak = normalizeBreakTag(line);
      if (cleanedParagraphs[cleanedParagraphs.length - 1] !== normalizedBreak) cleanedParagraphs.push(normalizedBreak);
      continue;
    }

    const normalized = normalizeStoryLine(line);
    if (!normalized) continue;
    const dedupeKey = normalizeForDedup(normalized);
    const count = seenParagraphs.get(dedupeKey) || 0;
    if (count >= 1 && normalized.length > 80) continue;
    seenParagraphs.set(dedupeKey, count + 1);
    cleanedParagraphs.push(normalized);
  }

  let cleaned = cleanedParagraphs
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n\n(<break[^>]*\/>)\n\n(<break[^>]*\/>)/gi, "\n\n$2")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();

  cleaned = dedupeRepeatedSentences(cleaned);
  cleaned = trimRepeatedTail(cleaned);
  cleaned = enforceStoryDuration(cleaned, durationMinutes);

  const maxChars = 6500;
  if (cleaned.length > maxChars) {
    const truncated = cleaned.slice(0, maxChars);
    const lastStop = Math.max(truncated.lastIndexOf("."), truncated.lastIndexOf("!"), truncated.lastIndexOf("?"), truncated.lastIndexOf("\n"));
    cleaned = (lastStop > 1000 ? truncated.slice(0, lastStop + 1) : truncated).trim();
  }

  return `${title}\n\n${cleaned}`.trim();
}

function getMockStory(keyword: string, source = "fallback") {
  return `เงาในทางแคบ

สวัสดีครับทุกท่าน คืนนี้ผมมีเรื่องหนึ่งที่เกิดขึ้นใกล้ ${keyword} มาเล่าให้ฟัง เป็นเรื่องที่คนแถวนั้นยังไม่กล้าพูดถึงกันตรง ๆ เพราะทุกครั้งที่นึกถึง มันจะมาพร้อมความเย็นวาบตรงต้นคอเสมอ

<break time="500ms"/>

คืนหนึ่ง ชายคนหนึ่งเดินกลับบ้านผ่านทางแคบหลังตลาด เขาได้ยินเสียงรองเท้าอีกคู่หนึ่งเดินตามหลัง ทั้งที่เมื่อหันกลับไปก็เห็นเพียงไฟถนนกะพริบและเงาของตัวเองที่ยาวผิดปกติบนกำแพง

เขาพยายามเร่งฝีเท้า แต่เสียงนั้นก็เร่งตาม ทุกก้าวชัดขึ้น ใกล้ขึ้น เหมือนใครบางคนกำลังเดินอยู่ข้างหลังในระยะที่แค่เอื้อมมือก็แตะไหล่ได้ กลิ่นธูปเก่าลอยมาในลม ทั้งที่แถวนั้นไม่มีศาล ไม่มีบ้านคน และไม่มีใครจุดอะไรไว้เลย

เมื่อถึงปากซอย เขารวบรวมความกล้าหันกลับไปอีกครั้ง คราวนี้ไม่มีเสียงฝีเท้าแล้ว แต่บนกำแพงกลับมีเงาอีกเงาหนึ่งยืนซ้อนอยู่หลังเงาของเขา เงานั้นก้มหน้าช้า ๆ ราวกับกำลังมองต้นคอของเขาอยู่

<break time="500ms"/>

เช้าวันต่อมา คนแถวนั้นเจอรองเท้าข้างหนึ่งของเขาตกอยู่กลางทางแคบ ไม่มีรอยลาก ไม่มีรอยเลือด มีเพียงรอยมือสีดำบนกำแพง และข้อความที่ถูกขูดไว้เบา ๆ ว่า "อย่าหันกลับมา"

ตั้งแต่นั้นมา ไม่มีใครเดินผ่านทางนั้นหลังเที่ยงคืนอีกเลย ยกเว้นบางคืนที่ไฟถนนกะพริบเอง และมีเสียงรองเท้าสองคู่เดินตามกันไปในความมืด

แหล่งสร้าง: ${source}`;
}

type TextRequestOptions = {
  temperature?: number;
  maxTokens?: number;
};

function getProviderKey(provider: AiProvider) {
  if (provider === "gemini") return window.localStorage.getItem("gh_api_gemini")?.trim() || "";
  if (provider === "groq") return window.localStorage.getItem("gh_api_groq")?.trim() || "";
  return window.localStorage.getItem("gh_api_openrouter")?.trim() || "";
}

export async function requestTextFromActiveProvider(
  prompt: string,
  provider: AiProvider = (window.localStorage.getItem("gh_active_ai") as AiProvider) || "gemini",
  options: TextRequestOptions = {}
): Promise<string> {
  const apiKey = getProviderKey(provider);
  if (!apiKey) throw new Error(`ยังไม่มี API key สำหรับ ${provider} กรุณาตั้งค่าในหน้า Settings ก่อน`);

  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 1400;

  if (provider === "gemini") {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens }
      })
    });
    if (!response.ok) throw new Error(await getErrorDetail(response));
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  }

  if (provider === "groq") {
    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature,
        max_tokens: maxTokens
      })
    });
    if (!response.ok) throw new Error(await getErrorDetail(response));
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": window.location.href,
      "X-Title": "GhostAI Studio"
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens: maxTokens
    })
  });
  if (!response.ok) throw new Error(await getErrorDetail(response));
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}
