// ==========================================
//  GhostAI Studio - TTS Engine
// ==========================================
// NOTE: All runtime narration and voice playback must use Google Cloud TTS only.
// Do not switch preview, export, or playback to Gemini TTS in this project.

const GOOGLE_CLOUD_TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";
const TTS_MAX_CHARS = 220;
const TTS_CONCURRENCY = 3;
const TTS_CROSSFADE_SECONDS = 0.035;
const TTS_SPEAKER_GAP_SECONDS = 0.12;
const TTS_SENTENCE_MAX_CHARS = 140;
const DEFAULT_TTS_VOICE = "Neural2C";
const BREAK_TAG_GLOBAL_REGEX = /<break\s+time\s*=\s*"([^"]+)"\s*\/>/gi;
const BREAK_TOKEN_REGEX = /^\[\[gh_break:(\d+ms)\]\]$/i;

const TTS_VOICES = [
    { id: "Charon", name: "ชารอน", gender: "M", desc: "Chirp 3 HD ลึก นุ่ม และเล่านิ่ง" },
    { id: "Zephyr", name: "เซเฟอร์", gender: "F", desc: "Chirp 3 HD รุ่นใหม่ ใส ชัด ฟังง่าย" },
    { id: "Zubenelgenubi", name: "ซูเบเนลเกนูบี", gender: "M", desc: "Chirp 3 HD รุ่นใหม่ โทนเข้มและชัด" },
    { id: "Kore", name: "โคเร", gender: "F", desc: "Chirp 3 HD หนักแน่น มีพลัง" },
    { id: "Gacrux", name: "กาครักซ์", gender: "F", desc: "Chirp 3 HD สุขุมและน่าเชื่อถือ" },
    { id: "Aurus", name: "ออรัส", gender: "M", desc: "Chirp 3 HD สุขุม นุ่ม และนิ่ง" },
    { id: "Fenrir", name: "เฟนริร์", gender: "M", desc: "Chirp 3 HD เข้มและพลังสูง" },
    { id: "Callirrhoe", name: "คัลลิรร์โฮ", gender: "F", desc: "Chirp 3 HD โปร่ง อ่านลื่น" },
    { id: "Aoede", name: "เอโอเด", gender: "F", desc: "Chirp 3 HD นุ่มสะอาด โทนเล่าเรื่อง" },
    { id: "Achird", name: "อาชิร์ด", gender: "M", desc: "Chirp 3 HD เป็นธรรมชาติ ฟังสบาย" },
    { id: "Sadachbia", name: "ซาดัคเบีย", gender: "F", desc: "Chirp 3 HD เรียบลึกและชัด" },
    { id: "Rasalgethi", name: "ราซาลเกธี", gender: "M", desc: "Chirp 3 HD คม ชัด แบบผู้บรรยาย" },
    { id: "Alnilam", name: "อัลนิแลม", gender: "M", desc: "Chirp 3 HD เด่นชัดและมั่นใจ" },
    { id: "Iapetus", name: "ไออะพีตัส", gender: "M", desc: "Chirp 3 HD คม สะอาด ชัดคำ" },
    { id: "Umbriel", name: "อัมเบรียล", gender: "M", desc: "Chirp 3 HD นุ่มลึกและลื่นไหล" },
    { id: "Algieba", name: "อัลจีบา", gender: "M", desc: "Chirp 3 HD ลื่นและดึงอารมณ์" },
    { id: "Erinome", name: "เอรินอม", gender: "F", desc: "Chirp 3 HD ถ้อยคำคมและชัด" },
    { id: "Despina", name: "เดสพินา", gender: "F", desc: "Chirp 3 HD เรียบลื่นแต่นุ่มลึก" },
    { id: "Achernar", name: "อาเชอร์นาร์", gender: "F", desc: "Chirp 3 HD อ่อนโยนแต่มีมิติ" },
    { id: "Vindemiatrix", name: "วินเดมิอาทริกซ์", gender: "F", desc: "Chirp 3 HD บางเบาและหลอน" },
    { id: "Sulafat", name: "ซูลาฟัต", gender: "F", desc: "Chirp 3 HD อบอุ่นและดึงความสนใจ" },
    { id: "Neural2C", name: "ไทย Neural2-C", gender: "F", desc: "Neural2 อ่านไทยนิ่ง ชัด และเสถียร" },
    { id: "StandardA", name: "ไทย Standard-A", gender: "F", desc: "Standard รุ่นพื้นฐาน ใช้เป็น fallback" }
];

const GOOGLE_TTS_VOICE_MAP = {
    Charon: "th-TH-Chirp3-HD-Charon",
    Zephyr: "th-TH-Chirp3-HD-Zephyr",
    Zubenelgenubi: "th-TH-Chirp3-HD-Zubenelgenubi",
    Kore: "th-TH-Chirp3-HD-Kore",
    Gacrux: "th-TH-Chirp3-HD-Gacrux",
    Aurus: "th-TH-Chirp3-HD-Orus",
    Fenrir: "th-TH-Chirp3-HD-Fenrir",
    Callirrhoe: "th-TH-Chirp3-HD-Callirrhoe",
    Aoede: "th-TH-Chirp3-HD-Aoede",
    Achird: "th-TH-Chirp3-HD-Achird",
    Sadachbia: "th-TH-Chirp3-HD-Sadachbia",
    Rasalgethi: "th-TH-Chirp3-HD-Rasalgethi",
    Alnilam: "th-TH-Chirp3-HD-Alnilam",
    Iapetus: "th-TH-Chirp3-HD-Iapetus",
    Umbriel: "th-TH-Chirp3-HD-Umbriel",
    Algieba: "th-TH-Chirp3-HD-Algieba",
    Erinome: "th-TH-Chirp3-HD-Erinome",
    Despina: "th-TH-Chirp3-HD-Despina",
    Achernar: "th-TH-Chirp3-HD-Achernar",
    Vindemiatrix: "th-TH-Chirp3-HD-Vindemiatrix",
    Sulafat: "th-TH-Chirp3-HD-Sulafat",
    Neural2C: "th-TH-Neural2-C",
    StandardA: "th-TH-Standard-A",
    spirit: "th-TH-Chirp3-HD-Charon"
};

let ttsDecodeCtx = null;

const TTS_PRONUNCIATION_MAP = new Map([
    ["AI", "เอไอ"],
    ["API", "เอพีไอ"],
    ["TTS", "ทีทีเอส"],
    ["SSML", "เอสเอสเอ็มแอล"],
    ["Google", "กูเกิล"],
    ["Groq", "กร็อก"],
    ["OpenRouter", "โอเพนเราเตอร์"]
]);

const TTS_THAI_PHRASE_MAP = new Map([
    ["ของ", "ของ"],
    ["โกรก", "โกรก"],
    ["แมววัด", "แมววัด"],
    ["เรื่องราวของ", "เรื่องราวของ"],
    ["และเราก็ไม่แน่ใจว่า", "และเราไม่แน่ใจว่า"]
]);

function getRuntimeApiKey(inputId, storageKey) {
    const inputValue = document.getElementById(inputId)?.value?.trim();
    if (inputValue) return inputValue;
    return localStorage.getItem(storageKey)?.trim() || "";
}

function getDecodeContext() {
    if (!ttsDecodeCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        ttsDecodeCtx = new Ctx();
    }
    return ttsDecodeCtx;
}

function normalizeBreakDuration(duration) {
    const raw = String(duration || "").trim().toLowerCase();
    if (/^\d+ms$/.test(raw)) return raw;
    if (/^\d+(?:\.\d+)?s$/.test(raw)) {
        const ms = Math.round(parseFloat(raw) * 1000);
        return `${Math.min(2000, Math.max(150, ms))}ms`;
    }
    return "500ms";
}

function makeBreakToken(duration) {
    return `[[gh_break:${normalizeBreakDuration(duration)}]]`;
}

function sanitizePlainText(text) {
    return normalizeThaiSpeechText(String(text || ""))
        .replace(/\[JUMP_SCARE\]/gi, " ")
        .replace(/<break[^>]*\/>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/[\[\]*#]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeNarrationMarkup(text) {
    return normalizeThaiSpeechText(String(text || ""))
        .replace(/\r/g, "")
        .replace(BREAK_TAG_GLOBAL_REGEX, (_, duration) => ` ${makeBreakToken(duration)} `)
        .replace(/\[JUMP_SCARE\]/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/[\*#]/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\n+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function collapseSpelledThaiSequence(text) {
    return String(text || "").replace(/(?:^|[\s(])((?:[\u0E01-\u0E4E\u0E30-\u0E3A\u0E40-\u0E44]\s+){2,}[\u0E01-\u0E4E\u0E30-\u0E3A\u0E40-\u0E44])(?=$|[\s),.!?])/g, (full, group) => {
        const joined = group.replace(/\s+/g, "");
        return full.replace(group, joined);
    });
}

function normalizeThaiSpeechText(text) {
    let normalized = String(text || "")
        .replace(/\r/g, "")
        .replace(/[\u201C\u201D]/g, "\"")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, "-");

    for (const [from, to] of TTS_PRONUNCIATION_MAP.entries()) {
        normalized = normalized.replace(new RegExp(from, "gi"), to);
    }

    for (const [from, to] of TTS_THAI_PHRASE_MAP.entries()) {
        normalized = normalized.replace(new RegExp(from, "g"), to);
    }

    normalized = collapseSpelledThaiSequence(normalized)
        .replace(/([ก-ฮ])\s+([อ-ฮ])/g, "$1$2")
        .replace(/([\u0E01-\u0E59])\s+([\u0E31-\u0E4E\u0E33])+/g, "$1$2")
        .replace(/([\u0E40-\u0E44])\s+([\u0E01-\u0E2E])/g, "$1$2")
        .replace(/\s{2,}/g, " ");

    return normalized.trim();
}

function ensureSentenceEnding(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return "";
    return /[.!?…ฯ]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function splitByHardLimit(text, maxLength = TTS_SENTENCE_MAX_CHARS) {
    const cleanText = sanitizePlainText(text);
    if (!cleanText) return [];
    if (cleanText.length <= maxLength) return [ensureSentenceEnding(cleanText)];

    const fragments = [];
    let cursor = 0;

    while (cursor < cleanText.length) {
        let end = Math.min(cursor + maxLength, cleanText.length);

        if (end < cleanText.length) {
            const searchStart = Math.max(cursor + Math.floor(maxLength * 0.55), cursor);
            const slice = cleanText.slice(searchStart, end);
            const splitAt = Math.max(
                slice.lastIndexOf(" "),
                slice.lastIndexOf(","),
                slice.lastIndexOf(";"),
                slice.lastIndexOf(":")
            );

            if (splitAt > 0) end = searchStart + splitAt;
        }

        const fragment = cleanText.slice(cursor, end).trim();
        if (fragment) fragments.push(ensureSentenceEnding(fragment));

        cursor = end;
        while (cleanText[cursor] === " ") cursor++;
    }

    return fragments;
}

function splitTextToSentenceUnits(text) {
    const cleanText = sanitizePlainText(text);
    if (!cleanText) return [];

    const sentences = cleanText
        .split(/(?<=[.!?…])/)
        .map((part) => part.trim())
        .filter(Boolean);

    const baseUnits = sentences.length ? sentences : splitByHardLimit(cleanText, TTS_SENTENCE_MAX_CHARS);
    const units = [];

    for (const unit of baseUnits) {
        if (unit.length > TTS_SENTENCE_MAX_CHARS) {
            for (const fragment of splitByHardLimit(unit, TTS_SENTENCE_MAX_CHARS)) {
                if (fragment) units.push({ type: "text", text: fragment });
            }
            continue;
        }

        const normalized = ensureSentenceEnding(unit);
        if (normalized) units.push({ type: "text", text: normalized });
    }

    return units;
}

function tokenizeTtsInput(text) {
    const normalized = normalizeNarrationMarkup(text);
    if (!normalized) return [];

    const parts = normalized
        .split(/(\[\[gh_break:\d+ms\]\])/g)
        .map((part) => part.trim())
        .filter(Boolean);

    const units = [];

    for (const part of parts) {
        const breakMatch = part.match(BREAK_TOKEN_REGEX);
        if (breakMatch) {
            if (units.length) units.push({ type: "break", time: breakMatch[1] });
            continue;
        }

        units.push(...splitTextToSentenceUnits(part));
    }

    return units;
}

function chunkHasText(units) {
    return units.some((unit) => unit.type === "text" && unit.text.trim());
}

function chunkPreview(units) {
    return units
        .map((unit) => unit.type === "break" ? `<break time="${unit.time}"/>` : unit.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
}

function splitTtsText(text, maxLength = TTS_MAX_CHARS) {
    const units = tokenizeTtsInput(text);
    if (!units.length) return [];

    const chunks = [];
    let currentUnits = [];
    let currentTextLength = 0;

    for (const unit of units) {
        if (unit.type === "break") {
            if (currentUnits.length) currentUnits.push(unit);
            continue;
        }

        const unitText = unit.text;
        if (!unitText) continue;

        const candidateLength = currentTextLength ? currentTextLength + 1 + unitText.length : unitText.length;
        if (candidateLength > maxLength && chunkHasText(currentUnits)) {
            chunks.push({
                units: [...currentUnits],
                text: chunkPreview(currentUnits)
            });
            currentUnits = [];
            currentTextLength = 0;
        }

        currentUnits.push({ type: "text", text: unitText });
        currentTextLength = currentTextLength ? currentTextLength + 1 + unitText.length : unitText.length;
    }

    if (chunkHasText(currentUnits)) {
        chunks.push({
            units: [...currentUnits],
            text: chunkPreview(currentUnits)
        });
    }

    return chunks;
}

function decodeBase64Audio(base64Data) {
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
}

function escapeSsml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function buildChunkSsml(chunk) {
    const units = Array.isArray(chunk) ? chunk : (chunk?.units || tokenizeTtsInput(chunk));
    if (!units.length) return "<speak></speak>";

    const ssmlParts = [];
    for (const unit of units) {
        if (unit.type === "break") {
            ssmlParts.push(`<break time="${unit.time}"/>`);
            continue;
        }

        const text = ensureSentenceEnding(unit.text);
        if (text) ssmlParts.push(`<s>${escapeSsml(text)}</s>`);
    }

    return `<speak>${ssmlParts.join("")}</speak>`;
}

function getVoiceRequestConfig(voiceId) {
    const voiceName = GOOGLE_TTS_VOICE_MAP[voiceId] || GOOGLE_TTS_VOICE_MAP[DEFAULT_TTS_VOICE] || "th-TH-Neural2-C";

    if (voiceName.includes("Neural2")) {
        return { voiceName, speakingRate: 0.88 };
    }

    if (voiceName.includes("Standard")) {
        return { voiceName, speakingRate: 0.9 };
    }

    return { voiceName, speakingRate: 0.92 };
}

async function decodeAudioContentToBuffer(base64Data) {
    const bytes = decodeBase64Audio(base64Data);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const ctx = getDecodeContext();
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
}

async function mapWithConcurrency(items, concurrency, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex++;
            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
    return results;
}

async function fetchGoogleTtsChunk(chunk, voiceConfig, apiKey, index) {
    const ssml = buildChunkSsml(chunk);
    const res = await fetch(`${GOOGLE_CLOUD_TTS_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            input: { ssml },
            voice: { languageCode: "th-TH", name: voiceConfig.voiceName },
            audioConfig: {
                audioEncoding: "LINEAR16",
                speakingRate: voiceConfig.speakingRate
            }
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        const previewText = typeof chunk === "string" ? sanitizePlainText(chunk) : (chunk?.text || "");

        if (res.status === 400 && /sentences that are too long/i.test(errText) && previewText.length > 80) {
            const fallbackChunks = splitTtsText(previewText, Math.max(90, Math.floor(TTS_MAX_CHARS * 0.7)));
            const fallbackBuffers = await mapWithConcurrency(
                fallbackChunks,
                Math.min(2, fallbackChunks.length),
                async (fragment, fragmentIndex) => await fetchGoogleTtsChunk(fragment, voiceConfig, apiKey, `${index}.${fragmentIndex}`)
            );
            return await renderAudioSequence(fallbackBuffers);
        }

        throw new Error(`Google Cloud TTS chunk ${index} - ${res.status}: ${errText}`);
    }

    const data = await res.json();
    if (!data.audioContent) return null;
    return await decodeAudioContentToBuffer(data.audioContent);
}

function createSilentAudioBuffer(sampleRate, numberOfChannels, durationSeconds) {
    return new AudioBuffer({
        length: Math.max(1, Math.floor(sampleRate * durationSeconds)),
        numberOfChannels,
        sampleRate
    });
}

async function renderAudioSequence(audioBuffers, { gapSeconds = 0, crossfadeSeconds = TTS_CROSSFADE_SECONDS } = {}) {
    const usableBuffers = audioBuffers.filter(Boolean);
    if (!usableBuffers.length) return null;
    if (usableBuffers.length === 1 && gapSeconds <= 0) return usableBuffers[0];

    const sampleRate = usableBuffers[0].sampleRate;
    const numberOfChannels = usableBuffers.reduce((max, buffer) => Math.max(max, buffer.numberOfChannels), 1);
    const overlapSeconds = gapSeconds > 0 ? 0 : crossfadeSeconds;
    const overlapFrames = Math.max(0, Math.floor(sampleRate * overlapSeconds));
    const gapFrames = Math.max(0, Math.floor(sampleRate * gapSeconds));

    let totalFrames = 0;
    for (let i = 0; i < usableBuffers.length; i++) {
        totalFrames += usableBuffers[i].length;
        if (i > 0) {
            totalFrames += gapFrames;
            totalFrames -= overlapFrames;
        }
    }

    const offlineCtx = new OfflineAudioContext(numberOfChannels, Math.max(totalFrames, 1), sampleRate);
    let cursorSeconds = 0;

    for (let i = 0; i < usableBuffers.length; i++) {
        const buffer = usableBuffers[i];
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;

        const gainNode = offlineCtx.createGain();
        source.connect(gainNode);
        gainNode.connect(offlineCtx.destination);

        const startTime = cursorSeconds;
        const endTime = startTime + buffer.duration;
        const fadeDuration = Math.min(crossfadeSeconds, buffer.duration / 4);

        if (gapSeconds <= 0 && fadeDuration > 0) {
            if (i > 0) {
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(1, startTime + fadeDuration);
            } else {
                gainNode.gain.setValueAtTime(1, startTime);
            }

            if (i < usableBuffers.length - 1) {
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
    }

    return await offlineCtx.startRendering();
}

function audioBufferToWavArrayBuffer(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataLength = buffer.length * blockAlign;
    const wavBuffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(wavBuffer);

    function writeString(offset, string) {
        for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    }

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, "data");
    view.setUint32(40, dataLength, true);

    let offset = 44;
    const channels = Array.from({ length: numChannels }, (_, index) => buffer.getChannelData(index));
    for (let frame = 0; frame < buffer.length; frame++) {
        for (let channel = 0; channel < numChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
            offset += 2;
        }
    }

    return wavBuffer;
}

async function synthesizeWithGoogleCloudTTS(text, voiceId) {
    const apiKey = getRuntimeApiKey("api-tts", "gh_api_tts");
    if (!apiKey) return null;

    const voiceConfig = getVoiceRequestConfig(voiceId);
    const chunks = splitTtsText(text, TTS_MAX_CHARS);
    if (!chunks.length) return null;

    const chunkBuffers = await mapWithConcurrency(chunks, TTS_CONCURRENCY, async (chunk, index) => {
        return await fetchGoogleTtsChunk(chunk, voiceConfig, apiKey, index);
    });

    return await renderAudioSequence(chunkBuffers);
}

async function synthesizeToAudioBuffer(text, voiceId) {
    const normalizedInput = normalizeNarrationMarkup(text);
    if (!normalizedInput) return null;

    const ttsKey = getRuntimeApiKey("api-tts", "gh_api_tts");
    if (!ttsKey) {
        throw new Error("ไม่มี Google Cloud TTS Key กรุณาตั้งค่าในหน้า Settings ก่อนครับ");
    }

    const audioBuffer = await synthesizeWithGoogleCloudTTS(normalizedInput, voiceId);
    if (!audioBuffer) {
        throw new Error("Google Cloud TTS ไม่ได้ส่งเสียงกลับมา");
    }

    return audioBuffer;
}

async function synthesizeCloudTTS(text, voiceId = DEFAULT_TTS_VOICE, voiceId2 = "Kore") {
    const rawText = String(text || "").trim();
    if (!rawText) return null;

    const speakerRegex = /\[([AB])\]:\s*(.*?)(?=\s*\[[AB]\]:|$)/gs;
    const matches = [...rawText.matchAll(speakerRegex)];

    if (matches.length > 0) {
        const sequence = [];

        for (const match of matches) {
            const role = match[1];
            const content = match[2].trim();
            if (!content) continue;

            const activeVoiceId = role === "A" ? voiceId : (voiceId2 || voiceId);
            const segment = await synthesizeToAudioBuffer(content, activeVoiceId);
            if (!segment) continue;

            sequence.push(segment);
            sequence.push(createSilentAudioBuffer(segment.sampleRate, segment.numberOfChannels, TTS_SPEAKER_GAP_SECONDS));
        }

        if (sequence.length) sequence.pop();
        const dialogue = await renderAudioSequence(sequence, { gapSeconds: 0, crossfadeSeconds: TTS_CROSSFADE_SECONDS });
        return dialogue ? audioBufferToWavArrayBuffer(dialogue) : null;
    }

    const narration = await synthesizeToAudioBuffer(rawText, voiceId);
    return narration ? audioBufferToWavArrayBuffer(narration) : null;
}

async function runCloudTTSDiagnostics(text, voiceId = DEFAULT_TTS_VOICE) {
    const chunks = splitTtsText(text, TTS_MAX_CHARS);
    const rendered = await synthesizeWithGoogleCloudTTS(text, voiceId);

    return {
        voiceId,
        chunkCount: chunks.length,
        chunks: chunks.map((chunk, index) => ({
            index,
            length: chunk.text.length,
            preview: chunk.text.slice(0, 120)
        })),
        renderedDuration: rendered?.duration || 0,
        sampleRate: rendered?.sampleRate || 0
    };
}

window.TTS_VOICES = TTS_VOICES;
window.GEMINI_VOICES = TTS_VOICES;
window.synthesizeCloudTTS = synthesizeCloudTTS;
window.runCloudTTSDiagnostics = runCloudTTSDiagnostics;


