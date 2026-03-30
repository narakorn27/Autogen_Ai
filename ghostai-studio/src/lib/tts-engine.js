// ========================================== //
//  👻 GhostAI Studio — GEMINI TTS ENGINE      //
// ========================================== //

const GEMINI_TTS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ข้อมูลเสียง Gemini Voice
const GEMINI_VOICES = [
    { id: 'Charon', name: 'ชารอน', gender: 'M', desc: 'สุขุม ลึก มืออาชีพ' },
    { id: 'Aurus', name: 'ออรัส', gender: 'M', desc: 'นิ่ง หนักแน่น มืดมน' },
    { id: 'Fenrir', name: 'เฟนริร์', gender: 'M', desc: 'เร้าใจ พลังงานสูง เข้มข้น' },
    { id: 'Algenib', name: 'อัลเจนิบ', gender: 'M', desc: 'แห้ง หยาบ มีพื้นผิว' },
    { id: 'Rasalgethi', name: 'ราซาลเกธี', gender: 'M', desc: 'ผู้บรรยาย มืออาชีพ' },
    { id: 'Alnilam', name: 'อัลนิแลม', gender: 'M', desc: 'มั่นใจ เด็ดขาด หนักแน่น' },
    { id: 'Schedar', name: 'เชดาร์', gender: 'M', desc: 'สม่ำเสมอ มั่นคง น่าเชื่อถือ' },
    { id: 'Iapetus', name: 'ไอเพทัส', gender: 'M', desc: 'ชัดเจน สะอาด คมชัด' },
    { id: 'Umbriel', name: 'อัมเบรียล', gender: 'M', desc: 'ผ่อนคลาย ลุ่มลึก เหมือนคนเล่าเรื่อง' },
    { id: 'Algieba', name: 'อัลเจียบา', gender: 'M', desc: 'เรียบลื่น ไหลลื่น ดูดดึง' },
    { id: 'Sadaltegel', name: 'ซาดัลเทเกอร์', gender: 'M', desc: 'รอบรู้ น่าเชื่อถือ เนิบช้า' },
    { id: 'Achird', name: 'อาชิร์ด', gender: 'M', desc: 'เป็นกันเอง ให้ความรู้สึกจริง' },
    { id: 'Kore', name: 'โคเร', gender: 'F', desc: 'เข้มแข็ง หนักแน่น มีพลัง' },
    { id: 'Gacrux', name: 'กาครัส', gender: 'F', desc: 'สุขุม น่าเชื่อถือ เย็นชา' },
    { id: 'Erinome', name: 'เอรินโอมี', gender: 'F', desc: 'ชัดถ้อยคำ คมชัด' },
    { id: 'Despina', name: 'เดสพินา', gender: 'F', desc: 'เรียบลื่น อ่อนโยน น่าขนลุก' },
    { id: 'Achernar', name: 'อาเชนาร์', gender: 'F', desc: 'อ่อนโยน แต่มีความลึก' },
    { id: 'Vindemiatrix', name: 'วินเดมิอาทริกซ์', gender: 'F', desc: 'อ่อนนุ่ม ละเอียดอ่อน น่ากลัวในแบบเงียบๆ' },
    { id: 'Sulafat', name: 'ซูลาฟาต', gender: 'F', desc: 'อบอุ่น ดูดดึง ดูน่าเชื่อถือ' }
];

// Helper: แปลง Raw PCM (จาก Gemini) เป็น WAV Buffer ให้ AudioContext เล่นได้
function pcmToWav(pcmDataView, sampleRate = 24000, numChannels = 1, bitDepth = 16) {
    const dataLength = pcmDataView.length;
    const wavBuffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(wavBuffer);
    const byteRate = sampleRate * numChannels * (bitDepth / 8);
    const blockAlign = numChannels * (bitDepth / 8);

    function writeString(offset, string) {
        for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    new Uint8Array(wavBuffer, 44).set(pcmDataView);
    return wavBuffer;
}

// ----------------------------------------------------
// 🎙️ ขอเสียงพูดจาก Gemini API
// ----------------------------------------------------
async function synthesizeCloudTTS(text, voiceId = 'Charon') {
    const apiKey = localStorage.getItem('gh_api_gemini');
    if (!apiKey) return null;

    let cleanText = text.replace(/\[JUMP_SCARE\]/g, '');

    // Gemini API จำกัดความยาวต่อ 1 Request นิดหน่อย หั่นท่อนละ 1500 ตัวอักษร
    const MAX_LENGTH = 1500; 
    let chunks = [];
    const tokens = cleanText.split(/([ \n]+)/);
    let currentChunk = '';
    
    for (const token of tokens) {
        if ((currentChunk.length + token.length) > MAX_LENGTH) {
            chunks.push(currentChunk);
            currentChunk = token;
        } else {
            currentChunk += token;
        }
    }
    if (currentChunk.trim() !== '') chunks.push(currentChunk);


    const chunkPromises = chunks.map(async (c, i) => {
        if (!c.trim()) return null;
        try {
            const prompt = `จงพูดประโยคนี้ด้วยน้ำเสียงเล่าเรื่องผีภาษาไทย แบบอินเนอร์เต็มที่:\n\n${c.trim()}`;
            const res = await fetch(`${GEMINI_TTS_ENDPOINT}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseModalities: ["AUDIO"],
                        speechConfig: {
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } }
                        }
                    }
                })
            });

            if (!res.ok) {
                console.error("[GhostAI] Gemini TTS Failed on chunk", res.status);
                return null;
            }

            const data = await res.json();
            const parts = data.candidates?.[0]?.content?.parts || [];
            const audioPart = parts.find(p => p.inlineData && p.inlineData.mimeType.includes("audio/pcm"));
            
            if (audioPart) {
                const binaryStr = atob(audioPart.inlineData.data);
                const bytes = new Uint8Array(binaryStr.length);
                for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);
                return { index: i, bytes: bytes };
            }
        } catch (err) {
            console.error("[GhostAI] TTS Exception chunk:", err);
        }
        return null;
    });

    // รอโหลดทุกท่อนพร้อมกัน! (เร็วขึ้น 5 เท่า)
    const results = await Promise.all(chunkPromises);
    
    // เรียงลำดับกลับให้ถูกต้อง
    const pcmBuffers = results
        .filter(r => r !== null)
        .sort((a, b) => a.index - b.index)
        .map(r => r.bytes);

    if (pcmBuffers.length === 0) return null;

    // Concat Raw PCM
    let totalLength = 0;
    for (let b of pcmBuffers) totalLength += b.length;
    
    let concatenatedPcm = new Uint8Array(totalLength);
    let offset = 0;
    for (let b of pcmBuffers) {
        concatenatedPcm.set(b, offset);
        offset += b.length;
    }

    // แปลง Raw 24kHz PCM เป็น WAV
    return pcmToWav(concatenatedPcm, 24000);
}
