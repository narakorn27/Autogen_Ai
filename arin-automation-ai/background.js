'use strict';

chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1],
        addRules: [{
            id: 1,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                responseHeaders: [{ header: 'content-security-policy', operation: 'remove' }]
            },
            condition: { urlFilter: '||labs.google', resourceTypes: ['main_frame', 'sub_frame'] }
        }]
    }).catch(console.error);
    console.log('[Arin BG] Installed');
});

let queue = [];
let isRunning = false;
let isPaused = false;
let aiKeyInvalid = false;

const WHISK_URL = 'https://labs.google/fx/tools/whisk/project';

const broadcastLog = (text, level = 'info') => {
    console.log(`[Arin BG][${level}] ${text}`);
    chrome.runtime.sendMessage({ action: 'LOG', text, level }).catch(() => {});
};

const broadcastQueue = () => {
    chrome.runtime.sendMessage({ action: 'QUEUE_UPDATED', queue }).catch(() => {});
    chrome.storage.local.get('botState', (data) => {
        const state = data.botState || {};
        state.queue = queue;
        chrome.storage.local.set({ botState: state });
    });
};

chrome.storage.local.get('botState', (data) => {
    if (data.botState?.queue) {
        queue = data.botState.queue.map((item) => {
            if (['running', 'typing', 'submitting'].includes(item.status)) {
                return { ...item, status: 'pending', percent: 0 };
            }
            return item;
        });
        broadcastQueue();
    }
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const openTabAndWait = async (url, timeoutMs = 15000) => {
    const created = await new Promise((resolve) => {
        chrome.tabs.create({ url, active: true }, (tab) => resolve(tab || null));
    });
    if (!created?.id) return null;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const tab = await new Promise((resolve) => chrome.tabs.get(created.id, (t) => resolve(t || null)));
        if (tab?.status === 'complete') return tab;
        await sleep(1000);
    }
    return created;
};

const injectContentScript = async (tabId) => {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
        });
        await sleep(1500);
        broadcastLog(`Injected content.js ไปยัง tab ${tabId}`, 'info');
    } catch (e) {
        broadcastLog(`Inject failed: ${e.message}`, 'warn');
    }
};

const waitForContentReady = async (tabId, timeoutMs = 25000) => {
    const start = Date.now();
    let injected = false;
    while (Date.now() - start < timeoutMs) {
        if (isPaused) return { ready: false, state: 'paused' };
        try {
            const resp = await chrome.tabs.sendMessage(tabId, { action: 'PING' });
            if (resp?.ok) {
                if (resp.isReady) return { ready: true, state: resp.state };
                if (resp.state === 'catchall' && resp.hasAddPhotoBtn) {
                    const clickResp = await chrome.tabs.sendMessage(tabId, { action: 'CLICK_ADD_PHOTO_BTN' }).catch(() => null);
                    if (clickResp?.clicked) {
                        await sleep(3000);
                        continue;
                    }
                }
            }
        } catch (e) {
            if (!injected) {
                await injectContentScript(tabId);
                injected = true;
                continue;
            }
        }
        await sleep(900);
    }
    return { ready: false, state: 'timeout' };
};

const navigateTabTo = async (tabId, url) => new Promise((resolve) => {
    chrome.tabs.update(tabId, { url, active: true }, (tab) => resolve(tab || null));
});

const isTabOnCatchAll = (tab) => {
    const url = tab?.url || '';
    return url.includes('[...catchAll]') || url.includes('%5B...catchAll%5D');
};

const findTargetTab = async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.url?.includes('/tools/whisk')) return activeTab;
    const tabs = await chrome.tabs.query({ url: '*://labs.google/*tools/whisk*' });
    return tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || null;
};

const recoverTabToWorkPage = async (tab) => {
    if (!tab?.id) return false;
    const tabId = tab.id;
    const tabUrl = tab.url || '';
    const isOnProject = /\/tools\/whisk\/project/.test(tabUrl);

    if (isOnProject) {
        await sleep(3000);
        const result = await waitForContentReady(tabId, 20000);
        if (result.ready) return true;
    }

    try {
        const clickResp = await chrome.tabs.sendMessage(tabId, { action: 'CLICK_ADD_PHOTO_BTN' }).catch(() => null);
        if (clickResp?.clicked) {
            await sleep(3000);
            const result = await waitForContentReady(tabId, 15000);
            if (result.ready) return true;
        }
    } catch (e) {}

    try { await chrome.tabs.reload(tabId); } catch (e) {}
    await sleep(6000);
    let result = await waitForContentReady(tabId, 15000);
    if (result.ready) return true;

    await navigateTabTo(tabId, WHISK_URL);
    await sleep(5000);
    result = await waitForContentReady(tabId, 20000);
    return result.ready;
};

const processQueue = async () => {
    if (isPaused) {
        isRunning = false;
        return;
    }
    if (queue.length === 0) {
        isRunning = false;
        return;
    }

    isRunning = true;
    const pendingItems = queue.filter((item) => item.status === 'pending');
    if (pendingItems.length === 0) {
        if (!queue.some((item) => item.status === 'running')) isRunning = false;
        return;
    }

    const runningCount = queue.filter((item) => item.status === 'running').length;
    if (runningCount === 0) pendingItems.slice(0, 1).forEach((item) => runItem(item));
};

const runItem = async (item) => {
    item.status = 'running';
    item.percent = item.percent || 0;
    item.error = null;
    item.retryCount = item.retryCount || 0;
    broadcastQueue();

    const settings = item.settings || {};
    const maxRetries = 3;
    broadcastLog(`เริ่มงาน: "${item.setName}"`, 'step');

    try {
        let finalPrompt = item.prompt;
        if (settings.aiEnhanceToggle && settings.apiKey && !aiKeyInvalid) {
            broadcastLog('AI Enhance กำลังแต่ง Prompt...', 'step');
            let promptToEnhance = item.prompt;
            if (settings.randomSceneToggle) promptToEnhance += ' [RANDOMIZE_SCENE]';
            try {
                finalPrompt = await enhanceWithAI(promptToEnhance, settings.apiKey, settings.aiProvider || 'groq');
            } catch (e) {
                broadcastLog(`AI Enhance ล้มเหลว: ${e.message}`, 'warn');
                if (String(e.message).includes('401') || String(e.message).toLowerCase().includes('invalid api key')) {
                    aiKeyInvalid = true;
                }
            }
        }

        item.finalPrompt = finalPrompt;

        let activeTab = await findTargetTab();
        if (!activeTab) {
            broadcastLog('ไม่พบแท็บ Whisk - เปิดใหม่', 'warn');
            activeTab = await openTabAndWait(WHISK_URL);
            if (!activeTab?.id) throw new Error('[OFF_SITE] เปิดหน้า Whisk ไม่สำเร็จ');
        }

        await sleep(2500);

        const isOnProject = /\/tools\/whisk\/project/.test(activeTab.url || '');
        if (isOnProject) {
            const pingResult = await waitForContentReady(activeTab.id, 20000);
            if (!pingResult.ready) {
                const recovered = await recoverTabToWorkPage(activeTab);
                if (!recovered) throw new Error('[NEED_REFRESH] Tab ไม่สามารถ recover ได้');
            }
        } else {
            const pingResult = await waitForContentReady(activeTab.id, 20000);
            if (!pingResult.ready || isTabOnCatchAll(activeTab) || pingResult.state === 'catchall') {
                const recovered = await recoverTabToWorkPage(activeTab);
                if (!recovered) throw new Error('[NEED_REFRESH] Tab ไม่สามารถ recover ได้');
            }
        }

        const tabs = await chrome.tabs.query({ url: '*://labs.google/*tools/whisk*' });
        if (tabs.length > 0) activeTab = tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];

        const response = await chrome.tabs.sendMessage(activeTab.id, {
            action: 'GENERATE',
            prompt: finalPrompt,
            promptId: item.id,
            settings,
            subjectImage: item.subjectImage,
            sceneImage: item.sceneImage,
            styleImage: item.styleImage
        }).catch((e) => {
            broadcastLog(`sendMessage error: ${e.message}`, 'error');
            return null;
        });

        if (response?.success) {
            item.status = 'completed';
            item.percent = 100;
            broadcastLog(`งาน "${item.setName}" สำเร็จ`, 'success');
        } else if (!response) {
            throw new Error('[NEED_REFRESH] ไม่ได้รับ response จาก content script');
        } else {
            if (response.needRefresh) {
                const tab = await findTargetTab();
                if (tab?.id) {
                    await navigateTabTo(tab.id, WHISK_URL);
                    await sleep(5000);
                }
            }
            throw new Error(response.error || 'เกิดข้อผิดพลาดจากหน้าเว็บ');
        }
    } catch (err) {
        const errMsg = err.message || '';
        broadcastLog(`Error: ${errMsg}`, 'error');

        if (isPaused) {
            item.status = 'pending';
            item.error = 'หยุดชั่วคราว';
            broadcastQueue();
            isRunning = false;
            return;
        }

        if (errMsg.includes('[DAILY_LIMIT]')) {
            item.status = 'failed';
            item.error = 'ถึงขีดจำกัดรายวัน';
            isPaused = true;
            broadcastQueue();
            isRunning = false;
            return;
        }

        if (item.retryCount < maxRetries && !errMsg.includes('[OFF_SITE]')) {
            item.retryCount += 1;
            item.status = 'pending';
            item.error = `ลองใหม่ ${item.retryCount}/${maxRetries}`;
            broadcastQueue();
            setTimeout(() => { if (!isPaused) processQueue(); }, 5000);
            return;
        }

        item.status = 'failed';
        item.error = errMsg.replace(/\[.*?\]\s*/, '');
    }

    broadcastQueue();
    if (isPaused) {
        isRunning = false;
        return;
    }

    const delayMs = (parseInt(settings.delayBetween || '15', 10) * 1000) + Math.floor(Math.random() * 3000);
    await sleep(delayMs);
    if (isPaused) {
        isRunning = false;
        return;
    }
    processQueue();
};

const enhanceWithAI = async (prompt, apiKey, provider) => {
    const isRandomizeScene = prompt.includes('[RANDOMIZE_SCENE]');
    const cleanPrompt = prompt.replace('[RANDOMIZE_SCENE]', '').trim();
    const sceneInstruction = isRandomizeScene ? 'CRUCIAL: Place the subject in a COMPLETELY RANDOM, unique scene each time.' : '';
    const systemInstruction = `You are an expert AI image prompt engineer specializing in Google Whisk.
Transform the user's input into a vivid, detailed English image generation prompt.

RULES:
- Output ONLY the final prompt.
- Language: English only.
- Length: 2-4 sentences, about 50-120 words.
- Include subject, environment, lighting, mood, and camera angle.
${sceneInstruction}

User Input: "${cleanPrompt}"`;

    let url = '';
    let body = {};
    const headers = { 'Content-Type': 'application/json' };

    if (provider === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        body = { contents: [{ parts: [{ text: systemInstruction }] }] };
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        const data = await res.json().catch(() => null);
        const result = data?.candidates?.[0]?.content?.parts?.find((p) => p?.text)?.text;
        if (!result) throw new Error(`Gemini: ไม่พบผลลัพธ์ (status=${res.status})`);
        return result.trim();
    }

    if (provider === 'openrouter') {
        url = 'https://openrouter.ai/api/v1/chat/completions';
        headers.Authorization = `Bearer ${apiKey}`;
        body = {
            model: 'meta-llama/llama-3-8b-instruct:free',
            messages: [{ role: 'user', content: systemInstruction }]
        };
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        const data = await res.json().catch(() => null);
        const result = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text;
        if (!result) throw new Error(`OpenRouter: ไม่พบผลลัพธ์ (status=${res.status})`);
        return result.trim();
    }

    url = 'https://api.groq.com/openai/v1/chat/completions';
    headers.Authorization = `Bearer ${apiKey}`;
    body = {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: systemInstruction }]
    };
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (res.status === 401 || res.status === 403) {
        throw new Error(`Groq: API Key ไม่ถูกต้อง (${res.status})`);
    }
    const result = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? null;
    if (!result || !result.trim()) throw new Error(`Groq: ไม่พบผลลัพธ์ (status=${res.status})`);
    return result.trim();
};

const validateApiKey = async (provider, apiKey) => {
    try {
        await enhanceWithAI('ทดสอบระบบ', apiKey, provider);
        return { valid: true };
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'LICENSE_VERIFIED') {
        chrome.storage.local.set({ licenseVerified: true });
        chrome.tabs.query({ url: '*://labs.google/*tools/whisk*' }, (tabs) => {
            tabs.forEach((tab) => {
                chrome.tabs.sendMessage(tab.id, { action: 'LICENSE_OK' }).catch(() => {});
            });
        });
        sendResponse({ success: true });
        return false;
    }

    if (message.action === 'LICENSE_REVOKED') {
        chrome.storage.local.remove('licenseVerified');
        chrome.tabs.query({ url: '*://labs.google/*tools/whisk*' }, (tabs) => {
            tabs.forEach((tab) => {
                chrome.tabs.sendMessage(tab.id, { action: 'LICENSE_REVOKED' }).catch(() => {});
            });
        });
        sendResponse({ success: true });
        return false;
    }

    if (message.action === 'NAVIGATE_TO_URL') {
        if (sender.tab?.id) {
            const url = message.url || WHISK_URL;
            chrome.tabs.update(sender.tab.id, { url }).catch(() => {});
        }
        sendResponse({ ok: true });
        return false;
    }

    if (message.action === 'VALIDATE_API_KEY') {
        validateApiKey(message.provider, message.apiKey)
            .then((result) => sendResponse(result))
            .catch((error) => sendResponse({ valid: false, error: error.message }));
        return true;
    }

    if (message.action === 'API_KEY_UPDATED') {
        aiKeyInvalid = false;
        sendResponse({ ok: true });
        return false;
    }

    if (message.action === 'START_QUEUE') {
        const settings = message.settings || {};
        const newItems = (message.items || []).map((item, index) => ({
            ...item,
            id: item.id || `q_${Date.now()}_${index}`,
            status: 'pending',
            percent: 0,
            retryCount: 0,
            error: null,
            settings
        }));
        queue = [...queue, ...newItems];
        isPaused = false;
        broadcastQueue();
        if (!isRunning) processQueue();
        sendResponse({ ok: true });
        return false;
    }

    if (message.action === 'CLEAR_QUEUE') {
        queue = [];
        isRunning = false;
        isPaused = false;
        broadcastQueue();
        sendResponse({ ok: true });
        return false;
    }

    if (message.action === 'PAUSE_QUEUE') {
        isPaused = true;
        isRunning = false;
        queue.filter((item) => ['running', 'typing', 'submitting'].includes(item.status)).forEach((item) => {
            item.status = 'pending';
            item.error = 'หยุดชั่วคราว';
        });
        broadcastQueue();
        sendResponse({ ok: true });
        return false;
    }

    if (message.action === 'RESUME_QUEUE') {
        isPaused = false;
        queue.filter((item) => item.error === 'หยุดชั่วคราว').forEach((item) => { item.error = null; });
        broadcastQueue();
        if (!isRunning) processQueue();
        sendResponse({ ok: true });
        return false;
    }

    if (message.action === 'PROGRESS_UPDATE') {
        const item = queue.find((q) => q.id === message.promptId);
        if (item) {
            item.percent = message.percent;
            item.status = message.status === 'completed' ? 'completed' : 'running';
            broadcastQueue();
        }
        sendResponse({ ok: true });
        return false;
    }

    if (message.action === 'DOWNLOAD_RESULT' && message.url) {
        const downloadOptions = { url: message.url };
        if (message.filename) {
            const folder = message.folder ? `${message.folder}/` : '';
            downloadOptions.filename = folder + message.filename;
        }
        chrome.downloads.download(downloadOptions).catch((e) => broadcastLog(`Download ล้มเหลว: ${e.message}`, 'error'));
        sendResponse({ ok: true });
        return false;
    }

    return true;
});
