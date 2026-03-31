// ========================================== //
//  👻 GhostAI Studio — Multi-API Story Gen   //
// ========================================== //

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;

const HORROR_TEMPLATES = {
    classic: { name: '🏚️ สยองขวัญคลาสสิก', keyword: 'บ้านผีสิงเก่าแก่, เสียงฝีเท้า', genre: 'สยองขวัญ', gore: 70 },
    creepypasta: { name: '📱 Creepypasta', keyword: 'เว็บลึกลับในอินเทอร์เน็ต, คลิปต้องห้าม', genre: 'ลึกลับ', gore: 50 },
    forest: { name: '🌲 เรื่องเล่าจากป่า', keyword: 'แคมป์ในป่าหลงทาง, สิ่งที่เดินตาม', genre: 'ระทึกขวัญ', gore: 60 },
    hospital: { name: '🏥 โรงพยาบาลร้าง', keyword: 'ห้องดับจิต, วิญญาณคนไข้', genre: 'สยองขวัญ', gore: 85 },
    school: { name: '🎓 โรงเรียนเก่า', keyword: 'ห้องน้ำชั้น 4, เด็กผีในชุดนักเรียน', genre: 'สยองขวัญ', gore: 55 }
};

function buildStoryPrompt(keyword, goreLevel, genre) {
    return `คุณคือนักเล่าเรื่องผีมืออาชีพ เขียนเรื่องผีสยองขวัญภาษาไทยตามเงื่อนไขนี้:
📌 คีย์เวิร์ด: ${keyword}
📌 แนวเรื่อง: ${genre}
📌 ระดับความโหด: ${goreLevel}/100

กฎ:
1. ความยาว 300-500 คำ เล่าให้อินและน่ากลัวที่สุด
2. ใส่ [JUMP_SCARE] 2 จุดในบริเวณที่เรื่องพีกที่สุด
3. ห้ามใช้หัวข้อหรือเกริ่นนำ ให้เริ่มเล่าเรื่องทันที`;
}

// ----------------------------------------------------
// 👻 Core Generator Engine (รองรับ 3 API)
// ----------------------------------------------------
async function generateGhostStory(keyword, goreLevel, genre) {
    const provider = localStorage.getItem('gh_active_ai') || 'gemini';
    const prompt = buildStoryPrompt(keyword, goreLevel, genre);

    try {
        if (provider === 'gemini') {
            const apiKey = localStorage.getItem('gh_api_gemini');
            if (!apiKey) return getMockStory(keyword, 'Gemini');

            const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9 } })
            });
            if (!res.ok) throw new Error('Gemini API Error');
            const data = await res.json();
            return data.candidates[0].content.parts[0].text.trim();

        } else if (provider === 'groq') {
            const apiKey = localStorage.getItem('gh_api_groq');
            if (!apiKey) return getMockStory(keyword, 'Groq');

            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        { role: 'system', content: 'You are an AI generating Thai horror stories. Output only the story without any markdown asterisks.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.9
                })
            });
            if (!res.ok) throw new Error('Groq API Error');
            const data = await res.json();
            return data.choices[0].message.content.trim();

        } else if (provider === 'openrouter') {
            const apiKey = localStorage.getItem('gh_api_openrouter');
            if (!apiKey) return getMockStory(keyword, 'OpenRouter');

            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'GhostAI Studio'
                },
                body: JSON.stringify({
                    model: 'openrouter/auto',
                    messages: [
                        { role: 'system', content: 'You are an AI generating Thai horror stories. Output only the story.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.9
                })
            });
            if (!res.ok) throw new Error('OpenRouter API Error');
            const data = await res.json();
            return data.choices[0].message.content.trim();
        }
    } catch (err) {
        console.error(`[GhostAI] API fail [${provider}]:`, err);
        return getMockStory(keyword, `${provider} ล้มเหลว`);
    }

    return getMockStory(keyword, 'Unknown API');
}

// ----------------------------------------------------
// 🔍 ระบบเช็ค API (ฝั่งหลังบ้าน) รองรับ 4 ตัว
// ----------------------------------------------------
async function testAIConnection(provider, apiKey) {
    if (!apiKey) return { success: false, msg: 'กรุณากรอก API Key ก่อนทดสอบครับ' };

    // Helper: ดึง error message จาก response body
    async function getErrorDetail(res) {
        try {
            const errData = await res.json();
            if (errData.error?.message) return errData.error.message;
            if (errData.error?.status) return `${errData.error.status}: ${errData.error.message || ''}`;
            return JSON.stringify(errData).substring(0, 150);
        } catch {
            return `HTTP ${res.status}`;
        }
    }

    try {
        if (provider === 'gemini') {
            const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: "สวัสดี" }] }] })
            });
            if (res.ok) return { success: true, msg: '✅ เชื่อมต่อ Gemini สำเร็จ!' };
            const detail = await getErrorDetail(res);
            return { success: false, msg: `❌ ข้อผิดพลาด: ${detail}` };

        } else if (provider === 'groq') {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'Hi, reply OK' }], max_tokens: 5 })
            });
            if (res.ok) return { success: true, msg: '✅ เชื่อมต่อ Groq สำเร็จ เลิศ!' };
            const detail = await getErrorDetail(res);
            return { success: false, msg: `❌ ข้อผิดพลาด: ${detail}` };

        } else if (provider === 'openrouter') {
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'GhostAI Studio'
                },
                body: JSON.stringify({ model: 'openrouter/auto', messages: [{ role: 'user', content: 'Hi, reply OK' }], max_tokens: 5 })
            });
            if (res.ok) return { success: true, msg: '✅ เชื่อมต่อ OpenRouter สำเร็จ!' };
            const detail = await getErrorDetail(res);
            return { success: false, msg: `❌ ข้อผิดพลาด: ${detail}` };

        } else if (provider === 'tts') {
            const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: { text: 'ทดสอบระบบเสียง' },
                    voice: { languageCode: 'th-TH', name: 'th-TH-Standard-A' },
                    audioConfig: { audioEncoding: 'LINEAR16' }
                })
            });
            if (res.ok) return { success: true, msg: '✅ เชื่อมต่อ Cloud TTS สำเร็จ!' };
            const detail = await getErrorDetail(res);
            return { success: false, msg: `❌ ข้อผิดพลาด: ${detail}` };
        }
    } catch (e) {
        return { success: false, msg: `❌ ล้มเหลวหรือติด CORS: ${e.message}` };
    }
}

function getMockStory(keyword, errorType) {
    return `ในคืนที่ฝนตกหนัก คุณเดินผ่าน ${keyword} กลิ่นคาวเลือดลอยแตะจมูก...
[JUMP_SCARE]
ปัง!! เสียงประตูปิดกระแทกอย่างแรงจากด้านหลัง! คุณหันไปมองแต่ไม่พบใคร
ท่ามกลางความมืด มีเสียงกระซิบเบาๆ ที่ข้างหูคุณว่า... "มาทำไม..."
[JUMP_SCARE]
รอยยิ้มฉีกกว้างโผล่มาจากความมืด พร้อมเอื้อมมือมาจับข้อเท้าคุณ!
(แจ้งเตือน: นี่คือเรื่องจำลองทำงานอยู่ในโหมด Offline เนื่องจาก ${errorType})`;
}
