// ==========================================
//  GhostAI Studio - Multi-API Story Gen
// ==========================================
// NOTE: This file is for script and text generation only.
// Do not add Gemini TTS or runtime voice playback logic here.

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

const HORROR_TEMPLATES = {
    classic: { name: "Classic", keyword: "บ้านผีสิงเก่าแก่, เสียงฝีเท้า", genre: "สยองขวัญ", gore: 70 },
    creepypasta: { name: "Creepypasta", keyword: "เว็บไซต์ลึกลับ, คลิปต้องห้าม", genre: "ลึกลับ", gore: 50 },
    forest: { name: "Forest", keyword: "แคมป์กลางป่า, สิ่งที่เดินตาม", genre: "ระทึกขวัญ", gore: 60 },
    hospital: { name: "Hospital", keyword: "โรงพยาบาลร้าง, ห้องดับจิต", genre: "สยองขวัญ", gore: 85 },
    school: { name: "School", keyword: "โรงเรียนเก่า, ห้องน้ำชั้น 4", genre: "สยองขวัญ", gore: 55 }
};

const STORY_BREAK_TAG_REGEX = /<break\s+time\s*=\s*"([^"]+)"\s*\/>/i;
const STORY_BREAK_TAG_GLOBAL_REGEX = /<break\s+time\s*=\s*"([^"]+)"\s*\/>/gi;
const STORY_WORDS_PER_MINUTE = 95;
const STORY_MIN_RATIO = 0.82;
const STORY_MAX_RATIO = 1.08;
const THAI_SENTENCE_SPLIT_REGEX = /(?<=[.!?…]|[ก-๙][\u0E2F])\s+/u;

function normalizeBreakDuration(duration) {
    const raw = String(duration || "").trim().toLowerCase();
    if (/^\d+ms$/.test(raw)) return raw;
    if (/^\d+(?:\.\d+)?s$/.test(raw)) {
        const ms = Math.round(parseFloat(raw) * 1000);
        return `${Math.min(2000, Math.max(150, ms))}ms`;
    }
    return "500ms";
}

function normalizeBreakTag(tagOrDuration) {
    const match = String(tagOrDuration || "").match(STORY_BREAK_TAG_REGEX);
    const duration = match ? match[1] : tagOrDuration;
    return `<break time="${normalizeBreakDuration(duration)}"/>`;
}

function getDurationWordTarget(durationMinutes = 3) {
    const safeMinutes = Math.min(10, Math.max(1, Number(durationMinutes) || 3));
    const target = Math.round(safeMinutes * STORY_WORDS_PER_MINUTE);
    return {
        minutes: safeMinutes,
        target,
        min: Math.max(70, Math.round(target * STORY_MIN_RATIO)),
        max: Math.max(100, Math.round(target * STORY_MAX_RATIO))
    };
}

function buildStoryPrompt(keyword, goreLevel, genre, durationMinutes = 3, style = "เรื่องเล่า") {
    const duration = getDurationWordTarget(durationMinutes);

    return `คุณคือนักเขียนสคริปต์เรื่องผีภาษาไทยสำหรับเล่าในช่องหรือพอดแคสต์

คีย์เวิร์ด: ${keyword}
แนวเรื่อง: ${genre}
สไตล์การเล่า: ${style}
ระดับความโหด: ${goreLevel}/100
ความยาวที่ต้องการ: ${duration.minutes} นาที
จำนวนคำเป้าหมาย: ประมาณ ${duration.target} คำ
จำนวนคำสูงสุด: ห้ามเกิน ${duration.max} คำ

โครงสร้างสคริปต์ที่ต้องมีครบทุกส่วน:
1. ชื่อเรื่อง
- บรรทัดแรกสุดต้องเป็นชื่อเรื่องสั้น กระชับ น่าสนใจ
- หลังชื่อเรื่องให้เว้นบรรทัดว่าง 1 บรรทัด แล้วค่อยเข้าเนื้อเรื่อง

2. Hook / เปิดรายการ
- ทักทายผู้ฟัง
- แนะนำตัวเองด้วยชื่อที่สุ่มขึ้นมาใหม่ทุกครั้ง
- แนะนำชื่อรายการที่สุ่มขึ้นมาใหม่ทุกครั้ง
- บอกใบ้ว่าคืนนี้เป็นเรื่องที่เกิดในจังหวัดไหนของไทย และทำไมถึงน่ากลัว

3. Setup / ปูเรื่อง
- แนะนำตัวละครหลัก สถานที่ และช่วงเวลา
- ใช้ประสาทสัมผัสทั้ง 5 ให้ชัด ทั้งกลิ่น เสียง สัมผัส สิ่งที่เห็น และอุณหภูมิ
- เน้นรายละเอียดกลิ่น เสียงรอบข้าง และความรู้สึกทางกายให้เห็นภาพ

4. Build-up & Climax / สร้างความตึงเครียดและจุดพีก
- เริ่มจากความผิดปกติเล็ก ๆ ก่อน แล้วค่อยไต่ระดับ
- ค่อย ๆ เปิดเผยว่าสิ่งที่เจอไม่ใช่เรื่องปกติ
- จุดพีกต้องขนลุก เห็นภาพชัด และมีแรงกระแทกทางอารมณ์
- ใส่ [JUMP_SCARE] ได้ไม่เกิน 2 จุด และใช้เฉพาะจุดที่คุ้มจริง ๆ

5. Closing / ปิดท้าย
- สรุปว่าเกิดอะไรขึ้นกับตัวละครหลังเหตุการณ์
- ทิ้งคำถามปลายเปิดให้คนฟังคิดต่อ
- ปิดด้วยประโยคสุดท้ายที่ทิ้งความหลอน

ข้อกำหนดสำคัญ:
- เขียนเป็นภาษาไทยล้วน
- ต้องคุมความยาวให้ใกล้ ${duration.minutes} นาทีจริง
- ถ้าเป็น ${duration.minutes} นาที ให้กระชับตรงประเด็น ห้ามยืด ห้ามวก ห้ามสรุปซ้ำ
- ห้ามเขียนประโยควนซ้ำ เช่น "และเราก็ไม่แน่ใจว่า..." หรือ "เรื่องราวของ...จะ..."
- ห้ามเขียนปิดท้ายแบบอธิบายซ้ำอีกรอบหลัง closing
- ใช้เครื่องหมายวรรคตอนช่วยจังหวะหายใจอย่างเป็นธรรมชาติ เช่น , ... ! ?
- อนุญาตให้ใส่ <break time="300ms"/>, <break time="500ms"/>, หรือ <break time="900ms"/> ได้เฉพาะจุดพักใหญ่จริง ๆ
- ใช้ <break .../> เท่าที่จำเป็นเท่านั้น ประมาณ 0-2 จุดทั้งเรื่องก็พอ
- ถ้าใช้ <break .../> ให้ใส่เป็นบรรทัดเดี่ยวของมันเอง คั่นระหว่างย่อหน้าเท่านั้น
- ห้ามใส่ <break .../> กลางย่อหน้า
- ห้ามใส่ bullet points, markdown, หัวข้อย่อย, วงเล็บอธิบาย, หรือคำอธิบายนอกเรื่อง
- ห้ามใส่แท็กพิเศษอื่นนอกจาก <break .../> และ [JUMP_SCARE]
- ทุกย่อหน้าต้องมีข้อมูลใหม่ ไม่ใช่การพูดซ้ำหรือขยายซ้ำด้วยถ้อยคำเดิม

รูปแบบคำตอบ:
- ตอบเป็นสคริปต์อย่างเดียวเท่านั้น
- บรรทัดแรกเป็นชื่อเรื่อง
- เว้น 1 บรรทัด
- จากนั้นเป็นเนื้อเรื่องหลายย่อหน้าตามลำดับ
- ถ้าใช้ <break .../> ให้แยกเป็นบรรทัดเดี่ยวเสมอ โดยมีบรรทัดว่างก่อนและหลัง`;
}

function normalizeStoryLine(line) {
    return String(line || "")
        .replace(/\s+/g, " ")
        .replace(/[“”]/g, "\"")
        .replace(/[‘’]/g, "'")
        .trim();
}

function countThaiWords(text) {
    return String(text || "")
        .replace(STORY_BREAK_TAG_GLOBAL_REGEX, " ")
        .replace(/\[JUMP_SCARE\]/gi, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;
}

function normalizeForDedup(text) {
    return String(text || "")
        .replace(STORY_BREAK_TAG_GLOBAL_REGEX, " ")
        .replace(/\[JUMP_SCARE\]/gi, " ")
        .replace(/[“”"']/g, "")
        .replace(/[,.!?…:;()\[\]-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function splitIntoSentences(paragraph) {
    return String(paragraph || "")
        .split(THAI_SENTENCE_SPLIT_REGEX)
        .map((sentence) => normalizeStoryLine(sentence))
        .filter(Boolean);
}

function dedupeRepeatedSentences(text) {
    const paragraphs = String(text || "")
        .split(/\n{2,}/)
        .map((part) => part.trim())
        .filter(Boolean);

    const seenSentences = new Set();
    const cleanedParagraphs = [];

    for (const paragraph of paragraphs) {
        if (STORY_BREAK_TAG_REGEX.test(paragraph) && paragraph.replace(STORY_BREAK_TAG_GLOBAL_REGEX, "").trim() === "") {
            if (cleanedParagraphs[cleanedParagraphs.length - 1] !== paragraph) cleanedParagraphs.push(normalizeBreakTag(paragraph));
            continue;
        }

        const keptSentences = [];
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

function trimRepeatedTail(text) {
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
        if (match && typeof match.index === "number") {
            cleaned = cleaned.slice(0, match.index).trim();
        }
    }

    const paragraphs = cleaned.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
    const compacted = [];
    const seenTail = new Set();

    for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];
        if (STORY_BREAK_TAG_REGEX.test(paragraph) && paragraph.replace(STORY_BREAK_TAG_GLOBAL_REGEX, "").trim() === "") {
            if (compacted[compacted.length - 1] !== paragraph) compacted.push(normalizeBreakTag(paragraph));
            continue;
        }

        const normalized = normalizeForDedup(paragraph);
        if (i >= Math.max(1, paragraphs.length - 3) && normalized.length > 40) {
            if (seenTail.has(normalized)) continue;
            seenTail.add(normalized);
        }

        compacted.push(paragraph);
    }

    return compacted.join("\n\n").trim();
}

function trimParagraphsToWordLimit(text, maxWords) {
    const paragraphs = String(text || "")
        .split(/\n{2,}/)
        .map((part) => part.trim())
        .filter(Boolean);

    if (!paragraphs.length) return "";

    const kept = [];
    let wordCount = 0;

    for (const paragraph of paragraphs) {
        const isBreak = STORY_BREAK_TAG_REGEX.test(paragraph) && paragraph.replace(STORY_BREAK_TAG_GLOBAL_REGEX, "").trim() === "";
        if (isBreak) {
            if (kept.length && kept[kept.length - 1] !== normalizeBreakTag(paragraph)) kept.push(normalizeBreakTag(paragraph));
            continue;
        }

        const paragraphWords = countThaiWords(paragraph);
        if (!kept.length || wordCount + paragraphWords <= maxWords) {
            kept.push(paragraph);
            wordCount += paragraphWords;
            continue;
        }

        const sentences = splitIntoSentences(paragraph);
        const partial = [];
        for (const sentence of sentences) {
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

function enforceStoryDuration(text, durationMinutes) {
    const duration = getDurationWordTarget(durationMinutes);
    const currentWords = countThaiWords(text);
    if (currentWords <= duration.max) return text;
    return trimParagraphsToWordLimit(text, duration.max);
}

function cleanupGeneratedStory(text, durationMinutes = 3) {
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
    const cleanedParagraphs = [];
    const seenParagraphs = new Map();

    for (const line of lines) {
        if (STORY_BREAK_TAG_REGEX.test(line) && line.replace(STORY_BREAK_TAG_GLOBAL_REGEX, "").trim() === "") {
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
        const lastStop = Math.max(
            truncated.lastIndexOf("."),
            truncated.lastIndexOf("!"),
            truncated.lastIndexOf("?"),
            truncated.lastIndexOf("\n")
        );
        cleaned = (lastStop > 1000 ? truncated.slice(0, lastStop + 1) : truncated).trim();
    }

    return `${title}\n\n${cleaned}`.trim();
}

async function generateGhostStory(keyword, goreLevel, genre, durationMinutes = 3, style = "เรื่องเล่า") {
    const provider = localStorage.getItem("gh_active_ai") || "gemini";
    const prompt = buildStoryPrompt(keyword, goreLevel, genre, durationMinutes, style);

    try {
        if (provider === "gemini") {
            const apiKey = localStorage.getItem("gh_api_gemini");
            if (!apiKey) return cleanupGeneratedStory(getMockStory(keyword, "Gemini"), durationMinutes);

            const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.75,
                        maxOutputTokens: 2200
                    }
                })
            });

            if (!res.ok) throw new Error("Gemini API Error");
            const data = await res.json();
            return cleanupGeneratedStory(data.candidates?.[0]?.content?.parts?.[0]?.text || "", durationMinutes);
        }

        if (provider === "groq") {
            const apiKey = localStorage.getItem("gh_api_groq");
            if (!apiKey) return cleanupGeneratedStory(getMockStory(keyword, "Groq"), durationMinutes);

            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        {
                            role: "system",
                            content: "คุณเป็นนักเล่าเรื่องผีมืออาชีพ เขียนสคริปต์ภาษาไทยให้เล่าลื่น กระชับตามเวลาที่กำหนด ไม่วก ไม่สรุปซ้ำ และใช้ <break .../> เท่าที่จำเป็นเท่านั้น"
                        },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.75,
                    max_tokens: 1800
                })
            });

            if (!res.ok) throw new Error("Groq API Error");
            const data = await res.json();
            return cleanupGeneratedStory(data.choices?.[0]?.message?.content || "", durationMinutes);
        }

        if (provider === "openrouter") {
            const apiKey = localStorage.getItem("gh_api_openrouter");
            if (!apiKey) return cleanupGeneratedStory(getMockStory(keyword, "OpenRouter"), durationMinutes);

            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": window.location.href,
                    "X-Title": "GhostAI Studio"
                },
                body: JSON.stringify({
                    model: "openrouter/auto",
                    messages: [
                        {
                            role: "system",
                            content: "คุณเป็นนักเล่าเรื่องผีมืออาชีพ เขียนสคริปต์ภาษาไทยให้เล่าลื่น กระชับตามเวลาที่กำหนด ไม่วก ไม่สรุปซ้ำ และใช้ <break .../> เท่าที่จำเป็นเท่านั้น"
                        },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.75,
                    max_tokens: 1800
                })
            });

            if (!res.ok) throw new Error("OpenRouter API Error");
            const data = await res.json();
            return cleanupGeneratedStory(data.choices?.[0]?.message?.content || "", durationMinutes);
        }
    } catch (err) {
        console.error(`[GhostAI] API fail [${provider}]:`, err);
        return cleanupGeneratedStory(getMockStory(keyword, `${provider} ล้มเหลว`), durationMinutes);
    }

    return cleanupGeneratedStory(getMockStory(keyword, "Unknown API"), durationMinutes);
}

async function requestTextFromActiveProvider(prompt, { temperature = 0.7, maxTokens = 2200 } = {}) {
    const provider = localStorage.getItem("gh_active_ai") || "gemini";

    if (provider === "gemini") {
        const apiKey = localStorage.getItem("gh_api_gemini");
        if (!apiKey) throw new Error("No Gemini key");

        const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature,
                    maxOutputTokens: maxTokens
                }
            })
        });

        if (!res.ok) throw new Error(`Gemini API Error (${res.status})`);
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    if (provider === "groq") {
        const apiKey = localStorage.getItem("gh_api_groq");
        if (!apiKey) throw new Error("No Groq key");

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: prompt }],
                temperature,
                max_tokens: maxTokens
            })
        });

        if (!res.ok) throw new Error(`Groq API Error (${res.status})`);
        const data = await res.json();
        return data.choices?.[0]?.message?.content || "";
    }

    if (provider === "openrouter") {
        const apiKey = localStorage.getItem("gh_api_openrouter");
        if (!apiKey) throw new Error("No OpenRouter key");

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
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

        if (!res.ok) throw new Error(`OpenRouter API Error (${res.status})`);
        const data = await res.json();
        return data.choices?.[0]?.message?.content || "";
    }

    throw new Error("Unknown AI provider");
}

async function enhanceGeneratedScript(scriptText) {
    const cleanInput = String(scriptText || "").trim();
    if (!cleanInput) return "";

    const currentWords = countThaiWords(cleanInput);
    const estimatedMinutes = Math.max(1, Math.round(currentWords / STORY_WORDS_PER_MINUTE));
    const duration = getDurationWordTarget(estimatedMinutes);

    const prompt = `ช่วยปรับสคริปต์ภาษาไทยสำหรับงานพากย์ให้อ่านลื่นขึ้น โดยคงเนื้อหาเดิมไว้ให้มากที่สุด

เป้าหมาย:
- แก้คำ เว้นวรรค และจังหวะประโยคที่แปลก
- ลดคำซ้ำ การปิดท้ายวก และประโยคอธิบายซ้ำ
- ปรับถ้อยคำให้เหมาะกับการอ่านออกเสียงภาษาไทย
- ถ้าคำไหนเสี่ยงให้ TTS อ่านสะกดทีละตัว ให้เขียนใหม่ให้อ่านเป็นคำธรรมชาติ
- คุมความยาวให้ใกล้ ${duration.minutes} นาที หรือประมาณ ${duration.target} คำ

กติกา:
- บรรทัดแรกต้องเป็นชื่อเรื่อง
- เว้น 1 บรรทัดหลังชื่อเรื่อง
- ถ้าใช้ <break time="..."/> ให้เป็นบรรทัดเดี่ยวของมันเองเสมอ
- ใช้ <break .../> เฉพาะจุดพักใหญ่เท่านั้น และไม่เกิน 2 จุด
- ห้าม markdown, bullet, คำอธิบายนอกเรื่อง
- ห้ามเปลี่ยนเรื่องใหม่
- ห้ามสรุปซ้ำหรือลาก closing ยาว
- ตอบเป็นสคริปต์ที่ปรับแล้วอย่างเดียว

สคริปต์ต้นฉบับ:
${cleanInput}`;

    const raw = await requestTextFromActiveProvider(prompt, { temperature: 0.35, maxTokens: 2200 });
    return cleanupGeneratedStory(raw || cleanInput, duration.minutes);
}

async function testAIConnection(provider, apiKey) {
    if (!apiKey) {
        return { success: false, msg: "กรุณากรอก API Key ก่อนทดสอบครับ" };
    }

    async function getErrorDetail(res) {
        try {
            const errData = await res.json();
            if (errData.error?.message) return errData.error.message;
            if (errData.error?.status) return `${errData.error.status}: ${errData.error.message || ""}`;
            return JSON.stringify(errData).substring(0, 150);
        } catch {
            return `HTTP ${res.status}`;
        }
    }

    try {
        if (provider === "gemini") {
            const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: "สวัสดี" }] }] })
            });
            if (res.ok) return { success: true, msg: "เชื่อมต่อ Gemini สำเร็จ" };
            return { success: false, msg: `ข้อผิดพลาด: ${await getErrorDetail(res)}` };
        }

        if (provider === "groq") {
            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: "Hi, reply OK" }],
                    max_tokens: 5
                })
            });
            if (res.ok) return { success: true, msg: "เชื่อมต่อ Groq สำเร็จ" };
            return { success: false, msg: `ข้อผิดพลาด: ${await getErrorDetail(res)}` };
        }

        if (provider === "openrouter") {
            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": window.location.href,
                    "X-Title": "GhostAI Studio"
                },
                body: JSON.stringify({
                    model: "openrouter/auto",
                    messages: [{ role: "user", content: "Hi, reply OK" }],
                    max_tokens: 5
                })
            });
            if (res.ok) return { success: true, msg: "เชื่อมต่อ OpenRouter สำเร็จ" };
            return { success: false, msg: `ข้อผิดพลาด: ${await getErrorDetail(res)}` };
        }

        if (provider === "tts") {
            const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    input: { text: "ทดสอบระบบเสียงภาษาไทย" },
                    voice: { languageCode: "th-TH", name: "th-TH-Neural2-C" },
                    audioConfig: { audioEncoding: "LINEAR16" }
                })
            });
            if (res.ok) return { success: true, msg: "เชื่อมต่อ Cloud TTS สำเร็จ" };
            return { success: false, msg: `ข้อผิดพลาด: ${await getErrorDetail(res)}` };
        }
    } catch (e) {
        return { success: false, msg: `ล้มเหลวหรือติด CORS: ${e.message}` };
    }

    return { success: false, msg: "ไม่รู้จัก provider ที่เลือก" };
}

function getMockStory(keyword, errorType) {
    return `เงาในทางแคบ

สวัสดีครับทุกท่าน ผมชื่อทิวา ยินดีต้อนรับสู่รายการ เสียงจากเงามืด คืนนี้ผมมีเรื่องที่เกิดขึ้นใกล้ ${keyword} มาเล่าให้ฟัง เป็นเรื่องที่คนแถวนั้นยังไม่กล้าพูดถึงกันตรง ๆ เพราะทุกครั้งที่นึกถึง มันจะมาพร้อมความเย็นวาบตรงต้นคอเสมอ

<break time="500ms"/>

เรื่องนี้เริ่มจากชายคนหนึ่งที่ต้องเดินกลับบ้านผ่านตรอกแคบในคืนฝนพรำ เขาได้กลิ่นดินเปียกผสมกลิ่นน้ำค้างเก่าและกลิ่นเหม็นจาง ๆ คล้ายของที่ถูกทิ้งไว้นานหลายปี เสียงน้ำหยดจากชายคาเคาะพื้นเป็นจังหวะเหมือนมีใครบางคนกำลังก้าวตามหลัง ทั้งที่ตรอกนั้นควรจะว่างเปล่า

เขาพยายามบอกตัวเองว่าเป็นแค่ลมกับความกลัว แต่ยิ่งเดินเร็ว เสียงก้าวด้านหลังก็ยิ่งชัดขึ้น เหมือนรองเท้าเปียกน้ำกำลังลากไปบนปูนเก่า [JUMP_SCARE] เขาหยุดเดินทันที แล้วเสียงนั้นก็หยุดพร้อมกัน เมื่อหันกลับไป เขาไม่เห็นใครเลย มีเพียงเงาดำยาวผิดรูปทอดอยู่บนพื้นเปียก ทั้งที่ตรงนั้นไม่มีต้นไม้หรือเสาไฟพอจะสร้างเงาแบบนั้นได้

<break time="700ms"/>

เขารีบสาวเท้าต่อ หัวใจเต้นแรงจนแทบหายใจไม่ทัน แล้วกลิ่นเหม็นอับก็เปลี่ยนเป็นกลิ่นคาวสดชัดขึ้น ราวกับมีอะไรบางอย่างถูกซ่อนไว้ไม่ไกล จากนั้นเสียงกระซิบก็มาลอยแนบหูอย่างช้า ๆ ว่า มาช้าไปแล้ว [JUMP_SCARE] ประตูไม้เก่าข้างทางเปิดออกเองอย่างแรง เผยความมืดสนิทด้านในพร้อมรอยยิ้มซีดบวมของบางสิ่งที่ไม่ควรยืนอยู่ตรงนั้น

เช้าวันถัดมาเขากลับไปพร้อมคนในชุมชน แต่ไม่พบประตูบานนั้นอีกเลย เหลือเพียงคราบน้ำสีคล้ำและรอยนิ้วมือยาวผิดมนุษย์บนกำแพงปูน ทุกวันนี้เขายังไม่กล้าเดินผ่านตรอกนั้นหลังฝนตก และไม่มีใครตอบได้ว่าคืนนั้น สิ่งที่เรียกเขาเข้าไปในความมืดคืออะไรกันแน่ (แจ้งเตือน: นี่คือเรื่องจำลองในโหมด Offline เนื่องจาก ${errorType})`;
}
