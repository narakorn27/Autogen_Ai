// ═══════════════════════════════════════════════════════════
// AR Automation Flow Bot — Content Script v1.0
// Source: arin-ex-autoflow (upload/scoring) + arin-flow-ext (generate flow)
// ═══════════════════════════════════════════════════════════
'use strict';

let isReady = true;

// ═══════════════════════════════════════
// SECTION 1: Utilities
// ═══════════════════════════════════════

function log(message, level = 'INFO', extra) {
    const text = `[AR Flow][${level}] ${message}`;
    console.log(text, extra || '');
    try {
        chrome.runtime.sendMessage({
            action: 'LOG',
            level: level.toLowerCase(),
            text: extra ? `${message} | ${safeJson(extra)}` : message,
        }).catch(() => {});
    } catch (_) {}
}

function safeJson(v) {
    try { return JSON.stringify(v); } catch { return String(v); }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity || '1') > 0 &&
        rect.width > 0 &&
        rect.height > 0
    );
}

function getRect(el) { return el?.getBoundingClientRect?.() || null; }

function getText(el) {
    if (!el) return '';
    return [
        el.innerText || '', el.textContent || '',
        el.getAttribute?.('aria-label') || '',
        el.getAttribute?.('title') || '',
        el.getAttribute?.('placeholder') || ''
    ].join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function getRawText(el) {
    if (!el) return '';
    return [
        el.innerText || '', el.textContent || '',
        el.getAttribute?.('aria-label') || '',
        el.getAttribute?.('title') || '',
        el.getAttribute?.('placeholder') || ''
    ].join(' ').replace(/\s+/g, ' ').trim();
}

function getIconText(el) {
    if (!el) return '';
    const icon = el.querySelector('i, .google-symbols');
    return (icon?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function getRectCenter(rect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function distanceScore(a, b) {
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    return Math.hypot(ax - bx, ay - by);
}

async function waitForCondition(checkFn, label, timeoutMs = 15000, intervalMs = 250) {
    const start = Date.now();
    let lastError = null;
    while (Date.now() - start < timeoutMs) {
        try {
            const result = checkFn();
            if (result) { log(`wait ok: ${label}`, 'OK'); return result; }
        } catch (err) {
            lastError = err;
        }
        await sleep(intervalMs);
    }
    if (lastError) log(`LastError in waitForCondition for ${label}: ${lastError.message}`, 'WARN');
    throw new Error(`Timeout waiting for: ${label}`);
}

function highlightElement(el, label = 'TARGET', color = '#4ade80') {
    if (!el || !isVisible(el)) return;
    const rect = el.getBoundingClientRect();
    const box = document.createElement('div');
    box.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;border:2px solid ${color};background:rgba(74,222,128,0.08);z-index:2147483647;pointer-events:none;border-radius:8px;box-sizing:border-box;`;
    const badge = document.createElement('div');
    badge.textContent = label;
    badge.style.cssText = `position:absolute;top:-22px;left:0;background:${color};color:#fff;font-size:12px;line-height:1;padding:4px 6px;border-radius:6px;font-weight:700;`;
    box.appendChild(badge);
    document.body.appendChild(box);
    setTimeout(() => { try { box.remove(); } catch (_) {} }, 1500);
}

function clickLikeHuman(el) {
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, view: window };
    try { el.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch (_) {}
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    try { el.focus?.(); } catch (_) {}
    try { el.dispatchEvent(new PointerEvent('pointerup', opts)); } catch (_) {}
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
}

function dataURLtoFile(dataUrl, filename, mimeType = 'image/png') {
    const arr = dataUrl.split(',');
    const mime = mimeType || arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
}

function normalizeName(name) {
    return String(name || '').toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function waitForPageReady() {
    await waitForCondition(() => document.readyState === 'interactive' || document.readyState === 'complete', 'document ready', 15000, 200);
    await sleep(700);
}

// ═══════════════════════════════════════
// SECTION 2: Element Finders (Scoring — from arin-ex-autoflow)
// ═══════════════════════════════════════

function getPromptCandidates() {
    const selectors = ['textarea', 'input[type="text"]', 'input:not([type])', '[contenteditable="true"]', '[role="textbox"]', 'div[aria-multiline="true"]'];
    const all = selectors.flatMap(s => Array.from(document.querySelectorAll(s)));
    return Array.from(new Set(all)).filter(isVisible);
}

function scorePrompt(el) {
    const rect = el.getBoundingClientRect();
    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const tag = el.tagName.toLowerCase();
    const center = getRectCenter(rect);
    let score = 0;

    if (tag === 'textarea') score += 45;
    if (tag === 'input') score += 20;
    if (el.getAttribute('contenteditable') === 'true') score += 40;
    if ((el.getAttribute('role') || '').toLowerCase() === 'textbox') score += 35;
    if (placeholder.includes('prompt')) score += 20;
    if (placeholder.includes('describe')) score += 10;
    if (aria.includes('prompt')) score += 20;
    if (aria.includes('ข้อความ')) score += 10;
    if (getText(el).includes('prompt')) score += 8;
    if (rect.width > 260) score += 10;
    if (rect.height > 18) score += 6;
    if (center.y > window.innerHeight * 0.62) score += 26;
    if (center.y > window.innerHeight * 0.72) score += 12;
    if (center.x > window.innerWidth * 0.15 && center.x < window.innerWidth * 0.80) score += 10;
    return score;
}

function findPromptInput() {
    const candidates = getPromptCandidates()
        .map(el => ({ el, score: scorePrompt(el), rect: el.getBoundingClientRect() }))
        .sort((a, b) => b.score - a.score);
    return candidates[0]?.el || null;
}

function findComposerRoot() {
    const prompt = findPromptInput();
    if (!prompt) return null;
    let node = prompt;
    for (let i = 0; i < 10 && node; i++) {
        const rect = node.getBoundingClientRect();
        if (rect.width > 420 && rect.height > 50 && rect.top > window.innerHeight * 0.55) return node;
        node = node.parentElement;
    }
    return prompt.parentElement || prompt;
}

function findPlusButtonNearComposer() {
    const root = findComposerRoot();
    const rootRect = root ? root.getBoundingClientRect() : { left: Math.min(300, window.innerWidth * 0.3), top: window.innerHeight * 0.7, width: 600, height: 100 };
    
    const buttons = [...document.querySelectorAll("button,[role='button'],[role='presentation'] button")].filter(isVisible);
    const scored = buttons.map(el => {
        try {
            const rect = el.getBoundingClientRect();
            const text = getText(el);
            const icon = getIconText(el);
            let score = 0;
            if (text.includes('add_2')) score += 80;
            if (icon === 'add_2') score += 80;
            if (text === '+' || text.includes('เพิ่ม') || text.includes('add')) score += 30;
            if (rect.top > window.innerHeight * 0.62) score += 18;
            if (rect.left < window.innerWidth * 0.35) score += 12;
            const dist = distanceScore(rect, rootRect);
            if (dist < 220) score += 30;
            if (dist < 120) score += 20;
            return { el, score };
        } catch(e) { return { el, score: -99 }; }
    }).sort((a, b) => b.score - a.score);

    return scored[0]?.score > 0 ? scored[0].el : (scored[0]?.el || null);
}

function findUploadButtonInOpenPanel() {
    const buttons = [...document.querySelectorAll("button,[role='button']")].filter(isVisible);
    const scored = buttons.map(el => {
        const rect = el.getBoundingClientRect();
        const text = getText(el);
        const icon = getIconText(el);
        let score = 0;
        if (text.includes('upload')) score += 60;
        if (text.includes('อัปโหลด')) score += 60;
        if (text.includes('อัปโหลดรูปภาพ')) score += 40;
        if (icon.includes('upload')) score += 70;
        if (rect.top > window.innerHeight * 0.45) score += 10;
        if (rect.left < window.innerWidth * 0.75) score += 8;
        return { el, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0]?.el || null;
}

function findGenerateButton() {
    const buttons = [...document.querySelectorAll("button,[role='button'],[role='presentation'] button")].filter(isVisible);
    const scored = buttons.map(el => {
        try {
            const rect = el.getBoundingClientRect();
            const text = getText(el);
            const icon = getIconText(el);
            let score = 0;
            if (icon.includes('arrow_forward')) score += 100;
            if (icon.includes('send')) score += 50;
            if (text.includes('arrow_forward') || text.includes('สร้าง') || text.includes('generate')) score += 50;
            if (el.hasAttribute?.('disabled') || el.getAttribute?.('aria-disabled') === 'true') score -= 20;
            return { el, score, text, icon };
        } catch(e) { return { el, score: -99, text: '', icon: '' }; }
    }).sort((a, b) => b.score - a.score);

    // Filter out generic low-scoring buttons if we actually have top contenders
    const best = scored[0];
    if (best && best.score > 20) {
        return best.el; // Found the real button confidently
    } else if (best) {
        // Fallback: didn't find specific button, return the highest scoring one anyway
        return best.el;
    }
    return null;
}

function getPanelRoot() {
    const candidates = [...document.querySelectorAll("div,[role='dialog']")]
        .filter(isVisible)
        .map(el => ({ el, text: getText(el), rect: getRect(el) }))
        .filter(x => x.rect && x.rect.width > 180 && x.rect.height > 120)
        .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height);
    const byText = candidates.find(x => /(upload|อัปโหลด|image|รูปภาพ|photo)/i.test(x.text));
    return byText?.el || candidates[0]?.el || null;
}

function findBestFileInput(panelRoot = null) {
    const inputs = [...document.querySelectorAll('input[type="file"]')];
    const composer = findComposerRoot();
    const panel = panelRoot || getPanelRoot();

    const scored = inputs.map(el => {
        const rect = getRect(el) || { left: 0, top: 0, width: 0, height: 0 };
        let score = 0;
        const accept = (el.accept || '').toLowerCase();
        if (accept.includes('image')) score += 80;
        if (el.multiple) score += 15;
        if (!isVisible(el)) score += 8;
        if (panel) { try { const d = distanceScore(rect, panel.getBoundingClientRect()); if (d < 350) score += 25; if (d < 220) score += 15; } catch (_) {} }
        if (composer) { try { const d = distanceScore(rect, composer.getBoundingClientRect()); if (d < 500) score += 10; } catch (_) {} }
        return { el, score };
    }).sort((a, b) => b.score - a.score);

    return scored[0]?.el || null;
}

// ═══════════════════════════════════════
// SECTION 3: Prompt Fill (from arin-ex-autoflow)
// ═══════════════════════════════════════

function setNativeInputValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLInputElement ? HTMLInputElement.prototype : null;
    const setter = proto ? Object.getOwnPropertyDescriptor(proto, 'value')?.set : null;
    if (setter) setter.call(el, value);
    else el.value = value;
}

function fireNativeTextEvents(el, insertedText = '') {
    try { el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: insertedText })); } catch (_) { el.dispatchEvent(new Event('beforeinput', { bubbles: true, cancelable: true })); }
    try { el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: insertedText })); } catch (_) { el.dispatchEvent(new Event('input', { bubbles: true })); }
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

async function safeTypeIntoContentEditable(el, prompt) {
    el.focus();
    await sleep(60);

    // ล้างช่องแบบเนียนๆ ไม่ชน React
    try {
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
    } catch (_) {}
    await sleep(80);

    // ใส่ข้อความวิธีที่ 1: แทรกตรงๆ
    try { document.execCommand('insertText', false, prompt); } catch (_) {}
    await sleep(100);

    // ใส่ข้อความวิธีที่ 2: จำลองวาง Paste
    try {
        const dt = new DataTransfer();
        dt.setData('text/plain', prompt);
        el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
    } catch (_) {}
    await sleep(100);

    // **จุดสำคัญที่สุด**: บอก React ว่ามีการกรอก text แล้ว
    try { el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: prompt })); } catch (_) {}
    try { el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt })); } catch (_) { el.dispatchEvent(new Event('input', { bubbles: true })); }
    
    // จำลองแป้นพิมพ์ตบท้าย
    el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    
    await sleep(150);
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    await sleep(120);
    el.focus();

    const current = (el.innerText || el.textContent || '').trim();
    // เช็คว่ามีข้อความอยู่ใน DOM จริง และไม่ใช่ Placeholder
    return current.length > 0 && !current.includes("คุณต้องการสร้างอะไร");
}

async function fillPrompt(prompt) {
    const inputEl = await waitForCondition(findPromptInput, 'prompt input', 15000, 250);
    highlightElement(inputEl, 'PROMPT', '#4ade80');
    clickLikeHuman(inputEl);
    await sleep(120);

    const safePrompt = String(prompt || '').trim();
    if (!safePrompt) {
        log('ไม่พบข้อความ Prompt ที่ต้องพิมพ์ (ข้ามการพิมพ์)', 'OK');
        return;
    }

    const tag = inputEl.tagName.toLowerCase();
    const isCE = inputEl.getAttribute('contenteditable') === 'true';
    const role = (inputEl.getAttribute('role') || '').toLowerCase();

    log(`Filling prompt. tag=${tag} ce=${isCE} role=${role}`);

    if (tag === 'textarea' || tag === 'input') {
        setNativeInputValue(inputEl, safePrompt);
        fireNativeTextEvents(inputEl, safePrompt);
        inputEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
        inputEl.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
        await sleep(250);
        const afterText = (inputEl.value || '').trim();
        if (!afterText && safePrompt) throw new Error('Prompt fill failed on native input');
        return;
    }

    if (isCE || role === 'textbox') {
        const ok = await safeTypeIntoContentEditable(inputEl, safePrompt);
        const afterText = (inputEl.innerText || inputEl.textContent || '').trim();
        if (!ok || (!afterText && safePrompt)) throw new Error('Prompt fill failed on contenteditable');
        return;
    }
    throw new Error('Unsupported prompt element type');
}

// ═══════════════════════════════════════
// SECTION 4: Image Upload (from arin-ex-autoflow)
// ═══════════════════════════════════════

function findVisibleFailureNode() {
    const failWords = ['ล้มเหลว', 'failed', 'error', 'ไม่สำเร็จ', 'อัปโหลดไม่สำเร็จ', 'upload failed', 'warning'];
    const nodes = [...document.querySelectorAll('div,span,p,button')]
        .filter(isVisible)
        .map(el => ({ el, text: getText(el), raw: getRawText(el), rect: getRect(el) }))
        .filter(x => x.rect && x.rect.top > window.innerHeight * 0.35);
    return nodes.find(x => failWords.some(w => x.text.includes(w)))?.el || null;
}

function findFilenameNode(name) {
    const normalized = normalizeName(name);
    if (!normalized) return null;
    const nodes = [...document.querySelectorAll('div,span,p,button')]
        .filter(isVisible)
        .map(el => ({ el, raw: getRawText(el), rect: getRect(el) }))
        .filter(x => x.rect && x.rect.top > window.innerHeight * 0.30);
    return nodes.find(x => { const t = normalizeName(x.raw); return t && (t.includes(normalized) || normalized.includes(t)); })?.el || null;
}

function getComposerAttachmentSnapshot() {
    const root = findComposerRoot() || document.body;
    // ดึง ID หรือ src ของภาพทั้งหมดที่เจอในหน้า เพื่อใช้เป็น Baseline
    return [...root.querySelectorAll('img, [data-image-id], [data-asset-id], [data-id]')]
        .map(el => {
            if (el.tagName.toLowerCase() === 'img') return el.src;
            return el.getAttribute('data-image-id') || el.getAttribute('data-asset-id') || el.getAttribute('data-id');
        })
        .filter(x => x && x.length > 5);
}

function snapshotDiffCount(before, after) {
    const set = new Set(before);
    return after.filter(x => !set.has(x)).length;
}

function isUploadingInProgress() {
    // เช็คว่ามี progress bar หรือ loading spinner หมุนๆ อยู่มั้ย
    return document.querySelector('[role="progressbar"], mat-spinner, .mdc-circular-progress') !== null;
}

async function waitForUploadResult(fileName, beforeSnapshot, timeoutMs = 25000) {
    const start = Date.now();
    let detectedNewId = false;

    while (Date.now() - start < timeoutMs) {
        const failNode = findVisibleFailureNode();
        if (failNode) {
            highlightElement(failNode, 'UPLOAD FAIL', '#ef4444');
            throw new Error(`อัปโหลดล้มเหลว: ${getRawText(failNode).slice(0, 100)}`);
        }

        const afterSnapshot = getComposerAttachmentSnapshot();
        const diffCount = snapshotDiffCount(beforeSnapshot, afterSnapshot);

        if (diffCount > 0) {
            if (!detectedNewId) {
                log('ตรวจพบ ID ภาพใหม่เข้าระบบ Flow แล้ว รอโหลดเสร็จ...', 'OK');
                detectedNewId = true;
            }
            
            // รอจนกว่า Progressbar จะหายไป (แปลว่า upload เสร็จ 100%)
            if (!isUploadingInProgress()) {
                await sleep(1500); // พักรอให้ UI นิ่ง
                log('อัปโหลดและอัปเดต ID เสร็จสมบูรณ์ ✅', 'OK');
                return { ok: true, mode: 'id-ready' };
            }
        }

        await sleep(500);
    }

    if (detectedNewId) {
        log('ตรวจเจอ ID แล้วแต่โหลดนานเกิน หมดเวลา timeout ข้ามไปขั้นต่อไป...', 'WARN');
        return { ok: true, mode: 'timeout-but-has-id' };
    }
    
    throw new Error(`หมดเวลาไม่ได้ ID คืนมา: ไม่พบภาพ "${fileName}" อัปเดตลง Flow กรุณาลองใหม่`);
}

async function uploadOneImage(item, index, total) {
    const file = dataURLtoFile(item.dataUrl, item.name || `image-${index + 1}.png`, item.type || 'image/png');
    const beforeSnapshot = getComposerAttachmentSnapshot();
    
    log(`เตรียมอัปโหลดภาพที่ ${index + 1}/${total}: ${file.name} 📤`, 'upload');

    const plusBtn = await waitForCondition(findPlusButtonNearComposer, 'plus button', 12000, 250);
    highlightElement(plusBtn, 'PLUS', '#f59e0b');
    clickLikeHuman(plusBtn);
    log(`กดปุ่ม + (Plus) เพื่อเพิ่มสื่อ... ➕`, 'action');
    await sleep(700);

    const uploadBtn = await waitForCondition(findUploadButtonInOpenPanel, 'upload button', 8000, 200);
    highlightElement(uploadBtn, 'UPLOAD', '#60a5fa');
    clickLikeHuman(uploadBtn);
    log('กดปุ่ม "อัปโหลดรูปภาพ" ในเมนู... ⬆️', 'action');
    await sleep(400);

    const panelRoot = getPanelRoot();
    if (panelRoot) log('เจอ Panel สำหรับการอัปโหลดแล้ว 📂', 'check');

    const fileInput = await waitForCondition(() => findBestFileInput(panelRoot), 'best image file input', 8000, 250);

    log('กำลังจำลองการเลือกไฟล์เสมือนมนุษย์ทำ... 🗂️', 'step');
    const dt = new DataTransfer();
    dt.items.add(file);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
    if (setter) setter.call(fileInput, dt.files);
    else fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    log(`เลือกไฟล์สำเร็จ กำลังส่งเข้าระบบ Flow... 🚀`, 'success');

    const result = await waitForUploadResult(file.name, beforeSnapshot, 20000);
    log(`การอัปโหลดเข้า Flow เสร็จสมบูรณ์ (${result.mode}) ✅`, 'success');
    await sleep(900);
}

const findButtonByText = (text, exact = false) =>
    Array.from(document.querySelectorAll('button, [role="button"], [role="menuitem"], [role="menuitemradio"], [role="tab"]'))
    .find(el => {
        if (!isVisible(el)) return false;
        const content = (el.innerText || el.textContent || '').trim();
        return exact ? content === text : content.includes(text);
    });

async function applySettings(settings) {
    if (!settings) return;
    const shortDelay = async (min = 80, max = 200) => await sleep(Math.floor(Math.random() * (max - min) + min));

    log('กำลังเช็คและตั้งค่า Image Settings... ⚙️', 'check');

    const pills = Array.from(document.querySelectorAll('button')).filter(b => b.getAttribute('aria-haspopup') === 'menu' || b.getAttribute('aria-haspopup') === 'dialog');
    const settingsSummaryBtn = pills.find(b => ['x1','x2','x3','x4'].some(t => b.innerText.includes(t))) || pills.find(b => b.innerText.includes('Imagen') || b.innerText.includes('Banana') || b.innerText.includes('Veo') || b.innerText.includes('Flux'));

    if (settingsSummaryBtn && settingsSummaryBtn.getAttribute('aria-expanded') === 'false') {
        log('เปิดหน้าต่างตั้งค่า... ⚙️', 'action');
        await shortDelay(200, 400);
        clickLikeHuman(settingsSummaryBtn);
        await shortDelay(600, 900); // รอ popup โผล่
    }

    if (settings.aspectRatio) {
        const ratioMap = { '9:16': 'แนวตั้ง', '1:1': 'จัตุรัส', '16:9': 'แนวนอน', '4:3': '4:3' };
        const ratioText = ratioMap[settings.aspectRatio] || 'แนวนอน';
        const ratioBtn = findButtonByText(ratioText, true) || findButtonByText(ratioText, false);
        if (ratioBtn && ratioBtn.getAttribute('aria-checked') !== 'true' && ratioBtn.getAttribute('aria-selected') !== 'true') {
            log(`ปรับอัตราส่วนเป็น: ${settings.aspectRatio} 📐`, 'action');
            await shortDelay(100, 200);
            clickLikeHuman(ratioBtn);
            await shortDelay(150, 350);
        }
    }

    const numOutputs = parseInt(settings.outputCount || settings.clipCount || 2, 10);
    if (numOutputs >= 1 && numOutputs <= 4) {
        const countText = `x${numOutputs}`;
        const countBtn = findButtonByText(countText, true) || findButtonByText(countText, false);
        if (countBtn && countBtn.getAttribute('aria-checked') !== 'true' && countBtn.getAttribute('data-state') !== 'on') {
            log(`ตั้งค่าจำนวน: ${countText} ภาพ 🔢`, 'action');
            await shortDelay(100, 200);
            clickLikeHuman(countBtn);
            await shortDelay(200, 400);
        }
    }

    const flowModelName = settings.flowImageModel || settings.videoModel;
    if (flowModelName) {
        const popupDropdowns = Array.from(document.querySelectorAll('[role="dialog"] button, [role="menu"] button'))
            .filter(b => b.hasAttribute('aria-haspopup'));
        const modelDropdown = popupDropdowns.find(b => b.innerText.includes('Imagen') || b.innerText.includes('Banana') || b.innerText.includes('Veo') || b.innerText.includes('Flux'));
        
        if (modelDropdown) {
            log('คลิกเลือก Model dropdown... 🤖', 'action');
            await shortDelay(150, 300);
            clickLikeHuman(modelDropdown);
            await shortDelay(500, 800);
            
            const modelNameMap = {
                banana_nano_pro: 'Nano Banana Pro',
                banana_nano_2: 'Nano Banana 2',
                imagen_4: 'Imagen 4',
                veo31_fast: 'Veo 3.1',
                veo31_free: 'Veo 3.1',
                flux_pro: 'Flux'
            };
            const targetModel = modelNameMap[flowModelName] || flowModelName;
            
            const modelItem = Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemradio"]'))
                .find(el => isVisible(el) && (el.innerText || '').trim().includes(targetModel));
            
            if (modelItem) {
                log(`ใช้โมเดล: ${targetModel} 🤖`, 'action');
                await shortDelay(100, 200);
                clickLikeHuman(modelItem);
                await shortDelay(400, 600);
            }
        }
    }

    if (settingsSummaryBtn && settingsSummaryBtn.getAttribute('aria-expanded') === 'true') {
        log('ตั้งค่าเสร็จสิ้น ปิดหน้าต่าง Popup 🆗', 'success');
        await shortDelay(100, 200);
        clickLikeHuman(settingsSummaryBtn);
        await shortDelay(400, 600);
    }
}

// ═══════════════════════════════════════
// SECTION 5: Generate (from arin-flow-ext)
// ═══════════════════════════════════════

async function clickGenerate() {
    log('หารอกดปุ่ม Generate หลัก... 🚀', 'check');
    const btn = await waitForCondition(findGenerateButton, 'generate button', 12000, 250);
    highlightElement(btn, 'GENERATE', '#4ade80');
    const disabled = btn.disabled || btn.getAttribute('aria-disabled') === 'true';
    if (disabled) log('ปุ่ม Generate ปิดการใช้งานอยู่ (Disabled)', 'warn');
    clickLikeHuman(btn);
    log('✨ ส่งคำสั่ง Generate เรียบร้อย! ✨', 'success');
    await sleep(1200);
}

// ═══════════════════════════════════════
// SECTION 6: Main Generate Flow (from arin-flow-ext)
// ═══════════════════════════════════════

async function handleGenerate(message, sendResponse) {
    try {
        log('===== เริ่มต้นกระบวนการ GENERATE =====', 'step');
        await waitForPageReady();
        await sleep(2000);

        const images = [];
        if (message.subjectImage) images.push({ dataUrl: message.subjectImage, name: 'subject.png', type: 'image/png' });
        if (message.sceneImage) images.push({ dataUrl: message.sceneImage, name: 'scene.png', type: 'image/png' });

        if (images.length > 0) {
            log(`ดำเนินการอัปโหลดภาพจำนวน ${images.length} ภาพ... 📤`, 'upload');
            for (let i = 0; i < images.length; i++) {
                await uploadOneImage(images[i], i, images.length);
            }
            await sleep(700);
        } else {
            log('ไม่มีภาพที่ต้องอัปโหลด ข้ามไปขั้นต่อไป...', 'info');
        }

        log('กำลังเตรียมกรอกข้อความ Prompt... 💬', 'step');
        await fillPrompt(message.prompt || '');
        await sleep(700);
        
        // ─── Apply settings right before clicking generate ───
        if (message.settings) {
            await applySettings(message.settings);
            await sleep(700);
        }

        await clickGenerate();

        log('===== กระบวนการเสร็จสมบูรณ์ =====', 'success');
        sendResponse({ success: true });

    } catch (err) {
        log(`ERROR: ${err.message}`, 'error');
        sendResponse({ success: false, error: err.message });
    }
}

// ═══════════════════════════════════════
// SECTION 7: Test / Debug Functions (from arin-ex-autoflow)
// ═══════════════════════════════════════

async function testSelectors() {
    await waitForPageReady();
    const prompt = findPromptInput();
    const plus = findPlusButtonNearComposer();
    const generate = findGenerateButton();

    if (prompt) { highlightElement(prompt, 'PROMPT'); log('Prompt found', 'OK'); }
    else log('Prompt not found', 'ERR');
    if (plus) { highlightElement(plus, 'PLUS', '#f59e0b'); log('Plus found', 'OK'); }
    else log('Plus not found', 'ERR');
    if (generate) { highlightElement(generate, 'GENERATE', '#4ade80'); log('Generate found', 'OK'); }
    else log('Generate not found', 'ERR');
}

async function testPrompt(prompt) {
    await waitForPageReady();
    await fillPrompt(prompt || 'Test prompt from AR Flow Bot');
}

async function testUpload(images) {
    await waitForPageReady();
    if (!images?.length) { log('No images to upload', 'WARN'); return; }
    for (let i = 0; i < images.length; i++) {
        await uploadOneImage(images[i], i, images.length);
    }
}

async function testGenerate() {
    await waitForPageReady();
    await clickGenerate();
}

async function runFull(images, prompt) {
    await waitForPageReady();
    if (images?.length) { await testUpload(images); await sleep(1000); }
    if (prompt) { await fillPrompt(prompt); await sleep(1000); }
    await clickGenerate();
    log('Run Full completed', 'OK');
}

// ═══════════════════════════════════════
// SECTION 8: Message Listener
// ═══════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Ping
    if (message.action === 'PING') {
        sendResponse({ ok: true, isReady, state: 'ready', editorReady: true });
        return true;
    }

    // Full generation pipeline (from queue)
    if (message.action === 'GENERATE') {
        handleGenerate(message, sendResponse);
        return true;
    }

    // Test selectors (direct)
    if (message.action === 'TEST_SELECTORS') {
        testSelectors().then(() => sendResponse({ ok: true })).catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    // Debug actions (from sidepanel via background)
    if (message.action === 'RUN_ACTION') {
        (async () => {
            try {
                const payload = message.payload || {};
                log(`Received action: ${payload.type}`);

                if (payload.type === 'TEST_SELECTORS') { await testSelectors(); sendResponse({ ok: true }); return; }
                if (payload.type === 'TEST_PROMPT') { await testPrompt(payload.prompt); sendResponse({ ok: true }); return; }
                if (payload.type === 'TEST_UPLOAD') { await testUpload(payload.images); sendResponse({ ok: true }); return; }
                if (payload.type === 'TEST_GENERATE') { await testGenerate(); sendResponse({ ok: true }); return; }
                if (payload.type === 'RUN_FULL') { await runFull(payload.images, payload.prompt); sendResponse({ ok: true }); return; }

                sendResponse({ ok: false, error: 'Unknown payload type' });
            } catch (error) {
                const msg = error?.message || String(error);
                log(msg, 'ERR');
                sendResponse({ ok: false, error: msg });
            }
        })();
        return true;
    }

    return true;
});

log('content.js loaded.', 'OK');
