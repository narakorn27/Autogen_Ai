// ========================================== //
//  GhostAI Studio - TTS Engine              //
// ========================================== //

const GEMINI_TTS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GOOGLE_CLOUD_TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

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
    { id: 'Sadaltegel', name: 'ซาดัลเทเกอร', gender: 'M', desc: 'รอบรู้ น่าเชื่อถือ เนิบช้า' },
    { id: 'Achird', name: 'อาชิร์ด', gender: 'M', desc: 'เป็นกันเอง ให้ความรู้สึกจริง' },
    { id: 'Kore', name: 'โคเร', gender: 'F', desc: 'เข้มแข็ง หนักแน่น มีพลัง' },
    { id: 'Gacrux', name: 'กาครัส', gender: 'F', desc: 'สุขุม น่าเชื่อถือ เย็นชา' },
    { id: 'Erinome', name: 'เอรินโอมี', gender: 'F', desc: 'ชัดถ้อยคำ คมชัด' },
    { id: 'Despina', name: 'เดสพินา', gender: 'F', desc: 'เรียบลื่น อ่อนโยน น่าขนลุก' },
    { id: 'Achernar', name: 'อาเชนาร์', gender: 'F', desc: 'อ่อนโยน แต่มีความลึก' },
    { id: 'Vindemiatrix', name: 'วินเดมิอาทริกซ์', gender: 'F', desc: 'อ่อนนุ่ม ละเอียดอ่อน น่ากลัวในแบบเงียบๆ' },
    { id: 'Sulafat', name: 'ซูลาฟาต', gender: 'F', desc: 'อบอุ่น ดูดดึง ดูน่าเชื่อถือ' }
];

const GOOGLE_TTS_VOICE_MAP = {
    Charon: 'th-TH-Chirp3-HD-Charon',
    Aurus: 'th-TH-Chirp3-HD-Orus',
    Fenrir: 'th-TH-Chirp3-HD-Fenrir',
    Algenib: 'th-TH-Chirp3-HD-Algenib',
    Rasalgethi: 'th-TH-Chirp3-HD-Rasalgethi',
    Alnilam: 'th-TH-Chirp3-HD-Alnilam',
    Schedar: 'th-TH-Chirp3-HD-Schedar',
    Iapetus: 'th-TH-Chirp3-HD-Iapetus',
    Umbriel: 'th-TH-Chirp3-HD-Umbriel',
    Algieba: 'th-TH-Chirp3-HD-Algieba',
    Sadaltegel: 'th-TH-Chirp3-HD-Sadaltager',
    Achird: 'th-TH-Chirp3-HD-Achird',
    Kore: 'th-TH-Chirp3-HD-Kore',
    Gacrux: 'th-TH-Chirp3-HD-Gacrux',
    Erinome: 'th-TH-Chirp3-HD-Erinome',
    Despina: 'th-TH-Chirp3-HD-Despina',
    Achernar: 'th-TH-Chirp3-HD-Achernar',
    Vindemiatrix: 'th-TH-Chirp3-HD-Vindemiatrix',
    Sulafat: 'th-TH-Chirp3-HD-Sulafat',
    spirit: 'th-TH-Chirp3-HD-Charon'
};

function getRuntimeApiKey(inputId, storageKey) {
    const inputValue = document.getElementById(inputId)?.value?.trim();
    if (inputValue) return inputValue;
    return localStorage.getItem(storageKey)?.trim() || '';
}

function decodeBase64Audio(base64Data) {
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
}

function pcmToWav(pcmDataView, sampleRate = 24000, numChannels = 1, bitDepth = 16) {
    const dataLength = pcmDataView.length;
    const wavBuffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(wavBuffer);
    const byteRate = sampleRate * numChannels * (bitDepth / 8);
    const blockAlign = numChannels * (bitDepth / 8);

    function writeString(offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
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

async function synthesizeWithGoogleCloudTTS(text, voiceId) {
    const apiKey = getRuntimeApiKey('api-tts', 'gh_api_tts');
    if (!apiKey) return null;

    const voiceName = GOOGLE_TTS_VOICE_MAP[voiceId] || 'th-TH-Standard-A';
    const res = await fetch(`${GOOGLE_CLOUD_TTS_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            input: { text },
            voice: { languageCode: 'th-TH', name: voiceName },
            audioConfig: {
                audioEncoding: 'LINEAR16',
                speakingRate: 0.95
            }
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Google Cloud TTS ${res.status}: ${errText}`);
    }

    const data = await res.json();
    if (!data.audioContent) return null;
    return decodeBase64Audio(data.audioContent).buffer;
}

async function synthesizeWithGeminiTTS(text, voiceId) {
    const apiKey = getRuntimeApiKey('api-gemini', 'gh_api_gemini');
    if (!apiKey) return null;

    const maxLength = 800;
    const chunks = [];
    const tokens = text.split(/([ \n]+)/);
    let currentChunk = '';

    for (const token of tokens) {
        if ((currentChunk.length + token.length) > maxLength) {
            chunks.push(currentChunk);
            currentChunk = token;
        } else {
            currentChunk += token;
        }
    }

    if (currentChunk.trim()) chunks.push(currentChunk);

    const results = await Promise.all(chunks.map(async (chunk, index) => {
        if (!chunk.trim()) return null;

        const prompt = `จงพูดประโยคนี้ด้วยน้ำเสียงเล่าเรื่องผีภาษาไทย แบบอินเนอร์เต็มที่:\n\n${chunk.trim()}`;
        const res = await fetch(`${GEMINI_TTS_ENDPOINT}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } }
                    }
                }
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gemini TTS ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const audioPart = parts.find(part => part.inlineData?.mimeType?.includes('audio/pcm'));
        if (!audioPart?.inlineData?.data) return null;

        return { index, bytes: decodeBase64Audio(audioPart.inlineData.data) };
    }));

    const pcmBuffers = results
        .filter(Boolean)
        .sort((a, b) => a.index - b.index)
        .map(item => item.bytes);

    if (!pcmBuffers.length) return null;

    let totalLength = 0;
    for (const buffer of pcmBuffers) totalLength += buffer.length;

    const concatenatedPcm = new Uint8Array(totalLength);
    let offset = 0;
    for (const buffer of pcmBuffers) {
        concatenatedPcm.set(buffer, offset);
        offset += buffer.length;
    }

    return pcmToWav(concatenatedPcm, 24000);
}

async function synthesizeCloudTTS(text, voiceId = 'Charon') {
    const cleanText = (text || '').replace(/\[JUMP_SCARE\]/g, '').trim();
    if (!cleanText) return null;

    try {
        const googleAudio = await synthesizeWithGoogleCloudTTS(cleanText, voiceId);
        if (googleAudio) return googleAudio;
    } catch (err) {
        console.error('[GhostAI] Google Cloud TTS failed:', err);
    }

    try {
        const geminiAudio = await synthesizeWithGeminiTTS(cleanText, voiceId);
        if (geminiAudio) return geminiAudio;
    } catch (err) {
        console.error('[GhostAI] Gemini TTS failed:', err);
    }

    return null;
}
