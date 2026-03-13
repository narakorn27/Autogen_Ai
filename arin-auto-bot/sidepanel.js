document.addEventListener('DOMContentLoaded', async () => {
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const modeBtns = document.querySelectorAll('.mode-btn');
    const uploadZone = document.getElementById('upload-zone');
    const modeHint = document.getElementById('modeHint');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const btnRun = document.getElementById('btnRun');
    const btnClear = document.getElementById('btnClear');
    const promptsText = document.getElementById('promptsText');
    const queueList = document.getElementById('queueList');
    const queueStatus = document.getElementById('queueStatus');

    const concurrentPrompts = document.getElementById('concurrentPrompts');
    const delayMin = document.getElementById('delayMin');
    const delayMax = document.getElementById('delayMax');
    const aiEnhance = document.getElementById('aiEnhance');
    const outputsPerPrompt = document.getElementById('outputsPerPrompt');
    const saveFolder = document.getElementById('saveFolder');
    const autoRename = document.getElementById('autoRename');
    const aspectRatio = document.getElementById('aspectRatio');
    const duration = document.getElementById('duration');
    const imageModel = document.getElementById('imageModel');
    const aiProvider = document.getElementById('aiProvider');
    const apiKeyLabel = document.getElementById('apiKeyLabel');
    const apiKey = document.getElementById('apiKey');
    const defaultVibe = document.getElementById('defaultVibe');

    let activeMode = 'text_to_video';

    const providerLabels = {
        gemini: 'Gemini API Key',
        groq: 'Groq API Key',
        openrouter: 'OpenRouter API Key'
    };

    const providerPlaceholders = {
        gemini: 'กรอก Gemini API Key (ฟรี 20 req/min)',
        groq: 'กรอก Groq API Key (gsk_...)',
        openrouter: 'กรอก OpenRouter API Key (sk-or-v1-...)'
    };

    // ─── State ───
    const loadState = async () => {
        const data = await chrome.storage.local.get('botState');
        if (data.botState) {
            const state = data.botState;
            activeMode = state.control.activeMode || 'text_to_video';
            updateModeUI(activeMode);
            concurrentPrompts.value = state.control.concurrentPrompts;
            delayMin.value = state.control.delayMin || 20;
            delayMax.value = state.control.delayMax || 30;
            promptsText.value = state.control.promptsText || '';
            aiEnhance.checked = state.control.aiEnhance || false;
            outputsPerPrompt.value = state.control.outputsPerPrompt || 2;
            saveFolder.value = state.control.saveFolder || '';
            autoRename.checked = state.control.autoRename !== false;
            aspectRatio.value = state.settings.aspectRatio || '16:9';
            duration.value = state.settings.duration || '5s';
            imageModel.value = state.settings.imageModel || 'imagen_3';

            aiProvider.value = state.settings.aiProvider || 'gemini';
            updateProviderUI(aiProvider.value);

            // Load keys from provider-specific storage or fallback to old apiKey
            apiKey.value = state.settings[`${aiProvider.value}_apiKey`] || state.settings.apiKey || '';

            defaultVibe.value = state.settings.defaultVibe || 'cinematic';
            updateQueueUI(state.queue || []);
        }
    };

    const saveState = async () => {
        const data = await chrome.storage.local.get('botState');
        const oldSettings = data.botState?.settings || {};

        const botState = {
            control: {
                activeMode,
                concurrentPrompts: parseInt(concurrentPrompts.value),
                delayMin: parseInt(delayMin.value),
                delayMax: parseInt(delayMax.value),
                promptsText: promptsText.value,
                aiEnhance: aiEnhance.checked,
                outputsPerPrompt: parseInt(outputsPerPrompt.value),
                saveFolder: saveFolder.value,
                autoRename: autoRename.checked
            },
            settings: {
                ...oldSettings,
                aspectRatio: aspectRatio.value,
                duration: duration.value,
                imageModel: imageModel.value,
                aiProvider: aiProvider.value,
                defaultVibe: defaultVibe.value,
                aiEnhance: aiEnhance.checked,
                outputsPerPrompt: parseInt(outputsPerPrompt.value),
                saveFolder: saveFolder.value,
                autoRename: autoRename.checked
            },
            queue: await getQueue()
        };

        // Save the current key to its specific slot
        botState.settings[`${aiProvider.value}_apiKey`] = apiKey.value;
        // Keep apiKey for backward compatibility or easy access in background
        botState.settings.apiKey = apiKey.value;

        await chrome.storage.local.set({ botState });
    };

    const updateProviderUI = (provider) => {
        apiKeyLabel.innerText = providerLabels[provider];
        apiKey.placeholder = providerPlaceholders[provider];
    };

    aiProvider.addEventListener('change', async () => {
        updateProviderUI(aiProvider.value);
        const data = await chrome.storage.local.get('botState');
        if (data.botState && data.botState.settings) {
            apiKey.value = data.botState.settings[`${aiProvider.value}_apiKey`] || '';
        } else {
            apiKey.value = '';
        }
        saveState();
    });

    const getQueue = async () => {
        const data = await chrome.storage.local.get('botState');
        return data.botState?.queue || [];
    };

    // ─── UI ───
    const updateModeUI = (mode) => {
        activeMode = mode;
        modeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
        uploadZone.classList.toggle('hidden', mode !== 'frame_to_video');
        modeHint.innerText = hints[mode];
    };

    const statusLabel = {
        pending: 'pending',
        running: 'running',
        typing: 'typing...',
        submitting: 'submit',
        completed: 'done ✓',
        failed: 'failed'
    };

    const updateQueueUI = (queue) => {
        if (!queue || queue.length === 0) {
            queueList.innerHTML = '<div class="empty-queue">ไม่มีงานในคิว</div>';
            queueStatus.innerText = '0 running';
            return;
        }

        const activeCount = queue.filter(q => q.status === 'running').length;
        queueStatus.innerText = `${activeCount} running`;

        queueList.innerHTML = queue.map(item => {
            const pct = item.percent ?? 0;
            const isDone = item.status === 'completed';
            const isFailed = item.status === 'failed';
            const barWidth = isDone ? 100 : pct;
            const label = statusLabel[item.status] || item.status;
            const pctLabel = isDone ? '100%' : isFailed ? '!' : pct > 0 ? `${pct}%` : '';

            return `
            <div class="queue-item status-${item.status}">
                <div class="item-main">
                    <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">
                        <span class="status-dot"></span>
                        <span class="item-text">${item.prompt}</span>
                    </div>
                    <span class="item-status-tag">${label}</span>
                </div>
                <div class="item-progress">
                    <div class="progress-track">
                        <div class="progress-fill" style="width:${barWidth}%"></div>
                    </div>
                    <span class="progress-label">${pctLabel}</span>
                </div>
                ${item.error ? `<div class="item-error">${item.error}</div>` : ''}
            </div>`;
        }).join('');
    };

    // ─── Events ───
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
        });
    });

    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => { updateModeUI(btn.dataset.mode); saveState(); });
    });

    const inputs = [concurrentPrompts, delayMin, delayMax, promptsText, aiEnhance, outputsPerPrompt,
        saveFolder, autoRename, aspectRatio, duration, imageModel, apiKey, defaultVibe, aiProvider];
    inputs.forEach(input => {
        if (!input) return;
        input.addEventListener('change', saveState);
        if (input.tagName === 'TEXTAREA' || input.type === 'text' || input.type === 'password') {
            input.addEventListener('input', saveState);
        }
    });

    btnRun.addEventListener('click', async () => {
        const text = promptsText.value.trim();
        if (!text) { alert('กรุณากรอก Prompt ก่อนเริ่มรัน'); return; }

        let prompts = [];
        if (text.includes('\n\n')) {
            // Split by blank lines (intentional separation of multi-line blocks)
            prompts = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
        } else if ((text.includes('{') && text.includes('}')) || text.length > 600) {
            // Single complex masterpiece prompt
            prompts = [text];
        } else {
            // Standard list: one prompt per line
            prompts = text.split('\n').map(p => p.trim()).filter(p => p.length > 0);
        }

        chrome.runtime.sendMessage({ action: 'START_QUEUE', prompts, mode: activeMode });
    });

    btnClear.addEventListener('click', async () => {
        promptsText.value = '';
        chrome.runtime.sendMessage({ action: 'CLEAR_QUEUE' });
        saveState();
    });

    // AI Check
    const btnCheckApi = document.getElementById('btnCheckApi');
    const apiStatusIcon = document.getElementById('apiStatusIcon');
    const apiStatusText = document.getElementById('apiStatusText');

    const updateApiStatus = (status, message = '') => {
        const apiField = apiKey.closest('.field');
        if (!apiField) return;
        apiField.classList.remove('api-loading', 'api-success', 'api-error');
        if (status) apiField.classList.add(`api-${status}`);

        if (status === 'loading') {
            apiStatusIcon.innerHTML = '<div class="api-loader"></div>';
        } else if (status === 'success') {
            apiStatusIcon.innerText = '✅';
        } else if (status === 'error') {
            apiStatusIcon.innerText = '❌';
        } else {
            apiStatusIcon.innerText = '⚡';
        }
        apiStatusText.innerText = message || (status === 'success' ? 'API Key ใช้งานได้ปกติ' : 'กรุณาตรวจสอบความถูกต้องของ Key');
    };

    btnCheckApi.addEventListener('click', async () => {
        const key = apiKey.value.trim();
        if (!key) { updateApiStatus('error', 'กรุณากรอก API Key'); return; }
        updateApiStatus('loading', 'กำลังตรวจสอบ...');
        try {
            const response = await new Promise(resolve => {
                chrome.runtime.sendMessage({ action: 'CHECK_API_KEY', apiKey: key, provider: aiProvider.value }, resolve);
            });
            if (response && response.success) {
                updateApiStatus('success');
            } else {
                updateApiStatus('error', response?.error || 'Key ไม่ถูกต้อง');
            }
        } catch (err) {
            updateApiStatus('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
    });

    // Manual AI Enhance
    const btnEnhanceManual = document.getElementById('btnEnhanceManual');
    if (btnEnhanceManual) {
        btnEnhanceManual.addEventListener('click', async () => {
            const text = promptsText.value.trim();
            const key = apiKey.value.trim();
            if (!text || !key) { alert('กรุณากรอก Prompt และ Gemini API Key ก่อน'); return; }

            btnEnhanceManual.innerText = '✨ กำลังขยายความ...';
            btnEnhanceManual.disabled = true;

            const prompts = text.split('\n').map(p => p.trim()).filter(p => p.length > 0);
            const enhanced = [];

            try {
                for (const p of prompts) {
                    const response = await new Promise(resolve => {
                        chrome.runtime.sendMessage({
                            action: 'ENHANCE_PROMPT_PREVIEW',
                            prompt: p,
                            apiKey: key,
                            vibe: defaultVibe.value,
                            provider: aiProvider.value
                        }, resolve);
                    });
                    enhanced.push(response?.success ? response.enhanced : p);
                }
                promptsText.value = enhanced.join('\n');
                saveState();
            } catch (err) {
                alert('AI Enhance ผิดพลาด: ' + err.message);
            } finally {
                btnEnhanceManual.innerText = '✨ AI Edit (Preview)';
                btnEnhanceManual.disabled = false;
            }
        });
    }

    // Upload TXT
    const btnUploadTxt = document.getElementById('uploadTxt');
    if (btnUploadTxt) {
        btnUploadTxt.addEventListener('click', () => {
            const tempInput = document.createElement('input');
            tempInput.type = 'file';
            tempInput.accept = '.txt';
            tempInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (re) => { promptsText.value = re.target.result; saveState(); };
                reader.readAsText(file);
            };
            tempInput.click();
        });
    }

    // Drop Zone
    const handleFiles = (files) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            await chrome.storage.local.set({ activeImage: base64 });
            dropZone.querySelector('span').innerText = `✅ อัปโหลดเรียบร้อย: ${file.name}`;
        };
        reader.readAsDataURL(file);
    };

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // Listen for queue updates
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'QUEUE_UPDATED') updateQueueUI(message.queue);
    });

    // URL Check
    const urlOverlay = document.getElementById('url-overlay');
    const checkCurrentTab = async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            urlOverlay.classList.toggle('hidden', !!(tab?.url?.includes('labs.google/fx/')));
        } catch (err) { console.error(err); }
    };

    setInterval(checkCurrentTab, 1000);
    await loadState();
    await checkCurrentTab();
});