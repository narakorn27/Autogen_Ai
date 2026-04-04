const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

const BOARD_LAYOUT = [
    ["ก", "ข", "ค", "ฆ", "ง", "จ", "ฉ", "ช", "ซ", "ฌ"],
    ["ญ", "ฎ", "ฏ", "ฐ", "ฑ", "ฒ", "ณ", "ด", "ต", "ถ"],
    ["ท", "ธ", "น", "บ", "ป", "ผ", "ฝ", "พ", "ฟ", "ภ"],
    ["ม", "ย", "ร", "ล", "ว", "ศ", "ษ", "ส", "ห", "ฬ"],
    [
        { key: "ทางเข้า", label: "← ทางเข้า", colSpan: 3, className: "board-cell--word board-cell--special board-cell--wide" },
        { key: "ที่พัก", label: "ที่พัก", colSpan: 4, className: "board-cell--word board-cell--special board-cell--center" },
        { key: "ทางออก", label: "ทางออก →", colSpan: 3, className: "board-cell--word board-cell--special board-cell--wide" },
    ],
    ["อ", "ฮ", "ะ", "า", "ำ", "ๅ", "ฤ", "ฦ", "ห์", "ฯ"],
    ["ั", "ิ", "ี", "ึ", "ื", "ุ", "ู", "เ", "แ", "โ"],
    ["ใ", "ไ", "็", "่", "้", "๊", "๋", "์", "ๆ", "ำ"],
    ["+", "๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘"],
    [
        "๙",
        { key: "ชาย", label: "ชาย", colSpan: 2, className: "board-cell--word board-cell--special" },
        { key: "หญิง", label: "หญิง", colSpan: 3, className: "board-cell--word board-cell--special" },
        { key: "ใช่", label: "ใช่", colSpan: 2, className: "board-cell--word board-cell--special" },
        { key: "ไม่ใช่", label: "ไม่ใช่", colSpan: 2, className: "board-cell--word board-cell--special" },
    ],
];

const TOKEN_ALIASES = {
    YES: "ใช่",
    NO: "ไม่ใช่",
    MALE: "ชาย",
    FEMALE: "หญิง",
    GOODBYE: "ทางออก",
    EXIT: "ทางออก",
    ENTER: "ทางเข้า",
    ENTRY: "ทางเข้า",
    REST: "ที่พัก",
};

const QUESTION_INTENTS = {
    gender: ["ชาย", "หญิง", "ไม่ใช่"],
    yesNo: ["ใช่", "ไม่ใช่"],
    location: ["ทางเข้า", "ทางออก", "ที่พัก"],
    identity: ["ชาย", "หญิง", "ที่พัก", "ทางออก"],
};

const SPIRIT_PERSONAS = [
    {
        id: "lady-ruen-thai",
        name: "ผีเรือนไทย",
        intro: "นางเฝ้าเรือนไม้เก่า พูดสุภาพ นุ่ม แต่ชวนขนลุก",
        style: "ตอบคล้ายหญิงไทยโบราณ ใช้คำอย่าง ข้า, เจ้า, ท่าน ได้บ้าง แต่ไม่เยิ่นเย้อ",
        traits: ["รักความเรียบร้อย", "มักตอบตรงแต่ไม่พูดหมด", "ชอบเตือนมากกว่าขู่"],
        bias: { gender: "หญิง", location: "ที่พัก" },
    },
    {
        id: "soldier-spirit",
        name: "วิญญาณทหาร",
        intro: "วิญญาณชายที่พูดสั้น หนักแน่น ตรงประเด็น",
        style: "ตอบกระชับ เด็ดขาด คล้ายคนผ่านศึก",
        traits: ["ชอบคำตอบสั้น", "ไม่อ้อมค้อม", "ให้ความรู้สึกจริงจัง"],
        bias: { gender: "ชาย", location: "ทางออก" },
    },
    {
        id: "hungry-ghost",
        name: "ผีเปรตเฝ้าทาง",
        intro: "เสียงแหบพร่า ตอบแปลกนิดหน่อย แต่ยังคุยรู้เรื่อง",
        style: "ตอบสั้น ลึกลับ มีความหิวโหยหรือเว้าวอนปนอยู่",
        traits: ["ชอบคำตอบคลุมเครือ", "ชี้ทางเข้าออกบ่อย", "อารมณ์แกว่ง"],
        bias: { yesNo: "ไม่ใช่", location: "ทางเข้า" },
    },
    {
        id: "child-spirit",
        name: "วิญญาณเด็ก",
        intro: "เด็กที่พูดสั้น ซื่อ แต่มีบรรยากาศแปลกเย็น",
        style: "ตอบสั้นแบบเด็ก พูดง่าย ๆ แต่ชวนขนลุก",
        traits: ["ชอบตอบตรง", "ไม่พูดประโยคยาว", "มักย้ำคำเดิม"],
        bias: { yesNo: "ใช่", location: "ที่พัก" },
    },
    {
        id: "cemetery-keeper",
        name: "ผีเฝ้าป่าช้า",
        intro: "ผู้เฝ้าสถานที่เก่าแก่ พูดช้า สุขุม เหมือนรู้มากกว่าเล่า",
        style: "ตอบหนักแน่น สุขุม เป็นผู้ใหญ่ และชอบทิ้งนัย",
        traits: ["นิ่ง", "ชอบคำตอบมีนัย", "มักพาคุยเรื่องทางเข้าออกและการจากลา"],
        bias: { identity: "ทางออก", location: "ทางออก" },
    },
];

let isMoving = false;
const boardMap = new Map();
let currentSpirit = null;

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function createCell(item, row, col) {
    const grid = document.getElementById("board-grid");
    const cell = document.createElement("div");

    const config = typeof item === "string"
        ? { key: item, label: item, colSpan: 1, rowSpan: 1, className: "" }
        : { rowSpan: 1, colSpan: 1, className: "", ...item };

    cell.className = `board-cell ${config.className || ""}`.trim();
    cell.textContent = config.label;
    cell.style.gridColumn = `${col} / span ${config.colSpan}`;
    cell.style.gridRow = `${row} / span ${config.rowSpan}`;

    if (String(config.label).length <= 2 && !(config.className || "").includes("word")) {
        cell.classList.add("board-cell--small");
    }

    grid.appendChild(cell);
    boardMap.set(config.key, { el: cell, key: config.key });

    return config.colSpan;
}

function initOuijaBoard() {
    const grid = document.getElementById("board-grid");
    if (!grid) return;

    grid.innerHTML = "";
    boardMap.clear();

    BOARD_LAYOUT.forEach((rowItems, rowIndex) => {
        let col = 1;
        rowItems.forEach((item) => {
            col += createCell(item, rowIndex + 1, col);
        });
    });
}

function getPlanchette() {
    return document.getElementById("planchette");
}

function movePlanchetteToKey(key) {
    const target = boardMap.get(key);
    const grid = document.getElementById("board-grid");
    const planchette = getPlanchette();
    if (!target || !grid || !planchette) return;

    const gridRect = grid.getBoundingClientRect();
    const cellRect = target.el.getBoundingClientRect();
    const boardRect = planchette.offsetParent.getBoundingClientRect();
    const centerX = cellRect.left - boardRect.left + cellRect.width / 2;
    const centerY = cellRect.top - boardRect.top + cellRect.height / 2;

    planchette.style.left = `${centerX}px`;
    planchette.style.top = `${centerY}px`;
}

async function highlightKey(key, linger = 420) {
    const target = boardMap.get(key);
    if (!target) return;

    movePlanchetteToKey(key);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    target.el.classList.add("active");
    await new Promise((resolve) => setTimeout(resolve, linger));
    target.el.classList.remove("active");
}

function normalizeBoardText(rawValue) {
    const clean = String(rawValue || "")
        .replace(/[.,!?/\\|[\]{}()"'`~@#$%^&*_+=<>:;-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!clean) return "";

    const upper = clean.toUpperCase();
    if (TOKEN_ALIASES[upper]) return TOKEN_ALIASES[upper];

    return clean;
}

function canSpellOnBoard(value) {
    return !!value && [...value].every((char) => boardMap.has(char) || char === " ");
}

function getRandomSpirit() {
    const index = Math.floor(Math.random() * SPIRIT_PERSONAS.length);
    return SPIRIT_PERSONAS[index];
}

function ensureSpirit(forceNew = false) {
    if (!currentSpirit || forceNew) {
        currentSpirit = getRandomSpirit();
    }
    return currentSpirit;
}

function updateSpiritStatus(spirit) {
    const connection = document.getElementById("connection-status");
    if (!connection || !spirit) return;

    connection.innerHTML = `
        <span class="text-xs text-gray-500 font-medium uppercase tracking-tighter">Spirit Link</span>
        <div class="w-2 h-2 rounded-full bg-crimson-500 animate-pulse"></div>
        <span class="text-xs text-amber-100/70">${escapeHtml(spirit.name)}</span>
    `;
}

function detectQuestionIntent(question) {
    const text = String(question || "").trim();
    if (!text) return { type: "general", allowedBoards: [] };

    if (/(ผู้หญิง|ผู้ชาย|หญิง|ชาย|เพศ)/i.test(text)) {
        return { type: "gender", allowedBoards: QUESTION_INTENTS.gender };
    }

    if (/(ใช่ไหม|หรือไม่|ไหม|หรือเปล่า|จริงไหม|ใช่หรือไม่|yes|no)/i.test(text)) {
        return { type: "yesNo", allowedBoards: QUESTION_INTENTS.yesNo };
    }

    if (/(อยู่ที่ไหน|มาจากไหน|ทางไหน|เข้า|ออก|ไปไหน|พัก|อยู่ไหน)/i.test(text)) {
        return { type: "location", allowedBoards: QUESTION_INTENTS.location };
    }

    if (/(คุณเป็นใคร|เจ้าเป็นใคร|ท่านเป็นใคร|คือใคร|เป็นใคร)/i.test(text)) {
        return { type: "identity", allowedBoards: QUESTION_INTENTS.identity };
    }

    return { type: "general", allowedBoards: [] };
}

function inferBoardTextFromMessage(message, intent = { type: "general", allowedBoards: [] }) {
    const text = normalizeBoardText(message);
    if (!text) return "";

    if (boardMap.has(text) && (intent.allowedBoards.length === 0 || intent.allowedBoards.includes(text))) {
        return text;
    }

    const tokenMatchers = [
        { pattern: /(ใช่|yes|จริง|ถูกต้อง)/i, board: "ใช่" },
        { pattern: /(ไม่ใช่|ไม่|no|เปล่า|มิใช่)/i, board: "ไม่ใช่" },
        { pattern: /(ชาย|ผู้ชาย|male|man)/i, board: "ชาย" },
        { pattern: /(หญิง|ผู้หญิง|female|woman)/i, board: "หญิง" },
        { pattern: /(เข้า|เริ่ม|มา|ทางเข้า)/i, board: "ทางเข้า" },
        { pattern: /(ออก|ไป|พอแล้ว|ลาก่อน|ทางออก|bye|goodbye)/i, board: "ทางออก" },
        { pattern: /(พัก|หยุด|สงบ|ที่พัก)/i, board: "ที่พัก" },
    ];

    const tokenMatch = tokenMatchers.find(({ pattern, board }) => {
        if (intent.allowedBoards.length > 0 && !intent.allowedBoards.includes(board)) return false;
        return pattern.test(text);
    });
    if (tokenMatch) return tokenMatch.board;

    if (intent.allowedBoards.length > 0) {
        return "";
    }

    const compact = text.replace(/\s+/g, "");
    if (canSpellOnBoard(compact)) return compact;

    const shorter = [...compact].slice(0, 8).join("");
    if (canSpellOnBoard(shorter)) return shorter;

    return "";
}

function extractJsonBlock(text) {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    return match ? match[0] : text;
}

function parseSpiritPayload(rawText, intent) {
    const fallbackMessage = String(rawText || "").trim();

    try {
        const parsed = JSON.parse(extractJsonBlock(rawText));
        const message = typeof parsed.message === "string" ? parsed.message.trim() : fallbackMessage;
        const explicitBoard = typeof parsed.board === "string" ? normalizeBoardText(parsed.board) : "";
        const normalizedExplicitBoard = explicitBoard && (intent.allowedBoards.length === 0 || intent.allowedBoards.includes(explicitBoard))
            ? explicitBoard
            : "";

        return {
            message,
            board: normalizedExplicitBoard || inferBoardTextFromMessage(message, intent),
        };
    } catch {
        return {
            message: fallbackMessage,
            board: inferBoardTextFromMessage(fallbackMessage, intent),
        };
    }
}

async function spellBoardAnswer(boardText) {
    const planchette = getPlanchette();
    const log = document.getElementById("ritual-log");
    const cleanText = normalizeBoardText(boardText);
    if (!cleanText) return;

    isMoving = true;
    planchette?.classList.add("planchette-moving");

    if (boardMap.has(cleanText)) {
        await highlightKey(cleanText, 900);
    } else {
        for (const char of [...cleanText.replace(/\s+/g, "")]) {
            if (boardMap.has(char)) {
                await highlightKey(char, 340);
            }
        }
    }

    planchette?.classList.remove("planchette-moving");
    isMoving = false;
    log.innerHTML += `<div class="muted">แก้วหยุดนิ่งแล้ว</div>`;
}

function getBoardInstruction(intent) {
    const baseRules = [
        'ตอบเป็น JSON เท่านั้น รูปแบบ {"message":"ข้อความตอบกลับภาษาไทยสั้นๆเหมือนคุยกัน","board":"คำหรือข้อความบนกระดาน"}',
        'field board ต้องเป็นภาษาไทยเท่านั้น',
        'ถ้าตอบสั้นได้ ให้เลือกคำสำเร็จรูปจาก: ชาย, หญิง, ใช่, ไม่ใช่, ทางเข้า, ทางออก, ที่พัก',
        'ถ้าจะสะกดเอง ให้ใช้ข้อความไทยสั้นไม่เกิน 8 ตัวอักษร และต้องสะกดได้จากพยัญชนะ สระ วรรณยุกต์บนกระดาน',
        'ห้ามใส่ markdown ห้ามอธิบายเกิน JSON',
    ];

    if (intent.type === "gender") {
        baseRules.push('คำถามนี้เป็นเรื่องเพศ field board ต้องตอบได้แค่: ชาย, หญิง, ไม่ใช่');
    } else if (intent.type === "yesNo") {
        baseRules.push('คำถามนี้ต้องตอบแบบรับหรือปฏิเสธ field board ต้องเป็น: ใช่ หรือ ไม่ใช่');
    } else if (intent.type === "location") {
        baseRules.push('คำถามนี้เป็นเรื่องตำแหน่ง field board ควรเป็น: ทางเข้า, ทางออก, หรือ ที่พัก');
    } else if (intent.type === "identity") {
        baseRules.push('ถ้าคำถามถามว่าเป็นใคร ให้ตอบสาระสำคัญ ไม่ใช้คำกลางๆอย่าง "เป็น" หรือ "ข้า" เป็นค่า board');
    }

    return baseRules.join("\n");
}

function getSpiritPromptBlock(spirit, intent) {
    const allowedBoards = intent.allowedBoards.length > 0 ? intent.allowedBoards.join(", ") : "คำบนกระดานที่เหมาะสม";
    const personaBias = [
        spirit.bias.gender ? `ถ้าเข้ากับคำถามเรื่องเพศ มักเอนเอียงไปทาง ${spirit.bias.gender}` : "",
        spirit.bias.location ? `ถ้าเป็นเรื่องตำแหน่ง มักโยงไปที่ ${spirit.bias.location}` : "",
        spirit.bias.yesNo ? `ถ้าเป็นคำถามรับหรือปฏิเสธ น้ำหนักใจมักไปทาง ${spirit.bias.yesNo}` : "",
        spirit.bias.identity ? `ถ้าถามตัวตน มักนิยามตัวเองผ่าน ${spirit.bias.identity}` : "",
    ].filter(Boolean).join("\n");

    return [
        `บทบาทของเจ้า: ${spirit.name}`,
        `ภูมิหลัง: ${spirit.intro}`,
        `สไตล์การพูด: ${spirit.style}`,
        `นิสัยหลัก: ${spirit.traits.join(", ")}`,
        personaBias,
        `ถ้าคำถามนี้มีกรอบคำตอบ ให้ field board เลือกจาก: ${allowedBoards}`,
        "อย่าหลุดบท อย่าพูดเหมือน AI หรือโมเดลภาษา",
    ].filter(Boolean).join("\n");
}

async function fetchSpiritAnswer(provider, question, intent, spirit) {
    const prompt = [
        "คุณคือวิญญาณที่กำลังสื่อสารผ่านกระดานผีถ้วยแก้วไทย",
        getSpiritPromptBlock(spirit, intent),
        `คำถาม: "${question}"`,
        "ให้ตอบเหมือนกำลังคุยกับผู้ถามจริง น้ำเสียงสั้น ลึกลับ สุภาพ",
        getBoardInstruction(intent),
        'ตัวอย่าง: {"message":"ข้าเป็นชาย","board":"ชาย"}',
        'ตัวอย่าง: {"message":"ข้ายังอยู่","board":"อยู่"}',
    ].join("\n");

    if (provider === "gemini") {
        const apiKey = localStorage.getItem("gh_api_gemini");
        if (!apiKey) throw new Error("ไม่พบ Gemini API Key");

        const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
            }),
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    }

    if (provider === "groq") {
        const apiKey = localStorage.getItem("gh_api_groq");
        if (!apiKey) throw new Error("ไม่พบ Groq API Key");

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.8,
                response_format: { type: "json_object" },
            }),
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return data.choices?.[0]?.message?.content?.trim() || "";
    }

    throw new Error(`ยังไม่รองรับ provider: ${provider}`);
}

window.startOuijaSession = async function startOuijaSession() {
    if (isMoving) return;

    const input = document.getElementById("ouija-question");
    const question = input.value.trim();
    if (!question) return;

    const log = document.getElementById("ritual-log");
    const spirit = ensureSpirit();
    updateSpiritStatus(spirit);
    log.innerHTML = `
        <div class="glow">ถาม: ${escapeHtml(question)}</div>
        <div class="muted">วิญญาณที่เชื่อมอยู่: ${escapeHtml(spirit.name)} - ${escapeHtml(spirit.intro)}</div>
        <div class="muted">วิญญาณกำลังตอบกลับผ่านแก้ว...</div>
    `;
    input.value = "";

    const provider = localStorage.getItem("gh_active_ai") || "gemini";
    const intent = detectQuestionIntent(question);

    try {
        const rawAnswer = await fetchSpiritAnswer(provider, question, intent, spirit);
        const spiritReply = parseSpiritPayload(rawAnswer, intent);
        const boardAnswer = spiritReply.board;

        if (!boardAnswer) {
            throw new Error(`AI ตอบกลับมาแล้ว แต่ยังตีคำตอบบนกระดานไม่ได้: ${rawAnswer}`);
        }

        if (!boardMap.has(boardAnswer) && !canSpellOnBoard(boardAnswer)) {
            throw new Error(`คำว่า "${boardAnswer}" ไม่มีบนกระดาน`);
        }

        log.innerHTML = `
            <div class="glow">ถาม: ${escapeHtml(question)}</div>
            <div class="muted">วิญญาณที่เชื่อมอยู่: ${escapeHtml(spirit.name)}</div>
            <div class="text-amber-100/90">วิญญาณ: ${escapeHtml(spiritReply.message || boardAnswer)}</div>
            <div class="muted">แก้วกำลังชี้ไปที่: ${escapeHtml(boardAnswer)}</div>
        `;

        await spellBoardAnswer(boardAnswer);
    } catch (error) {
        log.innerHTML += `<div class="alert">พิธีขัดข้อง: ${escapeHtml(error.message)}</div>`;
        console.error(error);
        isMoving = false;
        getPlanchette()?.classList.remove("planchette-moving");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    initOuijaBoard();
    updateSpiritStatus(ensureSpirit(true));
    if (window.lucide) lucide.createIcons();
});
