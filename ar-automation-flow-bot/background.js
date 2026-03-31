// ═══════════════════════════════════════════════════════════
// AR Automation Flow Bot — Background Service Worker v1.0
// Source: arin-flow-ext (queue/AI) + arin-ex-autoflow (tab mgmt)
// ═══════════════════════════════════════════════════════════
'use strict';

// ─── Setup ───
chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1],
        addRules: [{
            id: 1, priority: 1,
            action: { type: 'modifyHeaders', responseHeaders: [{ header: 'content-security-policy', operation: 'remove' }] },
            condition: { urlFilter: '||labs.google', resourceTypes: ['main_frame', 'sub_frame'] }
        }]
    }).catch(console.error);
    log('Extension ติดตั้งแล้ว ✅', 'success');
});

// ─── State ───
let queue = [];
let isRunning = false;
let isPaused = false;
let aiKeyInvalid = false;

// ─── Logging ───
const log = (text, level = 'info') => {
    const ts = new Date().toLocaleTimeString('th-TH');
    console.log(`[AR BG][${level}] ${text}`);
    chrome.runtime.sendMessage({ action: 'LOG', text: `[BG] ${text}`, level, ts }).catch(() => {});
};

// ─── Tab Helpers (from arin-ex-autoflow + arin-flow-ext) ───
const getFlowUrl = () => 'https://labs.google/fx/tools/flow/project';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const findFlowTab = async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.url?.includes('/tools/flow')) return activeTab;
    const tabs = await chrome.tabs.query({ url: '*://labs.google/*tools/flow*' });
    return tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || null;
};

const openFlowTab = async (timeoutMs = 15000) => {
    const tab = await new Promise(r => chrome.tabs.create({ url: getFlowUrl(), active: true }, t => r(t)));
    if (!tab?.id) return null;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const t = await new Promise(r => chrome.tabs.get(tab.id, t => r(t || null)));
        if (t?.status === 'complete') return t;
        await sleep(1000);
    }
    return tab;
};

const injectContentScript = async (tabId) => {
    try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
        log(`Inject content script → tab ${tabId}`, 'info');
        await sleep(2000);
    } catch (e) {
        log(`Inject failed: ${e.message}`, 'warn');
    }
};

// ─── Wait Content Script Ready (from arin-flow-ext) ───
const waitContentReady = async (tabId, timeoutMs = 25000) => {
    const start = Date.now();
    let injected = false;
    while (Date.now() - start < timeoutMs) {
        if (isPaused) return { ready: false, state: 'paused' };
        try {
            const resp = await chrome.tabs.sendMessage(tabId, { action: 'PING' });
            if (resp?.ok) {
                if (resp.isReady) return { ready: true, state: resp.state };
                log(`Tab ${tabId}: state=${resp.state} — รอ...`, 'warn');
            }
        } catch (e) {
            if (!injected) {
                log(`Tab ${tabId}: ไม่มี content script — inject...`, 'warn');
                await injectContentScript(tabId);
                injected = true;
                continue;
            }
        }
        await sleep(900);
    }
    return { ready: false, state: 'timeout' };
};

// ─── Recover Tab (from arin-flow-ext) ───
const recoverTab = async (tab) => {
    const tabId = tab.id;
    log(`Recover tab ${tabId}...`, 'warn');
    try { await chrome.tabs.reload(tabId); } catch (e) {}
    await sleep(6000);
    let result = await waitContentReady(tabId, 15000);
    if (result.ready) return true;
    log(`Navigate → ${getFlowUrl()}`, 'warn');
    await chrome.tabs.update(tabId, { url: getFlowUrl(), active: true });
    await sleep(6000);
    result = await waitContentReady(tabId, 20000);
    return result.ready;
};

// ─── Ensure Injected (from arin-ex-autoflow) ───
const ensureInjected = async (tabId) => {
    try {
        const ping = await chrome.tabs.sendMessage(tabId, { action: 'PING' });
        if (ping?.ok) return { ok: true };
    } catch (_) {}
    try {
        await injectContentScript(tabId);
        await sleep(600);
        const ping2 = await chrome.tabs.sendMessage(tabId, { action: 'PING' });
        if (ping2?.ok) return { ok: true };
        return { ok: false, error: ping2?.error || 'Ping after injection failed' };
    } catch (e) {
        return { ok: false, error: e?.message || String(e) };
    }
};

// ─── Queue State Persistence ───
chrome.storage.local.get('botState', (data) => {
    if (data.botState?.queue) {
        queue = data.botState.queue.map(item => {
            if (['running', 'typing', 'submitting'].includes(item.status)) {
                return { ...item, status: 'pending', percent: 0 };
            }
            return item;
        });
        broadcastQueue();
    }
});

const broadcastQueue = () => {
    chrome.runtime.sendMessage({ action: 'QUEUE_UPDATED', queue }).catch(() => {});
    chrome.storage.local.get('botState', (data) => {
        let state = data.botState || {};
        state.queue = queue;
        chrome.storage.local.set({ botState: state });
    });
};

// ─── Process Queue ───
const processQueue = async () => {
    if (isPaused || queue.length === 0) { isRunning = false; return; }
    isRunning = true;
    const pending = queue.filter(i => i.status === 'pending');
    if (pending.length === 0) {
        if (queue.filter(i => i.status === 'running').length === 0) isRunning = false;
        return;
    }
    runItem(pending[0]);
};

const runItem = async (item) => {
    item.status = 'running';
    item.percent = 0;
    item.error = null;
    item.retryCount = item.retryCount || 0;
    broadcastQueue();

    const settings = item.settings || {};
    const maxRetries = 3;
    log(`▶ เริ่มงาน: "${item.setName}" | prompt: "${(item.prompt || '').slice(0, 50)}..."`, 'step');

    try {
        // ─── Flow Mode ───
        let flowMode = 'text_to_image';
        if (settings.flowOutputType === 'video') {
            flowMode = settings.flowVideoMode === 'frame' ? 'frame_to_video' : 'text_to_video';
        }

        // ─── AI Enhance ───
        let finalPrompt = item.prompt;
        if (settings.aiEnhanceToggle && settings.apiKey && !aiKeyInvalid && !item.useExact) {
            log('AI Enhance กำลังแต่ง Prompt...', 'step');
            try {
                finalPrompt = await enhanceWithAI(item.prompt, settings.apiKey, settings.aiProvider || 'groq', flowMode, settings);
                log(`AI Enhance สำเร็จ (len=${finalPrompt.length})`, 'success');
            } catch (e) {
                log(`AI Enhance ล้มเหลว → ใช้ Prompt เดิม: ${e.message}`, 'warn');
                if (String(e.message).includes('401') || String(e.message).toLowerCase().includes('invalid')) {
                    aiKeyInvalid = true;
                    log('API Key ใช้ไม่ได้ — จะข้าม AI Enhance', 'error');
                }
            }
        }

        item.finalPrompt = finalPrompt;
        log(`Prompt: "${finalPrompt.slice(0, 80)}..."`, 'info');

        // ─── Find/Open Tab ───
        log('หา Tab Flow...', 'step');
        let tab = await findFlowTab();
        if (!tab) {
            log('ไม่พบ tab — เปิดใหม่', 'warn');
            tab = await openFlowTab();
            if (!tab?.id) throw new Error('[OFF_SITE] เปิดหน้า Flow ไม่สำเร็จ');
            await sleep(3000);
        }
        log(`พบ Tab: ${tab.url?.slice(0, 70)}`, 'success');
        await sleep(2000);

        // ─── Check Tab Ready ───
        log('ตรวจสอบสถานะ Tab...', 'step');
        let pingResult = await waitContentReady(tab.id, 20000);
        if (!pingResult.ready) {
            log('Tab ไม่พร้อม — recover...', 'warn');
            const recovered = await recoverTab(tab);
            if (!recovered) throw new Error('[NEED_REFRESH] Tab ไม่สามารถ recover ได้');
            tab = await findFlowTab() || tab;
        }

        // ─── Send GENERATE ───
        log('ส่งคำสั่ง GENERATE...', 'step');
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'GENERATE',
            prompt: finalPrompt,
            promptId: item.id,
            settings,
            flowMode,
            subjectImage: item.subjectImage,
            sceneImage: item.sceneImage,
        }).catch(e => {
            log(`sendMessage error: ${e.message}`, 'error');
            return null;
        });

        if (response?.success) {
            item.status = 'completed';
            item.percent = 100;
            log(`งาน "${item.setName}" สำเร็จ ✓`, 'success');
        } else if (!response) {
            throw new Error('[NEED_REFRESH] ไม่ได้รับ response');
        } else {
            if (response.needRefresh) {
                const t = await findFlowTab();
                if (t) await chrome.tabs.update(t.id, { url: getFlowUrl() });
            }
            throw new Error(response.error || 'เกิดข้อผิดพลาด');
        }

    } catch (err) {
        const errMsg = err.message || '';
        log(`❌ Error: ${errMsg}`, 'error');

        if (isPaused) {
            item.status = 'pending'; item.error = 'หยุดชั่วคราว';
            broadcastQueue(); isRunning = false; return;
        }
        if (errMsg.includes('[DAILY_LIMIT]')) {
            item.status = 'failed'; item.error = '🚫 ถึงขีดจำกัดรายวัน';
            isPaused = true; broadcastQueue(); isRunning = false; return;
        }
        if (item.retryCount < maxRetries && !errMsg.includes('[OFF_SITE]')) {
            item.retryCount++;
            item.status = 'pending';
            item.error = `🔄 ลองใหม่ ${item.retryCount}/${maxRetries}`;
            log(`จะลองใหม่ใน 5 วิ... (${item.retryCount}/${maxRetries})`, 'warn');
            broadcastQueue();
            setTimeout(() => { if (!isPaused) processQueue(); }, 5000);
            return;
        }
        item.status = 'failed';
        item.error = errMsg.replace(/\[.*?\]\s*/, '');
    }

    broadcastQueue();
    if (isPaused) { isRunning = false; return; }

    const delayMs = (parseInt(settings?.delayBetween || '15', 10) * 1000) + Math.floor(Math.random() * 3000);
    log(`พัก ${Math.round(delayMs / 1000)} วิ...`, 'info');
    await sleep(delayMs);
    if (isPaused) { isRunning = false; return; }
    processQueue();
};

// ─── AI Enhance (from arin-flow-ext) ───
const enhanceWithAI = async (prompt, apiKey, provider, flowMode, settings = {}) => {
    const isRandomScene = settings.randomSceneToggle;
    const sceneHint = isRandomScene ? '\nCRUCIAL: Place the subject in a COMPLETELY RANDOM, unique scene each time.' : '';

    const isImageMode = flowMode === 'text_to_image';
    const systemPrompt = isImageMode
        ? `You are an expert AI image prompt engineer for Google Flow (Imagen 4).
Transform the user's input into a vivid, detailed English image generation prompt.
RULES:
- Output ONLY the final prompt. No explanation, no quotes.
- English only, 2-4 sentences, ~50-120 words.
- Include: subject, action/pose, environment, lighting, mood, camera angle.
- Style: "cinematic product photography" or "TikTok-style vertical frame"
${sceneHint}

User Input: "${prompt}"`
        : `สร้างบทพูดรีวิวสินค้าภาษาไทยสั้นๆ น่าสนใจ ไม่เกิน 3 ประโยค
สินค้า: "${prompt}"`;

    let url = '', body = {}, headers = { 'Content-Type': 'application/json' };
    const providerBase = provider.replace('_thai', '');

    if (providerBase === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        body = { contents: [{ parts: [{ text: systemPrompt }] }] };
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        const data = await res.json().catch(() => null);
        const result = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!result) throw new Error(`Gemini: ไม่มีผลลัพธ์ (status=${res.status})`);
        return result.trim();

    } else if (providerBase === 'openrouter') {
        url = 'https://openrouter.ai/api/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = { messages: [{ role: 'user', content: systemPrompt }], model: 'meta-llama/llama-3-8b-instruct:free' };
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        const data = await res.json().catch(() => null);
        const result = data?.choices?.[0]?.message?.content;
        if (!result) throw new Error(`OpenRouter: ไม่มีผลลัพธ์ (status=${res.status})`);
        return result.trim();

    } else {
        // Groq
        url = 'https://api.groq.com/openai/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = { messages: [{ role: 'user', content: systemPrompt }], model: 'llama-3.3-70b-versatile' };
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        if (res.status === 401 || res.status === 403) throw new Error(`Groq: API Key ไม่ถูกต้อง (${res.status})`);
        const data = await res.json().catch(() => null);
        const result = data?.choices?.[0]?.message?.content;
        if (!result) throw new Error(`Groq: ไม่มีผลลัพธ์ (status=${res.status})`);
        return result.trim();
    }
};

const validateApiKey = async (provider, apiKey) => {
    try {
        await enhanceWithAI('ทดสอบระบบ', apiKey, provider, 'text_to_image');
        return { valid: true };
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

// ─── Message Listener ───
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'NAVIGATE_TO_URL') {
        if (sender.tab?.id) {
            chrome.tabs.update(sender.tab.id, { url: message.url || getFlowUrl() }).catch(() => {});
        }
        sendResponse({ ok: true });
        return false;
    }

    if (message.action === 'VALIDATE_API_KEY') {
        validateApiKey(message.provider, message.apiKey)
            .then(r => sendResponse(r))
            .catch(e => sendResponse({ valid: false, error: e.message }));
        return true;
    }

    if (message.action === 'API_KEY_UPDATED') {
        aiKeyInvalid = false;
        log('รับ API Key ใหม่ — รีเซ็ตสถานะ', 'info');
        sendResponse({ ok: true });
    }

    // ─── Debug: RUN_CONTENT_ACTION (from arin-ex-autoflow) ───
    if (message.action === 'RUN_CONTENT_ACTION') {
        (async () => {
            try {
                let tab = await findFlowTab();
                if (!tab) {
                    tab = await openFlowTab();
                    if (!tab?.id) { sendResponse({ ok: false, error: 'ไม่พบ Flow tab' }); return; }
                    await sleep(3000);
                }
                const inject = await ensureInjected(tab.id);
                if (!inject.ok) { sendResponse(inject); return; }

                const response = await chrome.tabs.sendMessage(tab.id, {
                    action: 'RUN_ACTION',
                    payload: message.payload
                });
                sendResponse(response || { ok: false, error: 'No response' });
            } catch (e) {
                sendResponse({ ok: false, error: e?.message || String(e) });
            }
        })();
        return true;
    }

    if (message.action === 'START_QUEUE') {
        const settings = message.settings || {};
        const newItems = (message.items || []).map((item, i) => ({
            ...item,
            id: item.id || `q_${Date.now()}_${i}`,
            status: 'pending',
            percent: 0,
            retryCount: 0,
            error: null,
            settings
        }));
        queue = [...queue, ...newItems];
        isPaused = false;
        log(`รับงานใหม่ ${newItems.length} ชุด ✅`, 'step');
        broadcastQueue();
        if (!isRunning) processQueue();
        sendResponse({ ok: true });
    }

    if (message.action === 'CLEAR_QUEUE') {
        queue = []; isRunning = false; isPaused = false;
        broadcastQueue();
        log('ล้าง Queue ทั้งหมด', 'info');
    }

    if (message.action === 'PAUSE_QUEUE') {
        isPaused = true; isRunning = false;
        queue.filter(q => ['running', 'typing', 'submitting'].includes(q.status)).forEach(q => {
            q.status = 'pending'; q.error = 'หยุดชั่วคราว';
        });
        log('⏸ หยุดชั่วคราว', 'warn');
        broadcastQueue();
    }

    if (message.action === 'RESUME_QUEUE') {
        isPaused = false;
        queue.filter(q => q.error === 'หยุดชั่วคราว').forEach(q => { q.error = null; });
        log('▶ ทำงานต่อ', 'step');
        broadcastQueue();
        if (!isRunning) processQueue();
    }

    if (message.action === 'RETRY_FAILED') {
        queue.filter(q => q.status === 'failed').forEach(q => { q.status = 'pending'; q.retryCount = 0; q.error = null; });
        broadcastQueue();
        if (!isRunning) processQueue();
    }

    if (message.action === 'PROGRESS_UPDATE') {
        const item = queue.find(q => q.id === message.promptId);
        if (item) {
            item.percent = message.percent;
            item.status = message.status === 'completed' ? 'completed' : 'running';
            broadcastQueue();
        }
    }

    if (message.action === 'DOWNLOAD_RESULT' && message.url) {
        const opts = { url: message.url };
        if (message.filename) {
            const folder = message.folder ? `${message.folder}/` : '';
            opts.filename = folder + message.filename;
        }
        chrome.downloads.download(opts).catch(e => log(`Download ล้มเหลว: ${e.message}`, 'error'));
    }

    return true;
});
