// --- Content Script: Arin Grok Bot ---
console.log('Arin Grok Bot: Content Script Loaded');

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
    const { prompt, promptId, mode, settings, image } = data;

    if (!window.location.href.includes('grok.com')) {
        throw new Error('คุณไม่ได้อยู่ในหน้า Grok');
    }

    const tiptap = await waitForElement('div.tiptap.ProseMirror', 8000);
    if (!tiptap) throw new Error('ไม่พบช่องกรอก Prompt (TipTap editor)');

    tiptap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await humanSleep(300, 600);
    sendProgress(promptId, 0, 'typing');

    // 1. Upload Image (If any)
    if (image) {
        try { await handleImageUpload(image); }
        catch (e) { throw new Error('อัปโหลดรูปภาพไม่สำเร็จ: ' + e.message); }
    }

    // 2. Apply Settings (Video toggle, details)
    try { await applySettings(settings); } catch (e) { console.warn('Apply Settings failed:', e.message); }

    await humanSleep(300, 700);
    tiptap.focus();
    await humanSleep(400, 900);

    // 3. Type Prompt
    try {
        tiptap.innerHTML = ''; // clear first
        document.execCommand('insertText', false, prompt);
    } catch(e) {
        // Fallback
        tiptap.textContent = prompt;
        tiptap.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    await humanSleep(800, 1500);

    const inserted = tiptap.textContent?.trim();
    if (!inserted || inserted.length === 0) throw new Error('ไม่สามารถกรอก Prompt ลงใน editor ได้');

    sendProgress(promptId, 2, 'submitting');

    const submitTimestamp = Date.now();

    const submitBtn = document.querySelector('button[aria-label="Submit"]');
    if (!submitBtn) throw new Error('ไม่พบปุ่ม Submit');

    await humanClick(submitBtn);

    // 4. Wait for generation
    const resultUrl = await waitForGeneration(promptId, 180000, submitTimestamp);
    sendProgress(promptId, 100, 'completed');

    // 5. Download
    if (settings?.autoDownload !== false && resultUrl) {
        try { await handleAutoDownload(prompt, settings, resultUrl); }
        catch (e) { console.warn('Auto Download Failed:', e.message); }
    }

    return true;
};

// ─── Auto Download ───
const handleAutoDownload = async (prompt, settings, url) => {
    const folder = settings?.saveFolder?.trim() || 'arin-grok-bot';
    const baseName = settings?.autoRename !== false ? sanitizeFilename(prompt) : `grok_${Date.now()}`;
    const ext = url.includes('.mp4') || url.startsWith('blob:') ? '.mp4' : '.jpg'; // Assumes mp4 by default for video
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

// ─── Apply Settings ───
const applySettings = async (settings) => {
    if (!settings) return;
    const shortDelay = () => humanSleep(150, 350);

    // Click Video Toggle
    const videoBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Video');
    if (videoBtn && videoBtn.getAttribute('aria-checked') !== 'true') {
        await humanClick(videoBtn);
        await shortDelay();
    }

    // Wait a brief moment for settings row to render
    await sleep(300);

    // Apply Resolution
    if (settings.resolution) {
        const resBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === settings.resolution);
        if (resBtn && resBtn.getAttribute('aria-checked') !== 'true') {
            await humanClick(resBtn);
            await shortDelay();
        }
    }

    // Apply Duration
    if (settings.duration) {
        let dur = settings.duration; // "6s" or "10s"
        const durBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === dur);
        if (durBtn && durBtn.getAttribute('aria-checked') !== 'true') {
            await humanClick(durBtn);
            await shortDelay();
        }
    }

    // Apply Ratio (It's a dropdown in Grok)
    if (settings.aspectRatio) {
        const ratioBtn = document.querySelector('button[aria-label="Aspect Ratio"]');
        if (ratioBtn && !ratioBtn.textContent.includes(settings.aspectRatio)) {
            await humanClick(ratioBtn);
            await shortDelay();
            
            // Find option in menu
            const menuOption = Array.from(document.querySelectorAll('div[role="menuitem"], button[role="menuitem"]'))
                .find(item => item.textContent.includes(settings.aspectRatio));
                
            if (menuOption) {
                await humanClick(menuOption);
                await shortDelay();
            } else {
                // close menu if not found
                document.body.click(); 
            }
        }
    }
};

// ─── Image Upload ───
const handleImageUpload = async (base64) => {
    if (!base64) return;
    
    // In Grok, the file input is name="files" and supports multiple
    const fileInput = document.querySelector('input[type="file"][name="files"]');
    
    if (!fileInput) {
        // Fallback: click attach button to summon input if needed (usually it's already in DOM)
        const attachBtn = document.querySelector('button[aria-label="Attach"]');
        if (attachBtn) {
            await humanClick(attachBtn);
            await sleep(500);
        }
    }

    const targetInput = document.querySelector('input[type="file"][name="files"]');
    if (!targetInput) throw new Error('ไม่พบช่องอัปโหลดไฟล์ของ Grok');

    const res = await fetch(base64);
    const blob = await res.blob();
    const file = new File([blob], `ref_${Date.now()}.jpg`, { type: blob.type });
    const dt = new DataTransfer();
    dt.items.add(file);
    
    targetInput.files = dt.files;
    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    // wait for upload UI to appear
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

// ─── Wait for Generation ───
const waitForGeneration = async (promptId, timeout = 180000, startTimestamp = Date.now()) => {
    const start = Date.now();
    let started = false;
    
    // We will look for new videos added to the DOM after startTimestamp
    const getNewestVideo = () => {
        const videos = Array.from(document.querySelectorAll('video'));
        // We could filter by attributes if necessary, but returning the last one usually works
        return videos.length > 0 ? videos[videos.length - 1] : null;
    };
    
    const initialVideosCount = document.querySelectorAll('video').length;

    while (Date.now() - start < timeout) {
        const bodyText = document.body.innerText;
        
        // Error detection during generation
        if (bodyText.includes('rate limit') || bodyText.includes('daily limit')) throw new Error('DAILY_LIMIT');
        if (bodyText.includes('Something went wrong')) throw new Error('SERVER_ERROR');

        // Check if generation finished by detecting a new video
        const currentVideosCount = document.querySelectorAll('video').length;
        if (currentVideosCount > initialVideosCount) {
            const vid = getNewestVideo();
            if (vid && vid.src) {
                return vid.src; // Return URL for download
            }
        }
        
        // Progress simulation since Grok might not show exact %
        if (Date.now() - start > 5000) {
            started = true;
            // Fake progress from 10 to 90
            let fakePct = Math.min(95, 10 + Math.floor((Date.now() - start) / 2000));
            sendProgress(promptId, fakePct, 'running');
        }

        await sleep(1000);
    }

    throw new Error('หมดเวลา Generation (Timeout)');
};