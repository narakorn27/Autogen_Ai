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
    const autoDownload = document.getElementById('autoDownload');
    const aspectRatio = document.getElementById('aspectRatio');
    const duration = document.getElementById('duration');
    const imageModel = document.getElementById('imageModel');
    const aiProvider = document.getElementById('aiProvider');
    const apiKeyLabel = document.getElementById('apiKeyLabel');
    const apiKey = document.getElementById('apiKey');
    const defaultVibe = document.getElementById('defaultVibe');

    let activeMode = 'text_to_video';
    let uploadedImages = [];

    // ─── State ───
    const loadState = async () => {
        const data = await chrome.storage.local.get('botState');
        if (data.botState) {
            const state = data.botState;
            activeMode = state.control.activeMode || 'text_to_video';
            updateModeUI(activeMode);
            
            concurrentPrompts.value = state.control.concurrentPrompts || 2;
            delayMin.value = state.control.delayMin || 20;
            delayMax.value = state.control.delayMax || 30;
            promptsText.value = state.control.promptsText || '';
            aiEnhance.checked = state.control.aiEnhance || false;
            outputsPerPrompt.value = state.control.outputsPerPrompt || 2;
            saveFolder.value = state.control.saveFolder || '';
            autoRename.checked = state.control.autoRename !== false;
            if (autoDownload) autoDownload.checked = state.control.autoDownload !== false;
            
            aspectRatio.value = state.settings.aspectRatio || '16:9';
            duration.value = state.settings.duration || '5s';
            imageModel.value = state.settings.imageModel || 'imagen_3';

            aiProvider.value = state.settings.aiProvider || 'gemini';
            updateProviderUI(aiProvider.value);

            apiKey.value = state.settings[`${aiProvider.value}_apiKey`] || state.settings.apiKey || '';
            defaultVibe.value = state.settings.defaultVibe || 'cinematic';
            
            // Frame to Video Specific
            uploadedImages = state.control.uploadedImages || [];
            if (document.getElementById('imageProcessing')) {
                document.getElementById('imageProcessing').value = state.control.imageProcessing || 'first_frame';
            }
            renderImagePreviews();

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
                autoRename: autoRename.checked,
                autoDownload: autoDownload ? autoDownload.checked : true,
                imageProcessing: document.getElementById('imageProcessing')?.value || 'first_frame',
                uploadedImages: uploadedImages
            },
            settings: {
                ...oldSettings,
                aspectRatio: aspectRatio.value,
                duration: duration.value,
                imageModel: imageModel.value,
                aiProvider: aiProvider.value,
                defaultVibe: defaultVibe.value
            },
            queue: await getQueue()
        };

        botState.settings[`${aiProvider.value}_apiKey`] = apiKey.value;
        botState.settings.apiKey = apiKey.value;

        await chrome.storage.local.set({ botState });
    };

    const renderImagePreviews = () => {
        const container = document.getElementById('image-previews');
        if (!container) return;
        container.innerHTML = '';

        if (uploadedImages.length === 0) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'grid';

        uploadedImages.forEach((img, index) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `
                <img src="${img.base64}" alt="${img.name}" title="${img.name}">
                <button class="remove-btn" data-index="${index}">×</button>
                <div class="index-badge">#${index + 1}</div>
            `;
            container.appendChild(div);
        });

        container.querySelectorAll('.remove-btn').forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.target.dataset.index);
                uploadedImages.splice(idx, 1);
                renderImagePreviews();
                saveState();
            };
        });
    };

    const providerLabels = { gemini: 'Gemini API Key', groq: 'Groq API Key', openrouter: 'OpenRouter API Key' };
    const providerPlaceholders = { gemini: 'กรอก API Key สำหรับ AI Enhance', groq: 'กรอก Groq API Key', openrouter: 'กรอก OpenRouter API Key' };

    const updateProviderUI = (provider) => {
        apiKeyLabel.innerText = providerLabels[provider] || 'API Key';
        apiKey.placeholder = providerPlaceholders[provider] || 'กรอก API Key';
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
    const hints = {
        text_to_video: 'ปรับสัดส่วนภาพ ความยาววิดีโอ และจำนวนได้ที่แถบ Setting',
        frame_to_video: 'อัปโหลดรูปแล้วปรับ Setting ได้ที่แถบ Setting',
        text_to_image: 'ปรับสัดส่วนภาพ โมเดลรูป และจำนวนได้ที่แถบ Setting — ดาวน์โหลดอัตโนมัติรองรับ'
    };

    const updateModeUI = (mode) => {
        activeMode = mode;
        modeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
        uploadZone.classList.toggle('hidden', mode !== 'frame_to_video');
        modeHint.innerText = hints[mode] || hints.text_to_video;
    };

    const statusLabel = {
        pending: 'รอ',
        running: 'กำลังรัน',
        typing: 'กำลังพิมพ์...',
        submitting: 'กำลังส่ง',
        completed: 'สำเร็จ',
        failed: 'ล้มเหลว'
    };

    const updateQueueUI = (queue) => {
        if (!queue || queue.length === 0) {
            queueList.innerHTML = '<div class="empty-queue">ไม่มีงานในคิว</div>';
            queueStatus.innerText = '0 กำลังรัน';
            return;
        }

        const activeCount = queue.filter(q => q.status === 'running').length;
        const total = queue.length;
        queueStatus.innerText = activeCount > 0 ? `${activeCount} กำลังรัน` : `${total} งาน`;

        queueList.innerHTML = queue.map(item => {
            const pct = item.percent ?? 0;
            const isDone = item.status === 'completed';
            const isFailed = item.status === 'failed';
            const isRunning = item.status === 'running' || item.status === 'typing' || item.status === 'submitting';
            const barWidth = isDone ? 100 : pct;
            const label = statusLabel[item.status] || item.status;
            const pctLabel = isDone ? '100%' : isFailed ? '!' : pct > 0 ? `${pct}%` : '';
            const fillClass = isRunning ? 'progress-fill progress-fill--running' : 'progress-fill';

            const statusIcon = isDone
                ? '<span class="status-icon status-icon--done" title="สำเร็จ">✓</span>'
                : '<span class="status-dot"></span>';
            return `
            <div class="queue-item status-${item.status}">
                <div class="item-main">
                    <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">
                        ${statusIcon}
                        <span class="item-text">${item.prompt}</span>
                    </div>
                    <span class="item-status-tag">${label}</span>
                </div>
                <div class="item-progress">
                    <div class="progress-track">
                        <div class="${fillClass}" style="width:${barWidth}%"></div>
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
        saveFolder, autoRename, autoDownload, aspectRatio, duration, imageModel, apiKey, defaultVibe, aiProvider];
    inputs.forEach(input => {
        if (!input) return;
        input.addEventListener('change', saveState);
        if (input.tagName === 'TEXTAREA' || input.type === 'text' || input.type === 'password') {
            input.addEventListener('input', saveState);
        }
    });

    const btnSaveSettings = document.getElementById('btnSaveSettings');
    const saveFeedback = document.getElementById('saveFeedback');
    if (btnSaveSettings && saveFeedback) {
        btnSaveSettings.addEventListener('click', async () => {
            await saveState();
            saveFeedback.classList.remove('hidden');
            setTimeout(() => saveFeedback.classList.add('hidden'), 2000);
        });
    }

    const btnPause = document.getElementById('btnPause');
    const btnResume = document.getElementById('btnResume');
    const btnRetryFailed = document.getElementById('btnRetryFailed');

    btnPause.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'PAUSE_QUEUE' });
        btnPause.classList.add('hidden');
        btnResume.classList.remove('hidden');
    });

    btnResume.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'RESUME_QUEUE' });
        btnResume.classList.add('hidden');
        btnPause.classList.remove('hidden');
    });

    btnRetryFailed.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'RETRY_FAILED' });
    });

    btnRun.addEventListener('click', async () => {
        btnPause.classList.remove('hidden');
        btnResume.classList.add('hidden');
        const text = promptsText.value.trim();
        if (!text) { alert('กรุณากรอก Prompt ก่อนเริ่มรัน'); return; }

        let prompts = [];
        if (text.includes('\n\n')) {
            prompts = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
        } else if ((text.includes('{') && text.includes('}')) || text.length > 600) {
            prompts = [text];
        } else {
            prompts = text.split('\n').map(p => p.trim()).filter(p => p.length > 0);
        }

        const processing = document.getElementById('imageProcessing')?.value || 'first_frame';
        const queueItems = prompts.map((p, i) => {
            let imgData = null;
            if (activeMode === 'frame_to_video' && uploadedImages.length > 0) {
                if (processing === 'first_frame') {
                    imgData = uploadedImages[0].base64;
                } else if (processing === 'one_per_prompt') {
                    imgData = uploadedImages[i] ? uploadedImages[i].base64 : null;
                } else if (processing === 'cycle') {
                    imgData = uploadedImages[i % uploadedImages.length].base64;
                }
            }
            return { prompt: p, image: imgData };
        });

        chrome.runtime.sendMessage({ 
            action: 'START_QUEUE', 
            items: queueItems, 
            mode: activeMode 
        });
        
        btnPause.classList.remove('hidden');
        btnResume.classList.add('hidden');
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
        
        let processedCount = 0;
        const total = files.length;

        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) {
                processedCount++;
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedImages.push({
                    name: file.name,
                    base64: e.target.result
                });
                processedCount++;
                if (processedCount === total) {
                    renderImagePreviews();
                    saveState();
                    dropZone.querySelector('span').innerText = `✅ เพิ่มรูปภาพสำเร็จ (${uploadedImages.length} รูป)`;
                }
            };
            reader.readAsDataURL(file);
        });
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