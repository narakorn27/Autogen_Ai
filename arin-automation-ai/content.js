// --- Content Script: Arin Whisk Bot v7.2 ---
console.log('[Arin Whisk] Content script loaded ✅');

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

// ─── Tool Type Detection ───
const getToolType = () => {
    if (window.location.hostname !== 'labs.google') return null;
    const p = window.location.pathname || '';
    if (p.includes('tools/whisk')) return 'whisk';
    if (p.includes('tools/image-fx')) return 'flow';
    return null;
};

// ─── URL State Classification ───
// คืนค่า: 'project' | 'landing' | 'catchall' | 'unknown'
const classifyCurrentUrl = () => {
    const p = window.location.pathname || '';
    // catchAll: มี [...catchAll] หรือ path ที่ google redirect ไปเมื่อหน้าไม่เจอ
    if (p.includes('[...catchAll]') || p.includes('%5B...catchAll%5D')) return 'catchall';
    // หน้า project จริง (มี /project ท้าย path)
    if (p.match(/\/tools\/whisk\/project$/) || p.match(/\/tools\/image-fx\/project$/)) return 'project';
    // หน้า landing (path เป็น /whisk หรือ /image-fx ไม่มี /project)
    if (p.match(/\/tools\/whisk\/?$/) || p.match(/\/tools\/image-fx\/?$/)) return 'landing';
    // path แปลก เช่น /th/tools/whisk ที่ google เพิ่ม locale prefix
    if (p.includes('tools/whisk') || p.includes('tools/image-fx')) return 'landing';
    return 'unknown';
};

// ─── ตรวจสอบว่าหน้า "ขออภัย" จริงๆ หรือแค่ path แปลก ───
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

// ─── ตรวจว่าหน้าปัจจุบันพร้อมใช้งาน (มี UI ของ Whisk) ───
const isWorkPageReady = () => {
    // ถ้า URL ยังเป็น catchAll = ไม่พร้อมเด็ดขาด ไม่ต้องเช็ค DOM
    const p = window.location.pathname || '';
    if (p.includes('[...catchAll]') || p.includes('%5B...catchAll%5D')) return false;

    // เช็คว่ามี textarea หรือ upload zone ซึ่งหมายความว่า UI โหลดสมบูรณ์
    const hasTextarea = !!document.querySelector('textarea');
    const hasFileInput = !!document.querySelector('input[type="file"]');
    
    // ✅ เพิ่ม: เช็คว่าปุ่ม add_photo_alternate อยู่ไหม = หน้า project โหลดแล้ว
    const hasAddPhotoBtn = Array.from(document.querySelectorAll('i.google-symbols, span.google-symbols'))
        .some(el => el.textContent.trim() === 'add_photo_alternate');
    
    return hasTextarea || hasFileInput || hasAddPhotoBtn;
};

// ─── Navigate กลับไปหน้า Project ───
// ไม่ throw, คืน true ถ้าสำเร็จ, false ถ้าไม่ได้
const navigateToProjectPage = async (targetApp, maxWaitMs = 25000) => {
    const projectUrl = targetApp === 'flow'
        ? 'https://labs.google/fx/tools/image-fx/project'
        : 'https://labs.google/fx/tools/whisk/project';

    const currentState = classifyCurrentUrl();
    const errorPage = isErrorPage();

    sendLog(`navigateToProjectPage: currentState=${currentState} errorPage=${errorPage} url=${window.location.pathname}`, 'warn');

    // ถ้าหน้านี้พร้อมแล้วไม่ต้อง navigate
    if (currentState === 'project' && isWorkPageReady() && !errorPage) {
        sendLog('ปัจจุบันอยู่ที่ /project แล้ว และหน้าพร้อม', 'info');
        return true;
    }

    // ─── วิธี 1: คลิกปุ่ม "เรียกดูแกลเลอรี" หรือ nav link ไป whisk ───
    // หา link ที่ชี้ไป /tools/whisk หรือ /tools/image-fx
    const navLinks = Array.from(document.querySelectorAll('a[href]')).filter(a => {
        const href = a.getAttribute('href') || '';
        return href.includes('tools/whisk') || href.includes('tools/image-fx');
    });
    if (navLinks.length > 0) {
        sendLog('พบ nav link ไป tools — คลิก...', 'info');
        try { navLinks[0].click(); } catch (e) {}
        await sleep(3000);
        if (isWorkPageReady()) {
            sendLog('หลังคลิก nav link: หน้าพร้อม ✅', 'success');
            // ยังอาจต้องกด "เข้าสู่เครื่องมือ" อีกครั้ง
            await clickEnterToolIfNeeded();
            return isWorkPageReady();
        }
    }

    // ─── วิธี 2: ถ้าเจอปุ่ม "เรียกดูแกลเลอรี" (gallery button) ───
    const galleryBtns = Array.from(document.querySelectorAll('button, a')).filter(b => {
        const txt = (b.innerText || '').trim();
        return txt.includes('แกลเลอรี') || txt.toLowerCase().includes('gallery') || txt.toLowerCase().includes('browse');
    });
    if (galleryBtns.length > 0) {
        sendLog('พบปุ่ม gallery — คลิก...', 'info');
        try { galleryBtns[0].click(); } catch (e) {}
        await sleep(3000);
        await clickEnterToolIfNeeded();
        if (isWorkPageReady()) return true;
    }

    // ─── วิธี 3: แจ้ง background ให้ navigate ด้วย chrome.tabs.update ───
    // (ทำโดย background เพราะ content script ไม่มีสิทธิ์ update tab URL)
    sendLog(`ขอให้ Background navigate ไป ${projectUrl}`, 'warn');
    chrome.runtime.sendMessage({ action: 'NAVIGATE_TO_URL', url: projectUrl });

    // รอ DOM เปลี่ยน
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        await sleep(1500);
        if (isWorkPageReady() && !isErrorPage()) {
            await clickEnterToolIfNeeded();
            return isWorkPageReady();
        }
    }

    return false;
};

// ─── คลิกปุ่ม "เข้าสู่เครื่องมือ" ถ้ายังอยู่หน้า landing ───
const clickEnterToolIfNeeded = async () => {
    if (isWorkPageReady()) return; // ไม่จำเป็น
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
        const btn = enterBtns[enterBtns.length - 1];
        try { btn.click(); } catch (e) {}
        await sleep(2500);
    }
};

// ─── คลิกปุ่ม add_photo_alternate เพื่อกลับหน้า project ───
const clickAddPhotoButton = async () => {
    // หา icon google-symbols ที่มีข้อความ add_photo_alternate
    const icon = Array.from(document.querySelectorAll('i.google-symbols, span.google-symbols'))
        .find(el => el.textContent.trim() === 'add_photo_alternate');
    
    if (!icon) return false;
    
    const btn = icon.closest('button');
    if (!btn || btn.offsetParent === null) return false;
    
    sendLog(`พบปุ่ม add_photo_alternate — กำลังคลิก...`, 'info');
    await humanClick(btn);
    
    // รอ URL เปลี่ยนเป็น /project
    const start = Date.now();
    while (Date.now() - start < 8000) {
        await sleep(300);
        if (window.location.pathname.includes('/tools/whisk/project') || 
            window.location.pathname.includes('/tools/image-fx/project')) {
            sendLog(`URL กลับเป็น /project แล้ว ✅`, 'success');
            return true;
        }
    }
    return false;
};

// ─── Ensure พร้อมทำงาน (แทน checkAndRecoverUrl เดิม) ───
// ไม่ throw — คืน true/false และ log สถานะ
const ensureReadyToWork = async (targetApp) => {
    const state = classifyCurrentUrl();
    const errorPage = isErrorPage();
    const workReady = isWorkPageReady(); // ตอนนี้เช็ค URL ด้วยแล้ว

    sendLog(`ensureReadyToWork: state=${state} errorPage=${errorPage} workReady=${workReady}`, 'info');

    // ✅ พร้อมจริงๆ = URL เป็น /project และ DOM พร้อม
    if (state === 'project' && workReady && !errorPage) return true;

    // ── catchAll หรือ URL ผิด หรือ DOM ยังไม่พร้อม ──
    if (state === 'catchall' || errorPage || !workReady) {
        sendLog('ตรวจพบ CatchAll/ไม่พร้อม — ลองคลิกปุ่ม add_photo_alternate...', 'warn');
        
        const clicked = await clickAddPhotoButton();
        if (clicked) {
            await waitForDOMStable(500, 5000);
            // เช็คอีกรอบหลังคลิก
            if (classifyCurrentUrl() === 'project' && isWorkPageReady()) return true;
        }

        // fallback: แจ้ง background navigate
        sendLog('คลิกปุ่มไม่สำเร็จ — ขอให้ Background navigate...', 'warn');
        chrome.runtime.sendMessage({ 
            action: 'NAVIGATE_TO_URL', 
            url: targetApp === 'flow' 
                ? 'https://labs.google/fx/tools/image-fx/project'
                : 'https://labs.google/fx/tools/whisk/project'
        });

        const start = Date.now();
        while (Date.now() - start < 20000) {
            await sleep(1000);
            if (classifyCurrentUrl() === 'project' && isWorkPageReady() && !isErrorPage()) return true;
        }
        throw new Error('[CATCH_ALL] ไม่สามารถกลับหน้า Whisk ได้');
    }

    // landing page
    if (state === 'landing') {
        const clicked = await clickAddPhotoButton();
        if (clicked) { await sleep(2000); if (isWorkPageReady()) return true; }
        await clickEnterToolIfNeeded();
        await sleep(2000);
        if (isWorkPageReady()) return true;
        throw new Error('[NEED_REFRESH] ไม่สามารถเข้าสู่หน้าเครื่องมือได้');
    }

    // unknown
    const clicked = await clickAddPhotoButton();
    if (clicked && classifyCurrentUrl() === 'project' && isWorkPageReady()) return true;
    throw new Error('[NEED_REFRESH] ไม่สามารถเข้าสู่หน้าเครื่องมือได้');
};

// ─── Message Listener ───
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'PING') {
        const state = classifyCurrentUrl();
        const workReady = isWorkPageReady(); // เช็ค URL แล้ว
        const errorPage = isErrorPage();
        
        // ✅ เพิ่ม: เช็คปุ่ม add_photo_alternate
        const hasAddPhotoBtn = Array.from(document.querySelectorAll('i.google-symbols, span.google-symbols'))
            .some(el => el.textContent.trim() === 'add_photo_alternate');
        
        sendResponse({
            ok: true,
            url: window.location.href,
            state,
            workReady,
            errorPage,
            hasAddPhotoBtn,
        // isReady = true เฉพาะเมื่อ URL เป็น /project จริงๆ เท่านั้น
            isReady: state === 'project' && (workReady || hasAddPhotoBtn) && !errorPage
        });
        return true;
    }

    // ── ใหม่: Background ขอให้คลิกปุ่ม add_photo_alternate ──
    if (message.action === 'CLICK_ADD_PHOTO_BTN') {
        clickAddPhotoButton()
            .then(clicked => sendResponse({ clicked }))
            .catch(() => sendResponse({ clicked: false }));
        return true; // async
    }

    if (message.action === 'GENERATE') {
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
        return true;
    }
});

// ─── Error Classification ───
const classifyError = (errMsg) => {
    if (!errMsg) return { message: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ', needRefresh: true };
    if (errMsg.includes('[CATCH_ALL]')) return { message: '⚠️ หน้า Whisk หลุด — กำลัง navigate กลับ', needRefresh: false };
    if (errMsg.includes('ไม่พบช่อง') || errMsg.includes('Upload zone') || errMsg.includes('ไม่พบ'))
        return { message: '❌ หน้าเครื่องมือยังโหลดไม่สมบูรณ์ — กรุณากด F5', needRefresh: true };
    if (errMsg.includes('Generate') || errMsg.includes('ปุ่ม'))
        return { message: '❌ ไม่พบปุ่ม Generate — กรุณากด F5', needRefresh: true };
    if (errMsg.includes('[OFF_SITE]'))
        return { message: '⚠️ กรุณาเปิด Google Whisk หรือ ImageFX ก่อน', needRefresh: false };
    if (errMsg.includes('DAILY_LIMIT') || errMsg.includes('ขีดจำกัด'))
        return { message: '🚫 ถึงขีดจำกัดรายวันแล้ว', needRefresh: false };
    if (errMsg.includes('Timeout') || errMsg.includes('หมดเวลา'))
        return { message: '⏱️ หมดเวลารอผลลัพธ์ — ลอง F5', needRefresh: true };
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

// ─── Navigate to Whisk main tool page ───
const ensureOnWhiskMainPage = async () => {
    // ใช้ ensureReadyToWork แทน (ทำงานครอบคลุมกว่า)
    // ฟังก์ชันนี้เก็บไว้เพื่อ backward compat
    if (isWorkPageReady()) return;

    // คลิก mode icon
    const modeIcons = Array.from(document.querySelectorAll('i, span')).filter(el => el.textContent.trim() === 'add_photo_alternate');
    if (modeIcons.length > 0) {
        const modeBtn = modeIcons[0].closest('button');
        if (modeBtn && modeBtn.offsetParent !== null) {
            await humanClick(modeBtn);
            await humanSleep(400, 800);
        }
    }
};

// ─── เปิด panel upload รูปภาพ (คลิก เพิ่มรูปภาพ) ───
const openImageUploadPanel = async () => {
    // เช็คว่าเปิดอยู่แล้วไหม (input[type=file] มีแล้ว)
    if (document.querySelectorAll('input[type="file"]').length > 0) {
        sendLog('Upload panel เปิดอยู่แล้ว ✅', 'info');
        return;
    }

    // หาปุ่ม "เพิ่มรูปภาพ" — text มี "เพิ่มรูปภ" และมี keyboard_arrow_right
    const addImgBtn = Array.from(document.querySelectorAll('button'))
        .find(b => b.offsetParent !== null && b.innerText?.includes('เพิ่มรูปภ'));

    if (addImgBtn) {
        sendLog('คลิก "เพิ่มรูปภาพ"...', 'info');
        await humanClick(addImgBtn);
        // รอจนกว่า input[type=file] จะโผล่
        const start = Date.now();
        while (Date.now() - start < 5000) {
            await sleep(300);
            if (document.querySelectorAll('input[type="file"]').length > 0) {
                sendLog(`Upload panel เปิดแล้ว ✅ (${document.querySelectorAll('input[type="file"]').length} inputs)`, 'success');
                return;
            }
        }
        sendLog('รอ upload panel timeout', 'warn');
    } else {
        sendLog('ไม่พบปุ่ม "เพิ่มรูปภาพ" — อาจเปิดอยู่แล้ว', 'warn');
    }
};

// ─── Prompt & Generate Selectors ───
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
    if (!arBtn) return;
    if (arBtn.disabled || arBtn.offsetParent === null) return;
    await humanClick(arBtn);
    await humanSleep(800, 1200);
    const ratioBtn = Array.from(document.querySelectorAll('button'))
        .filter(b => b.offsetParent !== null)
        .find(b => { const t = (b.textContent || '').replace(/\s/g, ''); return t === ratio || t.includes(ratio); });
    if (ratioBtn) { await humanClick(ratioBtn); await humanSleep(300, 600); }
    else { await humanClick(arBtn); }
};

// ─── Main Generation Flow ───
const processGeneration = async (data) => {
    const { prompt, promptId, settings, subjectImage, sceneImage, styleImage } = data;
    sendLog(`เริ่ม processGeneration สำหรับ ${promptId}`, 'step');

    const toolType = getToolType();
    if (!toolType) throw new Error('[OFF_SITE]');

    sendProgress(promptId, 0, 'starting');

    // ══ STEP 1: ตรวจสอบและกู้คืนหน้า ══
    sendLog('STEP 1: ตรวจสอบสถานะหน้า...', 'step');
    await ensureReadyToWork(toolType); // จะ throw ถ้าแก้ไม่ได้
    await waitForDOMStable(500, 5000);

    if (toolType === 'whisk') await ensureOnWhiskMainPage();

    // ══ STEP 2: Upload Images ══
    const hasImages = subjectImage || sceneImage || styleImage;
    if (hasImages) {
        sendProgress(promptId, 10, 'uploading_images');
        sendLog('STEP 2: Upload รูปภาพ...', 'step');

        // ── 2.1: กดปุ่ม "เพิ่มรูปภาพ" ให้ panel เปิดและ input[type=file] โผล่ ──
        await openImageUploadPanel();
        await sleep(800);

        // ── 2.2: ตรวจว่า input[type=file] มีแล้ว ──
        const fileInputs = document.querySelectorAll('input[type="file"]');
        sendLog(`พบ input[type=file]: ${fileInputs.length} ตัว`, 'info');
        if (fileInputs.length === 0) {
            throw new Error('[UPLOAD_FAILED] ไม่พบ file input หลังเปิด panel');
        }

        // ── 2.3: inject ไฟล์เข้า input โดยตรง (index 0=subject, 1=scene, 2=style) ──
        const injectToInput = async (imageData, idx, zoneName) => {
            if (!imageData) return;
            const inputs = document.querySelectorAll('input[type="file"]');
            const input = inputs[idx];
            if (!input) { sendLog(`ไม่พบ input[${idx}] สำหรับ ${zoneName}`, 'error'); return; }

            const mimeMatch = imageData.match(/data:([^;]+);/);
            const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const base64 = imageData.split(',')[1];
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
            sendLog(`Inject ${zoneName} (input[${idx}]) ✅`, 'success');
            await sleep(1500); // รอ React re-render
        };

        await injectToInput(subjectImage, 0, 'subject');
        await injectToInput(sceneImage, 1, 'scene');
        await injectToInput(styleImage, 2, 'style');
        await waitForDOMStable(300, 3000);
    }

    // ══ STEP 3: Aspect Ratio ══
    if (settings && settings.aspectRatio) {
        sendProgress(promptId, 28, 'setting_ratio');
        await setAspectRatio(settings.aspectRatio);
    }

    // ══ STEP 4: Type Prompt ══
    if (prompt && prompt.trim()) {
        sendProgress(promptId, 35, 'typing_prompt');
        sendLog('STEP 4: พิมพ์ Prompt...', 'step');
        const promptInput = await waitForAny(PROMPT_SELECTORS, 10000);
        if (promptInput) {
            await humanClick(promptInput);
            await humanSleep(300, 600);
            if (promptInput.tagName === 'TEXTAREA' || promptInput.tagName === 'INPUT') {
                promptInput.focus();
                const proto = promptInput.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                const nativeSet = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                if (nativeSet) nativeSet.call(promptInput, prompt);
                else promptInput.value = prompt;
                promptInput.dispatchEvent(new Event('input', { bubbles: true }));
                promptInput.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                promptInput.focus();
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
                document.execCommand('insertText', false, prompt);
            }
            await humanSleep(300, 600);
        }
    }

    // ══ STEP 5: Generate ══
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

    if (settings && settings.autoDownload && generated.length > 0) {
        const toDownload = generated.slice(0, 4);
        for (let i = 0; i < toDownload.length; i++) {
            const item = toDownload[i];
            const filename = sanitizeFilename(prompt || 'whisk') + '_' + Date.now() + '_' + (i + 1) + '.png';
            chrome.runtime.sendMessage({ action: 'DOWNLOAD_RESULT', url: item.url, filename, folder: (settings && settings.saveFolder) || 'ArinWhiskBot' });
            await sleep(600);
        }
    }

    sendProgress(promptId, 100, 'completed');
    sendLog(`เสร็จสิ้น ${promptId} ✅`, 'success');
    return true;
};

// ─── รอ Generate เสร็จ ───
const waitForGenerationComplete = async (promptId, urlBeforeGenerate, timeout = 180000) => {
    const getVisibleImages = () => Array.from(document.querySelectorAll('img')).filter(img => img.src && img.src.length > 20).map(img => img.src);
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
                if (!img.src || img.src.length < 30) return false;
                if (snapUrls.has(img.src)) return false;
                const src = img.src;
                if (src.includes('lh3.googleusercontent.com') || src.includes('generativelanguage') || src.includes('storage.googleapis.com')) {
                    const rect = img.getBoundingClientRect();
                    return rect.width > 200 && rect.height > 200;
                }
                if (src.startsWith('blob:')) return true;
                return false;
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