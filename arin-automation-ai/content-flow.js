// --- Content Script: Arin Flow (content-flow.js) v7.4 ---
// รับผิดชอบเฉพาะ Google Flow — ไม่ยุ่งกับ Whisk
// อัปเดต v7.4: แก้ปุ่ม + สับสน (add vs add_2), แก้ landing loop, เพิ่ม new project recovery
(function() {
'use strict';
console.log('[Arin Flow] content-flow.js loaded ✅');

// ─── Helper: เช็คว่าตอนนี้อยู่ Flow page หรือไม่ ───
const isFlowPage = () => /\/tools\/flow/.test(window.location.pathname);

// ─── Inject Injected.js (ทำครั้งเดียว เมื่ออยู่ Flow page) ───
let flowInjected = false;
const ensureFlowInjected = () => {
    if (flowInjected) return;
    if (!isFlowPage()) return;
    flowInjected = true;
    if (!document.getElementById('arin-flow-injected')) {
        const script = document.createElement('script');
        script.id = 'arin-flow-injected';
        script.src = chrome.runtime.getURL('InjectedFlow.js');
        script.onload = () => console.log('[Arin Flow] InjectedFlow.js loaded ✅');
        script.onerror = (e) => console.error('[Arin Flow] InjectedFlow.js load failed:', e);
        (document.head || document.documentElement).appendChild(script);
    }
};

if (isFlowPage()) ensureFlowInjected();

// ─── Utils ───
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const humanSleep = async (min = 500, max = 1500) => sleep(Math.floor(Math.random() * (max - min + 1) + min));
const sendProgress = (promptId, percent, status = 'running') => {
    chrome.runtime.sendMessage({ action: 'PROGRESS_UPDATE', promptId, percent, status }).catch(() => {});
};
const sendLog = (text, level = 'info') => {
    chrome.runtime.sendMessage({ action: 'LOG', text: `[Flow] ${text}`, level }).catch(() => {});
};
const sanitizeFilename = (str, maxLen = 60) =>
    (str || '').replace(/[<>:"/\\|?*\n\r]/g, '_').trim().slice(0, maxLen) || 'output';
function uuidLike() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ─── Media URL Interception (จาก Injected.js) ───
let capturedMediaUrls = [];
window.addEventListener('message', (e) => {
    if (e.data?.type === 'ARIN_MEDIA_URL') {
        capturedMediaUrls.push({ url: e.data.url, mediaType: e.data.mediaType, ts: e.data.ts || Date.now() });
        if (isFlowPage()) sendLog(`[Hook] เจอ URL สื่อใหม่ (${e.data.mediaType})`, 'success');
    }
});

// ─── URL State Classification (Flow only) ───
const classifyFlowUrl = () => {
    const p = window.location.pathname || '';
    if (!p.includes('tools/flow')) return 'other';
    if (p.includes('[...catchAll]') || p.includes('%5B...catchAll%5D')) return 'catchall';
    if (p.match(/\/tools\/flow\/project/)) return 'project';
    if (p.match(/\/tools\/flow\/?$/)) return 'landing';
    return 'other';
};

const isFlowEditorReady = () => {
    const hasSlateEditor = !!document.querySelector('div[data-slate-editor="true"]');
    const hasSubmitBtn = Array.from(document.querySelectorAll('button'))
        .some(b => b.textContent.includes('arrow_forward'));
    return hasSlateEditor && hasSubmitBtn;
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

// ─── Flow Page Recovery ───

/**
 * หาปุ่ม "โปรเจ็กต์ใหม่" บนหน้า landing (/tools/flow)
 * innerText = "add_2\nโปรเจ็กต์ใหม่" — ต่างจากปุ่ม "เพิ่มสื่อ" ใน input bar
 */
const findNewProjectButton = () => {
    // Primary: หา innerText ที่มี "โปรเจ็กต์ใหม่" หรือ "New project"
    const byText = Array.from(document.querySelectorAll('button')).find(b => {
        const txt = b.innerText || '';
        return txt.includes('โปรเจ็กต์ใหม่') || txt.includes('New project') || txt.includes('new project');
    });
    if (byText) return byText;

    // Fallback: หา icon add_2 (ไม่ใช่ add หรือ add\n)
    return Array.from(document.querySelectorAll('button')).find(b => {
        const icons = b.querySelectorAll('i, span');
        return Array.from(icons).some(i => i.textContent.trim() === 'add_2');
    });
};

const clickNewProjectButton = async () => {
    const btn = findNewProjectButton();
    if (btn) {
        sendLog('พบปุ่ม "โปรเจ็กต์ใหม่" — คลิก...', 'info');
        try { await humanClick(btn); } catch (e) {}
        await sleep(3000);
        // รอให้ URL เปลี่ยนเป็น /project/...
        const start = Date.now();
        while (Date.now() - start < 10000) {
            if (classifyFlowUrl() === 'project' && isFlowEditorReady()) return true;
            await sleep(800);
        }
        return classifyFlowUrl() === 'project';
    }
    sendLog('ไม่พบปุ่ม "โปรเจ็กต์ใหม่" บนหน้านี้', 'warn');
    return false;
};

const ensureFlowReady = async () => {
    const state = classifyFlowUrl();
    const editorReady = isFlowEditorReady();
    const errorPage = isErrorPage();
    sendLog(`ensureFlowReady: state=${state} editor=${editorReady} error=${errorPage}`, 'info');

    if (state === 'project' && editorReady && !errorPage) return true;

    if (state === 'landing') {
        sendLog('หน้า landing — หาปุ่ม "โปรเจ็กต์ใหม่"...', 'warn');
        const clicked = await clickNewProjectButton();
        if (clicked) {
            await sleep(2000);
            if (isFlowEditorReady()) return true;
        }
        // fallback: navigate ตรงๆ
        sendLog('ไม่พบปุ่ม — navigate ตรงไปยัง /project...', 'warn');
        chrome.runtime.sendMessage({ action: 'NAVIGATE_TO_URL', url: 'https://labs.google/fx/tools/flow/project' });
        const start = Date.now();
        while (Date.now() - start < 20000) {
            await sleep(1000);
            if (classifyFlowUrl() === 'project' && isFlowEditorReady()) return true;
        }
        throw new Error('[NEED_REFRESH] ไม่สามารถเข้าหน้า Flow project ได้');
    }

    if (state === 'catchall') {
        chrome.runtime.sendMessage({ action: 'NAVIGATE_TO_URL', url: 'https://labs.google/fx/tools/flow/project' });
        const start = Date.now();
        while (Date.now() - start < 20000) { await sleep(1000); if (classifyFlowUrl() === 'project' && isFlowEditorReady()) return true; }
        throw new Error('[CATCH_ALL] ไม่สามารถกลับหน้า Flow ได้');
    }

    if (state === 'project') {
        const start = Date.now();
        while (Date.now() - start < 15000) { if (isFlowEditorReady() && !isErrorPage()) return true; await sleep(800); }
        throw new Error('[NEED_REFRESH] Flow editor ไม่โหลด');
    }

    throw new Error('[NEED_REFRESH] ไม่ได้อยู่ในหน้า Flow');
};

// ─── DOM Helpers ───
const waitForElement = async (selector, timeout = 8000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const el = document.querySelector(selector);
        if (el && el.offsetWidth > 0) return el;
        await sleep(500);
    }
    return null;
};

const humanClick = async (element) => {
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await humanSleep(100, 300);
    for (const evType of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        element.dispatchEvent(new MouseEvent(evType, { bubbles: true, cancelable: true, view: window, buttons: 1 }));
        await humanSleep(10, 30);
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

// ═══════════════════════════════════════════════════════════
// ─── แทนที่ฟังก์ชัน Image Upload ใน Google Flow ───
// ═══════════════════════════════════════════════════════════

// ─── Helper: นับ thumbnail ปัจจุบัน ───
const getThumbnailCount = () =>
    document.querySelectorAll(
        'img[src*="lh3.googleusercontent"], img[src*="blob:"], img[src*="aisandbox"]'
    ).length;

const waitForThumbnailAdded = async (countBefore, timeoutMs = 20000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (getThumbnailCount() > countBefore) return true;
        await sleep(400);
    }
    return false;
};

// ── แทนที่ handleFlowImageUpload เดิม ให้รองรับอัปโหลดพร้อมกัน ──
const handleFlowMultipleImagesUpload = async (imagesObjArray) => {
    sendLog(`เริ่มต้นอัปโหลดภาพ ${imagesObjArray.length} ภาพ...`, 'info');
    if (!imagesObjArray || imagesObjArray.length === 0) return [];

    try {
        // 1. คลิกปุ่ม "เพิ่มสื่อ"
        const addBtn = Array.from(document.querySelectorAll('button')).find(b => {
            const txt = b.innerText || '';
            const rect = b.getBoundingClientRect();
            return (txt.includes('สร้าง') && txt.includes('add_2')) ||
                   (txt.includes('เพิ่มสื่อ') && rect.top > window.innerHeight * 0.5) ||
                   txt.includes('Attach image');
        });
        if (addBtn) {
            sendLog('คลิกปุ่ม "เพิ่มสื่อ"...', 'info');
            await humanClick(addBtn);
            await sleep(1200);
        }

        // 2. รอ input โผล่
        const startWait = Date.now();
        let input = null;
        while (Date.now() - startWait < 5000) {
            input = document.querySelector('input.sc-a40aa0db-0') 
                 || document.querySelector('input[type="file"][accept="image/*"]');
            if (input) break;
            await sleep(300);
        }
        if (!input) { sendLog('input ไม่โผล่', 'error'); return []; }

        // 3. เตรียมไฟล์
        const filesToInject = [];
        for (const img of imagesObjArray) {
            const mimeMatch = img.data.match(/data:([^;]+);/);
            const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const base64 = img.data.includes(',') ? img.data.split(',')[1] : img.data;
            filesToInject.push({ base64, mime, filename: img.name });
        }

        // 4. นับ mediaId ใน input bar ก่อน upload
        const countInputImages = async () => {
            return new Promise((resolve) => {
                const h = (e) => {
                    if (e.data?.type === 'ARIN_FLOW_INPUT_IMAGE_COUNT') {
                        window.removeEventListener('message', h);
                        sendLog(`countInputImages: ${e.data.count} (strategy: ${e.data.strategy || '?'})`, 'info');
                        resolve(e.data.count);
                    }
                };
                window.addEventListener('message', h);
                window.postMessage({ type: 'ARIN_FLOW_COUNT_INPUT_IMAGES' }, '*');
                setTimeout(() => { window.removeEventListener('message', h); resolve(0); }, 2000);
            });
        };

        window.postMessage({ type: 'ARIN_FLOW_RESET_SERVERIDS' }, '*');
        await sleep(100);

        const countBefore = await countInputImages();
        sendLog(`รูปใน input bar ก่อน upload: ${countBefore}`, 'info');

        // 5. Upload ผ่าน InjectedFlow.js
        const injected = await new Promise((resolve) => {
            const handler = (e) => {
                if (e.data?.type === 'ARIN_FLOW_UPLOAD_RESULT') {
                    window.removeEventListener('message', handler);
                    resolve(e.data);
                }
            };
            window.addEventListener('message', handler);
            window.postMessage({ type: 'ARIN_FLOW_UPLOAD_REQUEST', files: filesToInject }, '*');
            setTimeout(() => {
                window.removeEventListener('message', handler);
                resolve({ success: false, error: 'timeout' });
            }, 10000);
        });

        if (!injected.success) {
            sendLog(`inject upload ล้มเหลว: ${injected.error}`, 'error');
            return [];
        }
        sendLog('inject สำเร็จ ✅ รอรูปเข้า input bar...', 'info');

        // ── step 6: รอรูปเข้า zSufC — Flow auto-attach เอง ไม่ต้องคลิก card ──
        const startWaitImg = Date.now();
        let finalCount = 0;
        while (Date.now() - startWaitImg < 15000) {
            finalCount = await countInputImages();
            sendLog(`รูปใน input bar: ${finalCount}/1`, 'info');
            if (finalCount >= 1) break;
            await sleep(800);
        }

        if (finalCount >= 1) {
            sendLog(`✅ Upload สำเร็จ: รูปเข้า input bar แล้ว`, 'success');
            return [`success_0`];
        } else {
            sendLog(`❌ รูปไม่เข้า input bar (timeout)`, 'error');
            return [];
        }

    } catch(err) {
        sendLog(`handleFlowMultipleImagesUpload error: ${err.message}`, 'error');
        return [];
    }
};
// ─── Apply Settings (image/video mode, ratio, model, count) ───
const applySettings = async (settings, mode) => {
    if (!settings) return;
    const shortDelay = (min = 80, max = 200) => humanSleep(min, max);

    let settingsSummaryBtn = Array.from(document.querySelectorAll('button')).find(b => {
        const isMenuBtn = b.getAttribute('aria-haspopup') === 'menu' || b.getAttribute('aria-haspopup') === 'dialog';
        return isMenuBtn && ['x1','x2','x3','x4'].some(t => b.innerText.includes(t));
    }) || Array.from(document.querySelectorAll('button')).find(b =>
        b.getAttribute('aria-haspopup') === 'menu' &&
        (b.innerText.includes('Imagen') || b.innerText.includes('Banana') || b.innerText.includes('Veo'))
    );

    if (settingsSummaryBtn && settingsSummaryBtn.getAttribute('aria-expanded') === 'false') {
        await humanSleep(200, 400);
        await humanClick(settingsSummaryBtn);
        await humanSleep(400, 700);
    }

    const imgTexts = ['รูปภาพ', 'Image', 'Images'];
    const vidTexts = ['วิดีโอ', 'Video', 'Videos'];
    const targetTexts = mode === 'text_to_image' ? imgTexts : vidTexts;
    const catBtn = targetTexts.reduce((acc, text) => acc || findButtonByText(text, true), null);
    if (catBtn) { await shortDelay(); await humanClick(catBtn); await shortDelay(150, 350); }

    const ratioMap = { '9:16': 'แนวตั้ง', '1:1': 'จัตุรัส', '16:9': 'แนวนอน', '4:3': '4:3' };
    const ratioText = ratioMap[settings.aspectRatio] || 'แนวนอน';
    const ratioBtn = findButtonByText(ratioText, true) || findButtonByText(ratioText, false);
    if (ratioBtn && ratioBtn.getAttribute('aria-checked') !== 'true') {
        await shortDelay(); await humanClick(ratioBtn); await shortDelay(150, 350);
    }

    const numOutputs = parseInt(settings.clipCount || settings.imageCount || settings.outputsPerPrompt || 2, 10);
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

    const flowModelName = mode === 'text_to_image' ? settings.flowImageModel : settings.videoModel;
    if (flowModelName) {
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
            const modelNameMap = {
                banana_nano_pro: 'Nano Banana Pro',
                banana_nano_2: 'Nano Banana 2',
                imagen_4: 'Imagen 4',
                veo31_fast: 'Veo 3.1',
                veo31_free: 'Veo 3.1'
            };
            const targetModel = modelNameMap[flowModelName] || flowModelName;
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

// ─── Progress Reading ───
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
        if (pct !== null || hasLoading || body.includes('กำลังสร้าง') || body.includes('Generating')) { started = true; break; }
        await sleep(800);
    }
    while (Date.now() - start < timeout) {
        const pct = readProgressPercent();
        const hasLoading = !!document.querySelector('[aria-busy="true"], [role="progressbar"]');
        const body = document.body.innerText;
        const hasGenerating = body.includes('กำลังสร้าง') || body.includes('Generating');
        if (pct !== null && pct !== lastPercent) { lastPercent = pct; sendProgress(promptId, pct, 'running'); }
        if (!hasLoading && !hasGenerating && pct === null && started) { await sleep(1500); return true; }
        await sleep(1000);
    }
    throw new Error('หมดเวลา Generation (Timeout)');
};

// ─── Auto Download ───
const handleAutoDownload = async (prompt, settings, mode, submitTimestamp) => {
    const isImage = mode === 'text_to_image';
    const folder = settings?.saveFolder?.trim() || 'ArinAutoFlow';
    const baseName = settings?.autoRename !== false ? sanitizeFilename(prompt) : uuidLike();
    const ext = isImage ? '.jpg' : '.mp4';
    sendLog(`Waiting for fifeUrl... (mode: ${mode})`, 'info');
    const maxWait = 60000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
        const newUrls = capturedMediaUrls.filter(u => u.ts >= submitTimestamp);
        if (newUrls.length > 0) {
            newUrls.forEach((u, i) => {
                const filename = newUrls.length === 1 ? baseName + ext : `${baseName}_${i + 1}${ext}`;
                sendLog(`Downloading: ${filename}`, 'success');
                chrome.runtime.sendMessage({ action: 'DOWNLOAD_RESULT', url: u.url, filename, folder });
            });
            return;
        }
        await sleep(500);
    }
    sendLog('No fifeUrl found after 60s', 'warn');
};

// ─── Main Generation Flow ───
const processFlowGeneration = async (data) => {
    const { prompt, promptId, settings } = data;
    const mode = data.flowMode || 'text_to_video';
    sendLog(`เริ่มทำงานโหมด ${mode}`, 'step');

    if (!window.location.href.includes('labs.google/fx/')) {
        throw new Error('[OFF_SITE] คุณไม่ได้อยู่ในหน้า Google Flow');
    }

    // ─── Step 1: อัปโหลดภาพ (ถ้ามี) — Flow รองรับแค่ 1 รูป ───
    const imagesToUpload = [];
    if (data.subjectImage) imagesToUpload.push({ data: data.subjectImage, name: data.sourceFilename || data.imageName || 'subject.jpg', type: 'Subject' });
    if (data.sceneImage) imagesToUpload.push({ data: data.sceneImage, name: 'scene.jpg', type: 'Scene' });
    if (data.image && imagesToUpload.length === 0) imagesToUpload.push({ data: data.image, name: data.imageName || 'image.jpg', type: 'Image' });

    // Flow รองรับแค่ 1 รูป — ใช้รูปแรกเท่านั้น
    const singleImageUpload = imagesToUpload.slice(0, 1);

    if (singleImageUpload.length > 0 || mode === 'frame_to_video') {
        if (singleImageUpload.length === 0) throw new Error('โหมด Frame to Video ต้องการรูปภาพประกอบ');
        if (imagesToUpload.length > 1) {
            sendLog(`⚠️ Flow รองรับแค่ 1 รูป — ใช้เฉพาะ "${singleImageUpload[0].name}"`, 'warn');
        }

        sendProgress(promptId, 5, 'uploading');
        sendLog(`อัปโหลดภาพ 1 รูป (${singleImageUpload[0].name})...`, 'step');

        const successIds = await handleFlowMultipleImagesUpload(singleImageUpload);
        if (successIds.length === 0) {
            sendLog(`อัปโหลดล้มเหลว`, 'warn');
        }
        await humanSleep(800, 1200);
    }

    // ─── Step 2: หา Slate Editor ───
    const slateDiv = await waitForElement('div[data-slate-editor="true"]', 8000);
    if (!slateDiv) throw new Error('ไม่พบช่องกรอก Prompt (Slate editor)');

    slateDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(200);
    sendProgress(promptId, 15, 'typing');

    // ─── Step 3: Apply Settings ───
    try { await applySettings(settings, mode); } catch (e) { sendLog('Apply Settings failed: ' + e.message, 'warn'); }

    // ─── Step 4: พิมพ์ Prompt ───
    await humanSleep(300, 700);
    slateDiv.focus();
    await humanSleep(400, 900);

    slateDiv.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'a', code: 'KeyA', ctrlKey: true, keyCode: 65 }));
    await humanSleep(200, 500);
    slateDiv.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'deleteEntireSoftLine' }));
    await humanSleep(300, 800);
    slateDiv.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: prompt }));
    await humanSleep(800, 1500);

    const inserted = slateDiv.innerText?.trim();
    if (!inserted || inserted.length === 0) throw new Error('ไม่สามารถกรอก Prompt ลงใน Slate editor ได้');

    // ─── Step 5: Submit ───
    sendProgress(promptId, 30, 'submitting');
    const submitTimestamp = Date.now();
    const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('arrow_forward'));
    if (!submitBtn) throw new Error('ไม่พบปุ่ม Submit (arrow_forward)');

    await humanSleep(500, 1200);
    submitBtn.click();

    // ─── Step 6: รอผลลัพธ์ ───
    await waitForGeneration(promptId, 180000);
    sendProgress(promptId, 100, 'completed');

    if (settings?.autoDownload !== false) {
        try { await handleAutoDownload(prompt, settings, mode, submitTimestamp); }
        catch (e) { sendLog('Auto Download Failed: ' + e.message, 'warn'); }
    }
    return true;
};

// ─── Error Classification ───
const classifyError = (errMsg) => {
    if (!errMsg) return { message: 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ', needRefresh: true };
    if (errMsg.includes('[CATCH_ALL]')) return { message: '⚠️ หน้า Flow หลุด — กำลัง navigate กลับ', needRefresh: false };
    if (errMsg.includes('ไม่พบช่อง') || errMsg.includes('ไม่พบ')) return { message: '❌ หน้ายังโหลดไม่สมบูรณ์ — กรุณากด F5', needRefresh: true };
    if (errMsg.includes('[OFF_SITE]')) return { message: '⚠️ กรุณาเปิด Google Flow ก่อน', needRefresh: false };
    if (errMsg.includes('DAILY_LIMIT') || errMsg.includes('ขีดจำกัด')) return { message: '🚫 ถึงขีดจำกัดรายวันแล้ว', needRefresh: false };
    if (errMsg.includes('Timeout') || errMsg.includes('หมดเวลา')) return { message: '⏱️ หมดเวลารอผลลัพธ์ — ลอง F5', needRefresh: true };
    return { message: `❌ ${errMsg}`, needRefresh: true };
};

// ═══════════════════════════════════════════════════════════
// ─── MESSAGE LISTENER ───
// ═══════════════════════════════════════════════════════════
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isFlowPage()) return false;

    ensureFlowInjected();

    if (message.action === 'PING') {
        const urlState = classifyFlowUrl();
        const editorReady = isFlowEditorReady();
        const errorPage = isErrorPage();
        // หาปุ่ม new project บน landing page
        const hasNewProjectBtn = urlState === 'landing' ? !!findNewProjectButton() : false;
        console.log(`[Arin Flow] PING → state=${urlState} editor=${editorReady} err=${errorPage} newProjectBtn=${hasNewProjectBtn}`);
        sendResponse({
            ok: true,
            script: 'flow',
            url: window.location.href,
            state: urlState,
            urlState,
            editorReady,
            workReady: editorReady || hasNewProjectBtn,
            errorPage,
            hasNewProjectBtn,
            isReady: urlState === 'project' && editorReady && !errorPage
        });
        return false;
    }

    if (message.action === 'GENERATE') {
        ensureFlowReady().then(async () => {
            processFlowGeneration(message)
                .then(() => sendResponse({ success: true }))
                .catch((err) => {
                    console.error('Arin Flow Error:', err.message);
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

console.log('[Arin Flow] Listeners registered ✅');
})();