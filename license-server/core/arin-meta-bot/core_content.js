// --- Content Script: Arin Meta Bot ---
console.log('[Arin] Content script loaded ✅');

// ─── Inject Injected.js เข้าหน้า Meta AI ───
(function injectScript() {
    if (document.getElementById('arin-injected')) return; // inject แค่ครั้งเดียว
    const script = document.createElement('script');
    script.id = 'arin-injected';
    script.src = chrome.runtime.getURL('Injected.js');
    script.onload = () => console.log('[Arin] Injected.js loaded ✅');
    script.onerror = (e) => console.error('[Arin] Injected.js load failed:', e);
    (document.head || document.documentElement).appendChild(script);
})();

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

const waitForAny = async (selectors, timeout = 15000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        for (const sel of selectors) {
            try {
                const el = document.querySelector(sel);
                if (el && el.offsetParent !== null) return el;
            } catch (e) {}
        }
        await sleep(400);
    }
    return null;
};

/**
 * รอให้ DOM นิ่ง (ไม่เปลี่ยนแปลงใน 500ms ติดต่อกัน)
 * ใช้ตรวจ React hydrate เสร็จ
 */
const waitForDOMStable = async (stableMs = 600, timeout = 10000) => {
    const start = Date.now();
    let lastLen = 0;
    let stableStart = Date.now();

    while (Date.now() - start < timeout) {
        await sleep(150);
        const cur = document.body.innerHTML.length;
        if (cur !== lastLen) {
            lastLen = cur;
            stableStart = Date.now();
        } else if (Date.now() - stableStart >= stableMs) {
            return true;
        }
    }
    return true;
};

const humanClick = async (element) => {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await humanSleep(200, 450);
    element.focus && element.focus();
    await sleep(80);
    for (const evType of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        element.dispatchEvent(new MouseEvent(evType, {
            bubbles: true, cancelable: true, view: window, buttons: 1
        }));
        await humanSleep(20, 60);
    }
    await humanSleep(150, 300);
};

const insertTextViaClipboard = async (el, text) => {
    el.focus();
    await humanSleep(400, 700);

    // เคลียร์ก่อน
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', ctrlKey: true, bubbles: true }));
    await sleep(120);
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', ctrlKey: true, bubbles: true }));
    await sleep(120);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace', bubbles: true }));
    await sleep(150);
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', code: 'Backspace', bubbles: true }));
    await humanSleep(300, 500);

    // Paste
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true, cancelable: true, clipboardData: dt
    });
    el.dispatchEvent(pasteEvent);
    await humanSleep(600, 900);
};

const insertTextViaInput = async (el, text) => {
    el.focus();
    await humanSleep(300, 500);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
    await sleep(100);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    await sleep(200);

    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    el.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: text }));
    el.dispatchEvent(new InputEvent('input', {
        bubbles: true, inputType: 'insertCompositionText', data: text, isComposing: true
    }));
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: text }));
    el.dispatchEvent(new InputEvent('input', {
        bubbles: true, inputType: 'insertText', data: text, isComposing: false
    }));
    await humanSleep(500, 800);
};

// ─── Selectors ───
const INPUT_SELECTORS = [
    'div[data-testid="composer-input"]',
    'textarea[data-testid="composer-input"]',
    'div[contenteditable="true"][data-lexical-editor="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
];

const SUBMIT_SELECTORS = [
    'button[data-testid="composer-animate-button"]', // ✅ ค้นพบจาก F12
    'button[data-testid="composer-send-button"]',
    'button[aria-label="ส่ง"]',
    'button[aria-label="Send"]',
    'button[aria-label="Send message"]',
];

const findSubmitButton = () => {
    for (const sel of SUBMIT_SELECTORS) {
        try {
            const el = document.querySelector(sel);
            if (el && !el.disabled && el.offsetParent !== null) return el;
        } catch (e) {}
    }
    // Fallback: หา button[type=submit] ใกล้ input
    const inputEl = document.querySelector(INPUT_SELECTORS.join(','));
    if (inputEl) {
        let parent = inputEl.parentElement;
        for (let i = 0; i < 6 && parent; i++) {
            const btn = Array.from(parent.querySelectorAll('button[type="submit"], button'))
                .find(b => !b.disabled && b.offsetParent !== null);
            if (btn) return btn;
            parent = parent.parentElement;
        }
    }
    return null;
};

const waitForSubmitButton = async (timeout = 15000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const btn = findSubmitButton();
        if (btn && !btn.disabled) return btn;
        await sleep(400);
    }
    return null;
};

// ─── findButtonByText helper ───
const findButtonByText = (textList, exact = false) => {
    const els = Array.from(document.querySelectorAll(
        'div[role="button"], button, [role="menuitem"], [role="option"], li'
    ));
    return els.find(el => {
        if (!el || el.offsetParent === null) return false;
        const content = (el.innerText || '').trim();
        if (!content) return false;
        return textList.some(t => exact
            ? content === t
            : content.toLowerCase().includes(t.toLowerCase())
        );
    });
};

const waitForButtonByText = async (textList, timeout = 8000, exact = false) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const btn = findButtonByText(textList, exact);
        if (btn) return btn;
        await sleep(300);
    }
    return null;
};

// ─── STEP 1: เลือก Mode (รูปภาพ / วิดีโอ) ───
const selectMode = async (mode) => {
    const isVideo = mode.includes('video');
    const targetText = isVideo ? 'วิดีโอ' : 'รูปภาพ';
    const oppositeText = isVideo ? 'รูปภาพ' : 'วิดีโอ';

    console.log(`[Arin] Selecting mode: ${targetText}`);

    // ── หา combobox button ที่แสดง mode ปัจจุบัน ──
    // selector จริงจาก F12: button[role="combobox"] ที่มี span[data-slot="select-value"]
    const findModeBtn = () => {
        return Array.from(document.querySelectorAll('button[role="combobox"]'))
            .find(btn => {
                if (btn.offsetParent === null) return false;
                const val = btn.querySelector('[data-slot="select-value"]');
                const txt = val?.innerText?.trim() || btn.innerText?.trim();
                return txt === targetText || txt === oppositeText;
            });
    };

    const modeBtn = findModeBtn();
    if (!modeBtn) {
        console.warn('[Arin] Mode combobox not found, skipping');
        return;
    }

    // ตรวจว่า mode ถูกแล้วหรือเปล่า
    const currentVal = modeBtn.querySelector('[data-slot="select-value"]')?.innerText?.trim()
        || modeBtn.innerText?.trim();

    if (currentVal === targetText) {
        console.log('[Arin] Mode already correct:', currentVal);
        return;
    }

    console.log(`[Arin] Current mode: "${currentVal}" → switching to "${targetText}"`);

    // คลิกเปิด combobox
    await humanClick(modeBtn);
    await humanSleep(500, 900);

    // รอ option โผล่ — Radix UI ใช้ [role="option"] หรือ [data-radix-select-item]
    const findOption = () => {
        return Array.from(document.querySelectorAll(
            '[role="option"], [data-radix-select-item], [data-slot="select-item"]'
        )).find(el => {
            if (el.offsetParent === null) return false;
            return el.innerText?.trim() === targetText || 
                   el.innerText?.trim().includes(targetText);
        });
    };

    let option = null;
    const deadline = Date.now() + 5000;
    while (!option && Date.now() < deadline) {
        option = findOption();
        if (!option) await sleep(200);
    }

    if (option) {
        await humanClick(option);
        await humanSleep(400, 700);
        console.log('[Arin] Mode selected:', targetText);
    } else {
        await humanClick(document.body);
        await humanSleep(300, 500);
        console.warn('[Arin] Mode option not found in dropdown');
    }
};

// ─── STEP 2: เลือก Aspect Ratio ───
const selectAspectRatio = async (ratio) => {
    if (!ratio) return;

    console.log(`[Arin] Selecting ratio: ${ratio}`);

    const RATIO_OPTIONS = ['1:1', '16:9', '9:16', '4:3', '3:4'];

    // หา button ที่แสดง ratio ปัจจุบัน
    let ratioBtn = null;
    for (const r of RATIO_OPTIONS) {
        const el = document.querySelector(`button[aria-label*="${r}"], [data-testid*="ratio"]`);
        if (el && el.offsetParent !== null) { ratioBtn = el; break; }
    }

    // fallback: หาจากข้อความ
    if (!ratioBtn) {
        ratioBtn = findButtonByText(RATIO_OPTIONS);
    }

    if (!ratioBtn) {
        console.warn('[Arin] Ratio button not found, skipping');
        return;
    }

    const currentText = (ratioBtn.innerText || ratioBtn.getAttribute('aria-label') || '').trim();
    if (currentText.includes(ratio)) {
        console.log('[Arin] Ratio already correct:', ratio);
        return;
    }

    // คลิกเปิด dropdown ratio
    await humanClick(ratioBtn);
    await humanSleep(500, 800);

    // หา option ที่ตรงกับ ratio ที่ต้องการ
    const option = await waitForButtonByText([ratio], 5000, false);
    if (option) {
        await humanClick(option);
        await humanSleep(400, 600);
        console.log('[Arin] Ratio selected:', ratio);
    } else {
        await humanClick(document.body);
        await humanSleep(300, 500);
        console.warn('[Arin] Ratio option not found for:', ratio);
    }
};

// ─── Upload Images to Meta AI Composer (สนับสนุนหลายรูป) ───
const uploadImagesToComposer = async (imageDataUrls) => {
    if (!imageDataUrls || imageDataUrls.length === 0) return;
    console.log(`[Arin] Uploading ${imageDataUrls.length} image(s) to composer...`);

    // แปลงทุกรูปเป็น {base64, mime}
    const images = imageDataUrls.map(dataUrl => {
        const mimeMatch = dataUrl.match(/data:([^;]+);/);
        return {
            base64: dataUrl.split(',')[1],
            mime: mimeMatch ? mimeMatch[1] : 'image/jpeg'
        };
    });

    const result = await new Promise((resolve) => {
        const handler = (e) => {
            if (e.data?.type === 'ARIN_UPLOAD_RESULT') {
                window.removeEventListener('message', handler);
                resolve(e.data);
            }
        };
        window.addEventListener('message', handler);

        window.postMessage({
            type: 'ARIN_UPLOAD_REQUEST',
            images // ✅ ส่ง array
        }, '*');

        setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve({ success: false, error: 'timeout' });
        }, 10000);
    });

    console.log('[Arin] Upload result:', result);
    
    if (result.success) {
        // รอ preview โผล่
        await humanSleep(1500, 2500);
        // ตรวจ preview
        const preview = document.querySelector(
            '[data-testid*="attachment"], [data-testid*="image-preview"], ' +
            '[class*="attachment"], [class*="preview"] img'
        );
        if (preview) {
            console.log('[Arin] Image preview detected ✅');
        } else {
            console.warn('[Arin] No preview found — image may not have uploaded');
        }
    } else {
        console.warn('[Arin] Upload failed:', result.error, '— continuing without image');
    }
};

// ─── Main Flow ───
const processGeneration = async (data) => {
    const { prompt, promptId, mode, settings } = data;

    if (!window.location.href.includes('meta.ai')) {
        throw new Error('[OFF_SITE] กรุณาสลับไปที่หน้า Meta AI (meta.ai)');
    }

    sendProgress(promptId, 0, 'typing');

    // ── รอ DOM นิ่งก่อนทำอะไรทั้งนั้น ──
    console.log('[Arin] Waiting for DOM stable...');
    await waitForDOMStable(600, 8000);
    await humanSleep(500, 800);

    // ── STEP 1: เลือก Mode (กดเหมือนคนกด) ──
    sendProgress(promptId, 2, 'running');
    try {
        await selectMode(mode);
    } catch (e) {
        console.warn('[Arin] selectMode error:', e.message);
    }

    // รอ DOM นิ่งหลังเปลี่ยน mode
    await waitForDOMStable(500, 5000);
    await humanSleep(400, 700);

    // ── STEP 2: เลือก Aspect Ratio ──
    sendProgress(promptId, 5, 'running');
    if (settings && settings.aspectRatio) {
        try {
            await selectAspectRatio(settings.aspectRatio);
        } catch (e) {
            console.warn('[Arin] selectAspectRatio error:', e.message);
        }
        await waitForDOMStable(400, 4000);
        await humanSleep(400, 600);
    }

    // ── STEP 2.5: อัปโหลดรูป (สนับสนุนหลายรูปใน 1 message) ──
    const imagesToUpload = data.images || (data.image ? [data.image] : []);
    if (mode === 'frame_to_video' && imagesToUpload.length > 0) {
        sendProgress(promptId, 7, 'running');
        try {
            await uploadImagesToComposer(imagesToUpload);
        } catch (e) {
            console.warn('[Arin] Image upload failed:', e.message);
        }
        await waitForDOMStable(500, 4000);
        await humanSleep(500, 800);
    }

    // ── STEP 3: รอ Input Box ──
    sendProgress(promptId, 8, 'typing');
    const chatInput = await waitForAny(INPUT_SELECTORS, 15000);
    if (!chatInput) throw new Error('ไม่พบช่องกรอกข้อความ — ลอง F5 แล้วลองใหม่');

    // คลิก input ก่อนเพื่อ focus (เหมือนคนคลิก)
    await humanClick(chatInput);
    await humanSleep(400, 700);

    // รอ DOM นิ่งอีกรอบหลัง focus
    await waitForDOMStable(400, 4000);

    // ── STEP 4: ใส่ prompt ──
    const isCreatePage = window.location.href.includes('/create');
    const fullPrompt = isCreatePage
        ? prompt
        : (mode.includes('video') ? '/animate ' : '/imagine ') + prompt;

    console.log('[Arin] Inserting prompt:', fullPrompt.slice(0, 80));

    const isTextarea = chatInput.tagName === 'TEXTAREA';
    if (isTextarea) {
        chatInput.focus();
        await humanSleep(300, 500);
        const nativeSet = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
        ).set;
        nativeSet.call(chatInput, fullPrompt);
        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
        chatInput.dispatchEvent(new Event('change', { bubbles: true }));
        await humanSleep(500, 800);
    } else {
        await insertTextViaClipboard(chatInput, fullPrompt);

        // ตรวจว่าใส่สำเร็จ
        const textInserted = (chatInput.innerText || '').trim().length > 0;
        if (!textInserted) {
            console.warn('[Arin] Clipboard paste failed, trying input event fallback');
            await insertTextViaInput(chatInput, fullPrompt);
        }
    }

    // ตรวจอีกรอบ
    const verifyText = (chatInput.innerText || chatInput.value || '').trim();
    console.log('[Arin] Text in input:', verifyText.slice(0, 60));
    if (!verifyText) {
        throw new Error('ใส่ข้อความไม่สำเร็จ — React อาจยังโหลดไม่เสร็จ');
    }

    sendProgress(promptId, 12, 'submitting');

    // ── STEP 5: รอปุ่ม Submit enable ──
    await humanSleep(500, 900); // รอ Lexical update state
    const submitBtn = await waitForSubmitButton(12000);

    if (submitBtn) {
        console.log('[Arin] Found submit button:', submitBtn.dataset.testid || submitBtn.className.slice(0, 50));
        await humanSleep(300, 600);
        await humanClick(submitBtn);
    } else {
        // Fallback: กด Enter
        console.warn('[Arin] Submit button not found — trying Enter key');
        chatInput.focus();
        await humanSleep(200, 400);
        for (const evType of ['keydown', 'keypress', 'keyup']) {
            chatInput.dispatchEvent(new KeyboardEvent(evType, {
                key: 'Enter', code: 'Enter', keyCode: 13,
                which: 13, bubbles: true, cancelable: true,
            }));
            await sleep(60);
        }
    }

    sendProgress(promptId, 15, 'running');

    // ── STEP 6: รอ generate เสร็จ ──
    const expectedCount = (settings && settings.outputsPerPrompt) || 1;
    const generated = await waitForGenerationComplete(promptId, expectedCount);

    // ── STEP 7: Auto Download ──
    if (settings && settings.autoDownload && generated.length > 0) {
        for (let i = 0; i < generated.length; i++) {
            const item = generated[i];
            const ext = item.mediaType === 'video' ? 'mp4' : 'jpg';
            const filename = sanitizeFilename(prompt) + '_' + Date.now() + '_' + (i + 1) + '.' + ext;
            chrome.runtime.sendMessage({
                action: 'DOWNLOAD_RESULT',
                url: item.url,
                filename,
                folder: (settings && settings.saveFolder) || 'ArinMetaBot'
            });
            await sleep(500);
        }
    }

    sendProgress(promptId, 100, 'completed');
    return true;
};

// ─── รอ Generate เสร็จ (แก้ปัญหาเก็บ URL ก่อนเสร็จ) ───
const waitForGenerationComplete = async (promptId, expectedCount, timeout) => {
    expectedCount = expectedCount || 1;
    timeout = timeout || 300000; // 5 นาที

    // snapshot จำนวน image/video ที่มีอยู่ก่อน generate
    const snapImages = new Set(
        Array.from(document.querySelectorAll('img[src*="scontent"], img[src*="fbcdn"]'))
            .map(el => el.src)
    );
    const snapVideos = new Set(
        Array.from(document.querySelectorAll('video[src]'))
            .map(el => el.src)
    );
    const existingVideosDivCount = document.querySelectorAll(
        'div[data-testid="generated-video"]'
    ).length;

    console.log(`[Arin] Snapshot: ${snapImages.size} existing images, ${snapVideos.size} existing videos`);

    const collectedUrls = new Set();
    const start = Date.now();

    // รับ URL จาก injected.js ผ่าน postMessage
    const urlHandler = (event) => {
        if (event.data && event.data.type === 'ARIN_MEDIA_URL' && event.data.url) {
            // กรองเฉพาะ URL ที่ไม่มีใน snapshot (ใหม่จริงๆ)
            if (!snapImages.has(event.data.url) && !snapVideos.has(event.data.url)) {
                collectedUrls.add(JSON.stringify({
                    url: event.data.url,
                    mediaType: event.data.mediaType
                }));
                console.log('[Arin] New media from postMessage:', event.data.url.slice(0, 80));
            }
        }
    };
    window.addEventListener('message', urlHandler);

    let lastPercent = 15;
    const progressInterval = setInterval(() => {
        const elapsed = Date.now() - start;
        const pct = Math.min(88, Math.floor((elapsed / 120000) * 73) + 15);
        if (pct > lastPercent) {
            lastPercent = pct;
            sendProgress(promptId, pct, 'running');
        }
    }, 3000);

    // ── รอให้มี "loading indicator" ปรากฏก่อน ──
    // (Meta AI จะแสดง spinner/skeleton ระหว่าง generate)
    let generationStarted = false;
    const loadingSelectors = [
        '[data-testid="generating-indicator"]',
        '[aria-label*="generating"]',
        '[aria-label*="กำลัง"]',
        '.loading-skeleton',
        '[data-testid*="loading"]',
        '[data-testid*="skeleton"]',
    ];

    // รอสูงสุด 20 วินาทีให้ loading ปรากฏ
    const loadingStart = Date.now();
    while (Date.now() - loadingStart < 20000) {
        const loadingEl = await waitForAny(loadingSelectors, 1000);
        if (loadingEl) {
            generationStarted = true;
            console.log('[Arin] Generation loading indicator detected');
            break;
        }
        // ถ้าไม่มี loading indicator — ตรวจจาก DOM change แทน
        const curImages = document.querySelectorAll(
            'img[src*="scontent"], img[src*="fbcdn"]'
        ).length;
        if (curImages > snapImages.size) {
            console.log('[Arin] New images appeared in DOM');
            break;
        }
        await sleep(500);
    }

    try {
        while (Date.now() - start < timeout) {
            await sleep(2000);

            // ── วิธีที่ 1: จาก postMessage (injected.js) ──
            if (collectedUrls.size >= expectedCount) {
                console.log('[Arin] Got enough URLs from postMessage');
                break;
            }

            // ── วิธีที่ 2: DOM scan เฉพาะ element ใหม่ ──
            const currentVideosDivs = Array.from(
                document.querySelectorAll('div[data-testid="generated-video"]')
            );
            const newVideosDivs = currentVideosDivs.slice(existingVideosDivCount);
            newVideosDivs.forEach(div => {
                const videoEl = div.querySelector('video[src]');
                if (videoEl && videoEl.src && !snapVideos.has(videoEl.src)) {
                    collectedUrls.add(JSON.stringify({ url: videoEl.src, mediaType: 'video' }));
                }
                const imgEl = div.querySelector('img[src]');
                if (imgEl && imgEl.src && !snapImages.has(imgEl.src)) {
                    collectedUrls.add(JSON.stringify({ url: imgEl.src, mediaType: 'image' }));
                }
            });

            if (collectedUrls.size >= expectedCount) {
                console.log('[Arin] Got enough URLs from DOM scan (video divs)');
                break;
            }

            // ── วิธีที่ 3: scan img/video ใหม่ที่ไม่อยู่ใน snapshot ──
            document.querySelectorAll(
                'img[src*="fbcdn"], img[src*="scontent"], video[src*="fbcdn"], video[src*="scontent"]'
            ).forEach(el => {
                const src = el.src;
                if (!src) return;
                // กรอง: ต้องไม่อยู่ใน snapshot
                if (snapImages.has(src) || snapVideos.has(src)) return;
                // กรอง: URL ต้องยาวพอ (ไม่ใช่ thumbnail เล็กๆ)
                if (src.length < 100) return;
                collectedUrls.add(JSON.stringify({
                    url: src,
                    mediaType: el.tagName === 'VIDEO' ? 'video' : 'image'
                }));
            });

            if (collectedUrls.size >= expectedCount) {
                console.log('[Arin] Got enough URLs from DOM scan (img/video)');
                break;
            }

            // ── ตรวจ timeout ย่อย: ถ้าเกิน 3 นาทียังไม่ได้อะไรเลย ─
            if (Date.now() - start > 180000 && collectedUrls.size === 0) {
                console.warn('[Arin] 3 min timeout with no results');
                break;
            }
        }
    } finally {
        clearInterval(progressInterval);
        window.removeEventListener('message', urlHandler);
    }

    // ── รอเพิ่ม 2 วินาทีให้ URL โหลดเสร็จจริงๆ ก่อน download ──
    if (collectedUrls.size > 0) {
        console.log('[Arin] Waiting 2s for media to fully load...');
        await sleep(2000);
    }

    console.log('[Arin] Final collected URLs:', collectedUrls.size, Array.from(collectedUrls));
    return Array.from(collectedUrls).map(s => JSON.parse(s));
};