// ── Arin Background Worker v7.2 ──
'use strict';

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
    console.log('[Arin BG] Extension ติดตั้งแล้ว');
});

let queue = [];
let isRunning = false;
let isPaused = false;
let aiKeyInvalid = false;

const broadcastLog = (text, level = 'info') => {
    console.log(`[Arin BG][${level}] ${text}`);
    chrome.runtime.sendMessage({ action: 'LOG', text, level }).catch(() => {});
};

const getTargetUrl = (targetApp) => targetApp === 'flow'
    ? 'https://labs.google/fx/tools/flow/project'
    : 'https://labs.google/fx/tools/whisk/project';

// ─── เปิด tab ใหม่และรอโหลด ───
const openTabAndWait = async (url, timeoutMs = 15000) => {
    const created = await new Promise((resolve) => {
        chrome.tabs.create({ url, active: true }, (tab) => resolve(tab || null));
    });
    const tabId = created?.id;
    if (!tabId) return null;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const tab = await new Promise((resolve) => { chrome.tabs.get(tabId, (t) => resolve(t || null)); });
        if (tab?.status === 'complete') return tab;
        await new Promise((r) => setTimeout(r, 1000));
    }
    return await new Promise((resolve) => { chrome.tabs.get(created.id, (t) => resolve(t || created)); });
};

// ─── Inject content scripts ผ่าน scripting API (fallback เมื่อ PING ไม่ตอบ) ───
const injectContentScripts = async (tabId) => {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content-flow.js', 'content.js']
        });
        broadcastLog(`Injected content scripts ไปยัง tab ${tabId}`, 'info');
        await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
        broadcastLog(`Inject failed: ${e.message}`, 'warn');
    }
};

// ─── รอ Content Script พร้อม + เช็ค isReady ───
const waitForContentReady = async (tabId, timeoutMs = 25000, targetApp = 'whisk') => {
    const start = Date.now();
    let injected = false;
    while (Date.now() - start < timeoutMs) {
        if (isPaused) return { ready: false, state: 'paused' };
        try {
            const resp = await chrome.tabs.sendMessage(tabId, { action: 'PING' });
            if (resp?.ok) {
                if (resp.isReady) return { ready: true, state: resp.state, url: resp.url, script: resp.script };
                // ถ้า catchAll และมีปุ่ม add_photo → Whisk เท่านั้น (Flow ไม่มีปุ่มนี้)
                if (targetApp === 'whisk' && resp.state === 'catchall' && resp.hasAddPhotoBtn) {
                    broadcastLog(`Tab ${tabId}: catchAll มีปุ่ม — ส่ง CLICK_ADD_PHOTO_BTN...`, 'warn');
                    const clickResp = await chrome.tabs.sendMessage(tabId, { action: 'CLICK_ADD_PHOTO_BTN' }).catch(() => null);
                    if (clickResp?.clicked) {
                        await new Promise(r => setTimeout(r, 4000));
                        continue;
                    }
                }
                broadcastLog(`Tab ${tabId}: state=${resp.state} workReady=${resp.workReady} script=${resp.script} — รอ...`, 'warn');
            }
        } catch (e) {
            // Content script ยังไม่โหลด → inject ผ่าน scripting API
            if (!injected) {
                broadcastLog(`Tab ${tabId}: ไม่มี content script — inject ผ่าน scripting API...`, 'warn');
                await injectContentScripts(tabId);
                injected = true;
                continue;
            }
        }
        await new Promise(r => setTimeout(r, 900));
    }
    return { ready: false, state: 'timeout' };
};

// ─── Navigate tab ไปที่ URL ที่ต้องการ (ใช้ update แทน reload) ───
const navigateTabTo = async (tabId, url) => {
    return new Promise((resolve) => {
        chrome.tabs.update(tabId, { url, active: true }, (tab) => resolve(tab || null));
    });
};

// ─── หา tab เป้าหมาย ───
const findTargetTab = async (targetApp) => {
    const urlPattern = targetApp === 'flow' ? '*://labs.google/*tools/flow*' : '*://labs.google/*tools/whisk*';
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.url?.includes('labs.google')) {
        if ((targetApp === 'whisk' && activeTab.url.includes('whisk')) ||
            (targetApp === 'flow' && activeTab.url.includes('/tools/flow'))) return activeTab;
    }
    const tabs = await chrome.tabs.query({ url: urlPattern });
    return tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || null;
};

// ─── ตรวจสอบว่า URL ของ tab อยู่ใน catchAll หรือไม่ ───
const isTabOnCatchAll = (tab) => {
    const url = tab?.url || '';
    return url.includes('[...catchAll]') || url.includes('%5B...catchAll%5D');
};

// ─── ดูแล tab ให้กลับมาหน้าที่ถูกต้อง (ฉลาดขึ้น: ไม่ใช้ reload) ───
const recoverTabToWorkPage = async (tab, targetApp) => {
    const tabId = tab.id;
    const projectUrl = getTargetUrl(targetApp);
    const tabUrl = tab.url || '';
    broadcastLog(`recoverTabToWorkPage: tabId=${tabId} url=${tabUrl.slice(0, 70)}`, 'warn');

    // ── ถ้า URL เป็น /project หรือ /project/UUID อยู่แล้ว → รอ content script ก่อน ──
    const isAlreadyOnProject = tabUrl.match(/\/tools\/whisk\/project/) ||
                               tabUrl.match(/\/tools\/flow\/project/);

    if (isAlreadyOnProject) {
        broadcastLog(`Tab อยู่ที่ /project แล้ว — รอ content script โหลด...`, 'info');
        // รอนานขึ้นเพราะหน้าโหลดอยู่
        await new Promise(r => setTimeout(r, 3000));
        const result = await waitForContentReady(tabId, 20000);
        if (result.ready) {
            broadcastLog(`Tab ${tabId} พร้อมแล้ว ✅ state=${result.state}`, 'success');
            return true;
        }
        // ถ้ายังไม่พร้อม ลองส่ง CLICK_ADD_PHOTO_BTN ก่อน navigate
    }

    // ── ลองให้ content script คลิกปุ่มก่อน ──
    try {
        const clickResp = await Promise.race([
            chrome.tabs.sendMessage(tabId, { action: 'CLICK_ADD_PHOTO_BTN' }),
            new Promise(r => setTimeout(() => r(null), 4000))
        ]).catch(() => null);

        if (clickResp?.clicked) {
            broadcastLog(`คลิกปุ่มสำเร็จ — รอหน้าโหลด...`, 'info');
            await new Promise(r => setTimeout(r, 4000));
            const result = await waitForContentReady(tabId, 15000);
            if (result.ready) {
                broadcastLog(`Tab ${tabId} กลับมาพร้อม ✅`, 'success');
                return true;
            }
        }
    } catch(e) {}

    // ── fallback: reload หน้าก่อน navigate ──
    broadcastLog(`PING timeout บนหน้านี้ — พยายาม Reload tab ${tabId}...`, 'warn');
    try { await chrome.tabs.reload(tabId); } catch(e) {}
    await new Promise(r => setTimeout(r, 8000));
    
    const finalPing = await waitForContentReady(tabId, 15000);
    if (finalPing.ready) return true;

    broadcastLog(`Navigate tab ${tabId} → ${projectUrl}`, 'warn');
    await navigateTabTo(tabId, projectUrl);
    await new Promise(r => setTimeout(r, 6000));

    const result = await waitForContentReady(tabId, 25000);
    if (result.ready) {
        broadcastLog(`Tab ${tabId} กลับมาพร้อม ✅`, 'success');
        return true;
    }

    // รอบ 2
    await navigateTabTo(tabId, projectUrl);
    await new Promise(r => setTimeout(r, 8000));
    const result2 = await waitForContentReady(tabId, 20000);
    return result2.ready;
};

// ─── Queue State Load ───
chrome.storage.local.get('botState', (data) => {
    if (data.botState && data.botState.queue) {
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

    const settings = item.settings || {};
    const maxRetries = 3;
    broadcastLog(`เริ่มงาน: "${item.setName}" | prompt: "${(item.prompt || '').slice(0, 40)}..."`, 'step');

    try {
        const targetApp = settings.targetApp || 'whisk';
        let flowMode = 'text_to_video';
        if (targetApp === 'flow') {
            if (settings.flowOutputType === 'image') flowMode = 'text_to_image';
            else if (settings.flowVideoMode === 'frame') flowMode = 'frame_to_video';
        }

        // ─── AI Enhance ───
        let finalPrompt = item.prompt;
        if (settings.aiEnhanceToggle && settings.apiKey && !aiKeyInvalid) {
            broadcastLog('AI Enhance กำลังแต่ง Prompt...', 'step');
            let promptToEnhance = item.prompt;
            if (settings.randomSceneToggle) promptToEnhance += ' [RANDOMIZE_SCENE]';
            const providerToUse = targetApp === 'flow'
                ? (settings.aiProviderFlow || settings.aiProvider || 'groq_thai')
                : (settings.aiProvider || 'groq');
            try {
                finalPrompt = await enhanceWithAI(promptToEnhance, settings.apiKey, providerToUse, targetApp, flowMode);
                broadcastLog(`AI Enhance สำเร็จ (len=${finalPrompt.length})`, 'success');
            } catch (e) {
                broadcastLog(`AI Enhance ล้มเหลว → ใช้ Prompt เดิม: ${e.message}`, 'warn');
                if (String(e.message).includes('401') || String(e.message).toLowerCase().includes('invalid api key')) {
                    aiKeyInvalid = true;
                    broadcastLog('API Key ใช้ไม่ได้ — จะข้าม AI Enhance จนกว่าจะบันทึกใหม่', 'error');
                }
            }
        }

        item.finalPrompt = finalPrompt;
        broadcastLog(`Prompt: "${finalPrompt.slice(0, 80)}..."`, 'info');

        // ─── หา Tab ───
        broadcastLog(`หา Tab: ${targetApp}`, 'step');
        let activeTab = await findTargetTab(targetApp);

        if (!activeTab) {
            // เปิด tab ใหม่
            const url = getTargetUrl(targetApp);
            broadcastLog(`ไม่พบ tab — เปิดใหม่: ${url}`, 'warn');
            const createdTab = await openTabAndWait(url);
            if (!createdTab?.id) throw new Error('[OFF_SITE] เปิดหน้าไม่สำเร็จ');
            await new Promise((r) => setTimeout(r, 2000));
            activeTab = createdTab;
        }

        broadcastLog(`พบ Tab: ${activeTab.url?.slice(0, 70)}`, 'success');

        // ── รอให้ tab stabilize ก่อน PING ──
        await new Promise(r => setTimeout(r, 3000)); // เพิ่มจาก 1500 → 3000

        // ─── ตรวจสอบ Tab ก่อนส่งคำสั่ง ───
        // เช็ค PING ก่อนเสมอ — ถ้าหน้าไม่พร้อมให้แก้ก่อน
        broadcastLog('ตรวจสอบสถานะ Tab...', 'step');

        // ── ถ้า URL เป็น /project อยู่แล้ว → รอ PING ตรงๆ ไม่ต้อง recover ──
        const isOnProject = (activeTab.url || '').match(/\/tools\/(whisk|flow)\/project/);

        if (isOnProject) {
            broadcastLog('Tab อยู่ที่ /project แล้ว — รอ PING...', 'info');
            await new Promise(r => setTimeout(r, 2000));
            const pingResult = await waitForContentReady(activeTab.id, 20000, targetApp);
            if (!pingResult.ready) {
                broadcastLog('PING timeout — กำลัง recover...', 'warn');
                if (targetApp === 'flow') {
                    // Flow: inject content script แล้วลองอีกที ไม่ navigate ออก
                    await injectContentScripts(activeTab.id);
                    const r2 = await waitForContentReady(activeTab.id, 15000, targetApp);
                    if (!r2.ready) {
                        // reload หน้าเดิม (ไม่เปลี่ยน URL)
                        broadcastLog('Reload tab Flow...', 'warn');
                        try { await chrome.tabs.reload(activeTab.id); } catch(e) {}
                        await new Promise(r => setTimeout(r, 6000));
                        const r3 = await waitForContentReady(activeTab.id, 20000, targetApp);
                        if (!r3.ready) throw new Error('[NEED_REFRESH] Flow tab ไม่สามารถ recover ได้');
                    }
                } else {
                    // Whisk: ลอง CLICK_ADD_PHOTO_BTN ก่อน navigate
                    try {
                        const clickResp = await chrome.tabs.sendMessage(activeTab.id, { action: 'CLICK_ADD_PHOTO_BTN' }).catch(() => null);
                        if (clickResp?.clicked) {
                            await new Promise(r => setTimeout(r, 3000));
                            const r2 = await waitForContentReady(activeTab.id, 15000, targetApp);
                            if (r2.ready) { broadcastLog('Tab พร้อมหลังคลิก ✅', 'success'); }
                            else {
                                await navigateTabTo(activeTab.id, getTargetUrl(targetApp));
                                await new Promise(r => setTimeout(r, 5000));
                                const r3 = await waitForContentReady(activeTab.id, 20000, targetApp);
                                if (!r3.ready) throw new Error('[NEED_REFRESH] Tab ไม่สามารถ recover ได้');
                            }
                        } else {
                            await navigateTabTo(activeTab.id, getTargetUrl(targetApp));
                            await new Promise(r => setTimeout(r, 5000));
                            const r2 = await waitForContentReady(activeTab.id, 20000, targetApp);
                            if (!r2.ready) throw new Error('[NEED_REFRESH] Tab ไม่สามารถ recover ได้');
                        }
                    } catch(e) {
                        throw new Error('[NEED_REFRESH] Tab ไม่สามารถ recover ได้');
                    }
                }
            }
        } else {
            const pingResult = await waitForContentReady(activeTab.id, 30000, targetApp);
            if (!pingResult.ready) {
                broadcastLog(`Tab ไม่พร้อม (state=${pingResult.state}) — กำลัง recover...`, 'warn');
                const recovered = await recoverTabToWorkPage(activeTab, targetApp);
                if (!recovered) throw new Error('[NEED_REFRESH] Tab ไม่สามารถ recover ได้');
            } else if (isTabOnCatchAll(activeTab) || pingResult.state === 'catchall') {
                broadcastLog('Content script แจ้ง catchAll — กำลัง navigate กลับ...', 'warn');
                const recovered = await recoverTabToWorkPage(activeTab, targetApp);
                if (!recovered) throw new Error('[CATCH_ALL] navigate กลับไม่สำเร็จ');
            }
        }

        // ─── ส่งคำสั่ง GENERATE ───
        broadcastLog('ส่งคำสั่ง GENERATE...', 'step');

        // อัปเดต tab reference หลัง recovery
        const tabs = await chrome.tabs.query({ url: `*://labs.google/*tools/${targetApp === 'flow' ? 'flow' : 'whisk'}*` });
        if (tabs.length > 0) activeTab = tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];

        const response = await chrome.tabs.sendMessage(activeTab.id, {
            action: 'GENERATE',
            prompt: finalPrompt,
            promptId: item.id,
            settings,
            flowMode,
            subjectImage: item.subjectImage,
            sceneImage: item.sceneImage,
            styleImage: item.styleImage,
        }).catch(e => {
            broadcastLog(`sendMessage error: ${e.message}`, 'error');
            return null;
        });

        if (response && response.success) {
            item.status = 'completed';
            item.percent = 100;
            broadcastLog(`งาน "${item.setName}" สำเร็จ ✓`, 'success');
        } else if (!response) {
            throw new Error('[NEED_REFRESH] ไม่ได้รับ response จาก content script');
        } else {
            // Content script ส่ง error กลับ
            const isCatchAll = response.isCatchAll || (response.error && response.error.includes('CatchAll'));
            if (isCatchAll) {
                // Navigate กลับ (ไม่ reload)
                broadcastLog('Content แจ้ง CatchAll — navigate กลับ...', 'warn');
                const tabs2 = await chrome.tabs.query({ url: `*://labs.google/*` });
                if (tabs2.length > 0) {
                    await navigateTabTo(tabs2[0].id, getTargetUrl(targetApp));
                    await new Promise(r => setTimeout(r, 6000));
                }
            } else if (response.needRefresh) {
                broadcastLog('Content แจ้ง needRefresh — navigate กลับ...', 'warn');
                const tabs3 = await findTargetTab(targetApp);
                if (tabs3) {
                    await navigateTabTo(tabs3.id, getTargetUrl(targetApp));
                    await new Promise(r => setTimeout(r, 6000));
                }
            }
            throw new Error(response.error || 'เกิดข้อผิดพลาดจากหน้าเว็บ');
        }

    } catch (err) {
        const errMsg = err.message || '';
        broadcastLog(`Error: ${errMsg}`, 'error');

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
            broadcastLog(`จะลองใหม่ใน 5 วิ... (${item.retryCount}/${maxRetries})`, 'warn');
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
    broadcastLog(`พักก่อน ${Math.round(delayMs / 1000)} วิ ก่อนชุดถัดไป...`, 'info');
    await new Promise(resolve => setTimeout(resolve, delayMs));
    if (isPaused) { isRunning = false; return; }
    processQueue();
};

// ─── AI Enhance ───
const enhanceWithAI = async (prompt, apiKey, provider, targetApp, flowMode) => {
    const isRandomizeScene = prompt.includes('[RANDOMIZE_SCENE]');
    const cleanPrompt = prompt.replace('[RANDOMIZE_SCENE]', '').trim();
    const isThaiMode = targetApp === 'flow' && flowMode !== 'text_to_image';
    const sceneInstruction = isRandomizeScene ? 'CRUCIAL: Place the subject in a COMPLETELY RANDOM, unique scene each time.' : '';
    const langInstruction = isThaiMode
        ? 'ตอบเป็นภาษาไทยเท่านั้น สร้างบทพูดรีวิวสินค้าสั้นๆ น่าสนใจ ไม่เกิน 3 ประโยค'
        : `You are an expert AI image prompt engineer specializing in Google Whisk (powered by Imagen 4).
Your task: Transform the user's input into a vivid, detailed English image generation prompt.

RULES:
- Output ONLY the final prompt. No explanation, no quotes, no preamble.
- Language: English only.
- Length: 2-4 sentences, ~50-120 words.
- Include: subject description, action/pose, environment/scene, lighting style, mood/atmosphere, camera angle or lens style (e.g. low angle, Dutch angle, close-up).
- Style cue: "cinematic TikTok-style vertical video frame" — bold overlay text implied but described visually.
- If input mentions Thai cultural context, translate visually into scene description.
- If input has "| style:" tag, treat text after it as visual style instruction and incorporate it.
${sceneInstruction}

User Input: "${cleanPrompt}"`;

    const systemInstruction = isThaiMode
        ? `${langInstruction}\n\nสินค้า: "${cleanPrompt}"`
        : langInstruction;

    let url = '', body = {}, headers = { 'Content-Type': 'application/json' };
    const providerBase = provider.replace('_thai', '');

    if (providerBase === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        body = { contents: [{ parts: [{ text: systemInstruction }] }] };
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        let data = null;
        try { data = await res.json(); } catch (e) {}
        const result = data?.candidates?.[0]?.content?.parts?.[0]?.text
            || data?.candidates?.[0]?.content?.parts?.find(p => p?.text)?.text;
        if (!result) throw new Error(`Gemini: ไม่มีผลลัพธ์ (status=${res.status})`);
        return result.trim();

    } else if (providerBase === 'openrouter') {
        url = 'https://openrouter.ai/api/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = { messages: [{ role: 'user', content: systemInstruction }], model: 'meta-llama/llama-3-8b-instruct:free' };
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        let data = null;
        try { data = await res.json(); } catch (e) {}
        const result = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text;
        if (!result) throw new Error(`OpenRouter: ไม่มีผลลัพธ์ (status=${res.status})`);
        return result.trim();

    } else {
        // Groq
        url = 'https://api.groq.com/openai/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = { messages: [{ role: 'user', content: systemInstruction }], model: 'llama-3.3-70b-versatile' };
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        let data = null;
        try { data = await res.json(); } catch (e) {}
        if (res.status === 401 || res.status === 403) {
            throw new Error(`Groq: API Key ไม่ถูกต้อง (${res.status})`);
        }
        const result = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? null;
        if (!result || !result.trim()) throw new Error(`Groq: ไม่มีผลลัพธ์ (status=${res.status})`);
        return result.trim();
    }
};

const validateApiKey = async (provider, apiKey) => {
    try {
        await enhanceWithAI('ทดสอบระบบ', apiKey, provider, 'whisk', 'text_to_image');
        return { valid: true };
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

// ─── Message Listener ───
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'NAVIGATE_TO_URL') {
        // Content script ขอให้ background navigate tab
        if (sender.tab?.id) {
            const url = message.url || 'https://labs.google/fx/tools/whisk/project';
            broadcastLog(`NAVIGATE_TO_URL: tab=${sender.tab.id} → ${url}`, 'warn');
            chrome.tabs.update(sender.tab.id, { url }).catch(() => {});
        }
        sendResponse({ ok: true });
        return false;
    }

    if (message.action === 'VALIDATE_API_KEY') {
        validateApiKey(message.provider, message.apiKey)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ valid: false, error: error.message }));
        return true;
    }

    if (message.action === 'API_KEY_UPDATED') {
        aiKeyInvalid = false;
        broadcastLog('รับ API Key ใหม่ — รีเซ็ตสถานะ', 'info');
        sendResponse({ ok: true });
    }

    if (message.action === 'START_QUEUE') {
        const settings = message.settings || {};
        const newItems = (message.items || []).map((item, index) => ({
            ...item,
            id: item.id || (`q_${Date.now()}_${index}`),
            status: 'pending',
            percent: 0,
            retryCount: 0,
            error: null,
            settings
        }));
        queue = [...queue, ...newItems];
        isPaused = false;
        broadcastLog(`รับงานใหม่ ${newItems.length} ชุด`, 'step');
        broadcastQueue();
        if (!isRunning) processQueue();
        sendResponse({ ok: true });
    }

    if (message.action === 'CLEAR_QUEUE') {
        queue = []; isRunning = false; isPaused = false;
        broadcastQueue();
    }

    if (message.action === 'PAUSE_QUEUE') {
        isPaused = true; isRunning = false;
        queue.filter(q => ['running', 'typing', 'submitting'].includes(q.status)).forEach(q => {
            q.status = 'pending'; q.error = 'หยุดชั่วคราว';
        });
        broadcastLog('หยุดชั่วคราว', 'warn');
        broadcastQueue();
    }

    if (message.action === 'RESUME_QUEUE') {
        isPaused = false;
        queue.filter(q => q.error === 'หยุดชั่วคราว').forEach(q => { q.error = null; });
        broadcastLog('ทำงานต่อ', 'step');
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
        const downloadOptions = { url: message.url };
        if (message.filename) {
            const folder = message.folder ? `${message.folder}/` : '';
            downloadOptions.filename = folder + message.filename;
        }
        chrome.downloads.download(downloadOptions).catch(e => broadcastLog(`Download ล้มเหลว: ${e.message}`, 'error'));
    }

    return true;
});