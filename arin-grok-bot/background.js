// --- Background Service Worker ---

let queue = [];
let isRunning = false;

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.storage.local.get('botState', (data) => {
    if (data.botState && data.botState.queue) {
        queue = data.botState.queue.map(item => {
            if (item.status === 'running' || item.status === 'typing' || item.status === 'submitting') {
                return { ...item, status: 'pending', percent: 0 };
            }
            return item;
        });
        broadcastQueue();
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'START_QUEUE') {
        const newItems = message.items.map((item, index) => ({
            id: Date.now() + index,
            prompt: item.prompt,
            images: item.images || [],
            mode: message.mode,
            status: 'pending',
            percent: 0,
            retryCount: 0,
            error: null
        }));
        queue = [...queue, ...newItems];
        broadcastQueue();
        if (!isRunning) processQueue();

    } else if (message.action === 'CLEAR_QUEUE') {
        queue = [];
        isRunning = false;
        broadcastQueue();

    } else if (message.action === 'PROGRESS_UPDATE') {
        const item = queue.find(q => q.id === message.promptId);
        if (item) {
            item.percent = message.percent;
            item.status = message.status === 'completed' ? 'completed' : 'running';
            broadcastQueue();
        }

    } else if (message.action === 'ENHANCE_PROMPT_PREVIEW') {
        const provider = message.provider || 'gemini';
        enhanceWithAI(message.prompt, message.apiKey, message.vibe, provider)
            .then(enhanced => sendResponse({ success: true, enhanced }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;

    } else if (message.action === 'CHECK_API_KEY') {
        checkApiKey(message.apiKey, message.provider || 'gemini')
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;

    } else if (message.action === 'PAUSE_QUEUE') {
        isRunning = false;
        broadcastQueue();
    } else if (message.action === 'RESUME_QUEUE') {
        if (!isRunning) processQueue();
    } else if (message.action === 'RETRY_FAILED') {
        queue.filter(q => q.status === 'failed').forEach(q => {
            q.status = 'pending';
            q.retryCount = 0;
            q.error = null;
        });
        broadcastQueue();
        if (!isRunning) processQueue();

    } else if (message.action === 'DOWNLOAD_RESULT') {
        handleDownload(message);
    }
});

// ─── Download Handler: รองรับทั้ง blob URL, data URL, และ https URL ───
const handleDownload = (message) => {
    const { url, filename, folder } = message;
    const fullFilename = folder ? `${folder}/${filename}` : filename;

    if (!url) {
        console.error('Arin BG: No URL to download');
        return;
    }

    // data: URL — chrome.downloads รองรับ data URL โดยตรง (แต่มี limit ~2MB บางเวอร์ชัน)
    // blob: URL — ใช้ได้เฉพาะใน context ที่ create มัน (content script) ดังนั้นจะไม่มาถึงนี้
    // https: URL — ดาวน์โหลดปกติ
    try {
        chrome.downloads.download({
            url: url,
            filename: fullFilename,
            conflictAction: 'uniquify',
            saveAs: false  // ไม่ถามทุกครั้ง — auto save
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error('Arin BG: Download failed:', chrome.runtime.lastError.message);
            } else {
                console.log('Arin BG: Download started, ID:', downloadId, 'File:', fullFilename);
            }
        });
    } catch (e) {
        console.error('Arin BG: Download exception:', e.message);
    }
};

const broadcastQueue = () => {
    chrome.runtime.sendMessage({ action: 'QUEUE_UPDATED', queue }).catch(() => { });
    chrome.storage.local.get('botState', (data) => {
        if (data.botState) {
            data.botState.queue = queue;
            chrome.storage.local.set({ botState: data.botState });
        }
    });
};

const processQueue = async () => {
    if (queue.length === 0) { isRunning = false; return; }

    isRunning = true;
    const concurrentCount = 1; // บังคับให้รันทีละ 1 คิวเสมอ เพื่อไม่ให้หน้าเว็บรวน

    const pendingItems = queue.filter(item => item.status === 'pending');
    if (pendingItems.length === 0) {
        if (queue.filter(item => item.status === 'running').length === 0) isRunning = false;
        return;
    }

    const runningCount = queue.filter(item => item.status === 'running').length;
    const slotsAvailable = concurrentCount - runningCount;
    if (slotsAvailable > 0) pendingItems.slice(0, slotsAvailable).forEach(item => runItem(item));
};

const runItem = async (item) => {
    item.status = 'running';
    item.percent = item.percent || 0;
    item.error = null;
    item.retryCount = item.retryCount || 0;
    broadcastQueue();

    const data = await chrome.storage.local.get('botState');
    const maxRetries = 3;

    try {
        let finalPrompt = item.prompt;

        const control = data.botState.control || {};
        if (control.aiEnhance && data.botState.settings?.apiKey) {
            try {
                finalPrompt = await enhanceWithAI(
                    item.prompt,
                    data.botState.settings.apiKey,
                    data.botState.settings.defaultVibe,
                    data.botState.settings.aiProvider || 'gemini'
                );
            } catch (e) {
                console.error('AI Enhance failed, using original:', e.message);
            }
        }

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];

        if (!activeTab || !activeTab.url.includes('grok.com')) {
            throw new Error('[OFF_SITE] กรุณาสลับไปที่หน้า Grok');
        }

        const settings = {
            ...data.botState.settings,
            autoDownload: control.autoDownload !== false,
            autoRename: control.autoRename !== false,
            saveFolder: control.saveFolder,
            outputsPerPrompt: control.outputsPerPrompt
        };

        const response = await chrome.tabs.sendMessage(activeTab.id, {
            action: 'GENERATE',
            prompt: finalPrompt,
            promptId: item.id,
            mode: item.mode,
            settings,
            images: item.images || []
        });

        if (response && response.success) {
            item.status = 'completed';
            item.percent = 100;
        } else {
            if (response && response.needRefresh) {
                try { await chrome.tabs.reload(activeTab.id); } catch (e) { console.warn(e); }
            }
            throw new Error(response ? response.error : 'ได้รับคำตอบผิดพลาดจากหน้าเว็บ');
        }
    } catch (err) {
        const errMsg = err.message || '';
        console.error('Arin: Item failed:', errMsg);

        if (errMsg.includes('[DAILY_LIMIT]')) {
            item.status = 'failed';
            item.error = 'ขีดจำกัดรายวันเต็ม หยุดคิวอัตโนมัติ';
            isRunning = false;
        } else if (item.retryCount < maxRetries && !errMsg.includes('[OFF_SITE]')) {
            item.retryCount++;
            item.status = 'pending';
            const waitTime = 10000;
            item.error = `Retry ${item.retryCount}/${maxRetries} (รอ 10 วิ)`;
            setTimeout(() => { processQueue(); }, waitTime);
        } else {
            item.status = 'failed';
            item.error = errMsg.replace(/\[.*?\]\s*/, '');
        }
    }

    broadcastQueue();

    // หน่วงเวลาแบบสุ่ม 3 - 8 วินาที ก่อนรันคิวถัดไป เพื่อป้องกัน Rate Limit จาก Google Flow
    const delay = Math.floor(Math.random() * (8 - 3 + 1) + 3) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    processQueue();
};

const parseErrorMessage = (data, provider) => {
    if (provider === 'gemini') {
        return data.error?.message || 'Gemini API request failed';
    }
    return (
        data.error?.message ||
        data.error?.metadata?.reasons?.[0] ||
        (Array.isArray(data.error) ? data.error[0]?.message : null) ||
        'API request failed'
    );
};

const OPENROUTER_ENHANCE_MODELS = [
    'google/gemma-3-12b-it:free',
    'meta-llama/llama-4-scout:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
];

const checkApiKey = async (apiKey, provider) => {
    let url = '';
    let body = {};
    let headers = { 'Content-Type': 'application/json' };

    if (provider === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        body = { contents: [{ parts: [{ text: 'hi' }] }] };
    } else if (provider === 'groq') {
        url = 'https://api.groq.com/openai/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = { messages: [{ role: 'user', content: 'hi' }], model: 'llama-3.3-70b-versatile' };
    } else if (provider === 'openrouter') {
        url = 'https://openrouter.ai/api/v1/auth/key';
        headers['Authorization'] = `Bearer ${apiKey}`;
        const res = await fetch(url, { method: 'GET', headers });
        const data = await res.json();
        if (!res.ok || data.error) {
            throw new Error(data.error?.message || 'Invalid OpenRouter API key');
        }
        return true;
    }

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(parseErrorMessage(data, provider));
    return true;
};

const enhanceWithAI = async (prompt, apiKey, vibe, provider) => {
    const systemInstruction = `You are a professional AI Prompt Engineer for masterpiece-level image and video generation (specializing in models like VEO, Sora, Kling, and Imagen 3).
    Your goal is to transform a simple (often culturally-specific) user input into a highly detailed English prompt.
    
    CORE REQUIREMENTS:
    1. Output ONLY the final enhanced prompt. No chatting, no quotes, no preamble.
    2. LANGUAGE: Always output in English.
    3. CULTURAL CONTEXT: If input mentions specific Thai culture (e.g., "วัยรุ่นทรงเอ", "เด็กแว้น"), transform them into visual descriptions: Thai street-style youth, specific fashion (tight shirts, tattoos, slick hair), specific demeanor, and setting (customized pickup trucks, neon lights).
    4. STRUCTURE: Use a mix of prose and structured "JSON-like" keywords (e.g., {subject: ..., setting: ..., lighting: ...}) if it creates a longer, more professional prompt.
    5. VISUALS: Cinematic lighting (volumetric, ray-tracing), camera (anamorphic, 8k, f/1.4), and hyper-realistic physics.
    6. VIBE: Match the requested style: ${vibe || 'cinematic'}.
    
    Input: "${prompt}"`;

    let url = '';
    let body = {};
    let headers = { 'Content-Type': 'application/json' };

    if (provider === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        body = { contents: [{ parts: [{ text: systemInstruction }] }] };
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(parseErrorMessage(data, 'gemini'));
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!result) throw new Error('Invalid response from Gemini');
        return result.trim();

    } else if (provider === 'groq') {
        url = 'https://api.groq.com/openai/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = { messages: [{ role: 'user', content: systemInstruction }], model: 'llama-3.3-70b-versatile' };
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(parseErrorMessage(data, 'groq'));
        const result = data.choices?.[0]?.message?.content;
        if (!result) throw new Error('Invalid response from Groq');
        return result.trim();

    } else if (provider === 'openrouter') {
        url = 'https://openrouter.ai/api/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['HTTP-Referer'] = 'https://grok.com/imagine';
        headers['X-Title'] = 'Arin Grok Bot';

        let lastError = null;
        for (const model of OPENROUTER_ENHANCE_MODELS) {
            try {
                body = { messages: [{ role: 'user', content: systemInstruction }], model, max_tokens: 1000 };
                const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) { lastError = new Error(parseErrorMessage(data, 'openrouter')); continue; }
                const result = data.choices?.[0]?.message?.content;
                if (!result) { lastError = new Error(`Empty response from model: ${model}`); continue; }
                return result.trim();
            } catch (e) {
                lastError = e;
            }
        }
        throw lastError || new Error('All OpenRouter models failed');
    }

    throw new Error(`Unknown provider: ${provider}`);
};