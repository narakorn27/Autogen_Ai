// --- Content Script: Arin Auto Bot ---
console.log('Arin Auto Bot: Content Script Loaded');

// ─── ดัก fifeUrl ผ่าน injected.js (แก้ปัญหา CSP บล็อก inline script) ───
let capturedMediaUrls = [];

window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== 'ARIN_MEDIA_URL') return;
    const { url, ts, mediaType } = event.data;
    if (!url) return;
    capturedMediaUrls.push({ url, ts, mediaType });
    console.log('Arin: Captured fifeUrl (' + mediaType + '):', url.slice(0, 80) + '...');
});

// inject injected.js เป็น file แยก — ไม่โดน CSP บล็อก
function injectScript() {
    if (window.__arinScriptInjected) return;
    window.__arinScriptInjected = true;
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('injected.js');
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectScript);
else injectScript();

// ─── Utils ───
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const humanSleep = async (min = 500, max = 1500) => sleep(Math.floor(Math.random() * (max - min + 1) + min));
const sendProgress = (promptId, percent, status = 'running') => {
    chrome.runtime.sendMessage({ action: 'PROGRESS_UPDATE', promptId, percent, status });
};
const sanitizeFilename = (str, maxLen = 60) =>
    (str || '').replace(/[<>:"/\\|?*\n\r]/g, '_').trim().slice(0, maxLen) || 'output';
function uuidLike() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ─── Message Listener ───
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'GENERATE') {
        processGeneration(message)
            .then(() => sendResponse({ success: true }))
            .catch((err) => {
                console.error('Arin Error:', err.message);
                const errDetection = detectError();
                const needRefresh = !!(errDetection &&
                    (errDetection.code === 'SERVER_ERROR' || errDetection.code === 'POPUP_ERROR'));
                sendResponse({ success: false, error: err.message, needRefresh });
            });
        return true;
    }
});

// ─── Main Generation Flow ───
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

    if (mode === 'frame_to_video') {
        if (!data.image) throw new Error('โหมด Frame to Video ต้องการรูปภาพประกอบ');
        try { await handleImageUpload(data.image); }
        catch (e) { throw new Error('อัปโหลดรูปภาพไม่สำเร็จ: ' + e.message); }
    }

    try { await applySettings(settings, mode); } catch (e) { console.warn('Apply Settings failed:', e.message); }

    await humanSleep(300, 700);
    slateDiv.focus();
    await humanSleep(400, 900);

    slateDiv.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, cancelable: true, key: 'a', code: 'KeyA', ctrlKey: true, keyCode: 65
    }));
    await humanSleep(200, 500);
    slateDiv.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true, cancelable: true, inputType: 'deleteEntireSoftLine'
    }));
    await humanSleep(300, 800);
    slateDiv.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true, cancelable: true, inputType: 'insertText', data: prompt
    }));
    await humanSleep(800, 1500);

    const inserted = slateDiv.innerText?.trim();
    if (!inserted || inserted.length === 0) throw new Error('ไม่สามารถกรอก Prompt ลงใน Slate editor ได้');

    sendProgress(promptId, 2, 'submitting');

    const submitTimestamp = Date.now();

    const submitBtn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.includes('arrow_forward'));
    if (!submitBtn) throw new Error('ไม่พบปุ่ม Submit (arrow_forward)');

    await humanSleep(500, 1200);
    submitBtn.click();

    await waitForGeneration(promptId, 180000);
    sendProgress(promptId, 100, 'completed');

    if (settings?.autoDownload !== false) {
        try { await handleAutoDownload(prompt, settings, mode, submitTimestamp); }
        catch (e) { console.warn('Auto Download Failed:', e.message); }
    }

    return true;
};

// ─── Auto Download ───
const handleAutoDownload = async (prompt, settings, mode, submitTimestamp) => {
    const isImage = mode === 'text_to_image';
    const folder = settings?.saveFolder?.trim() || 'arin-auto-bot';
    const baseName = settings?.autoRename !== false ? sanitizeFilename(prompt) : uuidLike();
    const ext = isImage ? '.jpg' : '.mp4';

    console.log('Arin: Waiting for fifeUrl... (mode:', mode, ')');

    const maxWait = 60000;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
        const newUrls = capturedMediaUrls.filter(u => u.ts >= submitTimestamp);

        if (newUrls.length > 0) {
            newUrls.forEach((u, i) => {
                const filename = newUrls.length === 1
                    ? baseName + ext
                    : `${baseName}_${i + 1}${ext}`;
                console.log('Arin: Downloading:', filename);
                chrome.runtime.sendMessage({
                    action: 'DOWNLOAD_RESULT',
                    url: u.url,
                    filename,
                    folder
                });
            });
            return;
        }

        await sleep(500);
    }

    console.warn('Arin: No fifeUrl found after 60s');
};

// ─── Human Click ───
const humanClick = async (element) => {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await humanSleep(100, 300);
    for (const evType of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        element.dispatchEvent(new MouseEvent(evType, { bubbles: true, cancelable: true, view: window, buttons: 1 }));
        await humanSleep(10, 30);
    }
};

// ─── Apply Settings ───
const applySettings = async (settings, mode) => {
    if (!settings) return;
    const shortDelay = (min = 80, max = 200) => humanSleep(min, max);

    let settingsSummaryBtn = Array.from(document.querySelectorAll('button')).find(b => {
        const isMenuBtn = b.getAttribute('aria-haspopup') === 'menu' || b.getAttribute('aria-haspopup') === 'dialog';
        return isMenuBtn && ['x1','x2','x3','x4'].some(t => b.innerText.includes(t));
    }) || Array.from(document.querySelectorAll('button')).find(b =>
        b.getAttribute('aria-haspopup') === 'menu' &&
        (b.innerText.includes('Imagen') || b.innerText.includes('Banana'))
    );

    if (settingsSummaryBtn && settingsSummaryBtn.getAttribute('aria-expanded') === 'false') {
        await humanSleep(200, 400);
        await humanClick(settingsSummaryBtn);
        await humanSleep(400, 700);
    }

    const catBtn = findButtonByText(mode === 'text_to_image' ? 'รูปภาพ' : 'วิดีโอ', true);
    if (catBtn) { await shortDelay(); await humanClick(catBtn); await shortDelay(150, 350); }

    const ratioMap = { '9:16': 'แนวตั้ง', '1:1': 'จัตุรัส', '4:3': '4:3' };
    const ratioText = ratioMap[settings.aspectRatio] || 'แนวนอน';
    const ratioBtn = findButtonByText(ratioText, true) || findButtonByText(ratioText, false);
    if (ratioBtn && ratioBtn.getAttribute('aria-checked') !== 'true') {
        await shortDelay(); await humanClick(ratioBtn); await shortDelay(150, 350);
    }

    const numOutputs = parseInt(settings.outputsPerPrompt, 10);
    if (numOutputs >= 1 && numOutputs <= 4) {
        const countText = `x${numOutputs}`;
        const openMenu = Array.from(document.querySelectorAll('[role="menu"]')).find(m => {
            const rect = m.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;
            const text = m.innerText || '';
            return (text.includes('รูปภาพ') || text.includes('วิดีโอ')) && text.includes('x1');
        });
        const countBtn = openMenu
            ? Array.from(openMenu.querySelectorAll('button, [role="menuitemradio"]')).find(el => el.innerText.trim() === countText)
            : findButtonByText(countText, true) || findButtonByText(countText, false);
        if (countBtn && countBtn.getAttribute('data-state') !== 'on') {
            await shortDelay(); await humanClick(countBtn); await shortDelay(150, 350);
        }
    }

    if (settings.imageModel) {
        const openMenu = Array.from(document.querySelectorAll('[role="menu"]')).find(m => {
            const rect = m.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;
            const text = m.innerText || '';
            return (text.includes('รูปภาพ') || text.includes('วิดีโอ')) && text.includes('แนวนอน');
        });
        const modelDropdown = openMenu
            ? Array.from(openMenu.querySelectorAll('button')).find(b =>
                b.getAttribute('aria-haspopup') === 'menu' &&
                (b.innerText.includes('Imagen') || b.innerText.includes('Banana') || b.innerText.includes('Veo'))
            )
            : Array.from(document.querySelectorAll('button')).find(b =>
                b !== settingsSummaryBtn && b.getAttribute('aria-haspopup') === 'menu' &&
                (b.innerText.includes('Imagen') || b.innerText.includes('Banana') || b.innerText.includes('Veo'))
            );

        if (modelDropdown) {
            await shortDelay(); await humanClick(modelDropdown); await humanSleep(350, 600);
            const modelNameMap = { banana_nano_pro: 'Nano Banana Pro', banana_nano_2: 'Nano Banana 2', imagen_4: 'Imagen 4' };
            const targetModel = modelNameMap[settings.imageModel] || settings.imageModel;

            const submenu = Array.from(document.querySelectorAll('[role="menu"]')).find(m => {
                const rect = m.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return false;
                const t = (m.innerText || '').trim();
                return t.includes(targetModel) && !t.includes('รูปภาพ') && !t.includes('วิดีโอ');
            });
            const modelItem = submenu
                ? Array.from(submenu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], button'))
                    .find(el => (el.innerText || '').trim().includes(targetModel))
                : Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemradio"]'))
                    .find(el => {
                        const r = el.getBoundingClientRect();
                        return r.width > 0 && r.height > 0 && (el.innerText || '').trim().includes(targetModel);
                    });
            if (modelItem) { await humanClick(modelItem); await shortDelay(200, 400); }
        }
    }

    if (settingsSummaryBtn && settingsSummaryBtn.getAttribute('aria-expanded') === 'true') {
        await shortDelay(); await humanClick(settingsSummaryBtn); await shortDelay(150, 300);
    }
};

const findButtonByText = (text, exact = false) =>
    Array.from(document.querySelectorAll(
        'button, [role="button"], [role="menuitem"], [role="menuitemradio"], [role="tab"]'
    )).find(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const content = el.innerText.trim();
        return exact ? content === text : content.includes(text);
    });

// ─── Image Upload ───
const handleImageUpload = async (base64) => {
    if (!base64) return;
    const dropTarget = Array.from(document.querySelectorAll('div, button, span')).find(el => {
        const text = (el.innerText || '').trim();
        return text === 'Add' || text === 'เพิ่ม' || text.includes('upload') ||
               el.getAttribute('aria-label')?.includes('Add');
    }) || document.querySelector('div[data-slate-editor="true"]')?.parentElement;

    if (!dropTarget) throw new Error('ไม่พบเป้าหมายสำหรับอัปโหลดรูปภาพ');

    const res = await fetch(base64);
    const blob = await res.blob();
    const file = new File([blob], 'input_frame.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const cfg = { bubbles: true, cancelable: true, dataTransfer: dt };
    dropTarget.dispatchEvent(new DragEvent('dragenter', cfg));
    dropTarget.dispatchEvent(new DragEvent('dragover', cfg));
    dropTarget.dispatchEvent(new DragEvent('drop', cfg));
    for (let i = 0; i < 20; i++) {
        if (document.querySelector('img[src*="blob:"], button[aria-label*="Remove"], button[aria-label*="ลบ"]')) break;
        await sleep(500);
    }
    await humanSleep(1000, 2000);
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

// ─── Error Detection ───
const detectError = () => {
    const bodyText = document.body.innerText;
    if (bodyText.includes('reached your daily limit') || bodyText.includes('ขีดจำกัดรายวัน'))
        return { code: 'DAILY_LIMIT' };
    if (bodyText.includes('Something went wrong') || bodyText.includes('เกิดข้อผิดพลาดบางอย่าง'))
        return { code: 'SERVER_ERROR' };
    const dialog = document.querySelector('[role="alertdialog"], [role="dialog"]');
    if (dialog) {
        const t = dialog.innerText;
        if (t.includes('error') || t.includes('ผิดพลาด') || t.includes('failed'))
            return { code: 'POPUP_ERROR', message: t.slice(0, 100) };
    }
    return null;
};

// ─── Read Progress % ───
const readProgressPercent = () => {
    for (const el of document.querySelectorAll('*')) {
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

// ─── Wait for Generation ───
const waitForGeneration = async (promptId, timeout = 180000) => {
    const start = Date.now();
    let lastPercent = 2;
    let started = false;

    while (Date.now() - start < 15000) {
        const pct = readProgressPercent();
        const hasLoading = !!document.querySelector('[aria-busy="true"], [role="progressbar"]');
        const body = document.body.innerText;
        if (pct !== null || hasLoading || body.includes('กำลังสร้าง') || body.includes('Generating')) {
            started = true; break;
        }
        await sleep(800);
    }

    while (Date.now() - start < timeout) {
        const pct = readProgressPercent();
        const hasLoading = !!document.querySelector('[aria-busy="true"], [role="progressbar"]');
        const body = document.body.innerText;
        const hasGenerating = body.includes('กำลังสร้าง') || body.includes('Generating');

        if (pct !== null && pct !== lastPercent) {
            lastPercent = pct;
            sendProgress(promptId, pct, 'running');
        }

        if (!hasLoading && !hasGenerating && pct === null && started) {
            await sleep(1500);
            return true;
        }
        await sleep(1000);
    }

    throw new Error('หมดเวลา Generation (Timeout)');
};