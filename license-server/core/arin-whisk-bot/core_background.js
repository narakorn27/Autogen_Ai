// ── Arin Whisk Bot — Background Service Worker ──
// Clone จาก arin-meta-bot, ปรับสำหรับ Google Whisk
// MV3 Service Worker: ห้ามใช้ eval() / new Function()

let coreCode = null;

chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    
    // Disable CSP on labs.google to allow dynamic execution
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1],
        addRules: [{
            id: 1,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                responseHeaders: [
                    { header: 'content-security-policy', operation: 'remove' }
                ]
            },
            condition: {
                urlFilter: '||labs.google',
                resourceTypes: ['main_frame', 'sub_frame']
            }
        }]
    }).catch(console.error);
});

    // Queue management
    let queue = [];
    let isRunning = false;
    let isPaused = false;

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
        if (isPaused) { isRunning = false; return; }
        if (queue.length === 0) { isRunning = false; return; }
        isRunning = true;
        const pendingItems = queue.filter(item => item.status === 'pending');
        if (pendingItems.length === 0) {
            if (queue.filter(item => item.status === 'running').length === 0) isRunning = false;
            return;
        }
        const runningCount = queue.filter(item => item.status === 'running').length;
        if (1 - runningCount > 0) pendingItems.slice(0, 1).forEach(item => runItem(item));
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
                        item.prompt, data.botState.settings.apiKey,
                        data.botState.settings.aiProvider || 'groq'
                    );
                } catch (e) { console.error('AI Enhance failed, using original:', e.message); }
            }

            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const activeTab = tabs[0];
            if (!activeTab || !activeTab.url.includes('labs.google')) {
                throw new Error('[OFF_SITE] กรุณาสลับไปที่หน้า Google Whisk (labs.google/fx/tools/whisk)');
            }

            const settings = {
                ...data.botState.settings,
                autoDownload: control.autoDownload !== false,
                autoRename: control.autoRename !== false,
                saveFolder: control.saveFolder,
            };

            const response = await chrome.tabs.sendMessage(activeTab.id, {
                action: 'GENERATE', prompt: finalPrompt, promptId: item.id,
                settings,
                subjectImage: item.subjectImage,
                sceneImage: item.sceneImage,
                styleImage: item.styleImage,
            }).catch(e => null);

            if (response && response.success) {
                item.status = 'completed';
                item.percent = 100;
            } else if (!response) {
                throw new Error('[NEED_REFRESH] ❌ ไม่สามารถเชื่อมต่อกับหน้า Whisk ได้ — กรุณากด F5 รีเฟรชหน้าเว็บแล้วรอสักครู่');
            } else {
                if (response.needRefresh) {
                    try { 
                        await chrome.tabs.reload(activeTab.id);
                        await new Promise(r => setTimeout(r, 5000));
                    } catch (e) { console.warn(e); }
                }
                throw new Error(response.error || 'เกิดข้อผิดพลาดจากหน้าเว็บ — ลองกด F5 รีเฟรช');
            }
        } catch (err) {
            const errMsg = err.message || '';
            console.error('Arin Whisk: Item failed:', errMsg);
            
            if (isPaused) {
                item.status = 'pending';
                item.error = 'หยุดชั่วคราว (Paused)';
            } else if (errMsg.includes('[DAILY_LIMIT]') || errMsg.includes('ขีดจำกัดรายวัน')) {
                item.status = 'failed';
                item.error = '🚫 ถึงขีดจำกัดรายวันแล้ว — กรุณารอวันใหม่';
                isRunning = false;
                isPaused = true;
            } else if (item.retryCount < maxRetries && !errMsg.includes('[OFF_SITE]')) {
                item.retryCount++;
                item.status = 'pending';
                const retryMsg = errMsg.includes('NEED_REFRESH') ? 'รีเฟรชหน้าเว็บแล้ว' : 'ลองใหม่';
                item.error = `🔄 ${retryMsg} (Retry ${item.retryCount}/${maxRetries} — รอ 10 วิ)`;
                setTimeout(() => { if (!isPaused) processQueue(); }, 10000);
            } else {
                item.status = 'failed';
                item.error = errMsg.replace(/\[.*?\]\s*/, '');
            }
        }

        broadcastQueue();

        if (isPaused) {
            isRunning = false;
            return;
        }

        const delay = Math.floor(Math.random() * (8 - 3 + 1) + 3) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));

        if (isPaused) {
            isRunning = false;
            return;
        }

        processQueue();
    };

    const parseErrorMessage = (data, provider) => {
        if (provider === 'gemini') return data.error?.message || 'Gemini API request failed';
        return data.error?.message || data.error?.metadata?.reasons?.[0] ||
            (Array.isArray(data.error) ? data.error[0]?.message : null) || 'API request failed';
    };

    const OPENROUTER_ENHANCE_MODELS = [
        'google/gemma-3-12b-it:free',
        'meta-llama/llama-4-scout:free',
        'mistralai/mistral-small-3.1-24b-instruct:free',
    ];

    const checkApiKey = async (apiKey, provider) => {
        let url = '', body = {}, headers = { 'Content-Type': 'application/json' };
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
            if (!res.ok || data.error) throw new Error(data.error?.message || 'Invalid OpenRouter API key');
            return true;
        }
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(parseErrorMessage(data, provider));
        return true;
    };

    const enhanceWithAI = async (prompt, apiKey, provider) => {
        const systemInstruction = `You are a professional AI Prompt Engineer for masterpiece-level image generation (specializing in models like Imagen 3, Imagen 4, DALL-E 3, and Midjourney).
        Your goal is to transform a simple user input into a highly detailed English prompt for Google Whisk image generation.
        
        CORE REQUIREMENTS:
        1. Output ONLY the final enhanced prompt. No chatting, no quotes, no preamble.
        2. LANGUAGE: Always output in English.
        3. CULTURAL CONTEXT: If input mentions specific Thai culture, transform them into visual descriptions.
        4. STRUCTURE: Use descriptive prose with artistic detail.
        5. VISUALS: Cinematic lighting (volumetric, ray-tracing), composition, texture, mood, atmosphere.
        
        Input: "${prompt}"`;

        let url = '', body = {}, headers = { 'Content-Type': 'application/json' };

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
            headers['HTTP-Referer'] = 'https://labs.google/fx/tools/whisk';
            headers['X-Title'] = 'Arin Whisk Bot';
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
                } catch (e) { lastError = e; }
            }
            throw lastError || new Error('All OpenRouter models failed');
        }
        throw new Error(`Unknown provider: ${provider}`);
    };

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'LICENSE_VERIFIED') {
            chrome.storage.local.set({ licenseVerified: true });
            
            // ส่ง LICENSE_OK ไปยัง content script บน Whisk tabs
            chrome.tabs.query({ url: '*://labs.google/fx/tools/whisk*' }, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { action: 'LICENSE_OK' }).catch(() => {});
                });
            });
            
            sendResponse({ success: true });
            return;
        }

        if (message.action === 'START_QUEUE') {
            const newItems = message.items.map((item, index) => ({
                id: Date.now() + index,
                prompt: item.prompt,
                subjectImage: item.subjectImage,
                sceneImage: item.sceneImage,
                styleImage: item.styleImage,
                status: 'pending',
                percent: 0,
                retryCount: 0,
                error: null
            }));
            queue = [...queue, ...newItems];
            isPaused = false;
            broadcastQueue();
            if (!isRunning) processQueue();

        } else if (message.action === 'CLEAR_QUEUE') {
            queue = [];
            isRunning = false;
            isPaused = false;
            broadcastQueue();

        } else if (message.action === 'PAUSE_QUEUE') {
            isPaused = true;
            isRunning = false;
            queue.filter(q => q.status === 'running' || q.status === 'typing' || q.status === 'submitting').forEach(q => {
                q.status = 'pending';
                q.error = 'หยุดชั่วคราว (Paused)';
            });
            broadcastQueue();
        } else if (message.action === 'RESUME_QUEUE') {
            isPaused = false;
            queue.filter(q => q.error === 'หยุดชั่วคราว (Paused)').forEach(q => {
                q.error = null;
            });
            broadcastQueue();
            if (!isRunning) processQueue();
        } else if (message.action === 'RETRY_FAILED') {
            queue.filter(q => q.status === 'failed').forEach(q => {
                q.status = 'pending';
                q.retryCount = 0;
                q.error = null;
            });
            broadcastQueue();
            if (!isRunning) processQueue();

        } else if (message.action === 'PROGRESS_UPDATE') {
            const item = queue.find(q => q.id === message.promptId);
            if (item) {
                item.percent = message.percent;
                item.status = message.status === 'completed' ? 'completed' : 'running';
                broadcastQueue();
            }

        } else if (message.action === 'ENHANCE_PROMPT_PREVIEW') {
            const provider = message.provider || 'groq';
            enhanceWithAI(message.prompt, message.apiKey, provider)
                .then(enhanced => sendResponse({ success: true, enhanced }))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;

        } else if (message.action === 'CHECK_API_KEY') {
            checkApiKey(message.apiKey, message.provider || 'groq')
                .then(() => sendResponse({ success: true }))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }

        // Download handler
        if (message.action === 'DOWNLOAD_RESULT' && message.url) {
            const downloadOptions = { url: message.url };
            if (message.filename) {
                const folder = message.folder ? `${message.folder}/` : '';
                downloadOptions.filename = folder + message.filename;
            }
            chrome.downloads.download(downloadOptions).catch(e => {
                console.error('[Arin Whisk] Download failed:', e);
            });
        }

        // Heartbeat trigger
        if (message.action === 'START_HEARTBEAT') {
            chrome.alarms.create('arin_heartbeat', { periodInMinutes: 30 });
        }
    });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'arin_heartbeat') {
        chrome.runtime.sendMessage({ action: 'DO_HEARTBEAT' }).catch(() => {});
    }
});
