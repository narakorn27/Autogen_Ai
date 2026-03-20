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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'GENERATE') {
        processGeneration(message)
            .then(() => sendResponse({ success: true }))
            .catch((err) => {
                console.error('Arin Error:', err.message);
                const needRefresh = err.message.includes('SERVER_ERROR');
                sendResponse({ success: false, error: err.message, needRefresh });
            });
        return true;
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

    // 2. Apply Aspect Ratio (If Image mode)
    if (mode === 'Create Image' && settings?.aspectRatio) {
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

// ─── Set Generation Mode ───
const setGenerationMode = async (targetModeText) => {
    // 1. Check current mode (ถ้ามี indicator)
    const modeIndicator = document.querySelector('.mode-select-current-mode-name');
    if (modeIndicator && modeIndicator.textContent.includes(targetModeText)) return;

    // 2. หา trigger ที่ถูกต้องจาก HTML จริง
    const trigger = document.querySelector('.mode-select .ant-dropdown-trigger');
    if (!trigger) throw new Error('ไม่พบปุ่มเปลี่ยนโหมด (.mode-select .ant-dropdown-trigger)');

    await humanClick(trigger);
    await humanSleep(500, 800); // รอ dropdown animate

    // 3. รอ dropdown item — ลอง selector หลายแบบ
    const SELECTORS = [
        '.mode-select-common-item',
        '.ant-dropdown-menu-item',
        '.ant-dropdown li',
        '[class*="menu-item"]',
        '.ant-select-item-option'
    ];

    let dropdownItem = null;
    const deadline = Date.now() + 4000;

    while (!dropdownItem && Date.now() < deadline) {
        for (const sel of SELECTORS) {
            const items = Array.from(document.querySelectorAll(sel));
            dropdownItem = items.find(el =>
                el.offsetWidth > 0 && el.textContent.includes(targetModeText)
            );
            if (dropdownItem) break;
        }
        if (!dropdownItem) await sleep(300);
    }

    if (!dropdownItem) {
        // Debug: dump ทุก li/item ที่เห็นอยู่ในหน้า
        const allItems = Array.from(document.querySelectorAll(
            '.ant-dropdown li, .ant-dropdown [class*="item"], [class*="dropdown"] li'
        ));
        console.warn('Arin: dropdown items found:', allItems.map(el => el.className + ' | ' + el.textContent.trim()));
        document.body.click();
        throw new Error(`ไม่พบตัวเลือก "${targetModeText}" — ดู console สำหรับ items ที่มีอยู่จริง`);
    }

    if (dropdownItem.classList.contains('ant-dropdown-menu-item-disabled') || dropdownItem.classList.contains('ant-select-item-option-disabled')) {
        document.body.click();
        throw new Error(`โหมด "${targetModeText}" ถูก disabled ในบัญชีของคุณ`);
    }

    await humanClick(dropdownItem);
    await humanSleep(800, 1200);
};

// ─── Set Aspect Ratio ───
const setAspectRatio = async (ratio) => { // e.g., "16:9" or "9:16"
    // Find the ratio dropdown trigger near the input area
    const inputArea = document.querySelector('.message-input-textarea')?.closest('.chat-input') || document.body;
    
    // Search for a dropdown trigger that contains ratio text like "16:9"
    // Usually it's an ant-dropdown-trigger
    const triggers = Array.from(document.querySelectorAll('.ant-dropdown-trigger'));
    const ratioTrigger = triggers.find(t => t.textContent.includes(':') && (t.textContent.includes('16:9') || t.textContent.includes('9:16') || t.textContent.includes('1:1')));

    if (!ratioTrigger) return; // Might not exist if not in Image mode
    
    if (ratioTrigger.textContent.includes(ratio)) return; // Already set

    await humanClick(ratioTrigger);
    await humanSleep(300, 600);

    // Find the option in the opened dropdown menu
    const menuItems = Array.from(document.querySelectorAll('.ant-dropdown-menu-item'));
    const targetItem = menuItems.find(item => item.textContent.includes(ratio));

    if (targetItem) {
        await humanClick(targetItem);
    } else {
        document.body.click(); // Close if not found
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
    let started = false;
    
    // Qwen appends new messages to the chat history.
    // We count existing media elements to detect when new ones appear.
    const getMediaElements = () => {
        if (mode === 'Create Video') return Array.from(document.querySelectorAll('.chat-bubble video'));
        return Array.from(document.querySelectorAll('.chat-bubble img.image-preview-image, .chat-bubble img[src^="http"]'));
    };

    const initialMediaCount = getMediaElements().length;

    while (Date.now() - start < timeout) {
        const bodyText = document.body.innerText;
        
        // Error detection
        if (bodyText.includes('rate limit') || bodyText.includes('daily limit') || bodyText.includes('has been exhausted')) throw new Error('DAILY_LIMIT');
        if (bodyText.includes('Something went wrong') || bodyText.includes('Failed to generate')) throw new Error('SERVER_ERROR');

        // Check for new media
        const currentMediaElements = getMediaElements();
        
        if (currentMediaElements.length > initialMediaCount) {
            // New media found. Get the last one.
            const newMedia = currentMediaElements[currentMediaElements.length - 1];
            if (newMedia && newMedia.src) {
                // Wait a bit to ensure the source is fully loaded (especially for videos)
                await sleep(2000);
                return newMedia.src;
            }
        }
        
        // 1. Try to read real progress % from the latest UI bubble
        let realPct = null;
        const chatBubbles = document.querySelectorAll('.chat-bubble, .message-content, [class*="message"]');
        if (chatBubbles.length > 0) {
            // Check the last 1-2 bubbles
            for (let i = Math.max(0, chatBubbles.length - 2); i < chatBubbles.length; i++) {
                const pctMatch = chatBubbles[i].innerText.match(/(\d+)%/);
                if (pctMatch && parseInt(pctMatch[1]) > 0 && parseInt(pctMatch[1]) <= 100) {
                    realPct = parseInt(pctMatch[1]);
                }
            }
        }

        if (Date.now() - start > 3000) {
            started = true;
            if (realPct !== null) {
                // Use real percent parsed from screen
                sendProgress(promptId, Math.min(99, realPct), 'running');
            } else {
                // Fallback: Progress simulation
                let fakePct = Math.min(95, 10 + Math.floor((Date.now() - start) / 3000));
                sendProgress(promptId, fakePct, 'running');
            }
        }

        await sleep(1500);
    }

    throw new Error('หมดเวลา Generation (Timeout)');
};
