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

// ─── URL Helper: เช็คว่าอยู่บน Whisk domain (ทุก path) ───
const isOnWhisk = () => window.location.hostname === 'labs.google' && window.location.pathname.includes('tools/whisk');

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
        return { message: '❌ Whisk ยังโหลดไม่สมบูรณ์ — กรุณากด F5 รีเฟรชหน้าเว็บ', needRefresh: true };
    }
    if (errMsg.includes('Generate') || errMsg.includes('ปุ่ม')) {
        return { message: '❌ ไม่พบปุ่ม Generate — กรุณากด F5 รีเฟรชหน้าเว็บ', needRefresh: true };
    }
    if (errMsg.includes('[OFF_SITE]') || errMsg.includes('labs.google')) {
        return { message: '⚠️ กรุณาสลับไปที่หน้า Google Whisk แล้วลองใหม่', needRefresh: false };
    }
    if (errMsg.includes('DAILY_LIMIT') || errMsg.includes('ขีดจำกัด')) {
        return { message: '🚫 ถึงขีดจำกัดรายวันแล้ว — กรุณารอวันใหม่', needRefresh: false };
    }
    if (errMsg.includes('Timeout') || errMsg.includes('หมดเวลา')) {
        return { message: '⏱️ หมดเวลารอผลลัพธ์ — ลองกด F5 แล้วรันใหม่', needRefresh: true };
    }
    if (errMsg.includes('License') || errMsg.includes('verify')) {
        return { message: '🔑 License ยังไม่ได้เปิดใช้งาน — กรุณาเปิด Side Panel แล้วกรอก License Key', needRefresh: false };
    }

    return { message: `❌ ${errMsg}\n💡 ลองกด F5 รีเฟรชหน้า Whisk แล้วรันใหม่`, needRefresh: true };
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

// ─── Navigate to Whisk main tool page ───
// FIX: ห้ามใช้ window.location.href เด็ดขาด เพราะมันจะฆ่า Content Script (Script หยุดทำงานทันทีเมื่อเปลี่ยนหน้า)
// เราจะใช้การคลิกปุ่ม UI เพื่อให้เว็บโหลดแบบ SPA (ไม่ทำลาย Script)
const ensureOnWhiskMainPage = async () => {
    // ถ้าเราอยู่ในหน้า /project หรืออื่นๆ และหาปุ่ม "เข้าสู่เครื่องมือ" เจอ ให้กด
    const enterBtns = Array.from(document.querySelectorAll('a, button, div[role="button"]')).filter(
        b => b.textContent.includes('เข้าสู่เครื่องมือ') || b.textContent.toLowerCase().includes('enter tool')
    );
    if (enterBtns.length > 0) {
        const enterBtn = enterBtns[enterBtns.length - 1];
        if (enterBtn.offsetParent !== null) {
            console.log('[Arin Whisk] Found Landing Page, clicking Enter tool...');
            await humanClick(enterBtn);
            await humanSleep(2000, 3000);
            await waitForDOMStable(800, 8000);
        }
    }
    
    // โหมดสร้างภาพ (Create Image) - คลิกปุ่ม add_photo_alternate ด้านบน
    const modeIcons = Array.from(document.querySelectorAll('i, span')).filter(el => el.textContent.trim() === 'add_photo_alternate');
    if (modeIcons.length > 0) {
        const modeBtn = modeIcons[0].closest('button');
        if (modeBtn && modeBtn.offsetParent !== null) {
            console.log('[Arin Whisk] Explicitly selecting "Create Image" mode...');
            await humanClick(modeBtn);
            await humanSleep(800, 1500);
        }
    }
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
        await uploadViaDragDrop(imageDataUrl, targetZone);
    }
};

// ─── Fallback: Upload via Drag & Drop ───
const uploadViaDragDrop = async (imageDataUrl, targetZone) => {
    console.log(`[Arin Whisk] Trying drag & drop fallback for ${targetZone}...`);

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

        zoneEl.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
        await sleep(100);
        zoneEl.dispatchEvent(new DragEvent('dragover', { bubbles: true }));
        await sleep(100);
        zoneEl.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));

        console.log(`[Arin Whisk] Drag & drop completed for ${targetZone}`);
        await humanSleep(1000, 2000);
    } catch (e) {
        console.error(`[Arin Whisk] Drag & drop failed for ${targetZone}:`, e.message);
    }
};

// ─── Find Upload Zone Element (Container-Based Version) ───
const findUploadZoneElement = (targetZone) => {
    // 1. กำหนด Label สำหรับแต่ละหมวดหมู่
    const categories = {
        'subject': ['เรื่อง', 'ตัวแบบ', 'Subject', 'subject'],
        'scene': ['ฉาก', 'สถานที่', 'Scene', 'scene'],
        'style': ['รูปแบบ', 'สไตล์', 'Style', 'style']
    };
    const targetLabels = categories[targetZone] || categories['subject'];

    console.log(`[Arin Whisk] Target zone: ${targetZone}. Searching labels:`, targetLabels);

    // 2. หา Container ของหมวดหมู่ (Category Container)
    // ปกติจะมีคลาส sc-10ad0ca3-1 หรือมีหัวข้อกำกับ
    const allCategoryContainers = Array.from(document.querySelectorAll('div[class*="sc-10ad0ca3-1"], div.sc-60a66d0c-0'));
    
    let targetContainer = null;
    for (const container of allCategoryContainers) {
        const text = container.innerText || '';
        if (targetLabels.some(l => text.includes(l))) {
            targetContainer = container;
            console.log(`[Arin Whisk] Found category container for ${targetZone} ✅`);
            break;
        }
    }

    // ถ้าไม่เจอด้วย class ตรงๆ ให้ลองไล่จาก label
    if (!targetContainer) {
        for (const label of targetLabels) {
            const labelEl = Array.from(document.querySelectorAll('span, h2, h3, h4, b, p'))
                .find(el => el.textContent.trim() === label);
            if (labelEl) {
                targetContainer = labelEl.closest('div[class*="sc-10ad0ca3-1"]') || labelEl.parentElement.parentElement;
                console.log(`[Arin Whisk] Found category container via label search for ${targetZone} ✅`);
                break;
            }
        }
    }

    if (!targetContainer) {
        console.warn(`[Arin Whisk] Could not find category container for ${targetZone}`);
        return null;
    }

    // 3. หา Slot ภายในหมวดหมู่นั้นๆ
    // Slot ปกติจะมีคลาส sc-52570d98-8 หรือมีลักษณะเป็นปุ่ม role="button"
    const slots = Array.from(targetContainer.querySelectorAll('div[class*="sc-52570d98-8"], [role="button"]'))
        .filter(el => el.offsetParent !== null);

    if (slots.length > 0) {
        // เลือก Slot แรกของหมวดหมู่นั้น (หรือตัวที่ว่าง)
        const emptySlot = slots.find(s => s.textContent.includes('add') || !s.querySelector('img')) || slots[0];
        console.log(`[Arin Whisk] Found slot within ${targetZone} category ✅`);
        return emptySlot;
    }

    console.warn(`[Arin Whisk] Category found but no slots found for ${targetZone}`);
    return null;
};

// ─── Check if Zone has an Image (regardless of selection) ───
const isZoneHasImage = (targetZone) => {
    const zoneEl = findUploadZoneElement(targetZone);
    if (!zoneEl) {
        console.log(`[Arin Whisk] Zone element for ${targetZone} not found, assuming NO image`);
        return false;
    }
    // ดูทั้ง zone element เอง + parent container
    const container = zoneEl.closest('div[class*="sc-52570d98-8"]') || zoneEl.parentElement || zoneEl;
    const imgEl = container.querySelector('img');
    const hasImg = imgEl !== null && imgEl.offsetParent !== null;
    console.log(`[Arin Whisk] Zone ${targetZone} hasImage=${hasImg}`);
    return hasImg;
};

// ─── Check if Zone image is Selected (has checkmark ✅) ───
const isZoneSelected = (targetZone) => {
    const zoneEl = findUploadZoneElement(targetZone);
    if (!zoneEl) return false;
    const container = zoneEl.closest('div[class*="sc-52570d98-8"]') || zoneEl.parentElement || zoneEl;
    // ขยายขอบเขตค้นหา checkmark — ดูใน parent container ด้วย
    const categoryContainer = container.closest('div[class*="sc-10ad0ca3-1"]') || container.parentElement || container;

    // วิธีที่ 1: หา check icon (Material icon text)
    const hasCheckIcon = Array.from(categoryContainer.querySelectorAll('i, span')).some(el => {
        const t = el.textContent.trim().toLowerCase();
        return t === 'check' || t === 'done' || t === 'check_circle';
    });

    // วิธีที่ 2: หา button aria-label เกี่ยวกับ "เลือก" ที่มี state active
    const selectBtn = categoryContainer.querySelector('button[aria-label*="เลือก"], button[aria-label*="Select"]');
    const hasSelectBtn = selectBtn !== null;

    // วิธีที่ 3: ดู green checkmark badge (svg/icon overlay บน thumbnail)
    const hasGreenBadge = categoryContainer.querySelector('[class*="check"], [class*="selected"], [data-selected]') !== null;

    const isSelected = hasCheckIcon || hasSelectBtn || hasGreenBadge;
    console.log(`[Arin Whisk] Zone ${targetZone} selected=${isSelected} (check=${hasCheckIcon}, selectBtn=${hasSelectBtn}, badge=${hasGreenBadge})`);
    return isSelected;
};

// ─── Backward compat: isZoneOccupied = มีรูป ───
const isZoneOccupied = (targetZone) => isZoneHasImage(targetZone);

// ─── Ensure Image is Selected (click to select if needed) ───
const ensureImageSelected = async (targetZone) => {
    if (!isZoneHasImage(targetZone)) {
        console.log(`[Arin Whisk] Zone ${targetZone} has no image, skip select`);
        return false;
    }
    if (isZoneSelected(targetZone)) {
        console.log(`[Arin Whisk] Zone ${targetZone} already selected ✅`);
        return true;
    }
    console.log(`[Arin Whisk] Zone ${targetZone} has image but NOT selected — clicking to select...`);

    // หา img element ใน zone แล้วคลิก
    const zoneEl = findUploadZoneElement(targetZone);
    if (!zoneEl) return false;
    const container = zoneEl.closest('div[class*="sc-52570d98-8"]') || zoneEl.parentElement || zoneEl;
    const categoryContainer = container.closest('div[class*="sc-10ad0ca3-1"]') || container.parentElement || container;

    // ลองคลิก img หรือ clickable thumbnail
    const clickTarget = categoryContainer.querySelector('img') 
        || categoryContainer.querySelector('[role="button"]')
        || container;
    
    await humanClick(clickTarget);
    await humanSleep(800, 1500);

    // Verify ว่า select สำเร็จ
    const nowSelected = isZoneSelected(targetZone);
    console.log(`[Arin Whisk] Zone ${targetZone} after click: selected=${nowSelected}`);
    
    if (!nowSelected) {
        // Retry: ลองคลิก container เอง
        console.log(`[Arin Whisk] Retrying select on container...`);
        await humanClick(container);
        await humanSleep(800, 1200);
    }
    
    return isZoneSelected(targetZone);
};

// ─── Wait for Upload to Finish (Enhanced: spinner + img + checkmark) ───
const waitForUploadDone = async (targetZone, timeout = 45000) => {
    console.log(`[Arin Whisk] Waiting for ${targetZone} upload to complete...`);
    const start = Date.now();
    let spinnerSeen = false;

    while (Date.now() - start < timeout) {
        const zoneEl = findUploadZoneElement(targetZone);
        if (zoneEl) {
            const container = zoneEl.closest('div[class*="sc-52570d98-8"]') || zoneEl.parentElement || zoneEl;
            const categoryContainer = container.closest('div[class*="sc-10ad0ca3-1"]') || container.parentElement || container;

            // 1. ดักจับ spinner/loading
            const hasSpinner = categoryContainer.querySelector(
                '[class*="spinner"], [class*="loading"], [class*="progress"], [role="progressbar"], mat-spinner, .mat-mdc-progress-spinner'
            ) !== null;
            const hasCircularSvg = Array.from(categoryContainer.querySelectorAll('svg circle, svg')).some(el => {
                const cls = (el.getAttribute('class') || '').toLowerCase();
                return cls.includes('spin') || cls.includes('load') || cls.includes('circular');
            });

            if (hasSpinner || hasCircularSvg) {
                spinnerSeen = true;
                console.log(`[Arin Whisk] ${targetZone} spinner detected, waiting...`);
                await sleep(1000);
                continue;
            }

            // 2. ถ้าเคยเห็น spinner แล้วหายไป → upload น่าจะเสร็จ
            if (spinnerSeen) {
                console.log(`[Arin Whisk] ${targetZone} spinner gone — upload likely done`);
                await sleep(500);
            }

            // 3. เช็ค img tag + check icon
            const hasImg = container.querySelector('img') !== null;
            const hasCheck = Array.from(categoryContainer.querySelectorAll('i, span')).some(el => {
                const t = el.textContent.trim().toLowerCase();
                return t === 'check' || t === 'done' || t === 'check_circle';
            });
            const hasSelectBtn = categoryContainer.querySelector('button[aria-label*="เลือก"], button[aria-label*="Select"]') !== null;

            if (hasImg && (hasCheck || hasSelectBtn || spinnerSeen)) {
                console.log(`[Arin Whisk] ${targetZone} upload confirmed ✅ (img=${hasImg}, check=${hasCheck}, selectBtn=${hasSelectBtn})`);
                await sleep(800);
                return true;
            }

            // 4. Fallback: ถ้ามี img แล้ว spinner ไม่เคยเห็น (อาจเป็นรูปเก่า)
            if (hasImg && Date.now() - start > 5000) {
                console.log(`[Arin Whisk] ${targetZone} has image after 5s, treating as done`);
                return true;
            }
        }
        await sleep(1000);
    }
    console.warn(`[Arin Whisk] Timeout waiting for ${targetZone} upload`);
    return false;
};

// ─── Prompt Selectors ───
const PROMPT_SELECTORS = [
    'textarea.sc-18deeb1d-8',
    'textarea[placeholder*="อธิบายแนวคิด"]',
    'textarea[placeholder*="Describe"]',
    'textarea[aria-label*="Prompt"]',
    'textarea[aria-label*="พรอมต์"]',
    'textarea',
];

// ─── Generate Button ───
const GENERATE_SELECTORS = [
    'button[aria-label="ส่งพรอมต์"]',
    'button[aria-label*="ส่งพรอมต์"]',
    'button[aria-label*="Submit prompt"]',
    'button[aria-label*="Whisk"]',
    'button[aria-label*="whisk"]',
    'button[aria-label*="Generate"]',
    'button[aria-label*="generate"]',
    'button[aria-label*="สร้าง"]',
    'button[data-testid*="generate"]',
];

const findGenerateButton = () => {
    // 1. ARIA labels (Safest)
    for (const sel of GENERATE_SELECTORS) {
        try {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
                if (el && !el.disabled && el.offsetParent !== null) return el;
            }
        } catch (e) {}
    }

    // 2. หาปุ่มที่อยู่ใน prompt area — เอาปุ่มที่มี SVG และอยู่ขวาสุด
    const promptEl = document.querySelector(PROMPT_SELECTORS.join(','));
    if (promptEl) {
        let parent = promptEl.parentElement;
        for (let i = 0; i < 8 && parent; i++) {
            const buttons = Array.from(parent.querySelectorAll('button')).filter(
                b => !b.disabled && b.offsetParent !== null
            );

            // หาปุ่มที่มี SVG และไม่ใช่ปุ่ม clear/close
            const svgButtons = buttons.filter(b => {
                const hasSvg = b.querySelector('svg') !== null;
                const text = (b.textContent || '').trim().toLowerCase();
                const isClose = text === '×' || text === 'x' || b.getAttribute('aria-label')?.includes('clear');
                return hasSvg && !isClose;
            });

            // ปุ่ม generate มักเป็นปุ่มขวาสุด (สุดท้าย) ใน row
            if (svgButtons.length > 0) {
                // เรียงตาม getBoundingClientRect().left แล้วเอาปุ่มขวาสุด
                svgButtons.sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left);
                const candidate = svgButtons[0];
                // ตรวจว่ามี background สีหรือมี class primary/generate
                const style = window.getComputedStyle(candidate);
                const bgColor = style.backgroundColor;
                const isColored = bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent';
                const className = (candidate.className || '').toLowerCase();
                const isPrimary = className.includes('primary') || className.includes('generate') || className.includes('submit');

                if (isColored || isPrimary) return candidate;
                // fallback: return ปุ่มขวาสุดที่มี SVG ถ้าหาไม่เจอปุ่มสี
                if (svgButtons.length === 1) return candidate;
            }

            parent = parent.parentElement;
        }
    }

    // 3. Last resort: หาปุ่มที่มี arrow-right svg ในหน้า
    const allBtns = Array.from(document.querySelectorAll('button')).filter(
        b => !b.disabled && b.offsetParent !== null
    );
    const arrowBtn = allBtns.find(b => {
        const svg = b.querySelector('svg');
        if (!svg) return false;
        const paths = svg.querySelectorAll('path, polyline, line');
        const svgStr = svg.innerHTML.toLowerCase();
        // arrow-right patterns
        return svgStr.includes('m5 12h14') || svgStr.includes('l19 12') ||
            svgStr.includes('chevron') || svgStr.includes('arrow');
    });
    if (arrowBtn) return arrowBtn;

    return null;
};

// ─── Set Aspect Ratio ───
const setAspectRatio = async (ratio) => {
    if (!ratio || ratio === 'default') return;

    let arBtn = null;
    const icons = Array.from(document.querySelectorAll('i, span')).filter(el => el.textContent.trim() === 'aspect_ratio');
    if (icons.length > 0) {
        arBtn = icons[0].closest('button');
    }

    if (!arBtn) {
        const promptEl = document.querySelector(PROMPT_SELECTORS.join(','));
        if (promptEl) {
            let parent = promptEl.parentElement;
            for (let i = 0; i < 6 && parent; i++) {
                const buttons = Array.from(parent.querySelectorAll('button')).filter(
                    b => !b.disabled && b.offsetParent !== null && !b.textContent.includes('×')
                );
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
        await humanSleep(800, 1200);

        // หาปุ่ม ratio (1:1, 9:16, 16:9) ที่ปรากฎขึ้นมา
        const options = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null);
        const ratioBtn = options.find(b => {
             const t = (b.textContent || '').replace(/\s/g, '');
             return t === ratio || t.includes(ratio);
        });

        if (ratioBtn) {
            console.log(`[Arin Whisk] Selecting Aspect Ratio: ${ratio}`);
            await humanClick(ratioBtn);
            await humanSleep(500, 800);
        } else {
            console.warn(`[Arin Whisk] Could not find Aspect Ratio option: ${ratio}`);
            // ปิดเมนูถ้าหาไม่เจอ
            await humanClick(arBtn);
        }
    } else {
        console.log('[Arin Whisk] Aspect Ratio button not found, skipping');
    }
};

// ─── Pre-flight Validation: เช็คทุกเงื่อนไขก่อนกด Generate ───
const verifyAllConditionsBeforeGenerate = async (data, maxRetries = 10) => {
    const { prompt, settings, subjectImage, sceneImage, styleImage } = data;
    console.log('[Arin Whisk] 🔍 Running pre-flight validation...');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const issues = [];

        // 1. เช็ค Aspect Ratio ที่เลือก (ถ้ามีการตั้งค่า)
        if (settings && settings.aspectRatio && settings.aspectRatio !== 'default') {
            // ดูว่า aspect ratio button มี highlight ที่ถูกต้อง
            const arIcons = Array.from(document.querySelectorAll('i, span')).filter(el => el.textContent.trim() === 'aspect_ratio');
            if (arIcons.length > 0) {
                // Aspect ratio button exists — ถือว่า ok (ตรวจละเอียดยากเพราะ UI ไม่แสดงค่าตรงๆ)
            }
        }

        // 2. เช็คว่าภาพที่ต้องการถูก select (มี checkmark)
        const zonesToCheck = [];
        if (subjectImage) zonesToCheck.push('subject');
        if (sceneImage) zonesToCheck.push('scene');
        if (styleImage) zonesToCheck.push('style');

        for (const zone of zonesToCheck) {
            if (isZoneHasImage(zone)) {
                if (!isZoneSelected(zone)) {
                    issues.push(`${zone}: มีรูปแต่ยังไม่ถูกเลือก`);
                    // auto-fix: คลิกเลือก
                    await ensureImageSelected(zone);
                }
            } else {
                issues.push(`${zone}: ไม่พบรูปในช่อง`);
            }
        }

        // 3. เช็คว่า prompt ถูกใส่แล้ว (ถ้ามี prompt)
        if (prompt && prompt.trim()) {
            const promptInput = document.querySelector(PROMPT_SELECTORS.join(','));
            if (promptInput) {
                const currentVal = (promptInput.value || promptInput.textContent || '').trim();
                if (!currentVal) {
                    issues.push('prompt: ช่อง prompt ว่างเปล่า');
                }
            }
        }

        // 4. เช็คว่าปุ่ม Generate enabled + visible
        const genBtn = findGenerateButton();
        if (!genBtn) {
            issues.push('generate: ไม่พบปุ่ม Generate');
        } else if (genBtn.disabled) {
            issues.push('generate: ปุ่ม Generate ถูก disable');
        }

        if (issues.length === 0) {
            console.log(`[Arin Whisk] ✅ Pre-flight validation PASSED (attempt ${attempt})`);
            return true;
        }

        console.log(`[Arin Whisk] ⚠️ Pre-flight issues (attempt ${attempt}/${maxRetries}):`, issues);

        if (attempt < maxRetries) {
            await humanSleep(1500, 2500);
        }
    }

    console.warn('[Arin Whisk] ❌ Pre-flight validation FAILED after max retries');
    return false; // ยังไม่พร้อม แต่ให้ลองเจนต่อเผื่อ
};

// ─── Main Flow (Validation-Based Strict Sequence) ───
const processGeneration = async (data) => {
    const { prompt, promptId, settings, subjectImage, sceneImage, styleImage } = data;

    if (!isOnWhisk()) throw new Error('[OFF_SITE] กรุณาสลับไปที่หน้า Google Whisk');

    sendProgress(promptId, 0, 'starting');

    // ══ STEP 1: Ensure "Create Image" Mode ══
    console.log('[Arin Whisk] ═══ STEP 1: Ensure Create Image Mode ═══');
    await ensureOnWhiskMainPage(); 
    await waitForDOMStable(500, 5000);

    // ══ STEP 2: Open Sidebar + Upload Images ══
    const hasImages = subjectImage || sceneImage || styleImage;
    if (hasImages) {
        console.log('[Arin Whisk] ═══ STEP 2: Upload Images ═══');
        sendProgress(promptId, 10, 'uploading_images');

        // Ensure Sidebar is Open
        try {
            const toggleBtns = Array.from(document.querySelectorAll('button')).filter(b => {
                const txt = (b.textContent || '').trim();
                return txt === 'เพิ่มรูปภาพ' || txt === 'ซ่อนรูปภาพ' || txt.includes('image');
            });
            if (toggleBtns.length > 0) {
                const addImgBtn = toggleBtns[toggleBtns.length - 1];
                const isOpen = addImgBtn.textContent.includes('ซ่อน') || addImgBtn.textContent.toLowerCase().includes('hide');
                if (!isOpen && addImgBtn.offsetParent !== null) {
                    console.log('[Arin Whisk] Opening image sidebar...');
                    await humanClick(addImgBtn);
                    await humanSleep(1000, 1500);
                }
            }
        } catch (e) { console.warn('[Arin Whisk] Sidebar error:', e); }

        // Upload each zone (Smart Skip: เช็คว่ามีรูปแล้วไม่ต้องอัปใหม่)
        const uploadZone = async (imageData, zoneName) => {
            if (!imageData) return;
            console.log(`[Arin Whisk] Checking ${zoneName} zone...`);
            if (isZoneHasImage(zoneName)) {
                console.log(`[Arin Whisk] ${zoneName} already has image, skipping upload ✅`);
            } else {
                console.log(`[Arin Whisk] Uploading ${zoneName}...`);
                await uploadImageToZone(imageData, zoneName);
                await sleep(1500);
                await waitForUploadDone(zoneName);
            }
            await humanSleep(600, 1000);
        };

        await uploadZone(subjectImage, 'subject');
        await uploadZone(sceneImage, 'scene');
        await uploadZone(styleImage, 'style');

        await waitForDOMStable(1000, 3000);
        console.log('[Arin Whisk] All uploads finished 🎯');
    }

    // ══ STEP 3: Ensure Images are Selected (checkmark ✅) ══
    if (hasImages) {
        console.log('[Arin Whisk] ═══ STEP 3: Ensure Images Selected ═══');
        sendProgress(promptId, 20, 'selecting_images');

        if (subjectImage) await ensureImageSelected('subject');
        if (sceneImage)  await ensureImageSelected('scene');
        if (styleImage)  await ensureImageSelected('style');

        await humanSleep(500, 800);
    }

    // ══ STEP 4: Set Aspect Ratio ══
    if (settings && settings.aspectRatio) {
        console.log('[Arin Whisk] ═══ STEP 4: Set Aspect Ratio ═══');
        sendProgress(promptId, 28, 'setting_ratio');
        await setAspectRatio(settings.aspectRatio);
    }

    // ══ STEP 5: Type Prompt ══
    if (prompt && prompt.trim()) {
        console.log('[Arin Whisk] ═══ STEP 5: Type Prompt ═══');
        sendProgress(promptId, 35, 'typing_prompt');
        const promptInput = await waitForAny(PROMPT_SELECTORS, 10000);
        if (promptInput) {
            await humanClick(promptInput);
            await humanSleep(300, 600);

            if (promptInput.tagName === 'TEXTAREA' || promptInput.tagName === 'INPUT') {
                promptInput.focus();
                const nativeSet = Object.getOwnPropertyDescriptor(
                    promptInput.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype, 
                    'value'
                )?.set;
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
            await humanSleep(500, 800);
        }
    }

    // ══ STEP 6: Pre-flight Validation ══
    console.log('[Arin Whisk] ═══ STEP 6: Pre-flight Validation ═══');
    sendProgress(promptId, 40, 'validating');
    await verifyAllConditionsBeforeGenerate(data);

    // ══ STEP 7: Click Generate ══
    console.log('[Arin Whisk] ═══ STEP 7: Click Generate ═══');
    sendProgress(promptId, 45, 'clicking_generate');
    const generateBtn = findGenerateButton();
    if (generateBtn) {
        const urlBefore = window.location.href;
        await humanClick(generateBtn);
        
        // Fallback direct click
        await sleep(600);
        if (document.body.contains(generateBtn) && generateBtn.offsetParent !== null) {
            generateBtn.click();
        }

        sendProgress(promptId, 50, 'waiting_for_result');
        const generated = await waitForGenerationComplete(promptId, urlBefore);

        // Auto Download
        if (settings && settings.autoDownload && generated.length > 0) {
            const toDownload = generated.slice(0, 4);
            for (let i = 0; i < toDownload.length; i++) {
                const item = toDownload[i];
                const filename = sanitizeFilename(prompt || 'whisk') + '_' + Date.now() + '_' + (i + 1) + '.png';
                chrome.runtime.sendMessage({
                    action: 'DOWNLOAD_RESULT',
                    url: item.url,
                    filename,
                    folder: (settings && settings.saveFolder) || 'ArinWhiskBot'
                });
                await sleep(600);
            }
        }

        sendProgress(promptId, 100, 'completed');
        return true;
    } else {
        throw new Error('ไม่พบปุ่ม Generate — ลอง F5 แล้วลองใหม่');
    }
};


// ─── รอ Generate เสร็จ ───
// FIX: ใช้ Polling ธรรมดาที่ปลอดภัย (ไม่ใช้ MutationObserver + getBoundingClientRect เพราะทำเบราว์เซอร์ค้าง)
const waitForGenerationComplete = async (promptId, urlBeforeGenerate, timeout = 180000) => {

    // snapshot รูปเก่าทั้งหมด 
    const getVisibleImages = () => {
        return Array.from(document.querySelectorAll('img')).filter(img => {
            if (!img.src || img.src.length < 20) return false;
            // ไม่เช็ค BoundingBox ตอนดึง URL เพื่อลดภาระเครื่อง
            return true;
        }).map(img => img.src);
    };

    const snapUrls = new Set(getVisibleImages());
    console.log(`[Arin Whisk] Snapshot: ${snapUrls.size} existing images`);

    const collectedUrls = new Set();
    const start = Date.now();
    let resolved = false;

    // Progress updater
    let lastPercent = 50;
    const progressInterval = setInterval(() => {
        if (resolved) { clearInterval(progressInterval); return; }
        const elapsed = Date.now() - start;
        const pct = Math.min(90, Math.floor((elapsed / 90000) * 40) + 50);
        if (pct > lastPercent) {
            lastPercent = pct;
            sendProgress(promptId, pct, 'running');
        }
    }, 3000);

    try {
        while (Date.now() - start < timeout) {
            await sleep(1500);

            // ตรวจว่าเข้าหน้า /project หรือมีรูปใหม่ขึ้นมา
            const currentImgs = Array.from(document.querySelectorAll('img')).filter(img => {
                if (!img.src || img.src.length < 30) return false;
                if (snapUrls.has(img.src)) return false;
                // กรอง URL ขยะ
                const src = img.src;
                if (src.includes('lh3.googleusercontent.com') || src.includes('generativelanguage') || src.includes('storage.googleapis.com')) {
                    // รูปที่ Generate จริงมักมาในรูปแบบพวกนี้ ให้วัดขนาดเฉพาะรูปกลุ่มนี้เพื่อคัดกรอง
                    const rect = img.getBoundingClientRect();
                    return rect.width > 200 && rect.height > 200;
                }
                if (src.startsWith('blob:')) return true;
                return false;
            });

            if (currentImgs.length > 0) {
                currentImgs.forEach(img => {
                    collectedUrls.add(JSON.stringify({ url: img.src, mediaType: 'image' }));
                    console.log('[Arin Whisk] Found new image:', img.src.slice(0, 80));
                });
                break; // ได้รูปแล้ว
            }

            // Hard timeout ย่อย
            if (Date.now() - start > 140000 && collectedUrls.size === 0) {
                console.warn('[Arin Whisk] 2.5 min timeout with no results');
                break;
            }
        }
    } finally {
        resolved = true;
        clearInterval(progressInterval);
    }

    if (collectedUrls.size > 0) {
        await sleep(1000);
    }

    const results = Array.from(collectedUrls).map(s => JSON.parse(s));
    console.log(`[Arin Whisk] Final collected: ${results.length} image(s)`);
    return results;
};