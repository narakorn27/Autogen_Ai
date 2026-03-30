// ========================================== //
//  👻 GhostAI Studio — Spirit Box EVP         //
// ========================================== //

async function askSpirit(question) {
    const prompt = `คุณคือวิญญาณในอุปกรณ์ Spirit Box ถูกถามว่า: "${question}" 
จงตอบกลับสั้นๆ ลึกลับ น่าตื่นตระหนก ไม่เกิน 15 คำ ภาษาไทย`;

    const apiKey = localStorage.getItem('gh_api_gemini');
    let answer = "...ใครบางคน... อยู่ข้างหลังมึง..."; // fallback

    if (apiKey) {
        try {
            const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const data = await res.json();
            answer = data.candidates[0].content.parts[0].text.trim();
        } catch (e) { }
    }

    // เรียก TTS เสียง Spirit
    const audioBuffer = await synthesizeCloudTTS(answer, 'spirit');
    if (audioBuffer && audioCtx) {
        // เล่นโดยเปิด Pitch ให้เพี้ยนต่ำ (0.6) + เปิดเสียงก้อง
        playGhostAudio(audioBuffer, true, 0.6);
    } else {
        // Fallback Web Speech 
        const u = new SpeechSynthesisUtterance(answer);
        u.lang = 'th-TH'; u.pitch = 0.1; u.rate = 0.6;
        window.speechSynthesis.speak(u);
    }
    return answer;
}
