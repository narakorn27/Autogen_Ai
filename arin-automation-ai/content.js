// --- Content Script: Arin Whisk Bot v7.2 ---
// ไฟล์นี้จัดการเฉพาะ Google Whisk เท่านั้น
console.log('[Arin Whisk] Content script loaded ✅');
(function() {
'use strict';

let isLicensed = false;
let botGuardOverlay = null;

const ensureBotGuardOverlay = () => {
    if (botGuardOverlay && document.body?.contains(botGuardOverlay)) return botGuardOverlay;

    const styleId = 'arin-bot-guard-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #arin-bot-guard {
                position: fixed;
                inset: 0;
                z-index: 2147483646;
                display: none;
                align-items: center;
                justify-content: center;
                background: rgba(8, 8, 12, 0.38);
                pointer-events: none;
            }
            #arin-bot-guard .arin-bot-guard-card {
                max-width: 420px;
                margin: 24px;
                padding: 18px 20px;
                border-radius: 16px;
                border: 1px solid rgba(212, 175, 55, 0.25);
                background: rgba(14, 14, 20, 0.92);
                color: #f8fafc;
                text-align: center;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
                font-family: system-ui, sans-serif;
            }
            #arin-bot-guard .arin-bot-guard-title {
                font-size: 18px;
                font-weight: 700;
                color: #f59e0b;
                margin-bottom: 6px;
            }
            #arin-bot-guard .arin-bot-guard-text {
                font-size: 13px;
                line-height: 1.5;
                color: #cbd5e1;
            }
        `;
        document.documentElement.appendChild(style);
    }

    botGuardOverlay = document.createElement('div');
    botGuardOverlay.id = 'arin-bot-guard';
    botGuardOverlay.innerHTML = `
        <div class="arin-bot-guard-card">
            <div class="arin-bot-guard-title">บอทกำลังทำงาน</div>
            <div class="arin-bot-guard-text">กรุณาอย่าคลิก พิมพ์ หรือเปลี่ยนหน้าจอจนกว่าบอทจะทำงานเสร็จ</div>
        </div>
    `;
    (document.body || document.documentElement).appendChild(botGuardOverlay);
    return botGuardOverlay;
};

const showBotGuardOverlay = () => {
    const overlay = ensureBotGuardOverlay();
    if (overlay) overlay.style.display = 'flex';
};

const hideBotGuardOverlay = () => {
    if (botGuardOverlay) botGuardOverlay.style.display = 'none';
};

// ─── Inject Injected.js ───
(function injectScript() {
    if (document.getElementById('arin-whisk-injected')) return;
    const script = document.createElement('script');
    script.id = 'arin-whisk-injected';
    script.src = chrome.runtime.getURL('Injected.js');
    script.onload = () => console.log('[Arin Whisk] Injected.js loaded ✅');
    script.onerror = (e) => console.error('[Arin Whisk] Injected.js load failed:', e);
    (document.head || document.documentElement).appendChild(script);
})();

// ─── Utils ───
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const humanSleep = async (min = 500, max = 1500) => sleep(Math.floor(Math.random() * (max - min + 1) + min));
const sendProgress = (promptId, percent, status = 'running') => {
    chrome.runtime.sendMessage({ action: 'PROGRESS_UPDATE', promptId, percent, status });
};
const sendLog = (text, level = 'info') => {
    chrome.runtime.sendMessage({ action: 'LOG', text: `[Content] ${text}`, level }).catch(() => {});
};
const sanitizeFilename = (str, maxLen = 60) =>
    (str || '').replace(/[<>:"/\\|?*\n\r]/g, '_').trim().slice(0, maxLen) || 'output';

// ─── Whisk Media Interception ───
let capturedMediaUrls = [];
window.addEventListener('message', (e) => {
    if (e.data?.type === 'ARIN_MEDIA_URL') {
        capturedMediaUrls.push({ url: e.data.url, mediaType: e.data.mediaType, ts: e.data.ts || Date.now() });
        sendLog(`[Hook] เจอ URL สื่อใหม่ (${e.data.mediaType})`, 'success');
    }
});

// ─── URL State Classification (Whisk only) ───
const classifyCurrentUrl = () => {
    const p = window.location.pathname || '';
    if (p.includes('[...catchAll]') || p.includes('%5B...catchAll%5D')) return 'catchall';
    if (p.includes('/tools/whisk')) {
        if (p.includes('/project') || isWorkPageReady()) return 'project';
        return 'landing';
    }
    return 'unknown';
};

const isErrorPage = () => {
    const bodyText = (document.body?.innerText || '').toLowerCase();
    return (
        bodyText.includes('ขออภัย') ||
        bodyText.includes("we're sorry") ||
        bodyText.includes("page not found") ||
        bodyText.includes("ไม่พบเนื้อหา") ||
        bodyText.includes("something went wrong")
    );
};

const isWorkPageReady = () => {
    const p = window.location.pathname || '';
    if (p.includes('[...catchAll]') || p.includes('%5B...catchAll%5D')) return false;
    const hasTextarea = !!document.querySelector('textarea');
    const hasFileInput = !!document.querySelector('input[type="file"]');
    const hasAddPhotoBtn = Array.from(document.querySelectorAll('i.google-symbols, span.google-symbols'))
        .some(el => el.textContent.trim() === 'add_photo_alternate');
    return hasTextarea || hasFileInput || hasAddPhotoBtn;
};

const clickEnterToolIfNeeded = async () => {
    if (isWorkPageReady()) return;
    await sleep(1000);
    const enterBtns = Array.from(document.querySelectorAll('a, button, div[role="button"]')).filter(b => {
        const txt = (b.innerText || b.textContent || '').trim();
        return (
            txt.includes('เข้าสู่เครื่องมือ') ||
            txt.toLowerCase().includes('enter tool') ||
            txt.toLowerCase().includes('get started') ||
            txt.toLowerCase().includes('try whisk') ||
            txt.toLowerCase().includes('ลองใช้')
        );
    });
    if (enterBtns.length > 0) {
        sendLog('คลิก "เข้าสู่เครื่องมือ"...', 'info');
        try { enterBtns[enterBtns.length - 1].click(); } catch (e) {}
        await sleep(2500);
    }
};

const clickAddPhotoButton = async () => {
    const icon =
        Array.from(document.querySelectorAll('i.google-symbols, span.google-symbols, .google-symbols'))
            .find(el => el.textContent.trim() === 'add_photo_alternate')
        || Array.from(document.querySelectorAll('i, span'))
            .find(el => el.textContent.trim() === 'add_photo_alternate');

    if (!icon) {
        sendLog('ไม่พบ icon add_photo_alternate', 'warn');
        return false;
    }
    const btn = icon.closest('button');
    if (!btn) { sendLog('ไม่พบ button parent ของ icon', 'warn'); return false; }

    sendLog('พบปุ่ม add_photo_alternate — คลิก...', 'info');
    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(300);
    await humanClick(btn);
    await sleep(200);
    btn.click();

    const start = Date.now();
    while (Date.now() - start < 10000) {
        await sleep(300);
        if (/\/tools\/whisk\/project/.test(window.location.pathname)) {
            sendLog('URL กลับเป็น /project แล้ว ✅', 'success');
            return true;
        }
    }
    sendLog('คลิกแล้วแต่ URL ไม่เปลี่ยน', 'warn');
    return false;
};

const ensureReadyToWork = async () => {
    const state = classifyCurrentUrl();
    const errorPage = isErrorPage();
    const workReady = isWorkPageReady();
    sendLog(`ensureReadyToWork: state=${state} errorPage=${errorPage} workReady=${workReady}`, 'info');

    if (state === 'project' && workReady && !errorPage) return true;

    if (state === 'catchall') {
        sendLog('หน้า catchall — ขอให้ Background navigate...', 'warn');
        chrome.runtime.sendMessage({ action: 'NAVIGATE_TO_URL', url: 'https://labs.google/fx/tools/whisk/project' });
        const start = Date.now();
        while (Date.now() - start < 20000) {
            await sleep(1000);
            if (classifyCurrentUrl() === 'project' && isWorkPageReady() && !isErrorPage()) return true;
        }
        throw new Error('[CATCH_ALL] ไม่สามารถกลับหน้า Whisk ได้');
    }

    if (state === 'landing') {
        const clicked = await clickAddPhotoButton();
        if (clicked) { await sleep(2000); if (isWorkPageReady()) return true; }
        await clickEnterToolIfNeeded();
        await sleep(2000);
        if (isWorkPageReady()) return true;
        throw new Error('[NEED_REFRESH] ไม่สามารถเข้าสู่หน้าเครื่องมือได้');
    }

    const clicked = await clickAddPhotoButton();
    if (clicked && classifyCurrentUrl() === 'project' && isWorkPageReady()) return true;
    throw new Error('[NEED_REFRESH] ไม่สามารถเข้าสู่หน้าเครื่องมือได้');
};

// ─── Message Listener (Whisk only) ───
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'LICENSE_OK') {
        isLicensed = true;
        sendResponse({ success: true });
        return false;
    }

    if (message.action === 'LICENSE_REVOKED') {
        isLicensed = false;
        sendResponse({ success: true });
        return false;
    }

    if (message.action === 'PING') {
        const state = classifyCurrentUrl();
        const workReady = isWorkPageReady();
        const errorPage = isErrorPage();
        const hasAddPhotoBtn = Array.from(document.querySelectorAll('i.google-symbols, span.google-symbols'))
            .some(el => el.textContent.trim() === 'add_photo_alternate');
        sendResponse({
            ok: true,
            script: 'whisk',
            url: window.location.href,
            state,
            workReady,
            errorPage,
            hasAddPhotoBtn,
            isReady: state === 'project' && (workReady || hasAddPhotoBtn) && !errorPage
        });
        return false;
    }

    if (message.action === 'CLICK_ADD_PHOTO_BTN') {
        clickAddPhotoButton()
            .then(clicked => sendResponse({ clicked }))
            .catch(() => sendResponse({ clicked: false }));
        return true;
    }

    if (message.action === 'GENERATE') {
        if (!isLicensed) {
            sendResponse({ success: false, error: 'License ยังไม่ได้เปิดใช้งาน', needRefresh: false });
            return true;
        }
        ensureReadyToWork().then(async () => {
            processGeneration(message)
                .then(() => sendResponse({ success: true }))
                .catch((err) => {
                    console.error('Arin Whisk Error:', err.message);
                    const errorInfo = classifyError(err.message);
                    sendResponse({
                        success: false,
                        error: errorInfo.message,
                        needRefresh: errorInfo.needRefresh,
                        isCatchAll: err.message.includes('[CATCH_ALL]')
                    });
                });
        }).catch(err => {
            sendResponse({ success: false, error: err.message, needRefresh: true });
        });
        return true;
    }

    return false;
});

chrome.storage.local.get('licenseVerified', (data) => {
    if (data.licenseVerified) {
        isLicensed = true;
    }
});

// ─── Error Classification ───
const classifyError = (errMsg) => {
    if (!errMsg) return { message: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ', needRefresh: true };
    if (errMsg.includes('[CATCH_ALL]')) return { message: '⚠️ หน้า Whisk หลุด — กำลัง navigate กลับ', needRefresh: false };
    if (errMsg.includes('ไม่พบช่อง') || errMsg.includes('ไม่พบ')) return { message: '❌ หน้ายังโหลดไม่สมบูรณ์ — กรุณากด F5', needRefresh: true };
    if (errMsg.includes('[OFF_SITE]')) return { message: '⚠️ กรุณาเปิด Google Whisk ก่อน', needRefresh: false };
    if (errMsg.includes('DAILY_LIMIT') || errMsg.includes('ขีดจำกัด')) return { message: '🚫 ถึงขีดจำกัดรายวันแล้ว', needRefresh: false };
    if (errMsg.includes('Timeout') || errMsg.includes('หมดเวลา')) return { message: '⏱️ หมดเวลารอผลลัพธ์ — ลอง F5', needRefresh: true };
    return { message: `❌ ${errMsg}`, needRefresh: true };
};

// ─── DOM Helpers ───
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

const waitForDOMStable = async (stableMs = 600, timeout = 10000) => {
    const start = Date.now();
    let lastLen = 0;
    let stableStart = Date.now();
    while (Date.now() - start < timeout) {
        await sleep(150);
        const cur = document.body ? document.body.innerHTML.length : 0;
        if (cur !== lastLen) { lastLen = cur; stableStart = Date.now(); }
        else if (Date.now() - stableStart >= stableMs) return true;
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
        element.dispatchEvent(new MouseEvent(evType, { bubbles: true, cancelable: true, view: window, buttons: 1 }));
        await humanSleep(20, 60);
    }
    await humanSleep(150, 300);
};

const ensureOnWhiskMainPage = async () => {
    if (isWorkPageReady()) return;
    const modeIcons = Array.from(document.querySelectorAll('i, span'))
        .filter(el => el.textContent.trim() === 'add_photo_alternate');
    if (modeIcons.length > 0) {
        const modeBtn = modeIcons[0].closest('button');
        if (modeBtn && modeBtn.offsetParent !== null) {
            await humanClick(modeBtn);
            await humanSleep(400, 800);
        }
    }
};

const openImageUploadPanel = async () => {
    if (document.querySelectorAll('input[type="file"]').length > 0) {
        sendLog('Upload panel เปิดอยู่แล้ว ✅', 'info');
        return;
    }
    const addImgBtn = Array.from(document.querySelectorAll('button'))
        .find(b => b.offsetParent !== null && b.innerText?.includes('เพิ่มรูปภ'));
    if (addImgBtn) {
        sendLog('คลิก "เพิ่มรูปภาพ"...', 'info');
        await humanClick(addImgBtn);
        const start = Date.now();
        while (Date.now() - start < 5000) {
            await sleep(300);
            if (document.querySelectorAll('input[type="file"]').length > 0) {
                sendLog(`Upload panel เปิดแล้ว ✅`, 'success');
                return;
            }
        }
    } else {
        sendLog('ไม่พบปุ่ม "เพิ่มรูปภาพ"', 'warn');
    }
};

const clearAllUploadZones = async () => {
    const getDeleteBtns = () =>
        Array.from(document.querySelectorAll('button[aria-label="ลบรูปภาพ"]'))
            .filter(btn => {
                let p = btn.parentElement;
                for (let j = 0; j < 5 && p; j++) {
                    if ((p.className || '').includes('sc-7e4f5fb9-1')) return true;
                    p = p.parentElement;
                }
                return false;
            })
            .filter(btn => btn.offsetParent !== null);

    let btns = getDeleteBtns();
    let count = 0;
    while (btns.length > 0 && count < 10) {
        count++;
        sendLog(`🗑️ ลบรูปเก่า... (เหลือ ${btns.length})`, 'warn');
        await humanClick(btns[0]);
        await humanSleep(700, 1000);
        btns = getDeleteBtns();
    }
    if (count > 0) { sendLog(`✅ ล้างรูปเก่าครบ ${count} รูป`, 'success'); await humanSleep(400, 600); }
};

const waitForZoneUploaded = async (zoneIndex, timeout = 30000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const btns = Array.from(document.querySelectorAll('button[aria-label="ลบรูปภาพ"]'))
            .filter(btn => {
                let p = btn.parentElement;
                for (let j = 0; j < 5 && p; j++) {
                    if ((p.className || '').includes('sc-7e4f5fb9-1')) return true;
                    p = p.parentElement;
                }
                return false;
            })
            .filter(btn => btn.offsetParent !== null);
        if (btns.length > zoneIndex) {
            sendLog(`zone[${zoneIndex}] อัปโหลดเสร็จ ✅`, 'success');
            await sleep(1500);
            return true;
        }
        await sleep(500);
    }
    sendLog(`zone[${zoneIndex}] timeout`, 'warn');
    return false;
};

const uploadZone = async (imageData, zoneName, zoneIndex) => {
    if (!imageData) return;
    sendLog(`Uploading ${zoneName}...`, 'info');
    await uploadZoneViaInjected(imageData, zoneName);
    await waitForZoneUploaded(zoneIndex);
    await humanSleep(300, 500);
};

const uploadZoneViaInjected = async (imageData, zoneName) => {
    if (!imageData) return;
    const mimeMatch = imageData.match(/data:([^;]+);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64 = imageData.split(',')[1];
    const result = await new Promise((resolve) => {
        const handler = (e) => {
            if (e.data?.type === 'ARIN_UPLOAD_RESULT' && e.data.target === zoneName) {
                window.removeEventListener('message', handler);
                resolve(e.data);
            }
        };
        window.addEventListener('message', handler);
        window.postMessage({ type: 'ARIN_UPLOAD_REQUEST', target: zoneName, images: [{ base64, mime }] }, '*');
        setTimeout(() => { window.removeEventListener('message', handler); resolve({ success: false, error: 'timeout' }); }, 8000);
    });
    if (result.success) {
        sendLog(`Upload ${zoneName} via Injected ✅`, 'success');
        await sleep(1500);
    } else {
        sendLog(`Injected failed → fallback direct inject ${zoneName}`, 'warn');
        const idx = { subject: 0, scene: 1, style: 2 };
        const input = document.querySelectorAll('input[type="file"]')[idx[zoneName] ?? 0];
        if (input) {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: mime });
            const file = new File([blob], `${zoneName}_${Date.now()}.jpg`, { type: mime });
            const dt = new DataTransfer();
            dt.items.add(file);
            Object.defineProperty(input, 'files', { configurable: true, get() { return dt.files; } });
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            sendLog(`Direct inject ${zoneName} ✅`, 'success');
            await sleep(1500);
        }
    }
};

const PROMPT_SELECTORS = [
    'textarea.sc-18deeb1d-8',
    'textarea[placeholder*="อธิบายแนวคิด"]',
    'textarea[placeholder*="Describe"]',
    'textarea[aria-label*="Prompt"]',
    'textarea[aria-label*="พรอมต์"]',
    'textarea',
];

const GENERATE_SELECTORS = [
    'button[aria-label="ส่งพรอมต์"]',
    'button[aria-label*="ส่งพรอมต์"]',
    'button[aria-label*="Submit prompt"]',
    'button[aria-label*="Whisk"]',
    'button[aria-label*="Generate"]',
    'button[aria-label*="สร้าง"]',
];

const findGenerateButton = () => {
    for (const sel of GENERATE_SELECTORS) {
        try {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
                if (el && !el.disabled && el.offsetParent !== null) return el;
            }
        } catch (e) {}
    }
    const promptEl = document.querySelector(PROMPT_SELECTORS.join(','));
    if (promptEl) {
        let parent = promptEl.parentElement;
        for (let i = 0; i < 8 && parent; i++) {
            const buttons = Array.from(parent.querySelectorAll('button'))
                .filter(b => !b.disabled && b.offsetParent !== null);
            const svgButtons = buttons.filter(b => {
                const hasSvg = b.querySelector('svg') !== null;
                const text = (b.textContent || '').trim().toLowerCase();
                return hasSvg && text !== '×' && text !== 'x' && !b.getAttribute('aria-label')?.includes('clear');
            });
            if (svgButtons.length > 0) {
                svgButtons.sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left);
                return svgButtons[0];
            }
            parent = parent.parentElement;
        }
    }
    return null;
};

const setAspectRatio = async (ratio) => {
    if (!ratio || ratio === 'default') return;
    const icons = Array.from(document.querySelectorAll('i, span')).filter(el => el.textContent.trim() === 'aspect_ratio');
    let arBtn = icons.length > 0 ? icons[0].closest('button') : null;
    if (!arBtn || arBtn.disabled || arBtn.offsetParent === null) return;
    await humanClick(arBtn);
    await humanSleep(800, 1200);
    const ratioBtn = Array.from(document.querySelectorAll('button'))
        .filter(b => b.offsetParent !== null)
        .find(b => { const t = (b.textContent || '').replace(/\s/g, ''); return t === ratio || t.includes(ratio); });
    if (ratioBtn) { await humanClick(ratioBtn); await humanSleep(300, 600); }
    else { await humanClick(arBtn); }
};

const processGeneration = async (data) => {
    const { prompt, promptId, settings, subjectImage, sceneImage, styleImage } = data;
    sendLog(`เริ่ม processGeneration: ${promptId}`, 'step');
    if (!/tools\/whisk/.test(window.location.pathname)) throw new Error('[OFF_SITE] ไม่ได้อยู่ในหน้า Whisk');
    sendProgress(promptId, 0, 'starting');
    showBotGuardOverlay();
    try {
    await waitForDOMStable(500, 5000);
    await ensureOnWhiskMainPage();

    const hasImages = subjectImage || sceneImage || styleImage;
    if (hasImages) {
        sendProgress(promptId, 10, 'uploading_images');
        sendLog('STEP 2: Upload รูปภาพ...', 'step');
        await openImageUploadPanel();
        await sleep(800);
        const fileInputs = document.querySelectorAll('input[type="file"]');
        sendLog(`พบ input[type=file]: ${fileInputs.length} ตัว`, 'info');
        if (fileInputs.length === 0) throw new Error('[UPLOAD_FAILED] ไม่พบ file input');
        await clearAllUploadZones();
        let uploadIndex = 0;
        if (subjectImage) { await uploadZone(subjectImage, 'subject', uploadIndex); uploadIndex++; }
        if (sceneImage)   { await uploadZone(sceneImage, 'scene', uploadIndex); uploadIndex++; }
        if (styleImage)   { await uploadZone(styleImage, 'style', uploadIndex); uploadIndex++; }
        await waitForDOMStable(300, 3000);
    }

    if (settings?.aspectRatio) {
        sendProgress(promptId, 28, 'setting_ratio');
        await setAspectRatio(settings.aspectRatio);
    }

    if (prompt?.trim()) {
        sendProgress(promptId, 35, 'typing_prompt');
        sendLog('STEP 4: พิมพ์ Prompt...', 'step');
        const promptInput = await waitForAny(PROMPT_SELECTORS, 10000);
        if (promptInput) {
            await humanClick(promptInput);
            await humanSleep(300, 600);
            promptInput.focus();
            const proto = promptInput.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
            const nativeSet = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (nativeSet) nativeSet.call(promptInput, prompt);
            else promptInput.value = prompt;
            promptInput.dispatchEvent(new Event('input', { bubbles: true }));
            promptInput.dispatchEvent(new Event('change', { bubbles: true }));
            await humanSleep(300, 600);
        }
    }

    sendProgress(promptId, 45, 'clicking_generate');
    sendLog('STEP 5: กด Generate...', 'step');
    const generateBtn = findGenerateButton();
    if (!generateBtn) throw new Error('ไม่พบปุ่ม Generate — ลอง F5 แล้วลองใหม่');
    const urlBefore = window.location.href;
    await humanClick(generateBtn);
    await sleep(600);
    if (document.body.contains(generateBtn) && generateBtn.offsetParent !== null) generateBtn.click();

    sendProgress(promptId, 50, 'waiting_for_result');
    const generated = await waitForGenerationComplete(promptId, urlBefore);

    if (settings?.autoDownload && generated.length > 0) {
        for (let i = 0; i < Math.min(generated.length, 4); i++) {
            const filename = sanitizeFilename(prompt || 'whisk') + '_' + Date.now() + '_' + (i + 1) + '.png';
            chrome.runtime.sendMessage({ action: 'DOWNLOAD_RESULT', url: generated[i].url, filename, folder: settings?.saveFolder || 'ArinWhiskBot' });
            await sleep(600);
        }
    }

    sendProgress(promptId, 100, 'completed');
    sendLog(`เสร็จสิ้น ${promptId} ✅`, 'success');
    return true;
    } finally {
        hideBotGuardOverlay();
    }
};

const waitForGenerationComplete = async (promptId, urlBeforeGenerate, timeout = 180000) => {
    const getVisibleImages = () => Array.from(document.querySelectorAll('img'))
        .filter(img => img.src && img.src.length > 20).map(img => img.src);
    const snapUrls = new Set(getVisibleImages());
    const collectedUrls = new Set();
    const start = Date.now();
    let resolved = false;
    let lastPercent = 50;
    const progressInterval = setInterval(() => {
        if (resolved) { clearInterval(progressInterval); return; }
        const elapsed = Date.now() - start;
        const pct = Math.min(90, Math.floor((elapsed / 90000) * 40) + 50);
        if (pct > lastPercent) { lastPercent = pct; sendProgress(promptId, pct, 'running'); }
    }, 3000);
    try {
        while (Date.now() - start < timeout) {
            await sleep(800);
            const currentImgs = Array.from(document.querySelectorAll('img')).filter(img => {
                if (!img.src || img.src.length < 30 || snapUrls.has(img.src)) return false;
                const src = img.src;
                if (src.includes('lh3.googleusercontent.com') || src.includes('generativelanguage') || src.includes('storage.googleapis.com')) {
                    const rect = img.getBoundingClientRect();
                    return rect.width > 200 && rect.height > 200;
                }
                return src.startsWith('blob:');
            });
            if (currentImgs.length > 0) {
                currentImgs.forEach(img => collectedUrls.add(JSON.stringify({ url: img.src, mediaType: 'image' })));
                break;
            }
            if (Date.now() - start > 140000 && collectedUrls.size === 0) break;
        }
    } finally {
        resolved = true;
        clearInterval(progressInterval);
    }
    if (collectedUrls.size > 0) await sleep(1000);
    return Array.from(collectedUrls).map(s => JSON.parse(s));
};

console.log('[Arin Whisk] Listeners registered ✅');
})();
