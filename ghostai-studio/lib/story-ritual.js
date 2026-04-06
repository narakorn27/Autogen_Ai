/**
 * GhostAI Studio - Personalized Horror Ritual
 * 
 * ระบบที่สร้างตำนานสยองขวัญส่วนบุคคลโดยใช้ข้อมูลจากผู้ใช้
 * (ชื่อ, สถานที่, สิ่งที่กลัว) เพื่อให้เรื่องราวมีความเฉพาะเจาะจงและน่ากลัวยิ่งขึ้น
 */

async function invokePersonalRitual() {
    const name = document.getElementById('target-name').value.trim();
    const location = document.getElementById('target-location').value.trim();
    const fear = document.getElementById('target-fear').value.trim();

    if (!name || !location || !fear) {
        alert('กรุณากรอกข้อมูลให้ครบถ้วน... พิธีกรรมต้องการเครื่องเซ่นไหว้ที่สมบูรณ์');
        return;
    }

    const btn = document.getElementById('btn-invoke');
    const setupSection = document.getElementById('ritual-setup');
    const resultSection = document.getElementById('ritual-result');
    const storyContent = document.getElementById('story-content');

    // UI Transition
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> กำลังอัญเชิญคำสาป...';
    if (window.lucide) lucide.createIcons();

    const prompt = `คุณคือผู้ประกอบพิธีกรรมเขียนตำนานสยองขวัญส่วนบุคคล (Personalized Creepypasta)
จงแต่งเรื่องสยองขวัญสั้นๆ (ประมาณ 300-500 คำ) ที่มุ่งเป้าไปที่บุคคลนี้โดยเฉพาะ:
ชื่อ: ${name}
สถานที่อาศัย: ${location}
สิ่งที่กลัวที่สุด: ${fear}

ข้อกำหนด:
1. เรื่องราวต้องเกิดขึ้นใน ${location} และระบุถึง ${name} ในฐานะตัวละครเอกที่กำลังเผชิญกับ ${fear}
2. บรรยากาศต้องมืดมน กดดัน และทำให้รู้สึกว่า "มันกำลังเกิดขึ้นจริงๆ ในตอนนี้"
3. ใช้การเว้นวรรคและจังหวะการเล่าที่น่าขนลุก
4. ห้ามสรุปจบแบบมีความสุข
5. เน้นความรู้สึกทางประสาทสัมผัส (ความเย็น, กลิ่น, เสียง)
6. เขียนเป็นภาษาไทยล้วน

โครงสร้าง:
- เริ่มด้วยการบรรยายบรรยากาศใน ${location} ยามค่ำคืน
- เริ่มเห็นสิ่งผิดปกติที่เกี่ยวกับ ${fear}
- จุดพีกที่ ${name} ต้องเผชิญหน้ากับมันตรงๆ
- จบแบบทิ้งท้ายว่า "มัน" ยังคงอยู่แถวๆ นั้น`;

    try {
        const provider = localStorage.getItem('gh_active_ai') || 'gemini';
        let storyText = '';

        // เรียกใช้ฟังก์ชันจาก story-gen.js หรือสื่อสารกับ API โดยตรง
        if (typeof generateGhostStory === 'function') {
            // เราสามารถดัดแปลงหรือใช้ requestTextFromActiveProvider ถ้ามี
            if (typeof requestTextFromActiveProvider === 'function') {
                storyText = await requestTextFromActiveProvider(prompt);
            } else {
                // Fallback direct fetch (simulated for now)
                storyText = await mockPersonalStory(name, location, fear);
            }
        } else {
            storyText = await mockPersonalStory(name, location, fear);
        }

        // แสดงผล
        setupSection.classList.add('hidden');
        resultSection.classList.remove('hidden');
        
        // เอฟเฟกต์พิมพ์ดีด
        typeWriterEffect(storyContent, storyText);

    } catch (err) {
        console.error('Ritual failed:', err);
        alert('พิธีกรรมขัดข้อง... พลังงานบางอย่างแทรกแซง');
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="skull"></i> เริ่มพิธีกรรมเขียนตำนานเลือด';
        if (window.lucide) lucide.createIcons();
    }
}

function typeWriterEffect(element, text) {
    element.innerHTML = '';
    let i = 0;
    const speed = 30; // ms

    function type() {
        if (i < text.length) {
            const char = text.charAt(i);
            element.innerHTML += char === '\n' ? '<br>' : char;
            i++;
            
            // สุ่มเอฟเฟกต์ไฟกะพริบ (Flash) เมื่อเจอคำที่น่ากลัว
            if (Math.random() > 0.99) {
                triggerFlash();
            }

            setTimeout(type, speed + (Math.random() * 20));
        }
    }
    type();
}

function triggerFlash() {
    const flash = document.getElementById('ritual-flash');
    if (flash) {
        flash.style.opacity = '0.3';
        setTimeout(() => {
            flash.style.opacity = '0';
        }, 50);
    }
}

function resetRitual() {
    document.getElementById('ritual-setup').classList.remove('hidden');
    document.getElementById('ritual-result').classList.add('hidden');
    document.getElementById('btn-invoke').disabled = false;
    document.getElementById('btn-invoke').innerHTML = '<i data-lucide="skull"></i> เริ่มพิธีกรรมเขียนตำนานเลือด';
    if (window.lucide) lucide.createIcons();
}

function shareStory() {
    const text = document.getElementById('story-content').innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert('คัดลองตำนานเลือดลงในคลิปบอร์ดแล้ว...');
    });
}

async function mockPersonalStory(name, location, fear) {
    return `ตำนานแห่ง ${location}: ความลับของ ${name}

ในยามค่ำคืนที่เงียบสงัดของ ${location} เมื่อแสงไฟริมถนนเริ่มกะพริบและดับลงทีละดวง... ${name} กำลังนั่งอยู่ในห้องเพียงลำพัง 

เสียงลมพัดผ่านช่องหน้าต่างฟังดูเหมือนเสียงกระซิบที่เรียกชื่อคุณซ้ำแล้วซ้ำเล่า คุณพยายามบอกตัวเองว่ามันเป็นเพียงจินตนาการ แต่แล้วกลิ่นอับชื้นที่คุ้นเคยก็เริ่มลอยมาแตะจมูก

มันคือสิ่งที่ ${name} กลัวที่สุด... ${fear}

คุณเริ่มเห็นเงาบางอย่างเคลื่อนไหวอยู่ที่มุมมืดของห้อง มันไม่ใช่แค่เงา แต่มันมีรูปร่าง มันคือ ${fear} ที่คุณพยายามวิ่งหนีมาตลอดชีวิต แต่วันนี้มันตามคุณมาจนถึงที่นี่ ใน ${location} แห่งนี้

มันค่อยๆ คืบคลานเข้ามา... ความเย็นเยียบแผ่ซ่านไปทั่วกระดูกสันหลัง...

ไม่มีใครได้ยินเสียงกรีดร้องของคุณในคืนนี้หรอก ${name}...`;
}
