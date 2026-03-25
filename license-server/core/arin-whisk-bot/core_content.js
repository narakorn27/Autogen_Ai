// --- Content Script: Arin Whisk Bot ---
// DOM automation สำหรับ Google Whisk (Subject/Scene/Style + Prompt + Generate)
// จะเริ่มทำงานเมื่อได้รับสัญญาณ LICENSE_OK จาก background เท่านั้น

console.log('[Arin Whisk] Content script loaded ✅');

// ─── License Switch ───
let isLicensed = false;

// ─── Inject Injected.js เข้าหน้า Whisk ───
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
const sanitizeFilename = (str, maxLen = 60) =>
    (str || '').replace(/[<>:"/\\|?*\n\r]/g, '_').trim().slice(0, maxLen) || 'output';

// ─── Message Listener ───
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'LICENSE_OK') {
        isLicensed = true;
        console.log('[Arin Whisk] License verified, bot activated ✅');
        sendResponse({ success: true });
        return;
    }

    if (message.action === 'GENERATE') {
        if (!isLicensed) {
            sendResponse({ success: false, error: 'License ยังไม่ได้ verify — กรุณาเปิด Side Panel แล้วกรอก License Key', needRefresh: false });
            return true;
        }
        processGeneration(message)
            .then(() => sendResponse({ success: true }))
            .catch((err) => {
                console.error('Arin Whisk Error:', err.message);
                const errorInfo = classifyError(err.message);
                sendResponse({ 
                    success: false, 
                    error: errorInfo.message, 
                    needRefresh: errorInfo.needRefresh 
                });
            });
        return true;
    }
});

// ─── ตรวจ license จาก storage ───
chrome.storage.local.get('licenseVerified', (data) => {
    if (data.licenseVerified) {
        isLicensed = true;
        console.log('[Arin Whisk] License restored from storage, bot activated ✅');
    }
});

// ─── Error Classification ───
const classifyError = (errMsg) => {
    if (!errMsg) return { message: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ', needRefresh: true };

    if (errMsg.includes('ไม่พบช่อง') || errMsg.includes('Upload zone') || errMsg.includes('ไม่พบ')) {
        return { 
            message: '❌ Whisk ยังโหลดไม่สมบูรณ์ — กรุณากด F5 รีเฟรชหน้าเว็บ', 
            needRefresh: true 
        };
    }

    if (errMsg.includes('Generate') || errMsg.includes('ปุ่ม')) {
        return { 
            message: '❌ ไม่พบปุ่ม Generate — กรุณากด F5 รีเฟรชหน้าเว็บ', 
            needRefresh: true 
        };
    }

    if (errMsg.includes('[OFF_SITE]') || errMsg.includes('labs.google')) {
        return { 
            message: '⚠️ กรุณาสลับไปที่หน้า Google Whisk แล้วลองใหม่', 
            needRefresh: false 
        };
    }

    if (errMsg.includes('DAILY_LIMIT') || errMsg.includes('ขีดจำกัด')) {
        return { 
            message: '🚫 ถึงขีดจำกัดรายวันแล้ว — กรุณารอวันใหม่', 
            needRefresh: false 
        };
    }

    if (errMsg.includes('Timeout') || errMsg.includes('หมดเวลา')) {
        return { 
            message: '⏱️ หมดเวลารอผลลัพธ์ — ลองกด F5 แล้วรันใหม่', 
            needRefresh: true 
        };
    }

    if (errMsg.includes('License') || errMsg.includes('verify')) {
        return { 
            message: '🔑 License ยังไม่ได้เปิดใช้งาน — กรุณาเปิด Side Panel แล้วกรอก License Key', 
            needRefresh: false 
        };
    }

    return { 
        message: `❌ ${errMsg}\n💡 ลองกด F5 รีเฟรชหน้า Whisk แล้วรันใหม่`, 
        needRefresh: true 
    };
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

const findButtonByText = (textList, exact = false) => {
    const els = Array.from(document.querySelectorAll(
        'div[role="button"], button, [role="menuitem"], [role="option"], a'
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

// ─── Upload Image to Whisk Zone (Subject/Scene/Style) ───
const uploadImageToZone = async (imageDataUrl, targetZone) => {
    if (!imageDataUrl) return;
    console.log(`[Arin Whisk] Uploading image to ${targetZone} zone...`);

    const mimeMatch = imageDataUrl.match(/data:([^;]+);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64 = imageDataUrl.split(',')[1];

    const result = await new Promise((resolve) => {
        const handler = (e) => {
            if (e.data?.type === 'ARIN_UPLOAD_RESULT' && e.data.target === targetZone) {
                window.removeEventListener('message', handler);
                resolve(e.data);
            }
        };
        window.addEventListener('message', handler);

        window.postMessage({
            type: 'ARIN_UPLOAD_REQUEST',
            target: targetZone,
            images: [{ base64, mime }]
        }, '*');

        setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve({ success: false, error: 'timeout' });
        }, 10000);
    });

    if (result.success) {
        console.log(`[Arin Whisk] ${targetZone} upload OK ✅`);
        await humanSleep(1500, 2500);
    } else {
        console.warn(`[Arin Whisk] ${targetZone} upload via Injected.js failed:`, result.error);
        // Fallback: ลอง drag & drop โดยตรง
        await uploadViaDragDrop(imageDataUrl, targetZone);
    }
};

// ─── Fallback: Upload via Drag & Drop ───
const uploadViaDragDrop = async (imageDataUrl, targetZone) => {
    console.log(`[Arin Whisk] Trying drag & drop fallback for ${targetZone}...`);
    
    // หา upload zone container
    const zoneEl = findUploadZoneElement(targetZone);
    if (!zoneEl) {
        console.warn(`[Arin Whisk] Could not find ${targetZone} drop zone`);
        return;
    }

    try {
        const mimeMatch = imageDataUrl.match(/data:([^;]+);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const base64 = imageDataUrl.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        const file = new File([blob], `${targetZone}_${Date.now()}.jpg`, { type: mime });

        const dt = new DataTransfer();
        dt.items.add(file);

        const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt
        });

        zoneEl.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
        await sleep(100);
        zoneEl.dispatchEvent(new DragEvent('dragover', { bubbles: true }));
        await sleep(100);
        zoneEl.dispatchEvent(dropEvent);
        
        console.log(`[Arin Whisk] Drag & drop completed for ${targetZone}`);
        await humanSleep(1000, 2000);
    } catch (e) {
        console.error(`[Arin Whisk] Drag & drop failed for ${targetZone}:`, e.message);
    }
};

// ─── Find Upload Zone Element ───
const findUploadZoneElement = (targetZone) => {
    const labels = {
        'subject': ['Subject', 'subject', 'หัวข้อ', 'ตัวแบบ', 'เรื่อง'],
        'scene': ['Scene', 'scene', 'ฉาก', 'สถานที่'],
        'style': ['Style', 'style', 'สไตล์', 'รูปแบบ']
    };
    
    // First try exact class paths if they exist
    const exactMatch = {
        'subject': document.querySelector('div.sc-10ad0ca3-1:nth-of-type(1)'),
        'scene': document.querySelector('div.sc-10ad0ca3-1:nth-of-type(2)'),
        'style': document.querySelector('div.sc-10ad0ca3-1:nth-of-type(3)')
    };
    if (exactMatch[targetZone] && exactMatch[targetZone].offsetParent !== null) {
        return exactMatch[targetZone];
    }

    const targetLabels = labels[targetZone] || labels['subject'];
    
    // หา heading/label ที่ตรงกัน แล้วขึ้นไปหา parent container
    const allEls = document.querySelectorAll('h2, h3, h4, span, label, p, div');
    for (const el of allEls) {
        const text = (el.innerText || '').trim();
        if (targetLabels.some(l => text.toLowerCase().includes(l.toLowerCase()))) {
            // หา parent ที่เป็น upload area
            let parent = el.parentElement;
            for (let i = 0; i < 8 && parent; i++) {
                const dropArea = parent.querySelector(
                    '[class*="upload"], [class*="drop"], [class*="dropzone"], ' +
                    '[role="button"], [class*="card"], [class*="slot"]'
                );
                if (dropArea && dropArea.offsetParent !== null) return dropArea;
                // หรือ parent เองเป็น drop area
                if (parent.getAttribute('role') === 'button' || 
                    parent.className?.includes?.('upload') || 
                    parent.className?.includes?.('drop') ||
                    parent.className?.includes?.('slot')) {
                    return parent;
                }
                parent = parent.parentElement;
            }
        }
    }
    
    return null;
};

// ─── Prompt Selectors ───
const PROMPT_SELECTORS = [
    'textarea.sc-18deeb1d-8',
    'textarea[placeholder*="อธิบายแนวคิด"]',
    'textarea[placeholder*="Describe"]',
    'textarea',
    'input[type="text"][placeholder]',
    'div[contenteditable="true"]',
    '[data-testid*="prompt"]',
    '[aria-label*="prompt"]',
    '[aria-label*="Prompt"]',
    '[class*="prompt"] textarea',
    '[class*="prompt"] input',
];

// ─── Generate Button Selectors ───
const GENERATE_SELECTORS = [
    'button[aria-label*="Whisk"]',
    'button[aria-label*="whisk"]',
    'button[aria-label*="Generate"]',
    'button[aria-label*="generate"]',
    'button[aria-label*="สร้าง"]',
    'button[aria-label*="ส่งพรอมต์"]',
    'button[aria-label*="Submit prompt"]'
];

const findGenerateButton = () => {
    // 1. Try ARIA labels first (Safest)
    for (const sel of GENERATE_SELECTORS) {
        try {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
                if (el && !el.disabled && el.offsetParent !== null) return el;
            }
        } catch (e) {}
    }

    // 2. Try positional heuristic 
    const promptEl = document.querySelector(PROMPT_SELECTORS.join(','));
    if (promptEl) {
        let parent = promptEl.parentElement;
        for (let i = 0; i < 6 && parent; i++) {
            const buttons = Array.from(parent.querySelectorAll('button')).filter(
                b => !b.disabled && b.offsetParent !== null && !b.textContent.includes('×')
            );
            
            // หาปุ่มที่มีลูกศรขวา (SVG pathway) หรือเป็นปุ่มสุดท้าย
            const svgBtn = buttons.reverse().find(b => {
                const svg = b.querySelector('svg');
                return svg && (
                    b.className?.includes('primary') || 
                    b.className?.includes('generate') ||
                    b.style.backgroundColor !== ''
                );
            });
            
            if (svgBtn) return svgBtn;
            if (buttons.length > 0) return buttons[0]; // reverse แล้ว ตัวแรกคือปุ่มท้ายสุด
            parent = parent.parentElement;
        }
    }

    return null;
};

// ─── Set Aspect Ratio ───
const setAspectRatio = async (ratio) => {
    if (!ratio || ratio === 'default') return;
    
    // 1. Try finding aspect_ratio icon
    let arBtn = null;
    const icons = Array.from(document.querySelectorAll('i, span')).filter(el => el.textContent.trim() === 'aspect_ratio');
    if (icons.length > 0) {
        arBtn = icons[0].closest('button');
    }

    // 2. Try positional (usually the 3rd last button in the prompt container)
    if (!arBtn) {
        const promptEl = document.querySelector(PROMPT_SELECTORS.join(','));
        if (promptEl) {
            let parent = promptEl.parentElement;
            for (let i = 0; i < 6 && parent; i++) {
                const buttons = Array.from(parent.querySelectorAll('button')).filter(b => !b.disabled && b.offsetParent !== null && !b.textContent.includes('×'));
                if (buttons.length >= 3) {
                    arBtn = buttons[buttons.length - 3];
                    break;
                }
                parent = parent.parentElement;
            }
        }
    }

    if (arBtn && !arBtn.disabled && arBtn.offsetParent !== null) {
        console.log('[Arin Whisk] Opening Aspect Ratio menu...');
        await humanClick(arBtn);
        await humanSleep(500, 800);

        // หาปุ่ม ratio (เช่น 1:1, 9:16, 16:9) ที่เพิ่ง popup ขึ้นมา
        const options = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null);
        const ratioBtn = options.find(b => (b.textContent || '').replace(/\s/g, '') === ratio);
        
        if (ratioBtn) {
            console.log(`[Arin Whisk] Selecting Aspect Ratio: ${ratio}`);
            await humanClick(ratioBtn);
            await humanSleep(500, 800);
        } else {
            console.warn(`[Arin Whisk] Could not find Aspect Ratio option matching: ${ratio}`);
            // ปิด menu ถ่ายคลิกที่เดิม
            await humanClick(arBtn);
        }
    } else {
        console.log('[Arin Whisk] Aspect Ratio button not found, skipping');
    }
};

// ─── Main Flow ───
const processGeneration = async (data) => {
    const { prompt, promptId, settings, subjectImage, sceneImage, styleImage } = data;

    if (!window.location.href.includes('labs.google')) {
        throw new Error('[OFF_SITE] กรุณาสลับไปที่หน้า Google Whisk');
    }

    sendProgress(promptId, 0, 'running');

    // ── รอ DOM นิ่ง ──
    console.log('[Arin Whisk] Waiting for DOM stable...');
    await waitForDOMStable(600, 8000);
    await humanSleep(500, 800);

    // ── STEP 0.5: Handle Landing Page ──
    try {
        const enterBtns = Array.from(document.querySelectorAll('a, button, div[role="button"]')).filter(b => b.textContent.includes('เข้าสู่เครื่องมือ') || b.textContent.toLowerCase().includes('enter tool'));
        if (enterBtns.length > 0) {
            const enterBtn = enterBtns[enterBtns.length - 1];
            if (enterBtn.offsetParent !== null) {
                console.log('[Arin Whisk] Found Landing Page, clicking Enter tool...');
                await humanClick(enterBtn);
                await humanSleep(1500, 2500);
                await waitForDOMStable(600, 5000); // wait for main tool to load
            }
        }
    } catch (e) {
        console.warn('[Arin Whisk] Error checking landing page:', e);
    }

    // ── STEP 0.8: Ensure Sidebar is Open ──
    try {
        const toggleBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('เพิ่มรูปภาพ') || b.textContent.includes('Add Image'));
        if (toggleBtns.length > 0) {
            const addImgBtn = toggleBtns[toggleBtns.length - 1];
            if (addImgBtn.offsetParent !== null) {
                console.log('[Arin Whisk] Opening image sidebar...');
                await humanClick(addImgBtn);
                await humanSleep(1000, 1500);
            }
        }
    } catch (e) {
        console.warn('[Arin Whisk] Error expanding sidebar:', e);
    }

    // ── STEP 1: Upload Subject Image ──
    if (subjectImage) {
        sendProgress(promptId, 5, 'running');
        console.log('[Arin Whisk] Uploading Subject image...');
        await uploadImageToZone(subjectImage, 'subject');
        await waitForDOMStable(400, 4000);
        await humanSleep(500, 800);
    }

    // ── STEP 2: Upload Scene Image ──
    if (sceneImage) {
        sendProgress(promptId, 15, 'running');
        console.log('[Arin Whisk] Uploading Scene image...');
        await uploadImageToZone(sceneImage, 'scene');
        await waitForDOMStable(400, 4000);
        await humanSleep(500, 800);
    }

    // ── STEP 3: Upload Style Image ──
    if (styleImage) {
        sendProgress(promptId, 25, 'running');
        console.log('[Arin Whisk] Uploading Style image...');
        await uploadImageToZone(styleImage, 'style');
        await waitForDOMStable(400, 4000);
        await humanSleep(500, 800);
    }

    // ── STEP 4: Type Prompt (optional) ──
    if (prompt && prompt.trim()) {
        sendProgress(promptId, 35, 'typing');
        console.log('[Arin Whisk] Looking for prompt input...');
        
        const promptInput = await waitForAny(PROMPT_SELECTORS, 10000);
        if (promptInput) {
            await humanClick(promptInput);
            await humanSleep(300, 500);

            // เคลียร์ข้อความเดิม
            if (promptInput.tagName === 'TEXTAREA' || promptInput.tagName === 'INPUT') {
                promptInput.focus();
                promptInput.value = '';
                promptInput.dispatchEvent(new Event('input', { bubbles: true }));
                await sleep(100);
                
                // Native setter for React
                const proto = promptInput.tagName === 'TEXTAREA' 
                    ? window.HTMLTextAreaElement.prototype 
                    : window.HTMLInputElement.prototype;
                const nativeSet = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                if (nativeSet) {
                    nativeSet.call(promptInput, prompt);
                } else {
                    promptInput.value = prompt;
                }
                promptInput.dispatchEvent(new Event('input', { bubbles: true }));
                promptInput.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                // contentEditable
                promptInput.focus();
                await humanSleep(200, 400);
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
                await sleep(100);
                document.execCommand('insertText', false, prompt);
            }
            
            await humanSleep(500, 800);
            console.log('[Arin Whisk] Prompt inserted ✅');
        } else {
            console.warn('[Arin Whisk] Prompt input not found, continuing without text...');
        }
    }

    // ── STEP 4.5: Set Aspect Ratio ──
    if (settings && settings.aspectRatio) {
        await setAspectRatio(settings.aspectRatio);
    }

    // ── STEP 5: Click Generate/Whisk It ──
    sendProgress(promptId, 45, 'submitting');
    await humanSleep(500, 900);
    
    const generateBtn = findGenerateButton();
    if (generateBtn) {
        console.log('[Arin Whisk] Found Generate button, clicking...');
        await humanClick(generateBtn);
    } else {
        throw new Error('ไม่พบปุ่ม Generate — ลอง F5 แล้วลองใหม่');
    }

    sendProgress(promptId, 50, 'running');

    // ── STEP 6: รอ generate เสร็จ ──
    const generated = await waitForGenerationComplete(promptId);

    // ── STEP 7: Auto Download ──
    if (settings && settings.autoDownload && generated.length > 0) {
        const toDownload = generated.slice(0, 4); // Limit to max 4 images to prevent spam
        for (let i = 0; i < toDownload.length; i++) {
            const item = toDownload[i];
            const filename = sanitizeFilename(prompt || 'whisk') + '_' + Date.now() + '_' + (i + 1) + '.png';
            chrome.runtime.sendMessage({
                action: 'DOWNLOAD_RESULT',
                url: item.url,
                filename,
                folder: (settings && settings.saveFolder) || 'ArinWhiskBot'
            });
            await sleep(500);
        }
    }

    sendProgress(promptId, 100, 'completed');
    return true;
};

// ─── รอ Generate เสร็จ ───
const waitForGenerationComplete = async (promptId, timeout) => {
    timeout = timeout || 180000; // 3 นาที (Whisk เร็วกว่า Video)

    // snapshot รูปที่มีอยู่ก่อน generate
    const snapImages = new Set(
        Array.from(document.querySelectorAll('img[src*="lh3"], img[src*="googleusercontent"], img[src*="generated"]'))
            .map(el => el.src)
    );

    console.log(`[Arin Whisk] Snapshot: ${snapImages.size} existing images`);

    const collectedUrls = new Set();
    const start = Date.now();

    // รับ URL จาก Injected.js ผ่าน postMessage
    const urlHandler = (event) => {
        if (event.data && event.data.type === 'ARIN_MEDIA_URL' && event.data.url) {
            if (!snapImages.has(event.data.url)) {
                collectedUrls.add(JSON.stringify({
                    url: event.data.url,
                    mediaType: event.data.mediaType
                }));
                console.log('[Arin Whisk] New media from postMessage:', event.data.url.slice(0, 80));
            }
        }
    };
    window.addEventListener('message', urlHandler);

    let lastPercent = 50;
    const progressInterval = setInterval(() => {
        const elapsed = Date.now() - start;
        const pct = Math.min(90, Math.floor((elapsed / 90000) * 40) + 50);
        if (pct > lastPercent) {
            lastPercent = pct;
            sendProgress(promptId, pct, 'running');
        }
    }, 3000);

    try {
        while (Date.now() - start < timeout) {
            await sleep(2000);

            // วิธีที่ 1: จาก postMessage
            if (collectedUrls.size > 0) {
                console.log('[Arin Whisk] Got URL from postMessage');
                break;
            }

            // วิธีที่ 2: DOM scan — หารูปใหม่
            const currentImages = document.querySelectorAll(
                'img[src*="lh3"], img[src*="googleusercontent"], img[src*="generated"], img[src*="blob:"]'
            );
            for (const img of currentImages) {
                if (img.src && !snapImages.has(img.src) && img.src.length > 50) {
                    const rect = img.getBoundingClientRect();
                    // ตรวจว่าเป็นรูปใหญ่ในหน้าจอแสดงผลหลัก (ไม่ใช่ History Thumbnail ที่มักจะเล็กและอยู่ด้านข้าง)
                    if (rect.width > 200 && rect.height > 200 && rect.top >= 0) {
                        collectedUrls.add(JSON.stringify({ url: img.src, mediaType: 'image' }));
                    }
                }
            }

            if (collectedUrls.size > 0) {
                console.log('[Arin Whisk] Got URL from DOM scan');
                break;
            }

            // Timeout ย่อย
            if (Date.now() - start > 120000 && collectedUrls.size === 0) {
                console.warn('[Arin Whisk] 2 min timeout with no results');
                break;
            }
        }
    } finally {
        clearInterval(progressInterval);
        window.removeEventListener('message', urlHandler);
    }

    if (collectedUrls.size > 0) {
        console.log('[Arin Whisk] Waiting 2s for image to fully load...');
        await sleep(2000);
    }

    console.log('[Arin Whisk] Final collected URLs:', collectedUrls.size);
    return Array.from(collectedUrls).map(s => JSON.parse(s));
};
