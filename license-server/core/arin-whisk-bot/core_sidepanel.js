// ── Arin Whisk Bot — Sidepanel Logic ──
// License gate + state management + queue UI + upload handlers

const API_BASE = 'https://ar.paragonlandth.com/v1';
const PRODUCT = 'arin-whisk-bot';

document.addEventListener('DOMContentLoaded', async () => {
    const licenseGate = document.getElementById('license-gate');
    const inputKey = document.getElementById('licenseKeyInput');
    const btnActivate = document.getElementById('btnActivate');
    const statusMsg = document.getElementById('licenseStatus');
    const machineIdDisplay = document.getElementById('machineIdDisplay');
    const mainWrapper = document.getElementById('main-content-wrapper');

    const licensePlanName = document.getElementById('licensePlanName');
    const licenseDaysLeft = document.getElementById('licenseDaysLeft');
    const licenseDot = document.querySelector('.license-dot');
    const btnLogout = document.getElementById('btnLogout');

    // Initial state: ซ่อนทุกอย่าง
    if (licenseGate) licenseGate.classList.add('hidden');
    if (mainWrapper) mainWrapper.classList.add('hidden');

    // 1. Generate Machine ID
    const machineId = await getMachineId();
    if (machineIdDisplay) {
        machineIdDisplay.innerText = `Device ID: ${machineId.substring(0, 16)}...`;
    }

    // 2. ตรวจสอบ License
    const data = await chrome.storage.local.get('licenseInfo');
    if (data.licenseInfo && data.licenseInfo.key) {
        const success = await verifyAndLoad(data.licenseInfo.key, machineId);
        if (!success) {
            if (licenseGate) licenseGate.classList.remove('hidden');
        }
    } else {
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
                updateLicenseStatusBar(result.expires_at, result.plan || 'Standard');

                chrome.runtime.sendMessage({ 
                    action: 'LICENSE_VERIFIED', 
                    key: key,
                    mId: mId
                });

                if (licenseGate) licenseGate.classList.add('hidden');
                if (mainWrapper) mainWrapper.classList.remove('hidden');
                initMainUI();
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
            
            const cached = await chrome.storage.local.get('licenseInfo');
            if (cached.licenseInfo && cached.licenseInfo.expires_at) {
                const daysLeft = getDaysRemaining(cached.licenseInfo.expires_at);
                if (daysLeft > 0) {
                    showStatus('ออฟไลน์ — ใช้ License เดิมต่อ', 'success');
                    updateLicenseStatusBar(cached.licenseInfo.expires_at, cached.licenseInfo.plan || 'Standard');
                    
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

    function updateLicenseStatusBar(expiresAt, plan) {
        const days = getDaysRemaining(expiresAt);
        if (licensePlanName) licensePlanName.innerText = plan || 'Standard';
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
        return Math.max(0, Math.ceil((exp - now) / (1000 * 60 * 60 * 24)));
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

    // ═══════════════════════════════════════════════
    // ═══ Main UI Logic ═══
    // ═══════════════════════════════════════════════

    function initMainUI() {
    // --- Elements ---
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

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
    const aspectRatio = document.getElementById('aspectRatio');

    // Upload state
    let subjectImage = null;  // { name, base64 }
    let sceneImage = null;
    let styleImage = null;

    // --- State Management ---
    const loadState = async () => {
        const data = await chrome.storage.local.get('botState');
        if (data.botState) {
            const state = data.botState;
            promptsText.value = state.control?.promptsText || '';
            aiEnhance.checked = state.control?.aiEnhance || false;
            saveFolder.value = state.control?.saveFolder || '';
            autoRename.checked = state.control?.autoRename !== false;
            if (autoDownload) autoDownload.checked = state.control?.autoDownload !== false;

            aiProvider.value = state.settings?.aiProvider || 'groq';
            updateProviderUI(aiProvider.value);
            apiKey.value = state.settings?.[`${aiProvider.value}_apiKey`] || state.settings?.apiKey || '';
            aspectRatio.value = state.settings?.aspectRatio || '1:1';

            // Restore images
            subjectImage = state.control?.subjectImage || null;
            sceneImage = state.control?.sceneImage || null;
            styleImage = state.control?.styleImage || null;
            renderUploadPreviews();

            updateQueueUI(state.queue || []);
        }
    };

    const saveState = async () => {
        const data = await chrome.storage.local.get('botState');
        const oldSettings = data.botState?.settings || {};

        const botState = {
            control: {
                promptsText: promptsText.value,
                aiEnhance: aiEnhance.checked,
                saveFolder: saveFolder.value,
                autoRename: autoRename.checked,
                autoDownload: autoDownload ? autoDownload.checked : true,
                subjectImage,
                sceneImage,
                styleImage,
            },
            settings: {
                ...oldSettings,
                aiProvider: aiProvider.value,
                aspectRatio: aspectRatio.value
            },
            queue: await getQueue()
        };

        botState.settings[`${aiProvider.value}_apiKey`] = apiKey.value;
        botState.settings.apiKey = apiKey.value;

        await chrome.storage.local.set({ botState });
    };

    // --- Upload Handlers ---
    const zones = ['subject', 'scene', 'style'];
    
    zones.forEach(zone => {
        const dropEl = document.getElementById(`${zone}Drop`);
        const inputEl = document.getElementById(`${zone}Input`);
        const removeEl = document.getElementById(`${zone}Remove`);

        // Click to upload
        dropEl.addEventListener('click', (e) => {
            if (e.target.closest('.upload-remove')) return;
            inputEl.click();
        });

        // File selected
        inputEl.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file || !file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (re) => {
                setZoneImage(zone, { name: file.name, base64: re.target.result });
            };
            reader.readAsDataURL(file);
        });

        // Drag & Drop
        dropEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropEl.classList.add('dragover');
        });
        dropEl.addEventListener('dragleave', () => {
            dropEl.classList.remove('dragover');
        });
        dropEl.addEventListener('drop', (e) => {
            e.preventDefault();
            dropEl.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (!file || !file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (re) => {
                setZoneImage(zone, { name: file.name, base64: re.target.result });
            };
            reader.readAsDataURL(file);
        });

        // Remove button
        removeEl.addEventListener('click', (e) => {
            e.stopPropagation();
            setZoneImage(zone, null);
        });
    });

    const setZoneImage = (zone, imgData) => {
        if (zone === 'subject') subjectImage = imgData;
        else if (zone === 'scene') sceneImage = imgData;
        else if (zone === 'style') styleImage = imgData;
        renderUploadPreviews();
        saveState();
    };

    const renderUploadPreviews = () => {
        zones.forEach(zone => {
            const imgData = zone === 'subject' ? subjectImage : zone === 'scene' ? sceneImage : styleImage;
            const card = document.getElementById(`${zone}Card`);
            const preview = document.getElementById(`${zone}Preview`);
            const placeholder = document.getElementById(`${zone}Placeholder`);
            const remove = document.getElementById(`${zone}Remove`);

            if (imgData && imgData.base64) {
                preview.src = imgData.base64;
                preview.classList.remove('hidden');
                placeholder.classList.add('hidden');
                remove.classList.remove('hidden');
                card.classList.add('has-image');
            } else {
                preview.classList.add('hidden');
                placeholder.classList.remove('hidden');
                remove.classList.add('hidden');
                card.classList.remove('has-image');
            }
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

    // Settings Inputs auto-save
    const autoInputs = [promptsText, aiEnhance, saveFolder, autoRename, autoDownload, apiKey, aiProvider, aspectRatio];
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
        
        // ตรวจว่ามีรูปหรือ prompt อย่างน้อย 1 อย่าง
        if (!text && !subjectImage && !sceneImage && !styleImage) {
            alert('กรุณาอัปโหลดรูปอย่างน้อย 1 รูป หรือกรอก Prompt');
            return;
        }

        // ถ้ามี prompts หลายบรรทัด → สร้างหลาย queue items
        let prompts = text ? text.split('\n').map(p => p.trim()).filter(p => p.length > 0) : [''];

        const queueItems = prompts.map(p => ({
            prompt: p,
            subjectImage: subjectImage?.base64 || null,
            sceneImage: sceneImage?.base64 || null,
            styleImage: styleImage?.base64 || null,
        }));

        chrome.runtime.sendMessage({ 
            action: 'START_QUEUE', 
            items: queueItems,
            aspectRatio: state.settings?.aspectRatio || '1:1'
        });
    });

    // AI API Check
    document.getElementById('btnCheckApi').addEventListener('click', async () => {
        const key = apiKey.value.trim();
        if (!key) return;
        const icon = document.getElementById('apiStatusIcon');
        const text = document.getElementById('apiStatusText');
        
        icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
        text.innerText = 'กำลังตรวจสอบ...';
        
        const response = await new Promise(res => chrome.runtime.sendMessage({ action: 'CHECK_API_KEY', apiKey: key, provider: aiProvider.value }, res));
        if (response?.success) {
            icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
            text.innerText = 'API Key ใช้งานได้ปกติ';
        } else {
            icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
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
                action: 'ENHANCE_PROMPT_PREVIEW', prompt: p, apiKey: key, provider: aiProvider.value 
            }, res));
            enhanced.push(res?.success ? res.enhanced : p);
        }
        promptsText.value = enhanced.join('\n');
        saveState();
        btn.innerHTML = `${editIcon} ให้ AI ช่วยปรับปรุง`;
        btn.disabled = false;
    });

    // Upload .txt
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

    // Save settings button
    const btnSave = document.getElementById('btnSaveSettings');
    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            await saveState();
            const fb = document.getElementById('saveFeedback');
            if (fb) {
                fb.classList.remove('hidden');
                setTimeout(() => fb.classList.add('hidden'), 2000);
            }
        });
    }

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
                        <span class="item-text">${item.prompt || '(รูปภาพเท่านั้น)'}</span>
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

    // URL check overlay
    const urlOverlay = document.getElementById('url-overlay');
    setInterval(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        urlOverlay.classList.toggle('hidden', !!(tab?.url?.includes('labs.google')));
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
