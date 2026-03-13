// --- Background Service Worker ---

let queue = [];
let isRunning = false;

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'START_QUEUE') {
        const newItems = message.prompts.map((p, index) => ({
            id: Date.now() + index,
            prompt: p,
            mode: message.mode,
            status: 'pending',
            percent: 0,
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

    } else if (message.action === 'DOWNLOAD_RESULT') {
        chrome.downloads.download({
            url: message.url,
            filename: `${message.folder}/${message.filename}`,
            conflictAction: 'uniquify',
            saveAs: true
        });
    }
});

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
    const data = await chrome.storage.local.get('botState');
    const concurrentCount = data.botState?.control.concurrentPrompts || 1;

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
    item.percent = 0;
    item.error = null;
    broadcastQueue();

    const data = await chrome.storage.local.get('botState');
    const { delayMin, delayMax } = data.botState.control;

    try {
        let finalPrompt = item.prompt;

        if (data.botState.settings?.aiEnhance && data.botState.settings?.apiKey) {
            console.log('Enhancing prompt with AI...');
            try {
                finalPrompt = await enhanceWithAI(
                    item.prompt,
                    data.botState.settings.apiKey,
                    data.botState.settings.defaultVibe,
                    data.botState.settings.aiProvider || 'gemini'
                );
                console.log('Enhanced:', finalPrompt);
            } catch (e) {
                console.error('AI Enhance failed, using original:', e.message);
            }
        }

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];

        if (!activeTab || !activeTab.url.includes('labs.google/fx/')) {
            item.status = 'failed';
            item.error = 'กรุณาสลับไปที่หน้า Google Flow ก่อนเริ่มรัน';
            broadcastQueue();
            processQueue();
            return;
        }

        const activeImageData = await chrome.storage.local.get('activeImage');

        const response = await chrome.tabs.sendMessage(activeTab.id, {
            action: 'GENERATE',
            prompt: finalPrompt,
            promptId: item.id,
            mode: item.mode,
            settings: data.botState.settings,
            image: (item.mode === 'frame_to_video') ? activeImageData.activeImage : null
        });

        if (response && response.success) {
            item.status = 'completed';
            item.percent = 100;
        } else {
            item.status = 'failed';
            item.error = response ? response.error : 'ได้รับคำตอบผิดพลาดจากหน้าเว็บ';
        }
    } catch (err) {
        item.status = 'failed';
        item.error = 'การเชื่อมต่อผิดพลาด (ลอง Refresh หน้าเว็บแล้วรันใหม่)';
    }

    broadcastQueue();

    const delay = Math.floor(Math.random() * (delayMax - delayMin + 1) + delayMin) * 1000;
    console.log(`Waiting ${delay}ms before next prompt...`);
    await new Promise(resolve => setTimeout(resolve, delay));

    processQueue();
};

// ✅ FIX: แยก helper สำหรับดึง error message จาก OpenRouter/Groq/Gemini
const parseErrorMessage = (data, provider) => {
    if (provider === 'gemini') {
        return data.error?.message || 'Gemini API request failed';
    }
    // OpenRouter และ Groq ใช้ format เดียวกัน แต่ OpenRouter มี nested errors เพิ่ม
    return (
        data.error?.message ||
        data.error?.metadata?.reasons?.[0] ||
        (Array.isArray(data.error) ? data.error[0]?.message : null) ||
        'API request failed'
    );
};

// ✅ FIX: OpenRouter free models ที่ active อยู่ปัจจุบัน (มี fallback)
const OPENROUTER_CHECK_MODEL = 'google/gemma-3-4b-it:free';
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
        // ✅ FIX: ใช้ /auth/key endpoint แทน — ตรวจ key โดยตรงโดยไม่เสีย quota
        url = 'https://openrouter.ai/api/v1/auth/key';
        headers['Authorization'] = `Bearer ${apiKey}`;

        const res = await fetch(url, { method: 'GET', headers });
        const data = await res.json();

        if (!res.ok || data.error) {
            const msg = data.error?.message || 'Invalid OpenRouter API key';
            throw new Error(msg);
        }
        // data.data.label จะมีชื่อ key ถ้า valid
        return true;
    }

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(parseErrorMessage(data, provider));
    }
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
        // ✅ FIX: ลอง model ตามลำดับ fallback จนกว่าจะสำเร็จ
        url = 'https://openrouter.ai/api/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['HTTP-Referer'] = 'https://labs.google/fx/';
        headers['X-Title'] = 'Arin Auto Bot';

        let lastError = null;

        for (const model of OPENROUTER_ENHANCE_MODELS) {
            try {
                body = {
                    messages: [{ role: 'user', content: systemInstruction }],
                    model,
                    max_tokens: 1000,
                };

                const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();

                if (!res.ok) {
                    const msg = parseErrorMessage(data, 'openrouter');
                    console.warn(`OpenRouter model ${model} failed: ${msg}`);
                    lastError = new Error(msg);
                    continue; // ลอง model ถัดไป
                }

                const result = data.choices?.[0]?.message?.content;
                if (!result) {
                    lastError = new Error(`Empty response from model: ${model}`);
                    continue;
                }

                console.log(`OpenRouter success with model: ${model}`);
                return result.trim();

            } catch (e) {
                lastError = e;
                console.warn(`OpenRouter model ${model} exception:`, e.message);
            }
        }

        // ถ้าทุก model fail
        throw lastError || new Error('All OpenRouter models failed');
    }

    throw new Error(`Unknown provider: ${provider}`);
};