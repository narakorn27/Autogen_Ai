// ========================================== //
//  👻 Spirit Tarot — The Weeping Deck Logic  //
// ========================================== //

const SPIRIT_CARDS = [
    { 
        id: 0, name: "The Wanderer", thai: "เด็กหลงทาง", arcana: "The Fool", 
        desc: "วิญญาณเด็กที่เดินหายไปในป่าลึก ไร้จุดหมายและคำเตือน", 
        img: "https://image.pollinations.ai/prompt/dark%20gothic%20tarot%20card%20art%20of%20a%20creepy%20ghost%20child%20standing%20in%20a%20misty%20dead%20forest,%20horror%20aesthetic,%20cinematic%20lighting?width=400&height=600&nologo=true" 
    },
    { 
        id: 1, name: "The Hollow Mind", thai: "จิตว่างเปล่า", arcana: "The Magician", 
        desc: "ผู้ที่พยายามควบคุมวิญญาณแต่กลับถูกกลืนกินเสียเอง", 
        img: "https://image.pollinations.ai/prompt/horror%20tarot%20card%20art%20of%20a%20faceless%20monk%20with%20glowing%20eyes%20holding%20a%20bleeding%20skull,%20dark%20magic,%20gothic?width=400&height=600&nologo=true" 
    },
    { 
        id: 6, name: "The Bound Souls", thai: "วิญญาณผูกพยาบาท", arcana: "The Lovers", 
        desc: "คู่รักที่สาบานว่าจะตายด้วยกัน และพวกเขาก็ทำเช่นนั้นจริงๆ", 
        img: "https://image.pollinations.ai/prompt/creepy%20tarot%20card%20art%20of%20two%20ghosts%20sewn%20together%20by%20rusty%20chains,%20dark%20romance%20horror,%20disturbing?width=400&height=600&nologo=true" 
    },
    { 
        id: 13, name: "The Reaping Shadow", thai: "เงาสั่งตาย", arcana: "Death", 
        desc: "ความเปลี่ยนแปลงที่มาพร้อมกับกลิ่นธูปและเสียงสวด", 
        img: "https://image.pollinations.ai/prompt/grim%20reaper%20tarot%20card%20horror%20art,%20dark%20shadowy%20figure%20with%20a%20scythe%20in%20a%20cemetery,%20haunting?width=400&height=600&nologo=true" 
    },
    { 
        id: 15, name: "The Puppeteer", thai: "นักเชิดหุ่น", arcana: "The Devil", 
        desc: "ผู้บงการกิเลสที่มองไม่เห็นตัวตน ซ่อนอยู่ในเงามืดของใจ", 
        img: "https://image.pollinations.ai/prompt/horror%20tarot%20card%20art%20of%20a%20giant%20rotting%20demon%20controlling%20humans%20with%20bloody%20strings,%20hellish%20atmosphere?width=400&height=600&nologo=true" 
    },
    { 
        id: 16, name: "The Crumbling Asylum", thai: "สถานบำบัดวิปลาส", arcana: "The Tower", 
        desc: "ความพินาศที่พังทลายลงมาอย่างไร้ความปราณี", 
        img: "https://image.pollinations.ai/prompt/burning%20haunted%20asylum%20tarot%20card%20art,%20screaming%20ghosts%20falling%20from%20windows,%20chaos%20horror?width=400&height=600&nologo=true" 
    },
    { 
        id: 18, name: "The Drowning Echo", thai: "เสียงสะท้อนใต้น้ำ", arcana: "The Moon", 
        desc: "ความกลัวที่ซ่อนอยู่ใต้ผิวน้ำที่นิ่งสงบ ความลวงตาที่น่าสยดสยอง", 
        img: "https://image.pollinations.ai/prompt/drowned%20woman%20ghost%20underwater%20tarot%20card%20art,%20pale%20skin,%20long%20black%20hair,%20dark%20watery%20void?width=400&height=600&nologo=true" 
    }
];

let isRitualActive = false;
let selectedFreq = 103.4;
let tarotFrequencyInterval = null;

// --- 1. Ritual Setup & UI ---

function updateFrequency(val) {
    selectedFreq = (88.0 + (val / 100) * (108.0 - 88.0)).toFixed(1);
    const display = document.getElementById('freq-display');
    if (display) display.innerText = `${selectedFreq} MHz`;
    
    document.getElementById('dial-val').innerText = `${val}%`;

    // Trigger visual feedback if ritual is on
    if (isRitualActive) {
        triggerSpiritInterference();
    }
}

function initTarotDeck() {
    const container = document.getElementById('deck-container');
    container.innerHTML = '';
    
    // Create 3 face-down cards
    for (let i = 0; i < 3; i++) {
        const card = document.createElement('div');
        card.className = 'tarot-card float-card';
        card.style.setProperty('--r', `${(i - 1) * 15}deg`);
        card.style.left = `calc(50% - 70px + ${(i - 1) * 160}px)`;
        card.style.top = '100px';
        
        card.innerHTML = `
            <div class="tarot-card-inner">
                <div class="card-face card-back"></div>
                <div class="card-front">
                    <div class="card-art"></div>
                    <div class="card-title">UNKNOWN</div>
                </div>
            </div>
        `;
        
        card.onclick = () => drawCard(card);
        container.appendChild(card);
    }
}

// --- 2. Ritual Logic ---

async function startRitual() {
    if (isRitualActive) return;
    
    const btn = document.getElementById('btn-ritual-start');
    const status = document.getElementById('ritual-status');
    
    isRitualActive = true;
    btn.disabled = true;
    btn.innerText = "กำลังจูนคลื่นวิญญาณ...";
    status.innerText = "-- ค้นหาสัญญาณจากความมืด... --";
    
    // Start canvas interference
    startFrequencyVisualizer();
    
    // Wait 2 seconds for "finding" spirits
    setTimeout(() => {
        initTarotDeck();
        status.innerText = "-- วิญญาณสถิตอยู่ ณ ที่นี้แล้ว... จงเลือกไพ่ของเจ้า --";
        btn.innerText = "กำลังสื่อสาร...";
    }, 2000);
}

function startFrequencyVisualizer() {
    const canvas = document.getElementById('tarot-freq-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (tarotFrequencyInterval) clearInterval(tarotFrequencyInterval);
    
    tarotFrequencyInterval = setInterval(() => {
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        
        for (let x = 0; x < canvas.width; x++) {
            const noise = (Math.random() - 0.5) * 50;
            ctx.lineTo(x, canvas.height / 2 + noise);
        }
        ctx.stroke();
    }, 50);
}

function triggerSpiritInterference() {
    // Add glitch class to cards temporarily
    document.querySelectorAll('.tarot-card').forEach(card => {
        card.classList.add('glitch-card');
        setTimeout(() => card.classList.remove('glitch-card'), 200);
    });
}

// --- 3. Card Drawing & AI Integration ---

async function drawCard(cardEl) {
    if (cardEl.classList.contains('flipped')) return;
    
    // Randomly select card data
    const cardData = SPIRIT_CARDS[Math.floor(Math.random() * SPIRIT_CARDS.length)];
    const isReverse = Math.random() > 0.7; // 30% chance for reverse
    
    // Update UI Card Front
    const art = cardEl.querySelector('.card-art');
    const title = cardEl.querySelector('.card-title');
    
    art.style.backgroundImage = `url('${cardData.img}')`;
    if (isReverse) art.style.transform = 'rotate(180deg)';
    title.innerText = `${cardData.thai}${isReverse ? ' (กลับหัว)' : ''}`;
    
    // Flip Animation
    cardEl.classList.add('flipped');
    cardEl.classList.remove('float-card');
    
    // Show Result Panel
    const resultPanel = document.getElementById('tarot-result');
    const interpretationText = document.getElementById('tarot-interpretation');
    const revealedCardUi = document.getElementById('revealed-card-ui');
    const cardNameDisplay = document.getElementById('card-name');
    
    resultPanel.classList.remove('hidden');
    interpretationText.innerHTML = '<span class="animate-pulse">... วิญญาณกำลังกระซิบ ...</span>';
    cardNameDisplay.innerText = `${cardData.name} ${isReverse ? '(Reverse)' : ''}`;
    
    // Set revealed card UI image
    revealedCardUi.innerHTML = `<img src="${cardData.img}" class="w-full h-full object-cover ${isReverse ? 'rotate-180' : ''}">`;
    
    // Get AI Interpretation
    const question = document.getElementById('tarot-question').value || "ดวงชะตาทั่วไป";
    const interpretation = await getSpiritInterpretation(cardData, isReverse, question);
    
    // Typewriter effect for interpretation
    interpretationText.innerText = '';
    let i = 0;
    function type() {
        if (i < interpretation.length) {
            interpretationText.innerText += interpretation.charAt(i);
            i++;
            setTimeout(type, 15);
        }
    }
    type();
}

async function getSpiritInterpretation(card, isReverse, question) {
    const provider = localStorage.getItem('gh_active_ai') || 'gemini';
    const prompt = `คุณคือวิญญาณสถิตในไพ่ทาโร่ (The Weeping Deck) มีนิสัยดุร้ายแต่สัจจริง 
จงทำนายดวงจากไพ่ใบนี้:
ไพ่: ${card.name} (${card.thai})
ความหมายเดิม: ${card.arcana}
สถานะ: ${isReverse ? 'กลับหัว (Reverse)' : 'ปกติ'}
คำถามจากผู้ถูกสิง: "${question}"

กฎการตอบ:
1. ใช้ภาษาไทยที่ดูน่ากลัว ลึกลับ และเป็นทางการแบบโบราณ
2. เริ่มต้นด้วยเสียงกระซิบหรือคำทักทายที่น่าขนลุก
3. เชื่อมโยงเรื่องราวสยองขวัญของไพ่เข้ากับคำถาม
4. ความยาวไม่เกิน 150 คำ`;

    try {
        if (provider === 'gemini') {
            const apiKey = localStorage.getItem('gh_api_gemini');
            if (!apiKey) return getMockTarot(card, isReverse);

            const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8 } })
            });
            const data = await res.json();
            return data.candidates[0].content.parts[0].text.trim();
        } else if (provider === 'groq') {
            const apiKey = localStorage.getItem('gh_api_groq');
            if (!apiKey) return getMockTarot(card, isReverse);

            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'system', content: 'You are a scary spirit tarot reader. Answer in Thai.' }, { role: 'user', content: prompt }],
                    temperature: 0.8
                })
            });
            const data = await res.json();
            return data.choices[0].message.content.trim();
        }
    } catch (err) {
        console.error("Tarot AI Fail:", err);
        return getMockTarot(card, isReverse);
    }
    return getMockTarot(card, isReverse);
}

function getMockTarot(card, isReverse) {
    return `ข้าเห็นเงาของ ${card.thai} พาดผ่านดวงชะตาของเจ้า... ${isReverse ? 'แม้แต่ความตายยังกลับตาลปัตร' : ''} 
สิ่งที่เจ้าถามนั้น มีคำตอบซ่อนอยู่ในเงามืดเบื้องหลังตัวเจ้าเอง จงระวัง... สิ่งที่เจ้ามองไม่เห็น กำลังมองเจ้าอยู่`;
}

function resetRitual() {
    isRitualActive = false;
    document.getElementById('tarot-result').classList.add('hidden');
    document.getElementById('deck-container').innerHTML = '<div id="ritual-status" class="text-gray-600 text-sm italic animate-pulse">-- วางมือบนความถี่เพื่อเริ่มสื่อสาร --</div>';
    document.getElementById('btn-ritual-start').disabled = false;
    document.getElementById('btn-ritual-start').innerText = "เริ่มพิธีกรรม";
    if (tarotFrequencyInterval) clearInterval(tarotFrequencyInterval);
}

async function playTarotTTS() {
    const text = document.getElementById('tarot-interpretation').innerText;
    if (!text) return;
    
    // ใช้ฟังก์ชันจาก tts-engine.js ที่มีอยู่แล้ว
    if (typeof playMockTTS === 'function') {
        // แสร้งว่านี่คือเรื่องผี เพื่อให้ใช้ engine เดิมได้
        const originalContent = document.getElementById('story-content').innerText;
        document.getElementById('story-content').innerText = text;
        await playMockTTS();
        document.getElementById('story-content').innerText = originalContent;
    }
}
