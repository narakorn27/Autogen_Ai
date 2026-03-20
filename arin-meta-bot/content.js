// --- Content Script: Arin Meta Bot ---
console.log('Arin Meta Bot: Content Script Loaded');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const humanSleep = async (min = 500, max = 1500) => sleep(Math.floor(Math.random() * (max - min + 1) + min));
const sendProgress = (promptId, percent, status = 'running') => {
    chrome.runtime.sendMessage({ action: 'PROGRESS_UPDATE', promptId, percent, status });
};
const sanitizeFilename = (str, maxLen = 60) =>
    (str || '').replace(/[<>:"/\\|?*\n\r]/g, '_').trim().slice(0, maxLen) || 'output';

// ─── Message Listener ───
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'GENERATE') {
        processGeneration(message)
            .then(() => sendResponse({ success: true }))
            .catch((err) => {
                console.error('Arin Error:', err.message);
                sendResponse({ success: false, error: err.message, needRefresh: false });
            });
        return true;
    }
});

// ─── Helpers ───

const waitForAny = async (selectors, timeout = 12000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        for (const sel of selectors) {
            try {
                const el = document.querySelector(sel);
                if (el && el.offsetParent !== null) return el;
            } catch (e) { }
        }
        await sleep(400);
    }
    return null;
};

/**
 * รอให้ React hydrate เสร็จก่อน (ไม่มี pending React work)
 * ตรวจโดยดูว่า DOM นิ่งแล้ว (ไม่เปลี่ยนแปลงใน 300ms)
 */
const waitForReactStable = async (timeout = 8000) => {
    const start = Date.now();
    let lastHTML = '';
    while (Date.now() - start < timeout) {
        await sleep(300);
        const currentHTML = document.body.innerHTML.length;
        if (currentHTML === lastHTML) return true;
        lastHTML = currentHTML;
    }
    return true;
};

const humanClick = async (element) => {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await humanSleep(120, 320);
    element.focus && element.focus();
    for (const evType of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        element.dispatchEvent(new MouseEvent(evType, {
            bubbles: true, cancelable: true, view: window, buttons: 1
        }));
        await humanSleep(10, 30);
    }
};

/**
 * วิธีที่ปลอดภัยที่สุดสำหรับ Lexical editor บน Meta AI:
 * 
 * React error #418 เกิดเมื่อ execCommand/innerHTML แทรก text node
 * ในขณะที่ React กำลัง hydrate หรือ render
 * 
 * แก้โดย: ใช้ clipboard paste แทน — Lexical รองรับ paste event
 * และ React ไม่ได้ควบคุม clipboard ดังนั้นจะไม่เกิด hydration conflict
 */
const insertTextViaClipboard = async (el, text) => {
    el.focus();
    await humanSleep(300, 500);

    // เคลียร์ก่อนด้วย Ctrl+A → Backspace (keyboard event เท่านั้น)
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', ctrlKey: true, bubbles: true }));
    await sleep(100);
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', ctrlKey: true, bubbles: true }));
    await sleep(100);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace', bubbles: true }));
    await sleep(100);
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', code: 'Backspace', bubbles: true }));
    await humanSleep(200, 400);

    // สร้าง DataTransfer สำหรับ paste
    const dt = new DataTransfer();
    dt.setData('text/plain', text);

    // dispatch paste event — Lexical จัดการแทรกข้อความเองผ่าน onPaste handler
    const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt
    });
    el.dispatchEvent(pasteEvent);
    await humanSleep(400, 700);
};

/**
 * Fallback: พิมพ์ทีละตัวผ่าน input event
 * ใช้เมื่อ clipboard paste ไม่ work
 */
const insertTextViaInput = async (el, text) => {
    el.focus();
    await humanSleep(200, 400);

    // เคลียร์ก่อน
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
    await sleep(80);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    await sleep(150);

    // ใช้ input event แบบ compositionstart/end ซึ่ง Lexical ใช้ handle IME
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    el.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: text }));
    el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertCompositionText',
        data: text,
        isComposing: true
    }));
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: text }));
    el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: text,
        isComposing: false
    }));
    await humanSleep(400, 700);
};

// ─── Confirmed Selectors ───
const INPUT_SELECTORS = [
    'div[data-testid="composer-input"]',
    'textarea[data-testid="composer-input"]',
    'div[contenteditable="true"][data-lexical-editor="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
];

const SUBMIT_SELECTORS = [
    'button[data-testid="composer-send-button"]',
    'button[aria-label="ส่ง"]',
    'button[aria-label="Send"]',
    'button[aria-label="Send message"]',
    'div[role="button"][aria-label="ส่ง"]',
];

const findSubmitButton = () => {
    for (const sel of SUBMIT_SELECTORS) {
        try {
            const el = document.querySelector(sel);
            if (el && !el.disabled && el.offsetParent !== null) return el;
        } catch (e) { }
    }
    return null;
};

const waitForSubmitButton = async (timeout = 10000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const btn = findSubmitButton();
        if (btn && !btn.disabled) return btn;
        await sleep(300);
    }
    return null;
};

// ─── Settings Applier ───
const findButtonByText = (textList, exact = false) => {
    const els = Array.from(document.querySelectorAll('div[role="button"], button, [role="menuitem"], [role="option"]'));
    return els.find(el => {
        if (!el || el.offsetParent === null) return false;
        const content = (el.innerText || '').trim();
        if (!content) return false;
        return textList.some(t => exact ? content === t : content.includes(t));
    });
};

const applyMetaAISettings = async (mode, settings) => {
    const isVideo = mode.includes('video');
    const targetModeTexts = isVideo ? ['วิดีโอ', 'Video'] : ['รูปภาพ', 'Image'];

    let modeBtn = document.querySelector('button[data-testid="composer-mode-dropdown-button"]');
    if (!modeBtn) {
        const oppositeTexts = isVideo ? ['รูปภาพ', 'Image'] : ['วิดีโอ', 'Video'];
        modeBtn = findButtonByText([...targetModeTexts, ...oppositeTexts], true);
    }

    if (modeBtn) {
        const currentModeText = (modeBtn.innerText || '').trim();
        const alreadySet = targetModeTexts.some(t => currentModeText.includes(t));
        if (!alreadySet) {
            await humanClick(modeBtn);
            await humanSleep(300, 600);
            const optionBtn = findButtonByText(targetModeTexts, true) || findButtonByText(targetModeTexts, false);
            if (optionBtn) {
                await humanClick(optionBtn);
                await humanSleep(300, 600);
            } else {
                await humanClick(document.body);
            }
        }
    }

    if (settings && settings.aspectRatio) {
        const currentRatioBtn = findButtonByText(['1:1', '16:9', '9:16', '4:3']);
        if (currentRatioBtn && !currentRatioBtn.innerText.includes(settings.aspectRatio)) {
            await humanClick(currentRatioBtn);
            await humanSleep(300, 600);
            const optionBtn = findButtonByText([settings.aspectRatio]);
            if (optionBtn) {
                await humanClick(optionBtn);
                await humanSleep(300, 600);
            } else {
                await humanClick(document.body);
            }
        }
    }
};

// ─── Main Flow ───
const processGeneration = async (data) => {
    const { prompt, promptId, mode, settings } = data;

    if (!window.location.href.includes('meta.ai')) {
        throw new Error('[OFF_SITE] กรุณาสลับไปที่หน้า Meta AI (meta.ai)');
    }

    sendProgress(promptId, 0, 'typing');

    // รอให้ React hydrate เสร็จก่อนแตะ DOM
    await waitForReactStable(5000);

    // 0. ปรับตั้งค่า
    try {
        await applyMetaAISettings(mode, settings);
    } catch (e) {
        console.warn('[Arin] Apply settings failed:', e.message);
    }

    // 1. รอ Input Box
    const chatInput = await waitForAny(INPUT_SELECTORS, 12000);
    if (!chatInput) throw new Error('ไม่พบช่องกรอกข้อความ — ลอง F5 แล้วลองใหม่');

    // รอให้ React stable อีกรอบหลังจากที่ settings เปลี่ยน
    await humanSleep(500, 800);

    // 2. prefix ตาม mode
    const isCreatePage = window.location.href.includes('/create');
    const fullPrompt = isCreatePage
        ? prompt
        : (mode.includes('video') ? '/animate ' : '/imagine ') + prompt;

    // 3. ใส่ข้อความ — ลอง clipboard paste ก่อน, fallback ไป input event
    const isTextarea = chatInput.tagName === 'TEXTAREA';
    if (isTextarea) {
        chatInput.focus();
        await humanSleep(200, 400);
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        nativeInputValueSetter.call(chatInput, fullPrompt);
        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
        chatInput.dispatchEvent(new Event('change', { bubbles: true }));
        await humanSleep(400, 700);
    } else {
        // ลอง clipboard paste ก่อน
        await insertTextViaClipboard(chatInput, fullPrompt);

        // ตรวจว่าข้อความถูกใส่หรือเปล่า (Lexical จะมี text node ใน div)
        const textInserted = (chatInput.innerText || '').trim().length > 0;
        if (!textInserted) {
            console.warn('[Arin] Clipboard paste failed, trying input event fallback');
            await insertTextViaInput(chatInput, fullPrompt);
        }
    }

    sendProgress(promptId, 5, 'submitting');

    // 4. รอปุ่ม Submit enable (Lexical จะ enable ปุ่มหลังจากมีข้อความ)
    const submitBtn = await waitForSubmitButton(10000);
    if (!submitBtn) throw new Error('ไม่พบปุ่มส่งข้อความ (composer-send-button) — ข้อความอาจไม่ถูกใส่');

    await humanSleep(300, 600);
    await humanClick(submitBtn);

    sendProgress(promptId, 10, 'running');

    // 5. รอ generate เสร็จ
    const expectedCount = (settings && settings.outputsPerPrompt) || 1;
    const generated = await waitForGenerationComplete(promptId, expectedCount);

    // 6. Auto Download
    if (settings && settings.autoDownload && generated.length > 0) {
        for (let i = 0; i < generated.length; i++) {
            const item = generated[i];
            const ext = item.mediaType === 'video' ? 'mp4' : 'jpg';
            const filename = sanitizeFilename(prompt) + '_' + Date.now() + '_' + (i + 1) + '.' + ext;
            chrome.runtime.sendMessage({
                action: 'DOWNLOAD_RESULT',
                url: item.url,
                filename: filename,
                folder: (settings && settings.saveFolder) || 'ArinMetaBot'
            });
            await sleep(500);
        }
    }

    sendProgress(promptId, 100, 'completed');
    return true;
};

// ─── รอ Generate เสร็จ ───
const waitForGenerationComplete = async (promptId, expectedCount, timeout) => {
    expectedCount = expectedCount || 1;
    timeout = timeout || 180000;

    const collectedUrls = new Set();
    const start = Date.now();
    const existingVideoDivs = document.querySelectorAll('div[data-testid="generated-video"]').length;

    const urlHandler = (event) => {
        if (event.data && event.data.type === 'ARIN_MEDIA_URL' && event.data.url) {
            collectedUrls.add(JSON.stringify({ url: event.data.url, mediaType: event.data.mediaType }));
        }
    };
    window.addEventListener('message', urlHandler);

    let lastPercent = 10;
    const progressInterval = setInterval(() => {
        const elapsed = Date.now() - start;
        const pct = Math.min(90, Math.floor((elapsed / 90000) * 80) + 10);
        if (pct > lastPercent) {
            lastPercent = pct;
            sendProgress(promptId, pct, 'running');
        }
    }, 3000);

    try {
        while (Date.now() - start < timeout) {
            const currentVideoDivs = document.querySelectorAll('div[data-testid="generated-video"]').length;
            const newVideoCount = currentVideoDivs - existingVideoDivs;

            if (newVideoCount >= expectedCount) {
                const allVideoDivs = Array.from(document.querySelectorAll('div[data-testid="generated-video"]'));
                const newDivs = allVideoDivs.slice(existingVideoDivs);
                newDivs.forEach(div => {
                    const videoEl = div.querySelector('video[src]');
                    if (videoEl && videoEl.src) {
                        collectedUrls.add(JSON.stringify({ url: videoEl.src, mediaType: 'video' }));
                    }
                    const imgEl = div.querySelector('img[src]');
                    if (imgEl && imgEl.src) {
                        collectedUrls.add(JSON.stringify({ url: imgEl.src, mediaType: 'image' }));
                    }
                });
            }

            if (collectedUrls.size >= expectedCount) break;

            // fallback scan
            document.querySelectorAll('video[src*="fife"], img[src*="fife"], video[src*="scontent"], img[src*="scontent"]').forEach(el => {
                if (el.src) collectedUrls.add(JSON.stringify({
                    url: el.src,
                    mediaType: el.tagName === 'VIDEO' ? 'video' : 'image'
                }));
            });

            if (collectedUrls.size >= expectedCount) break;
            await sleep(2000);
        }
    } finally {
        clearInterval(progressInterval);
        window.removeEventListener('message', urlHandler);
    }

    console.log('[Arin] collected URLs:', Array.from(collectedUrls));
    return Array.from(collectedUrls).map(s => JSON.parse(s));
};