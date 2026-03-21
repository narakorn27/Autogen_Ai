document.addEventListener('DOMContentLoaded', async () => {
    // --- Elements ---
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const generationMode = document.getElementById('generationMode');
    
    const btnRun = document.getElementById('btnRun');
    const btnClear = document.getElementById('btnClear');
    const promptsText = document.getElementById('promptsText');
    const queueList = document.getElementById('queueList');
    const queueStatus = document.getElementById('queueStatus');

    const aiEnhance = document.getElementById('aiEnhance');
    const saveFolder = document.getElementById('saveFolder');
    const autoRename = document.getElementById('autoRename');
    const autoDownload = document.getElementById('autoDownload');
    const aiProvider = document.getElementById('aiProvider');
    const activeAiBadge = document.getElementById('activeAiBadge');
    const apiKeyLabel = document.getElementById('apiKeyLabel');
    const apiKey = document.getElementById('apiKey');
    const defaultVibe = document.getElementById('defaultVibe');
    const aspectRatio = document.getElementById('aspectRatio');

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const imageProcessing = document.getElementById('imageProcessing');
    const imagePreviews = document.getElementById('image-previews');

    let activeMode = 'Create Image';
    let uploadedImages = [];

    // --- State Management ---
    const loadState = async () => {
        const data = await chrome.storage.local.get('qwenBotState');
        if (data.qwenBotState) {
            const state = data.qwenBotState;
            activeMode = state.control.activeMode || 'Create Image';
            
            if (generationMode) generationMode.value = activeMode;
            if (aspectRatio) aspectRatio.value = state.settings.aspectRatio || '9:16';
            
            // Sync Inputs
            promptsText.value = state.control.promptsText || '';
            aiEnhance.checked = state.control.aiEnhance || false;
            saveFolder.value = state.control.saveFolder || '';
            autoRename.checked = state.control.autoRename !== false;
            if (autoDownload) autoDownload.checked = state.control.autoDownload !== false;
            
            aiProvider.value = state.settings.aiProvider || 'gemini';
            updateProviderUI(aiProvider.value);
            apiKey.value = state.settings[`${aiProvider.value}_apiKey`] || state.settings.apiKey || '';
            defaultVibe.value = state.settings.defaultVibe || 'cinematic';
            
            uploadedImages = state.control.uploadedImages || [];
            if (imageProcessing) imageProcessing.value = state.control.imageProcessing || 'first_frame';
            renderImagePreviews();
            
            // Sync Custom Select UI
            if (aspectRatio) {
                const opt = document.querySelector(`.custom-option[data-value="${aspectRatio.value}"]`);
                if (opt) {
                    document.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    const triggerValue = document.querySelector('.custom-select-value');
                    if(triggerValue) triggerValue.innerHTML = opt.innerHTML;
                }
            }

            updateQueueUI(state.queue || []);
        }
    };

    const saveState = async () => {
        const data = await chrome.storage.local.get('qwenBotState');
        const oldSettings = data.qwenBotState?.settings || {};

        const activeRatio = aspectRatio?.value || '9:16';

        const qwenBotState = {
            control: {
                activeMode: generationMode.value,
                promptsText: promptsText.value,
                aiEnhance: aiEnhance.checked,
                saveFolder: saveFolder.value,
                autoRename: autoRename.checked,
                autoDownload: autoDownload ? autoDownload.checked : true,
                imageProcessing: imageProcessing?.value || 'first_frame',
                uploadedImages: uploadedImages
            },
            settings: {
                ...oldSettings,
                aspectRatio: activeRatio,
                aiProvider: aiProvider.value,
                defaultVibe: defaultVibe.value
            },
            queue: await getQueue()
        };

        qwenBotState.settings[`${aiProvider.value}_apiKey`] = apiKey.value;
        qwenBotState.settings.apiKey = apiKey.value;

        await chrome.storage.local.set({ qwenBotState });
    };

    const updateProviderUI = (provider) => {
        const labels = { gemini: 'Gemini API Key', groq: 'Groq API Key', openrouter: 'OpenRouter API Key' };
        apiKeyLabel.innerText = labels[provider] || 'API Key';
        apiKey.placeholder = `กรอก API Key สำหรับ ${provider}`;
        
        if (activeAiBadge) {
            const badgeLabels = { gemini: 'Gemini 2.0', groq: 'Groq Fast', openrouter: 'OpenRouter' };
            activeAiBadge.innerText = badgeLabels[provider] || provider;
        }
    };

    const renderImagePreviews = () => {
        if (!imagePreviews) return;
        imagePreviews.innerHTML = '';
        if (uploadedImages.length === 0) { 
            imagePreviews.classList.add('hidden'); 
            return; 
        }
        imagePreviews.classList.remove('hidden');
        imagePreviews.style.display = 'grid';

        uploadedImages.forEach((img, index) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `
                <img src="${img.base64}" alt="${img.name}" title="${img.name}">
                <button class="remove-btn" data-index="${index}">×</button>
                <div class="index-badge">#${index + 1}</div>
            `;
            imagePreviews.appendChild(div);
        });

        imagePreviews.querySelectorAll('.remove-btn').forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.target.dataset.index);
                uploadedImages.splice(idx, 1);
                renderImagePreviews();
                saveState();
            };
        });
    };

    // --- Events ---
    // Custom Dropdown Logic
    const ratioSelect = document.getElementById('ratioSelect');
    if (ratioSelect) {
        const trigger = ratioSelect.querySelector('.custom-select-trigger');
        const triggerValue = ratioSelect.querySelector('.custom-select-value');
        const options = ratioSelect.querySelectorAll('.custom-option');
        
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            ratioSelect.classList.toggle('open');
        });

        options.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                options.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                triggerValue.innerHTML = opt.innerHTML;
                aspectRatio.value = opt.dataset.value;
                ratioSelect.classList.remove('open');
                
                aspectRatio.dispatchEvent(new Event('change'));
            });
        });

        document.addEventListener('click', () => {
            ratioSelect.classList.remove('open');
        });
    }

    // Tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
        });
    });

    const autoInputs = [promptsText, aiEnhance, generationMode,
        saveFolder, autoRename, autoDownload, apiKey, defaultVibe, aiProvider,
        aspectRatio];
    autoInputs.forEach(input => {
        if (!input) return;
        if (input.id === 'aspectRatio') { 
            input.addEventListener('change', saveState);
        } else {
            input.addEventListener('change', saveState);
            if (input.tagName === 'TEXTAREA' || input.type === 'text' || input.type === 'password' || input.type === 'hidden') {
                input.addEventListener('input', saveState);
            }
        }
    });

    aiProvider.addEventListener('change', async () => {
        updateProviderUI(aiProvider.value);
        const data = await chrome.storage.local.get('qwenBotState');
        apiKey.value = data.qwenBotState?.settings?.[`${aiProvider.value}_apiKey`] || '';
        saveState();
    });

    // Control Buttons
    document.getElementById('btnPause').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'PAUSE_QUEUE' });
        document.getElementById('btnPause').classList.add('hidden');
        document.getElementById('btnResume').classList.remove('hidden');
    });

    document.getElementById('btnResume').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'RESUME_QUEUE' });
        document.getElementById('btnResume').classList.add('hidden');
        document.getElementById('btnPause').classList.remove('hidden');
    });

    document.getElementById('btnRetryFailed').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'RETRY_FAILED' });
    });

    btnClear.addEventListener('click', async () => {
        promptsText.value = '';
        chrome.runtime.sendMessage({ action: 'CLEAR_QUEUE' });
        saveState();
    });

    // Run Logic
    btnRun.addEventListener('click', async () => {
        const text = promptsText.value.trim();
        if (!text) { alert('กรุณากรอก Prompt ก่อนเริ่มรัน'); return; }

        let prompts = [];
        if (text.includes('---')) {
            prompts = text.split(/---+/).map(p => p.trim()).filter(p => p.length > 0);
        } else if (text.includes('\n\n\n')) {
            prompts = text.split(/\n\s*\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
        } else {
            prompts = [text];
        }

        const processing = imageProcessing?.value || 'first_frame';
        const queueItems = prompts.map((p, i) => {
            let imgData = null;
            if (uploadedImages.length > 0) {
                if (processing === 'first_frame') imgData = uploadedImages[0].base64;
                else if (processing === 'one_per_prompt') imgData = uploadedImages[i]?.base64 || null;
                else if (processing === 'cycle') imgData = uploadedImages[i % uploadedImages.length].base64;
            }
            return { prompt: p, images: imgData ? [imgData] : [] };
        });

        chrome.runtime.sendMessage({ action: 'START_QUEUE', items: queueItems, mode: generationMode.value });
    });

    // AI API Check
    document.getElementById('btnCheckApi').addEventListener('click', async () => {
        const key = apiKey.value.trim();
        if (!key) return;
        const icon = document.getElementById('apiStatusIcon');
        const text = document.getElementById('apiStatusText');
        
        icon.innerText = '⏳';
        text.innerText = 'กำลังตรวจสอบ...';
        
        const response = await new Promise(res => chrome.runtime.sendMessage({ action: 'CHECK_API_KEY', apiKey: key, provider: aiProvider.value }, res));
        if (response?.success) {
            icon.innerText = '✅';
            text.innerText = 'API Key ใช้งานได้ปกติ';
        } else {
            icon.innerText = '❌';
            text.innerText = response?.error || 'Key ไม่ถูกต้อง';
        }
    });

    // AI Enhance Manual
    document.getElementById('btnEnhanceManual').addEventListener('click', async () => {
        const text = promptsText.value.trim();
        const key = apiKey.value.trim();
        if (!text || !key) { alert('โปรดกรอก Prompt และ API Key'); return; }

        const btn = document.getElementById('btnEnhanceManual');
        btn.innerHTML = '✨ กำลังประมวลผล...';
        btn.disabled = true;

        const prompts = text.split('\n').filter(p => p.trim());
        const enhanced = [];
        for (const p of prompts) {
            const res = await new Promise(res => chrome.runtime.sendMessage({ 
                action: 'ENHANCE_PROMPT_PREVIEW', prompt: p, apiKey: key, vibe: defaultVibe.value, provider: aiProvider.value 
            }, res));
            enhanced.push(res?.success ? res.enhanced : p);
        }
        promptsText.value = enhanced.join('\n');
        saveState();
        btn.innerHTML = `✨ ให้ AI ช่วยปรับปรุง`;
        btn.disabled = false;
    });

    // Upload Files Handling
    const handleFiles = (files) => {
        if (!files || files.length === 0) return;
        let count = 0;
        const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (validFiles.length === 0) return;
        
        validFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedImages.push({ name: file.name, base64: e.target.result });
                count++;
                if (count === validFiles.length) {
                    renderImagePreviews();
                    saveState();
                }
            };
            reader.readAsDataURL(file);
        });
    };

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => { 
            e.preventDefault(); 
            dropZone.classList.remove('dragover');
            handleFiles(e.dataTransfer.files); 
        });
        fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    }

    document.getElementById('uploadTxt').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.txt';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (re) => { promptsText.value = re.target.result; saveState(); };
            reader.readAsText(file);
        };
        input.click();
    });

    // Queue UI Logic
    const getQueue = async () => (await chrome.storage.local.get('qwenBotState')).qwenBotState?.queue || [];
    const updateQueueUI = (queue) => {
        if (!queue || queue.length === 0) {
            queueList.innerHTML = '<div class="empty-queue">ไม่มีงานในคิว</div>';
            queueStatus.innerText = '0 กำลังรัน';
            return;
        }
        const activeCount = queue.filter(q => q.status === 'running').length;
        queueStatus.innerText = activeCount > 0 ? `${activeCount} กำลังรัน` : `${queue.length} งาน`;

        queueList.innerHTML = queue.map(item => {
            const isDone = item.status === 'completed';
            const isRunning = ['running', 'typing', 'submitting'].includes(item.status);
            const pct = isDone ? 100 : (item.percent || 0);
            
            const statusLabels = {
                'pending': 'รอคิว',
                'running': 'กำลังรัน',
                'typing': 'กำลังพิมพ์',
                'submitting': 'กำลังส่ง',
                'completed': 'สำเร็จ',
                'failed': 'ล้มเหลว'
            };
            const statusLabel = statusLabels[item.status] || item.status;
            
            return `
            <div class="queue-item status-${item.status}">
                <div class="item-main">
                    <div style="display:flex;align-items:center;gap:6px;min-width:0">
                        ${isDone ? '<span class="status-icon status-icon--done">✓</span>' : '<span class="status-dot"></span>'}
                        <span class="item-text">${item.prompt}</span>
                    </div>
                    <span class="item-status-tag">${statusLabel}</span>
                </div>
                <div class="item-progress">
                    <div class="progress-track"><div class="progress-fill ${isRunning ? 'progress-fill--running' : ''}" style="width:${pct}%"></div></div>
                    <span class="progress-label">${isDone ? '100%' : pct + '%'}</span>
                </div>
                ${item.error ? `
                    <div style="font-size:10px; color:var(--danger); margin-top:8px; display:flex; align-items:flex-start; flex-direction:column; gap:4px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
                        <div class="item-error" style="width:100%;">${item.error}</div>
                    </div>
                ` : ''}
            </div>`;
        }).join('');
    };

    chrome.runtime.onMessage.addListener((m) => { if (m.action === 'QUEUE_UPDATED') updateQueueUI(m.queue); });

    const urlOverlay = document.getElementById('url-overlay');
    setInterval(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        urlOverlay.classList.toggle('hidden', !!(tab?.url?.includes('chat.qwen.ai')));
    }, 1000);

    loadState();
});
