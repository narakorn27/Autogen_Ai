// --- Content Script: Arin Auto Bot ---

console.log('Arin Auto Bot: Content Script Loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'GENERATE') {
        processGeneration(message)
            .then(() => sendResponse({ success: true }))
            .catch((err) => {
                console.error('Arin Auto Bot Error:', err.message);
                sendResponse({ success: false, error: err.message });
            });
        return true;
    }
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper สำหรับจำลองการรอแบบคน (สุ่มช่วงเวลาสั้นๆ)
const humanSleep = async (min = 500, max = 1500) => {
    const ms = Math.floor(Math.random() * (max - min + 1) + min);
    return sleep(ms);
};

// ส่ง progress กลับไปที่ sidepanel ผ่าน background
const sendProgress = (promptId, percent, status = 'running') => {
    chrome.runtime.sendMessage({ action: 'PROGRESS_UPDATE', promptId, percent, status });
};

const processGeneration = async (data) => {
    const { prompt, promptId, mode, settings } = data;

    if (!window.location.href.includes('labs.google/fx/')) {
        throw new Error('คุณไม่ได้อยู่ในหน้า Google Flow');
    }

    const slateDiv = await waitForElement('div[data-slate-editor="true"]', 8000);
    if (!slateDiv) throw new Error('ไม่พบช่องกรอก Prompt (Slate editor)');

    slateDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(200);

    sendProgress(promptId, 0, 'typing');

    // Frame to Video: Upload Image first
    if (mode === 'frame_to_video' && data.image) {
        try { await handleImageUpload(data.image); } catch (e) { console.warn('Image Upload failed:', e.message); }
    }

    // Apply Settings
    try { await applySettings(settings, mode); } catch (e) { console.warn('Apply Settings failed:', e.message); }

    // Focus
    await humanSleep(300, 700);
    slateDiv.focus();
    await humanSleep(400, 900);

    // Clear via Slate beforeinput
    slateDiv.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, cancelable: true, key: 'a', code: 'KeyA', ctrlKey: true, keyCode: 65
    }));
    await humanSleep(200, 500); // จำลองเวลาที่คนลากคลุมดำ
    slateDiv.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true, cancelable: true, inputType: 'deleteEntireSoftLine'
    }));
    await humanSleep(300, 800); // หน่วงหลังลบเสร็จ

    // Insert text via beforeinput
    slateDiv.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true, cancelable: true, inputType: 'insertText', data: prompt
    }));
    await humanSleep(800, 1500); // จำลองคนกวาดสายตาดูพรอมพ์ที่เพิ่งพิมพ์เสร็จ

    const inserted = slateDiv.innerText?.trim();
    console.log('Inserted text:', inserted?.slice(0, 60));
    if (!inserted || inserted.length === 0) {
        throw new Error('ไม่สามารถกรอก Prompt ลงใน Slate editor ได้');
    }

    sendProgress(promptId, 2, 'submitting');

    // Click submit button
    const submitBtn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.includes('arrow_forward'));
    if (!submitBtn) throw new Error('ไม่พบปุ่ม Submit (arrow_forward)');

    console.log('Clicking submit:', submitBtn.textContent.trim().slice(0, 30));
    await humanSleep(500, 1200); // จังหวะเลื่อนเมาส์ไปกด
    submitBtn.click();

    // Wait for generation with real % progress
    await waitForGeneration(promptId, 180000);

    sendProgress(promptId, 100, 'completed');

    // Auto Download
    try { await handleAutoDownload(prompt, settings); } catch (e) { console.warn('Auto Download Failed:', e.message); }

    return true;
};

// Helper สำหรับคลิกแบบคน (แก้ปัญหา Radix UI ไม่รับ .click() ธรรมดา)
const humanClick = async (element) => {
    if (!element) return;

    // เลื่อนเมาส์ไปหา (พฤติกรรม)
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await humanSleep(100, 300);

    // จำลอง Event Mousedown -> Mouseup -> Click
    const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    for (const evType of events) {
        element.dispatchEvent(new MouseEvent(evType, {
            bubbles: true,
            cancelable: true,
            view: window,
            buttons: 1
        }));
        await humanSleep(10, 30); // ระยะเวลาคลิกลงและปล่อย
    }
};

// ─── Settings Automation (Radix UI) ───
const applySettings = async (settings, mode) => {
    if (!settings) return;
    console.log('Arin: Applying settings...', settings);

    // 1. ค้นหาและคลิกปุ่มสรุปการตั้งค่าเพื่อเปิดเมนู (ถ้ายังไม่เปิด)
    // ค้นหาแบบเฉพาะเจาะจง: ต้องเป็นปุ่มที่มีเมนู (aria-haspopup) และมี text หน้าตาเหมือนสรุปการตั้งค่า
    let settingsSummaryBtn = Array.from(document.querySelectorAll('button')).find(b => {
        const isMenuBtn = b.getAttribute('aria-haspopup') === 'menu' || b.getAttribute('aria-haspopup') === 'dialog';
        const hasSummaryText = b.innerText.includes('x1') || b.innerText.includes('x2') ||
            b.innerText.includes('x3') || b.innerText.includes('x4');
        return isMenuBtn && hasSummaryText;
    });

    if (!settingsSummaryBtn) {
        // Fallback หาปุ่มที่แสดงชื่อโมเดลปัจจุบัน
        settingsSummaryBtn = Array.from(document.querySelectorAll('button')).find(b =>
            (b.getAttribute('aria-haspopup') === 'menu') &&
            (b.innerText.includes('Imagen') || b.innerText.includes('Banana'))
        );
    }

    if (settingsSummaryBtn && settingsSummaryBtn.getAttribute('aria-expanded') === 'false') {
        console.log('Arin: Opening settings menu...');
        await humanSleep(800, 1500); // รอจังหวะก่อนกด
        await humanClick(settingsSummaryBtn);
        await humanSleep(1000, 2000); // รอให้เมนูกางออกมาสวยๆ
    }

    // 2. เลือกหมวดหมู่ (รูปภาพ / วิดีโอ)
    const categoryText = mode === 'text_to_image' ? 'รูปภาพ' : 'วิดีโอ';
    const catBtn = findButtonByText(categoryText, true);
    if (catBtn) {
        await humanSleep(400, 800);
        await humanClick(catBtn);
        await humanSleep(600, 1200);
    }

    // 3. เลือก Aspect Ratio
    let ratioText = 'แนวนอน';
    if (settings.aspectRatio === '9:16') ratioText = 'แนวตั้ง';
    else if (settings.aspectRatio === '1:1') ratioText = 'จัตุรัส';
    else if (settings.aspectRatio === '4:3') ratioText = '4:3';

    // ลองหาแบบ exact ก่อน ถ้าไม่เจอค่อยหาแบบ includes
    let ratioBtn = findButtonByText(ratioText, true) || findButtonByText(ratioText, false);
    if (ratioBtn && ratioBtn.getAttribute('aria-checked') !== 'true') {
        await humanSleep(400, 800);
        await humanClick(ratioBtn);
        await humanSleep(600, 1200);
    }

    // 4. เลือกจำนวนผลลัพธ์ (Output Count)
    if (settings.outputsPerPrompt) {
        const countText = `x${settings.outputsPerPrompt}`;
        let countBtn = findButtonByText(countText, true) || findButtonByText(countText, false);
        if (countBtn && countBtn.getAttribute('data-state') !== 'on') {
            await humanSleep(400, 800);
            await humanClick(countBtn);
            await humanSleep(600, 1200);
        }
    }

    // 5. เลือกโมเดล (Model Selection)
    if (settings.imageModel) {
        // ค้นหาปุ่ม Dropdown เลือกโมเดลในเมนู (ปุ่มที่มีไอคอนดาวสีส้ม)
        const modelDropdown = Array.from(document.querySelectorAll('button')).find(b =>
            b.innerText.includes('Imagen') || b.innerText.includes('Banana') || (b.getAttribute('aria-haspopup') === 'menu' && !b.innerText.includes('x'))
        );

        if (modelDropdown) {
            console.log('Arin: Selecting model:', settings.imageModel);
            await humanSleep(500, 1000);
            await humanClick(modelDropdown);
            await humanSleep(1000, 2000); // รอเมนู Dropdown เลื่อนลงมา

            // ค้นหาโมเดลในรายการที่ปรากฏขึ้น
            let targetModel = settings.imageModel;
            if (targetModel === 'banana_nano_pro') targetModel = 'Nano Banana Pro';
            if (targetModel === 'banana_nano_2') targetModel = 'Nano Banana 2';
            if (targetModel === 'imagen_4') targetModel = 'Imagen 4';

            const modelItem = findButtonByText(targetModel);
            if (modelItem) {
                await humanClick(modelItem);
                await humanSleep(800, 1500); // หน่วงหลังเลือกเสร็จ
            } else {
                // ถ้าหาไม่เจอ ลองหาด้วยการเทียบ string แบบ case-insensitive
                const fallbackItem = Array.from(document.querySelectorAll('[role="menuitem"]')).find(el => el.innerText.toLowerCase().includes(targetModel.toLowerCase()));
                if (fallbackItem) {
                    await humanClick(fallbackItem);
                    await humanSleep(800, 1500);
                }
            }
        }
    }

    // ปิดเมนูหลัก
    if (settingsSummaryBtn && settingsSummaryBtn.getAttribute('aria-expanded') === 'true') {
        await humanSleep(400, 800);
        await humanClick(settingsSummaryBtn);
        await humanSleep(500, 1000);
    }

    console.log('Arin: Settings applied.');
};

// Helper ค้นหาปุ่มด้วย Text อย่างแม่นยำ (เช็คว่ามองเห็นบนจอเท่านั้น)
const findButtonByText = (text, exact = false) => {
    return Array.from(document.querySelectorAll('button, [role="button"], [role="menuitem"], [role="menuitemradio"], [role="tab"]')).find(el => {
        // เช็คว่าปุ่มสามารถมองเห็นได้บนหน้าจอจริงๆ (ไม่ใช่ปุ่มที่ซ่อนอยู่)
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;

        const content = el.innerText.trim();
        if (exact) return content === text;
        return content.includes(text);
    });
};

// ─── Auto Download ───
const handleAutoDownload = async (prompt, settings) => {
    console.log('Looking for download button...');
    await sleep(2000);

    const downloadBtn = Array.from(document.querySelectorAll('button, a')).find(el =>
        el.getAttribute('aria-label')?.toLowerCase().includes('download') ||
        el.innerText.toLowerCase().includes('download') ||
        el.innerHTML.includes('download')
    );

    if (downloadBtn) {
        console.log('Download button found!');
        if (downloadBtn.tagName === 'A' && downloadBtn.href) {
            chrome.runtime.sendMessage({
                action: 'DOWNLOAD_RESULT',
                url: downloadBtn.href,
                filename: `${prompt.slice(0, 30)}.mp4`,
                folder: settings?.saveFolder || 'arin-auto-bot'
            });
        } else {
            downloadBtn.click();
        }
    }
};

// ─── Image Upload ───
const handleImageUpload = async (base64) => {
    console.log('Attempting image upload...');
    const uploadBtn = Array.from(document.querySelectorAll('button'))
        .find(b => b.innerHTML.includes('add') || b.getAttribute('aria-label')?.includes('Add') || b.getAttribute('aria-label')?.includes('เพิ่ม'));

    if (uploadBtn) { uploadBtn.click(); await sleep(1000); }

    let fileInput = document.querySelector('input[type="file"]');
    if (!fileInput) { console.warn('File input not found'); return; }

    const res = await fetch(base64);
    const blob = await res.blob();
    const file = new File([blob], 'input_frame.png', { type: 'image/png' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('Image injected.');
    await sleep(2000);
};

// ─── Wait for Element ───
const waitForElement = async (selector, timeout = 8000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const el = document.querySelector(selector);
        if (el && el.offsetWidth > 0) return el;
        await sleep(500);
    }
    return null;
};

// ─── Read % from DOM ───
const readProgressPercent = () => {
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
        if (el.children.length > 0) continue;
        const text = el.textContent?.trim();
        if (text && /^\d+%$/.test(text)) {
            const num = parseInt(text);
            if (num >= 0 && num <= 100) return num;
        }
    }
    const matches = document.body.innerText.match(/(\d+)%/g);
    if (matches) {
        const nums = matches.map(m => parseInt(m)).filter(n => n >= 0 && n <= 100);
        if (nums.length > 0) return Math.max(...nums);
    }
    return null;
};

// ─── Wait for Generation + Send Progress ───
const waitForGeneration = async (promptId, timeout = 180000) => {
    const start = Date.now();
    let lastPercent = 2;

    // รอ generation เริ่ม
    console.log('Waiting for generation to start...');
    let started = false;
    while (Date.now() - start < 15000) {
        const pct = readProgressPercent();
        const hasLoading = !!document.querySelector('[aria-busy="true"], [role="progressbar"]');
        const bodyText = document.body.innerText;
        const hasGenerating = bodyText.includes('กำลังสร้าง') || bodyText.includes('Generating');

        if (pct !== null || hasLoading || hasGenerating) {
            started = true;
            console.log('Generation started, percent:', pct);
            break;
        }
        await sleep(800);
    }

    if (!started) console.warn('Generation start not detected, proceeding...');

    // Poll % จริงจาก DOM
    console.log('Monitoring progress...');
    while (Date.now() - start < timeout) {
        const pct = readProgressPercent();
        const hasLoading = !!document.querySelector('[aria-busy="true"], [role="progressbar"]');
        const bodyText = document.body.innerText;
        const hasGenerating = bodyText.includes('กำลังสร้าง') || bodyText.includes('Generating');

        if (pct !== null && pct !== lastPercent) {
            lastPercent = pct;
            sendProgress(promptId, pct, 'running');
            console.log(`Progress: ${pct}%`);
        }

        // เสร็จ: ไม่มี % ไม่มี loading
        if (!hasLoading && !hasGenerating && pct === null && started) {
            console.log('Generation complete.');
            await sleep(1500);
            return true;
        }

        await sleep(1000);
    }

    throw new Error('หมดเวลา Generation (Timeout)');
};