// --- Content Script: Arin Qwen Auto Flow ---
console.log('Arin Qwen Auto Flow: Content Script Loaded');

// ─── Utils ───
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const humanSleep = async (min = 500, max = 1500) => sleep(Math.floor(Math.random() * (max - min + 1) + min));
const sendProgress = (promptId, percent, status = 'running') => {
    chrome.runtime.sendMessage({ action: 'PROGRESS_UPDATE', promptId, percent, status });
};
const sanitizeFilename = (str, maxLen = 60) =>
    (str || '').replace(/[<>:"/\\|?*\n\r]/g, '_').trim().slice(0, maxLen) || 'output';

// ─── Message Listener ───
window.arinIsGenerating = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'GENERATE') {
        window.arinIsGenerating = true;
        processGeneration(message)
            .then(() => {
                window.arinIsGenerating = false;
                sendResponse({ success: true });
            })
            .catch((err) => {
                window.arinIsGenerating = false;
                if (err.message !== 'USER_STOPPED_GENERATION') {
                    console.error('Arin Error:', err.message);
                } else {
                    console.log('Arin: Generation stopped by user.');
                }
                const needRefresh = err.message.includes('SERVER_ERROR');
                sendResponse({ success: false, error: err.message, needRefresh });
            });
        return true;
    }

    if (message.action === 'STOP_GENERATION') {
        window.arinIsGenerating = false;
        console.log('Arin: Received STOP signal!');
        sendResponse({ success: true });
    }
});

// ─── Main Generation Flow ───
const processGeneration = async (data) => {
    const { prompt, promptId, mode, settings } = data; // mode: "Create Image" or "Create Video"

    if (!window.location.href.includes('chat.qwen.ai')) {
        throw new Error('คุณไม่ได้อยู่ในหน้า Qwen Chat');
    }

    sendProgress(promptId, 0, 'typing');

    // 1. Change Mode (Create Image / Create Video)
    try {
        await setGenerationMode(mode);
    } catch (e) {
        throw new Error('ไม่สามารถเปลี่ยนโหมดเป็น ' + mode + ' ได้: ' + e.message);
    }

    // 2. Apply Aspect Ratio (ทั้ง Image และ Video)
    if (settings?.aspectRatio) {
        try {
            await setAspectRatio(settings.aspectRatio);
        } catch (e) {
            console.warn('Set Aspect Ratio failed:', e.message);
        }
    }

    await humanSleep(500, 1000);

    // 3. Find and Focus Textarea
    const textarea = await waitForElement('textarea.message-input-textarea', 5000);
    if (!textarea) throw new Error('ไม่พบช่องกรอก Prompt');

    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    textarea.focus();
    await humanSleep(300, 600);

    // 4. Type Prompt
    try {
        // Clear first
        textarea.value = '';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(100);

        // Set new value
        textarea.value = prompt;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        // Also dispatch change and keydown to ensure React picks it up
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        textarea.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
    } catch(e) {
        throw new Error('ไม่สามารถกรอก Prompt ลงใน editor ได้');
    }
    
    await humanSleep(800, 1500);

    const inserted = textarea.value?.trim();
    if (!inserted || inserted.length === 0) throw new Error('ไม่สามารถกรอก Prompt ลงใน editor ได้');

    sendProgress(promptId, 2, 'submitting');
    const submitTimestamp = Date.now();

    // 5. Click Submit
    const submitBtn = document.querySelector('button.send-button');
    if (!submitBtn) throw new Error('ไม่พบปุ่ม Submit');
    if (submitBtn.disabled) throw new Error('ปุ่ม Submit ไม่พร้อมใช้งาน (อาจยังไม่ได้พิมพ์ข้อความ)');

    await humanClick(submitBtn);

    // 6. Wait for generation
    const resultUrl = await waitForGeneration(promptId, 240000, submitTimestamp, mode);
    sendProgress(promptId, 100, 'completed');

    // 7. Download
    if (settings?.autoDownload !== false && resultUrl) {
        try { await handleAutoDownload(prompt, settings, resultUrl, mode); }
        catch (e) { console.warn('Auto Download Failed:', e.message); }
    }

    return true;
};

// ─── Set Generation Mode ─── (แก้ใหม่ทั้งหมด)
const setGenerationMode = async (targetModeText) => {
    console.log('Arin: Setting mode to', targetModeText);

    // ── Helper: อ่าน mode ที่ active อยู่ตอนนี้จาก bottom bar ──
    const getCurrentMode = () => {
        // กรณีที่ 1: มี mode label ชัดเจน เช่น "Create Video" หรือ "Create Image" ใน bottom bar
        const modeLabel = Array.from(document.querySelectorAll(
            '.mode-select-current-mode-name, ' +
            '[class*="mode-select"] [class*="name"], ' +
            '[class*="mode-label"]'
        )).find(el => el.offsetWidth > 0);
        if (modeLabel) return modeLabel.textContent.trim();

        // กรณีที่ 2: อ่านจากข้อความใน bottom bar ทั้งหมด (เช่น "Create Video" หรือ "Create Image" ข้างๆ + icon)
        const bottomBar = document.querySelector(
            '.message-input-container, .chat-input, ' +
            '[class*="input-container"], [class*="chat-footer"]'
        );
        if (bottomBar) {
            const text = bottomBar.innerText || '';
            if (text.includes('Create Video')) return 'Create Video';
            if (text.includes('Create Image')) return 'Create Image';
        }
        return null;
    };

    // ── ถ้า mode ตรงแล้ว ออกได้เลย (อ่านจาก DOM ไม่ใช่ซากเก่า) ──
    const current = getCurrentMode();
    if (current && current.includes(targetModeText)) {
        console.log('Arin: Already in mode:', targetModeText);
        return;
    }

    // ── ปิด dropdown ที่ค้างอยู่ก่อน ──
    if (Array.from(document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden)')).some(el => el.offsetWidth > 0)) {
        document.body.click();
        await sleep(400);
    }

    // ── หาปุ่ม + ที่ถูกต้อง ──
    // Strategy: หาทุก ant-dropdown-trigger ใน input area แล้วเลือกอันที่มี plus icon
    const findPlusTrigger = () => {
        // 1. ตรง — .mode-select .ant-dropdown-trigger (new chat DOM)
        const direct = document.querySelector('.mode-select .ant-dropdown-trigger');
        if (direct && direct.offsetWidth > 0) return direct;

        // 2. หา trigger ที่มี SVG use href="*plus*"
        const allTriggers = Array.from(document.querySelectorAll('.ant-dropdown-trigger')).filter(el => el.offsetWidth > 0);
        for (const t of allTriggers) {
            const uses = t.querySelectorAll('use');
            for (const u of uses) {
                const href = u.getAttribute('href') || u.getAttribute('xlink:href') || '';
                if (href.includes('plus')) return t;
            }
        }

        // 3. หา element ที่ render เป็นปุ่ม "+" ใน input area (เช่น button หรือ span ที่มี text "+")
        const inputArea = document.querySelector(
            '.message-input-container, .chat-input, [class*="input-wrap"], .input-bottom-bar'
        );
        if (inputArea) {
            const candidates = Array.from(inputArea.querySelectorAll(
                'button, span[role], div[role="button"], [class*="plus"], [class*="add-btn"]'
            )).filter(el => el.offsetWidth > 0);
            
            // เลือกอันที่ innerText เป็น "+" หรือ aria-label มีคำว่า add/plus/more
            const plusBtn = candidates.find(el => {
                const txt = el.innerText?.trim();
                const aria = el.getAttribute('aria-label') || '';
                return txt === '+' || aria.toLowerCase().includes('plus') || aria.toLowerCase().includes('add');
            });
            if (plusBtn) return plusBtn;

            // สุดท้าย: เอา .ant-dropdown-trigger แรกใน inputArea
            const firstTrigger = inputArea.querySelector('.ant-dropdown-trigger');
            if (firstTrigger && firstTrigger.offsetWidth > 0) return firstTrigger;
        }

        return null;
    };

    const trigger = findPlusTrigger();
    if (!trigger) throw new Error('ไม่พบปุ่ม + (plus trigger) ในหน้านี้');

    console.log('Arin: Found + trigger, clicking...', trigger.className);
    
    // ── คลิก + เพื่อเปิด dropdown ──
    await humanClick(trigger);

    // ── รอ dropdown เปิดและหา item ──
    let targetItem = null;
    const deadline = Date.now() + 5000;

    while (Date.now() < deadline) {
        if (!window.arinIsGenerating) throw new Error('USER_STOPPED_GENERATION');
        const visibleDropdown = Array.from(document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden)')).find(el => el.offsetWidth > 0);
        if (visibleDropdown) {
            // หา item ที่มีข้อความ targetModeText
            const items = Array.from(visibleDropdown.querySelectorAll(
                'li, [role="menuitem"], [class*="menu-item"], [class*="mode-item"]'
            ));
            targetItem = items.find(el =>
                el.offsetHeight > 0 && el.textContent.includes(targetModeText)
            );
            if (targetItem) break;
        }
        await sleep(150);
    }

    if (!targetItem) {
        document.body.click();
        await sleep(200);
        throw new Error(`ไม่พบโหมด "${targetModeText}" ใน dropdown`);
    }

    if (targetItem.classList.contains('ant-dropdown-menu-item-disabled') || targetItem.classList.contains('ant-select-item-option-disabled')) {
        document.body.click();
        throw new Error(`โหมด "${targetModeText}" ถูก disabled`);
    }

    // ── คลิก item ช้าๆ ให้ React จับ event ──
    console.log('Arin: Found Mode targetItem, clicking...');
    await humanSleep(400, 600);
    targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await humanSleep(300, 500);

    // คลิก element ลูก (icon/text) ก็ได้ — บางครั้ง React ต้องการ event จาก child
    const innerEl = targetItem.querySelector('span, div, svg') || targetItem;
    await humanClick(innerEl);

    // ── รอ dropdown ปิด ──
    const closeDeadline = Date.now() + 3000;
    while (Date.now() < closeDeadline) {
        if (!window.arinIsGenerating) throw new Error('USER_STOPPED_GENERATION');
        const stillOpen = Array.from(document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden)')).filter(el => el.offsetWidth > 0);
        if (stillOpen.length === 0) break;
        await sleep(150);
    }
    
    // force close ถ้ายังค้าง
    if (Array.from(document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden)')).some(el => el.offsetWidth > 0)) {
        document.body.click();
    }
    await sleep(200);

    // ── Verify: เช็คว่า mode เปลี่ยนจริงหรือเปล่า ──
    await humanSleep(800, 1200); // รอ React re-render
    const newMode = getCurrentMode();
    console.log('Arin: Mode after click check:', newMode);

    if (newMode && !newMode.includes(targetModeText)) {
        // Mode ยังไม่เปลี่ยน — ลองคลิกอีกรอบ
        console.warn('Arin: Mode did not change, retrying click...');
        const trigger2 = findPlusTrigger();
        if (trigger2) {
            await humanClick(trigger2);
            await humanSleep(400, 600);
            
            const dropdown2 = Array.from(document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden)')).find(el => el.offsetWidth > 0);
            if (dropdown2) {
                const items2 = Array.from(dropdown2.querySelectorAll('li, [role="menuitem"]'));
                const item2 = items2.find(el => el.offsetHeight > 0 && el.textContent.includes(targetModeText));
                if (item2) {
                    await humanClick(item2.querySelector('span, div, svg') || item2);
                    await humanSleep(600, 1000);
                }
            }
            document.body.click();
            await humanSleep(600, 800);
        }
    }

    await humanSleep(500, 800); // final settle
};

// ─── Set Aspect Ratio ───
const setAspectRatio = async (ratio) => {
    console.log('Arin: Setting Aspect Ratio to', ratio);
    await humanSleep(1000, 1500); // รอ mode switch settle ก่อน (เพิ่มเวลาเนื่องจาก DOM อัปเดตช้า)

    // หาจาก bottom input bar โดยตรงเท่านั้น เพื่อป้องกันไปดึง text เก่าๆ จากแชท
    const inputContainer = document.querySelector('.message-input-container, .chat-input, .input-bottom-bar') || document.body;
    
    const RATIO_PATTERN = /^\s*(\d+:\d+)\s*[▲▼]?\s*$/;
    let ratioTrigger = Array.from(inputContainer.querySelectorAll('.ant-dropdown-trigger, [class*="ratio"], [class*="aspect"]'))
        .find(el => el.offsetWidth > 0 && /\d+:\d+/.test(el.textContent.trim()));

    if (!ratioTrigger) {
        const els = Array.from(inputContainer.querySelectorAll('*')).filter(el => el.offsetWidth > 0 && el.children.length < 3);
        ratioTrigger = els.find(el => /\d+:\d+/.test(el.textContent.trim()));
    }

    if (!ratioTrigger) {
        console.warn('Arin: Ratio trigger not found, skipping');
        return;
    }

    if (ratioTrigger.textContent.includes(ratio)) {
        console.log('Arin: Ratio already set to', ratio);
        return;
    }

    await humanClick(ratioTrigger);
    await humanSleep(400, 700);

    let targetItem = null;
    let visibleDropdown = null;
    const deadline = Date.now() + 4000;
    while (!targetItem && Date.now() < deadline) {
        if (!window.arinIsGenerating) throw new Error('USER_STOPPED_GENERATION');
        const dropdowns = Array.from(document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden)'));
        visibleDropdown = dropdowns.find(el => el.offsetWidth > 0);
        
        if (visibleDropdown) {
            const items = Array.from(visibleDropdown.querySelectorAll('li, [class*="item"]'));
            targetItem = items.find(el => el.offsetHeight > 0 && (el.textContent.trim() === ratio || el.textContent.includes(ratio)));
        }
        if (!targetItem) await sleep(200);
    }

    if (!targetItem) {
        console.warn('Arin: Ratio option', ratio, 'not found in dropdown');
        document.body.click();
        return;
    }

    console.log('Arin: Clicking Ratio option', ratio);
    await humanSleep(500, 800); // รอ animation dropdown กลางจอเสร็จ
    const ratioClickEl = targetItem.querySelector('*') || targetItem;
    await humanClick(ratioClickEl);
    
    let closeTimeout = Date.now() + 3000;
    while (Date.now() < closeTimeout) {
        const stillOpen = document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden)');
        if (Array.from(stillOpen).filter(el => el.offsetWidth > 0).length === 0) break;
        await sleep(200);
    }

    const openDrops = Array.from(document.querySelectorAll('.ant-dropdown:not(.ant-dropdown-hidden)')).filter(el => el.offsetWidth > 0);
    if (openDrops.length > 0) {
        document.body.click();
    }
    
    await humanSleep(500, 800);
};


// ─── Auto Download ───
const handleAutoDownload = async (prompt, settings, url, mode) => {
    const folder = settings?.saveFolder?.trim() || '';
    const baseName = settings?.autoRename !== false ? sanitizeFilename(prompt) : `qwen_${Date.now()}`;
    const ext = mode === 'Create Video' || url.includes('.mp4') || url.startsWith('blob:') ? '.mp4' : '.jpg';
    const filename = baseName + ext;
    
    console.log('Arin: Downloading:', filename);
    chrome.runtime.sendMessage({
        action: 'DOWNLOAD_RESULT',
        url: url,
        filename,
        folder
    });
};

// ─── Human Click ───
const humanClick = async (element) => {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await humanSleep(100, 300);
    for (const evType of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        element.dispatchEvent(new MouseEvent(evType, { bubbles: true, cancelable: true, view: window, buttons: 1 }));
        await sleep(10);
    }
};

// ─── Wait for Element ───
const waitForElement = async (selector, timeout = 8000, conditionFn = null) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (!window.arinIsGenerating) throw new Error('USER_STOPPED_GENERATION');
        const els = document.querySelectorAll(selector);
        for (const el of Array.from(els)) {
            if (el && el.offsetWidth > 0) {
                if (!conditionFn || conditionFn(el)) return el;
            }
        }
        await sleep(500);
    }
    return null;
};

// ─── Wait for Generation ───
const waitForGeneration = async (promptId, timeout = 240000, startTimestamp = Date.now(), mode) => {
    const start = Date.now();
    let maxSeenPct = 0;

    const getMediaElements = () => {
        if (mode === 'Create Video') {
            return Array.from(document.querySelectorAll(
                // ✅ ครอบคลุม blob: และ https: และ video element ทุกแบบ
                'video[src], video source, .chat-bubble video, [class*="message"] video, [class*="video-player"] video'
            )).filter(v => {
                const src = v.src || v.querySelector?.('source')?.src || '';
                return src.length > 0;
            });
        }
        return Array.from(document.querySelectorAll(
            '.chat-bubble img[src^="http"], .chat-bubble img[src^="blob:"], ' +
            '[class*="message"] img[src^="http"], [class*="message"] img[src^="blob:"]'
        ));
    };

    const initialMediaCount = getMediaElements().length;
    console.log('Arin: Initial media count:', initialMediaCount);

    while (Date.now() - start < timeout) {
        if (!window.arinIsGenerating) throw new Error('USER_STOPPED_GENERATION');
        const bodyText = document.body.innerText;

        if (bodyText.includes('rate limit') || bodyText.includes('daily limit') || bodyText.includes('has been exhausted'))
            throw new Error('[DAILY_LIMIT]');
        if (bodyText.includes('Something went wrong') || bodyText.includes('Failed to generate'))
            throw new Error('SERVER_ERROR');

        // ─── Check new media ───
        const currentMedia = getMediaElements();
        if (currentMedia.length > initialMediaCount) {
            const newEl = currentMedia[currentMedia.length - 1];
            const src = newEl.src || newEl.querySelector?.('source')?.src || '';
            if (src) {
                console.log('Arin: Media found!', src.slice(0, 80));
                await sleep(2000);
                sendProgress(promptId, 100, 'completed');
                return src;
            }
        }

        // ─── Progress: อ่าน % จริงจาก UI ───
        let realPct = null;
        const allBubbles = document.querySelectorAll(
            '.chat-bubble, [class*="message-content"], [class*="generation-progress"]'
        );
        for (let i = Math.max(0, allBubbles.length - 3); i < allBubbles.length; i++) {
            const match = allBubbles[i].innerText?.match(/(\d+)%/);
            if (match) {
                const pct = parseInt(match[1]);
                if (pct > 0 && pct <= 100) realPct = pct;
            }
        }

        if (Date.now() - start > 3000) {
            let currentPct = realPct !== null
                ? Math.min(99, realPct)
                : Math.min(95, 10 + Math.floor((Date.now() - start) / 3000));

            maxSeenPct = Math.max(maxSeenPct, currentPct);
            sendProgress(promptId, maxSeenPct, 'running');
        }

        await sleep(1500);
    }

    throw new Error('หมดเวลา Generation (Timeout)');
};
