// ── Loader Sidepanel Logic (แจกลูกค้า) ──

const API_BASE = 'https://ar.paragonlandth.com/v1'; // ← เปลี่ยนตาม subdomain จริงของผู้ใช้
const PRODUCT = 'arin-meta-bot';

document.addEventListener('DOMContentLoaded', async () => {
    const licenseGate = document.getElementById('license-gate');
    const inputKey = document.getElementById('licenseKeyInput');
    const btnActivate = document.getElementById('btnActivate');
    const statusMsg = document.getElementById('licenseStatus');
    const machineIdDisplay = document.getElementById('machineIdDisplay');
    const mainWrapper = document.getElementById('main-content-wrapper');

    // License Status Bar elements
    const licensePlanName = document.getElementById('licensePlanName');
    const licenseDaysLeft = document.getElementById('licenseDaysLeft');
    const licenseDot = document.querySelector('.license-dot');
    const btnLogout = document.getElementById('btnLogout');

    // Initial state: ซ่อนทุกอย่างก่อน
    if (licenseGate) licenseGate.classList.add('hidden');
    if (mainWrapper) mainWrapper.classList.add('hidden');

    // 1. Generate Machine ID
    const machineId = await getMachineId();
    if (machineIdDisplay) {
        machineIdDisplay.innerText = `Device ID: ${machineId.substring(0, 16)}...`;
    }

    // 2. ตรวจสอบ License ที่เก็บไว้
    const data = await chrome.storage.local.get('licenseInfo');
    if (data.licenseInfo && data.licenseInfo.key) {
        const success = await verifyAndLoad(data.licenseInfo.key, machineId);
        if (!success) {
            // License หมดอายุ หรือถูก revoke → แสดงหน้า Login
            if (licenseGate) licenseGate.classList.remove('hidden');
        }
    } else {
        // ยังไม่เคย activate → แสดงหน้า Login
        if (licenseGate) licenseGate.classList.remove('hidden');
    }

    // 3. ปุ่ม Activate
    if (btnActivate) {
        btnActivate.onclick = async () => {
            const key = inputKey.value.trim().toUpperCase();
            if (!key) return showStatus('กรุณากรอก License Key', 'error');
            
            btnActivate.disabled = true;
            btnActivate.innerText = 'กำลังตรวจสอบ...';
            
            const success = await verifyAndLoad(key, machineId, true);
            if (!success) {
                btnActivate.disabled = false;
                btnActivate.innerText = 'เข้าสู่ระบบ';
            }
        };
    }

    // 4. ปุ่ม Logout
    if (btnLogout) {
        btnLogout.onclick = async () => {
            if (!confirm('ต้องการออกจากระบบใช่ไหม?')) return;
            await chrome.storage.local.remove(['licenseInfo', 'licenseVerified']);
            if (mainWrapper) mainWrapper.classList.add('hidden');
            if (licenseGate) licenseGate.classList.remove('hidden');
            if (inputKey) inputKey.value = '';
            showStatus('', '');
        };
    }

    /**
     * ตรวจสอบ License กับ Server และโหลด Core Code
     */
    async function verifyAndLoad(key, mId, setStorage = false) {
        try {
            const resp = await fetch(`${API_BASE}/c.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ k: key, m: mId, p: PRODUCT })
            });

            const result = await resp.json();
            
            if (result.success) {
                if (setStorage) {
                    await chrome.storage.local.set({ 
                        licenseInfo: { 
                            key, 
                            expires_at: result.expires_at,
                            plan: result.plan || 'Standard',
                            activated_at: new Date().toISOString()
                        } 
                    });
                }
                
                showStatus('สำเร็จ! กำลังโหลดบอท...', 'success');
                
                // อัปเดต License Status Bar
                updateLicenseStatusBar(result.expires_at, result.plan || 'Standard');

                // ส่งสัญญาณ license verified ไป background
                chrome.runtime.sendMessage({ 
                    action: 'LICENSE_VERIFIED', 
                    key: key,
                    mId: mId
                });

                // ซ่อน License Gate → แสดง Main UI
                if (licenseGate) licenseGate.classList.add('hidden');
                if (mainWrapper) mainWrapper.classList.remove('hidden');

                // รัน core logic ของ sidepanel
                initMainUI();
                
                // เริ่ม Heartbeat
                chrome.runtime.sendMessage({ action: 'START_HEARTBEAT' });
                
                return true;
            } else {
                showStatus(result.message || 'License ไม่ถูกต้องหรือหมดอายุ', 'error');
                if (licenseGate) licenseGate.classList.remove('hidden');
                if (mainWrapper) mainWrapper.classList.add('hidden');
                return false;
            }
        } catch (err) {
            console.error('Verify error:', err);
            showStatus('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
            
            // Offline fallback: ถ้ามี licenseInfo เก่าอยู่ ให้ใช้ต่อได้ (grace period)
            const cached = await chrome.storage.local.get('licenseInfo');
            if (cached.licenseInfo && cached.licenseInfo.expires_at) {
                const daysLeft = getDaysRemaining(cached.licenseInfo.expires_at);
                if (daysLeft > 0) {
                    showStatus('ออฟไลน์ — ใช้ License เดิมต่อ', 'success');
                    updateLicenseStatusBar(cached.licenseInfo.expires_at, cached.licenseInfo.plan || 'Standard');
                    
                    // ส่งสัญญาณ license verified ไป background (เพื่อ relay LICENSE_OK ไป content script)
                    chrome.runtime.sendMessage({ 
                        action: 'LICENSE_VERIFIED', 
                        key: cached.licenseInfo.key,
                        mId: mId
                    });
                    
                    if (licenseGate) licenseGate.classList.add('hidden');
                    if (mainWrapper) mainWrapper.classList.remove('hidden');
                    initMainUI();
                    return true;
                }
            }
            return false;
        }
    }

    /**
     * อัปเดต Status Bar แสดงแพลน + วันที่เหลือ
     */
    function updateLicenseStatusBar(expiresAt, plan) {
        const days = getDaysRemaining(expiresAt);
        
        if (licensePlanName) {
            licensePlanName.innerText = plan || 'Standard';
        }
        
        if (licenseDaysLeft) {
            if (days <= 0) {
                licenseDaysLeft.innerText = 'หมดอายุ';
                licenseDaysLeft.className = 'license-days expired';
            } else if (days <= 7) {
                licenseDaysLeft.innerText = `เหลือ ${days} วัน`;
                licenseDaysLeft.className = 'license-days warning';
            } else {
                licenseDaysLeft.innerText = `เหลือ ${days} วัน`;
                licenseDaysLeft.className = 'license-days';
            }
        }
        
        if (licenseDot) {
            licenseDot.className = days > 0 ? 'license-dot active' : 'license-dot expired';
        }
    }

    function getDaysRemaining(expiresAt) {
        if (!expiresAt) return 0;
        const now = new Date();
        const exp = new Date(expiresAt);
        const diff = exp - now;
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    function showStatus(msg, type) {
        if (!statusMsg) return;
        statusMsg.innerText = msg;
        statusMsg.className = `status-msg ${type || ''}`;
    }

    async function getMachineId() {
        const raw = [
            navigator.userAgent,
            `${screen.width}x${screen.height}`,
            Intl.DateTimeFormat().resolvedOptions().timeZone,
            navigator.hardwareConcurrency
        ].join('|');
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }



    function initMainUI() {
    // --- Elements ---
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const uploadZone = document.getElementById('upload-zone');
    const subModeContainer = document.getElementById('subModeContainer');
    const chipBtns = document.querySelectorAll('.chip-btn');
    const quickModel = document.getElementById('quickModel');
    
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const btnRun = document.getElementById('btnRun');
    const btnClear = document.getElementById('btnClear');
    const promptsText = document.getElementById('promptsText');
    const queueList = document.getElementById('queueList');
    const queueStatus = document.getElementById('queueStatus');

    const aiEnhance = document.getElementById('aiEnhance');
    const saveFolder = document.getElementById('saveFolder');
    const autoRename = document.getElementById('autoRename');
    const autoDownload = document.getElementById('autoDownload');
    const duration = document.getElementById('duration');
    const aiProvider = document.getElementById('aiProvider');
    const activeAiBadge = document.getElementById('activeAiBadge');
    const apiKeyLabel = document.getElementById('apiKeyLabel');
    const apiKey = document.getElementById('apiKey');
    const defaultVibe = document.getElementById('defaultVibe');

    let activeType = 'video'; // video | image
    let activeMode = 'text_to_video';
    let uploadedImages = [];

    const modelsByType = {
        video: [
            { value: 'veo-3-1-fast', label: 'Veo 3.1 - Fast' },
            { value: 'veo-3-1-high', label: 'Veo 3.1 - High Quality' }
        ],
        image: [
            { value: 'banana_nano_pro', label: 'Nano Banana Pro' },
            { value: 'banana_nano_2', label: 'Nano Banana 2' },
            { value: 'imagen_4', label: 'Imagen 4' }
        ]
    };

    // --- State Management ---
    const loadState = async () => {
        const data = await chrome.storage.local.get('botState');
        if (data.botState) {
            const state = data.botState;
            activeMode = state.control.activeMode || 'text_to_video';
            activeType = activeMode === 'text_to_image' ? 'image' : 'video';
            
            // Sync UI Chips
            updateChipUI('type', activeType);
            updateChipUI('mode', activeMode);
            const ratioSelect = document.getElementById('aspectRatio');
            if (ratioSelect) ratioSelect.value = state.settings.aspectRatio || '9:16';
            
            // Sync Inputs
            promptsText.value = state.control.promptsText || '';
            aiEnhance.checked = state.control.aiEnhance || false;
            saveFolder.value = state.control.saveFolder || '';
            autoRename.checked = state.control.autoRename !== false;
            if (autoDownload) autoDownload.checked = state.control.autoDownload !== false;
            
            duration.value = state.settings.duration || '5s';
            aiProvider.value = state.settings.aiProvider || 'gemini';
            updateProviderUI(aiProvider.value);
            apiKey.value = state.settings[`${aiProvider.value}_apiKey`] || state.settings.apiKey || '';
            defaultVibe.value = state.settings.defaultVibe || 'cinematic';
            
            // Model
            updateModelOptions(activeType);
            if (quickModel) quickModel.value = (activeType === 'image' ? state.settings.imageModel : state.settings.videoModel) || modelsByType[activeType][0].value;

            // Frame to Video Specific
            uploadedImages = state.control.uploadedImages || [];
            if (document.getElementById('imageProcessing')) {
                document.getElementById('imageProcessing').value = state.control.imageProcessing || 'first_frame';
            }
            renderImagePreviews();
            updateModeLogic();
            updateQueueUI(state.queue || []);
        } else {
            // Default settings
            updateModelOptions('video');
            updateModeLogic();
        }
    };

    const saveState = async () => {
        const data = await chrome.storage.local.get('botState');
        const oldSettings = data.botState?.settings || {};

        const ratioSelect = document.getElementById('aspectRatio');
        const activeRatio = ratioSelect ? ratioSelect.value : '9:16';
        const activeCount = 1;

        const botState = {
            control: {
                activeMode,
                promptsText: promptsText.value,
                aiEnhance: aiEnhance.checked,
                outputsPerPrompt: activeCount,
                saveFolder: saveFolder.value,
                autoRename: autoRename.checked,
                autoDownload: autoDownload ? autoDownload.checked : true,
                imageProcessing: document.getElementById('imageProcessing')?.value || 'first_frame',
                uploadedImages: uploadedImages
            },
            settings: {
                ...oldSettings,
                aspectRatio: activeRatio,
                duration: duration.value,
                aiProvider: aiProvider.value,
                defaultVibe: defaultVibe.value
            },
            queue: await getQueue()
        };

        if (activeType === 'image') {
            botState.settings.imageModel = quickModel ? quickModel.value : null;
        } else {
            botState.settings.videoModel = quickModel ? quickModel.value : null;
        }

        botState.settings[`${aiProvider.value}_apiKey`] = apiKey.value;
        botState.settings.apiKey = apiKey.value;

        await chrome.storage.local.set({ botState });
    };

    // --- UI Helpers ---
    const updateChipUI = (grp, val) => {
        document.querySelectorAll(`.chip-btn[data-${grp}]`).forEach(btn => {
            btn.classList.toggle('active', btn.dataset[grp] == val);
        });
    };

    const updateModelOptions = (type) => {
        if (quickModel) quickModel.innerHTML = modelsByType[type].map(m => `<option value="${m.value}">${m.label}</option>`).join('');
    };

    const updateModeLogic = () => {
        // Toggle Sub-mode row visibility
        subModeContainer.classList.toggle('hidden', activeType === 'image');
        
        // Final mode decision
        if (activeType === 'image') {
            activeMode = 'text_to_image';
        } else {
            activeMode = document.querySelector('.chip-btn[data-mode].active')?.dataset.mode || 'text_to_video';
        }

        // Toggle Upload Zone
        uploadZone.classList.toggle('hidden', activeMode !== 'frame_to_video');
    };

    const renderImagePreviews = () => {
        const container = document.getElementById('image-previews');
        if (!container) return;
        container.innerHTML = '';
        if (uploadedImages.length === 0) { container.style.display = 'none'; return; }
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

    const updateProviderUI = (provider) => {
        const labels = { gemini: 'Gemini API Key', groq: 'Groq API Key', openrouter: 'OpenRouter API Key' };
        apiKeyLabel.innerText = labels[provider] || 'API Key';
        apiKey.placeholder = `กรอก API Key สำหรับ ${provider}`;
        
        if (activeAiBadge) {
            const badgeLabels = { gemini: 'Gemini 2.0', groq: 'Groq Fast', openrouter: 'OpenRouter' };
            activeAiBadge.innerText = badgeLabels[provider] || provider;
        }
    };

    // --- Events ---
    // Tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
        });
    });

    // Chip Buttons (Type, Mode, Ratio, Count)
    chipBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const ds = btn.dataset;
            if (ds.type) {
                activeType = ds.type;
                updateChipUI('type', activeType);
                updateModelOptions(activeType);
                updateModeLogic();
            } else if (ds.mode) {
                updateChipUI('mode', ds.mode);
                updateModeLogic();
            }
            saveState();
        });
    });

    // Settings Inputs
    const autoInputs = [promptsText, aiEnhance, 
        saveFolder, autoRename, autoDownload, duration, apiKey, defaultVibe, aiProvider, quickModel, document.getElementById('aspectRatio')];
    autoInputs.forEach(input => {
        if (!input) return;
        input.addEventListener('change', saveState);
        if (input.tagName === 'TEXTAREA' || input.type === 'text' || input.type === 'password') {
            input.addEventListener('input', saveState);
        }
    });

    aiProvider.addEventListener('change', async () => {
        updateProviderUI(aiProvider.value);
        const data = await chrome.storage.local.get('botState');
        apiKey.value = data.botState?.settings?.[`${aiProvider.value}_apiKey`] || '';
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

        let prompts = text.includes('\n\n') ? text.split(/\n\s*\n/) : text.split('\n');
        prompts = prompts.map(p => p.trim()).filter(p => p.length > 0);

        const processing = document.getElementById('imageProcessing')?.value || 'first_frame';
        const queueItems = prompts.map((p, i) => {
            let imgData = null;
            let imagesArray = [];
            if (activeMode === 'frame_to_video' && uploadedImages.length > 0) {
                if (processing === 'first_frame') {
                    imgData = uploadedImages[0].base64;
                    imagesArray = [uploadedImages[0].base64];
                } else if (processing === 'one_per_prompt') {
                    imgData = uploadedImages[i]?.base64 || null;
                    imagesArray = imgData ? [imgData] : [];
                } else if (processing === 'cycle') {
                    imgData = uploadedImages[i % uploadedImages.length].base64;
                    imagesArray = [imgData];
                } else if (processing === 'all_images') {
                    // ส่งรูปทั้งหมดไปพร้อมกัน
                    imagesArray = uploadedImages.map(img => img.base64);
                    imgData = imagesArray[0] || null;
                }
            }
            return { prompt: p, image: imgData, images: imagesArray };
        });

        chrome.runtime.sendMessage({ action: 'START_QUEUE', items: queueItems, mode: activeMode });
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
        const editIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
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
        btn.innerHTML = `${editIcon} ให้ AI ช่วยปรับปรุง`;
        btn.disabled = false;
    });

    // Upload Files
    const handleFiles = (files) => {
        if (!files) return;
        let count = 0;
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedImages.push({ name: file.name, base64: e.target.result });
                count++;
                if (count === Array.from(files).filter(f => f.type.startsWith('image/')).length) {
                    renderImagePreviews();
                    saveState();
                }
            };
            reader.readAsDataURL(file);
        });
    };
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); });
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

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
    const getQueue = async () => (await chrome.storage.local.get('botState')).botState?.queue || [];
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
            
            // แปลงสถานะเป็นภาษาไทย
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
                        <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                            <span style="display:flex; align-items:center; gap:4px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                เกิดข้อผิดพลาด
                            </span>
                            <button class="btn-error-toggle" data-toggle-error="true">ดูรายละเอียด</button>
                        </div>
                        <div class="item-error" style="width:100%; display:none;">${item.error}</div>
                    </div>
                ` : ''}
            </div>`;
        }).join('');

        // ─── Event delegation: ปุ่ม "ดูรายละเอียด" (ห้ามใช้ inline onclick ใน MV3) ───
        queueList.querySelectorAll('[data-toggle-error]').forEach(btn => {
            btn.addEventListener('click', () => {
                const errorDiv = btn.parentElement.nextElementSibling;
                if (errorDiv) {
                    const isVisible = errorDiv.style.display !== 'none';
                    errorDiv.style.display = isVisible ? 'none' : 'block';
                    btn.textContent = isVisible ? 'ดูรายละเอียด' : 'ซ่อน';
                }
            });
        });
    };

    chrome.runtime.onMessage.addListener((m) => { if (m.action === 'QUEUE_UPDATED') updateQueueUI(m.queue); });

    const urlOverlay = document.getElementById('url-overlay');
    setInterval(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        urlOverlay.classList.toggle('hidden', !!(tab?.url?.includes('meta.ai')));
    }, 1000);

    loadState();
    }

    // Heartbeat listener
    chrome.runtime.onMessage.addListener((m) => {
        if (m.action === 'DO_HEARTBEAT') {
            chrome.storage.local.get('licenseInfo', async (data) => {
                if (data.licenseInfo && data.licenseInfo.key) {
                    await verifyAndLoad(data.licenseInfo.key, machineId);
                }
            });
        }
    });
});
