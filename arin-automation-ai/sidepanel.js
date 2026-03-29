// ═══ Arin Automation AI — Sidepanel v7.1 ═══
'use strict';

const LOG = (() => {
    const prefix = '[Arin]';
    const el = () => document.getElementById('liveLog');
    const push = (msg, color = '#e2e8f0') => {
        const now = new Date().toLocaleTimeString('th-TH');
        console.log(`${prefix} ${msg}`);
        const logEl = el();
        if (!logEl) return;
        const line = document.createElement('div');
        line.style.color = color;
        line.textContent = `[${now}] ${msg}`;
        const placeholder = logEl.querySelector('.text-gray-500');
        if (placeholder) placeholder.remove();
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
    };
    return {
        info: (m) => push(m, '#e2e8f0'),
        success: (m) => push(m, '#10b981'),
        warn: (m) => push(m, '#f59e0b'),
        error: (m) => push(m, '#ef4444'),
        step: (m) => push(`▶ ${m}`, '#60a5fa')
    };
})();

function bindToggle(checkboxId, wrapperId, onChange) {
    const cb = document.getElementById(checkboxId);
    const wrap = document.getElementById(wrapperId);
    if (!cb || !wrap) return;
    const sync = () => {
        wrap.classList.toggle('active', !!cb.checked);
        if (typeof onChange === 'function') onChange(cb.checked);
    };
    cb.addEventListener('change', sync);
    sync();
}

function createAppModeManager(cfg) {
    const tabWhisk = document.getElementById('tabWhisk');
    const tabFlow = document.getElementById('tabFlow');
    let currentApp = cfg.defaultApp || 'whisk';

    const applyTabStyle = (activeId) => {
        [tabWhisk, tabFlow].forEach((el) => {
            if (!el) return;
            const isActive = el.id === activeId;
            el.style.backgroundColor = isActive ? '#1a1a20' : 'transparent';
            el.style.color = isActive ? '#d4af37' : '#6b7280';
            el.style.border = isActive ? '1px solid #d4af37' : '1px solid transparent';
            el.style.fontWeight = isActive ? '600' : '500';
        });
    };

    const applyVisibility = (app) => {
        document.querySelectorAll('[data-app]').forEach((el) => {
            const attr = el.getAttribute('data-app');
            el.classList.toggle('hidden', !(attr === 'both' || attr === app));
        });
        const flowAiWrap = document.getElementById('aiProviderFlowWrap');
        if (flowAiWrap) flowAiWrap.classList.toggle('hidden', app !== 'flow');
    };

    const setApp = (app) => {
        currentApp = app === 'flow' ? 'flow' : 'whisk';
        document.body.setAttribute('data-current-app', currentApp);
        applyTabStyle(currentApp === 'flow' ? 'tabFlow' : 'tabWhisk');
        applyVisibility(currentApp);
        LOG.info(`เปลี่ยนโหมด → ${currentApp === 'flow' ? 'Google Flow' : 'Google Whisk'}`);
        if (typeof cfg.onChange === 'function') cfg.onChange(currentApp);
    };

    if (tabWhisk) tabWhisk.addEventListener('click', () => setApp('whisk'));
    if (tabFlow) tabFlow.addEventListener('click', () => setApp('flow'));
    setApp(currentApp);
    return { setApp, getCurrentApp: () => currentApp, applyVisibility };
}

function createFlowModeManager(cfg) {
    let outputType = cfg.defaultOutputType || 'video';
    let videoMode = cfg.defaultVideoMode || 'text';

    const btnImage = document.getElementById('btnFlowTypeImage');
    const btnVideo = document.getElementById('btnFlowTypeVideo');
    const btnText = document.getElementById('btnVideoModeText');
    const btnFrame = document.getElementById('btnVideoModeFrame');

    const imageModelContainer = document.getElementById('flowImageModelContainer');
    const videoModelContainer = document.getElementById('flowVideoModelContainer');
    const videoModeContainer = document.getElementById('flowVideoModeContainer');
    
    const toggleAutoExtendWrap = document.getElementById('toggleAutoExtendWrap');
    
    // Style dropdowns
    const imageStyleContainer = document.getElementById('imageStyle')?.parentElement;
    const videoStyleContainer = document.getElementById('videoStyle')?.parentElement;
    const cameraMotionContainer = document.getElementById('videoCameraMotion')?.parentElement;
    const randomVideoStyleWrap = document.getElementById('toggleRandomVideoStyleWrap');
    const randomImageStyleWrap = document.getElementById('toggleRandomImageStyleWrap');
    const cameraAngleContainer = document.getElementById('cameraAngle')?.parentElement;
    const randomCameraToggleWrap = document.getElementById('toggleRandomCameraWrap');
    const speechLineContainer = document.getElementById('speechLine')?.parentElement;

    const applyStyles = () => {
        const activeStyle = 'background-color:#1a1a24;color:#60a5fa;border:1px solid #60a5fa;box-shadow:0 1px 3px rgba(0,0,0,0.3);';
        const activePurple = 'background-color:#1a1a24;color:#c084fc;border:1px solid #c084fc;box-shadow:0 1px 3px rgba(0,0,0,0.3);';
        const inactiveStyle = 'color:#6b7280;border:1px solid transparent;background-color:transparent;box-shadow:none;';
        
        if (btnImage) btnImage.style.cssText = outputType === 'image' ? activeStyle : inactiveStyle;
        if (btnVideo) btnVideo.style.cssText = outputType === 'video' ? activeStyle : inactiveStyle;
        if (btnText) btnText.style.cssText = videoMode === 'text' ? activePurple : inactiveStyle;
        if (btnFrame) btnFrame.style.cssText = videoMode === 'frame' ? activePurple : inactiveStyle;
    };

    const applyVisibility = (app) => {
        if (app !== 'flow') return;
        const isImage = outputType === 'image';
        
        if (imageModelContainer) imageModelContainer.classList.toggle('hidden', !isImage);
        if (videoModelContainer) videoModelContainer.classList.toggle('hidden', isImage);
        if (videoModeContainer) videoModeContainer.classList.toggle('hidden', isImage);
        
        if (imageStyleContainer) imageStyleContainer.classList.toggle('hidden', !isImage);
        if (randomImageStyleWrap) randomImageStyleWrap.classList.toggle('hidden', !isImage);
        
        if (videoStyleContainer) videoStyleContainer.classList.toggle('hidden', isImage);
        if (cameraMotionContainer) cameraMotionContainer.classList.toggle('hidden', isImage);
        if (randomVideoStyleWrap) randomVideoStyleWrap.classList.toggle('hidden', isImage);
        
        if (toggleAutoExtendWrap) toggleAutoExtendWrap.classList.toggle('hidden', isImage);
        if (speechLineContainer) speechLineContainer.classList.toggle('hidden', isImage);
        
        if (cameraAngleContainer) cameraAngleContainer.classList.toggle('hidden', !isImage);
        if (randomCameraToggleWrap) randomCameraToggleWrap.classList.toggle('hidden', !isImage);
    };

    const setType = (type, app) => {
        outputType = type;
        applyStyles();
        applyVisibility(app);
        if (typeof cfg.onChange === 'function') cfg.onChange(outputType, videoMode);
    };

    const setVideoMode = (mode, app) => {
        videoMode = mode;
        applyStyles();
        applyVisibility(app);
        if (typeof cfg.onChange === 'function') cfg.onChange(outputType, videoMode);
    };

    if (btnImage) btnImage.addEventListener('click', () => setType('image', 'flow'));
    if (btnVideo) btnVideo.addEventListener('click', () => setType('video', 'flow'));
    if (btnText) btnText.addEventListener('click', () => setVideoMode('text', 'flow'));
    if (btnFrame) btnFrame.addEventListener('click', () => setVideoMode('frame', 'flow'));

    applyStyles();
    return { setType, setVideoMode, applyVisibility, getOutputType: () => outputType, getVideoMode: () => videoMode };
}

document.addEventListener('DOMContentLoaded', async () => {
    LOG.info('Arin Automation AI v7.1 เริ่มต้นแล้ว');
    if (window.lucide) {
        try { lucide.createIcons(); } catch (e) { console.error('[Arin] Lucide Error:', e); }
    }

    const btnAddSet = document.getElementById('btnAddSet');
    const setsWrap = document.getElementById('productSetsContainer');
    const setCountEl = document.getElementById('setCountText');
    const btnRun = document.getElementById('btnRun');
    const btnPause = document.getElementById('btnPause');
    const btnResume = document.getElementById('btnResume');
    const btnClear = document.getElementById('btnClear');
    const btnSaveKey = document.getElementById('btnSaveKey');
    const btnToggleKey = document.getElementById('btnToggleKey');
    const queueList = document.getElementById('queueList');
    const queueStatus = document.getElementById('queueStatus');
    const queueWrap = document.getElementById('queueContainer');
    const statusBadge = document.getElementById('statusBadge');
    const btnClearLog = document.getElementById('btnClearLog');

    let setCount = 0;
    const MAX_SETS = 15;
    let productSetsData = [];
    let currentApp = 'whisk';
    let currentFlowOutputType = 'video';
    let currentFlowVideoMode = 'text';
    let isPaused = false;
    let saveState = async () => {};

    const flowMode = createFlowModeManager({
        defaultOutputType: currentFlowOutputType,
        defaultVideoMode: currentFlowVideoMode,
        onChange: (type, mode) => {
            currentFlowOutputType = type;
            currentFlowVideoMode = mode;
            saveState();
        }
    });

    const appMode = createAppModeManager({
        defaultApp: 'whisk',
        onChange: (app) => { 
            currentApp = app; 
            flowMode.applyVisibility(app);
            saveState(); 
        }
    });

    document.querySelectorAll('.section-header').forEach((header) => {
        header.addEventListener('click', () => {
            const id = header.getAttribute('data-target');
            const el = document.getElementById(id);
            const icon = document.getElementById(`icon-${id}`);
            if (!el) return;
            const isOpen = el.style.maxHeight && el.style.maxHeight !== '0px';
            el.style.maxHeight = isOpen ? '0px' : '1000px';
            el.classList.toggle('border-transparent', isOpen);
            icon?.classList.toggle('rotate-180', !isOpen);
        });
    });
    const basicEl = document.getElementById('basicSettings');
    if (basicEl) basicEl.style.maxHeight = '1000px';

    bindToggle('randomCameraToggle', 'toggleRandomCameraWrap', () => saveState());
    bindToggle('aiEnhanceToggle', 'toggleAiEnhanceWrap', () => saveState());
    bindToggle('randomSceneToggle', 'toggleRandomSceneWrap', () => saveState());
    bindToggle('noOverlayToggle', 'toggleNoOverlayWrap', () => saveState());
    bindToggle('autoExtendToggle', 'toggleAutoExtendWrap', () => saveState());
    bindToggle('autoLoopToggle', 'toggleAutoLoopWrap', () => saveState());

    if (btnToggleKey) {
        btnToggleKey.addEventListener('click', () => {
            const keyInput = document.getElementById('apiKey');
            if (!keyInput) return;
            const isHidden = keyInput.type === 'password';
            keyInput.type = isHidden ? 'text' : 'password';
            const icon = btnToggleKey.querySelector('[data-lucide]');
            if (icon && window.lucide) {
                icon.setAttribute('data-lucide', isHidden ? 'eye-off' : 'eye');
                lucide.createIcons({ root: btnToggleKey });
            }
        });
    }

    // ═══ API Settings Modal Logic ═══
    const btnOpenApiSettings = document.getElementById('btnOpenApiSettings');
    const btnEditApiConfig = document.getElementById('btnEditApiConfig');
    const btnCloseApiModal = document.getElementById('btnCloseApiModal');
    const apiSettingsModal = document.getElementById('apiSettingsModal');

    const openApiModal = () => {
        if (apiSettingsModal) apiSettingsModal.classList.remove('hidden');
    };
    const closeApiModal = () => {
        if (apiSettingsModal) apiSettingsModal.classList.add('hidden');
    };

    if (btnOpenApiSettings) btnOpenApiSettings.addEventListener('click', openApiModal);
    if (btnEditApiConfig) btnEditApiConfig.addEventListener('click', openApiModal);
    if (btnCloseApiModal) btnCloseApiModal.addEventListener('click', closeApiModal);

    // ปิดเมื่อคลิกพื้นหลัง
    if (apiSettingsModal) {
        apiSettingsModal.addEventListener('click', (e) => {
            if (e.target === apiSettingsModal) closeApiModal();
        });
    }

    // Setup Provider Key Inputs
    const providers = ['Groq', 'Gemini', 'OpenRouter'];
    providers.forEach(provider => {
        const pKey = provider; // For UI IDs
        const pValue = provider.toLowerCase(); // For storage/backend
        
        // Toggle Visibility
        const btnToggle = document.getElementById(`btnToggleKey${pKey}`);
        const inputKey = document.getElementById(`apiKey${pKey}`);
        if (btnToggle && inputKey) {
            btnToggle.addEventListener('click', () => {
                const isHidden = inputKey.type === 'password';
                inputKey.type = isHidden ? 'text' : 'password';
                const icon = btnToggle.querySelector('[data-lucide]');
                if (icon && window.lucide) {
                    icon.setAttribute('data-lucide', isHidden ? 'eye-off' : 'eye');
                    lucide.createIcons({ root: btnToggle });
                }
            });
        }

        // Save
        const btnSave = document.getElementById(`btnSave${pKey}`);
        if (btnSave && inputKey) {
            btnSave.addEventListener('click', async () => {
                btnSave.disabled = true;
                const originalText = btnSave.innerHTML;
                btnSave.innerHTML = '<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> บันทึก...';
                if (window.lucide) lucide.createIcons({ root: btnSave });

                await saveState();
                
                // แจ้ง background ว่ามีการบันทึก key ใหม่
                if (typeof chrome !== 'undefined' && chrome.runtime) {
                    chrome.runtime.sendMessage({ action: 'API_KEY_UPDATED' });
                }

                LOG.success(`บันทึก API Key (${provider}) แล้ว`);
                const msg = document.getElementById(`validationMsg${pKey}`);
                if (msg) {
                    msg.textContent = '✓ บันทึกสำเร็จ';
                    msg.style.color = '#10b981';
                    msg.classList.remove('hidden');
                    setTimeout(() => msg.classList.add('hidden'), 3000);
                }

                setTimeout(() => {
                    btnSave.disabled = false;
                    btnSave.innerHTML = originalText;
                }, 500);
            });
        }

        // Test
        const btnTest = document.getElementById(`btnTest${pKey}`);
        if (btnTest && inputKey) {
            btnTest.addEventListener('click', () => {
                const key = inputKey.value;
                if (!key) return alert('กรุณากรอก API Key ก่อนทดสอบ');

                btnTest.disabled = true;
                const originalText = btnTest.innerHTML;
                btnTest.innerHTML = '<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> กำลังทดสอบ...';
                if (window.lucide) lucide.createIcons({ root: btnTest });

                const msg = document.getElementById(`validationMsg${pKey}`);
                if (msg) {
                    msg.textContent = 'กำลังตรวจสอบ...';
                    msg.style.color = '#e2e8f0';
                    msg.classList.remove('hidden');
                }

                if (typeof chrome !== 'undefined' && chrome.runtime) {
                    chrome.runtime.sendMessage({
                        action: 'VALIDATE_API_KEY',
                        provider: pValue,
                        apiKey: key
                    }, (response) => {
                        btnTest.disabled = false;
                        btnTest.innerHTML = originalText;
                        
                        if (msg) {
                            if (response && response.valid) {
                                msg.textContent = '✓ ใช้งานได้';
                                msg.style.color = '#10b981';
                            } else {
                                msg.textContent = '✗ ไม่ถูกต้อง: ' + (response?.error || 'Unknown error');
                                msg.style.color = '#ef4444';
                            }
                        }
                    });
                } else {
                    // Fallback for local testing
                    setTimeout(() => {
                        btnTest.disabled = false;
                        btnTest.innerHTML = originalText;
                        if (msg) { msg.textContent = 'จำลอง: ✓ ใช้งานได้'; msg.style.color = '#10b981'; }
                    }, 1000);
                }
            });
        }
        
        // Input Trigger Validation Reset
        if (inputKey) {
            inputKey.addEventListener('input', () => {
                const msg = document.getElementById(`validationMsg${pKey}`);
                if (msg) msg.classList.add('hidden');
            });
        }
    });

    // Backward Compatibility logic for saveKey button (if it still exists in DOM)
    if (btnSaveKey) {
        btnSaveKey.addEventListener('click', async () => {
            await saveState();
            LOG.success(`บันทึกการตั้งค่าแล้ว`);
            // แจ้ง background ว่ามีการบันทึก key ใหม่
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({ action: 'API_KEY_UPDATED' });
            }
            const msg = document.getElementById('apiKeySavedMsg');
            if (msg) {
                msg.classList.remove('hidden');
                setTimeout(() => msg.classList.add('hidden'), 2500);
            }
        });
    }

    const updateSetCount = () => { if (setCountEl) setCountEl.textContent = setCount; };
    const getSetDataById = (id) => {
        let d = productSetsData.find((s) => s.id === id);
        if (!d) { d = { id }; productSetsData.push(d); }
        return d;
    };
    const readFile = (file, cb) => {
        const reader = new FileReader();
        reader.onload = (e) => cb(e.target.result);
        reader.readAsDataURL(file);
    };

    const attachImageUpload = (setDiv, setId) => {
        ['product', 'model', 'style'].forEach((zone) => {
            const box = setDiv.querySelector(`.image-box-${zone}`);
            const input = setDiv.querySelector(`.image-input-${zone}`);
            const preview = setDiv.querySelector(`.image-preview-${zone}`);
            const holder = setDiv.querySelector(`.image-placeholder-${zone}`);
            const removeBtn = setDiv.querySelector(`.image-remove-${zone}`);
            if (!box) return;
            const dataKey = zone === 'product' ? 'subject' : (zone === 'model' ? 'scene' : 'style');
            const applyImage = (dataUrl) => {
                getSetDataById(setId)[dataKey] = dataUrl;
                preview.src = dataUrl;
                preview.classList.remove('hidden');
                holder.classList.add('hidden');
                removeBtn.classList.remove('hidden');
                box.classList.add('has-image');
                LOG.step(`อัปโหลดรูป [${zone}] ชุด ${setId} สำเร็จ`);
                saveState();
            };
            box.addEventListener('click', (e) => { if (!e.target.closest('.image-remove')) input.click(); });
            box.addEventListener('dragover', (e) => { e.preventDefault(); box.style.borderColor = '#d4af37'; });
            box.addEventListener('dragleave', () => { box.style.borderColor = ''; });
            box.addEventListener('drop', (e) => {
                e.preventDefault();
                box.style.borderColor = '';
                const file = e.dataTransfer.files[0];
                if (file?.type.startsWith('image/')) readFile(file, applyImage);
            });
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) readFile(file, applyImage);
            });
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                getSetDataById(setId)[dataKey] = null;
                preview.src = '';
                preview.classList.add('hidden');
                holder.classList.remove('hidden');
                removeBtn.classList.add('hidden');
                box.classList.remove('has-image');
                input.value = '';
                saveState();
            });
        });
    };

    const addProductSet = (existingId = null, existingData = null) => {
        if (setCount >= MAX_SETS && !existingId) return alert(`เพิ่มได้สูงสุด ${MAX_SETS} ชุด`);
        setCount++;
        updateSetCount();

        const setId = existingId || (`set_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        if (!existingData) productSetsData.push({ id: setId });

        const wrap = document.createElement('div');
        wrap.className = 'set-item rounded-lg p-3 relative opacity-0 transition-opacity duration-300';
        wrap.style.cssText = 'background-color:#0e0e14;border:1px solid #2a2a3a;';
        wrap.setAttribute('data-id', setId);
        wrap.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <span class="set-number text-xs font-bold" style="color:#d4af37;">ชุดที่ ${setCount}</span>
                <button class="btn-remove-set text-gray-500 hover:text-red-400 p-1 rounded-full transition"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
            </div>
            <div class="grid grid-cols-3 gap-2 mb-3 product-images-grid">
                <div class="image-box-product dashed-box rounded-lg flex flex-col items-center justify-center p-2 h-[80px] cursor-pointer relative overflow-hidden">
                    <div class="image-placeholder-product flex flex-col items-center pointer-events-none"><i data-lucide="image-plus" class="w-4 h-4 mb-1" style="color:#d4af37;"></i><span class="text-[9px] text-gray-500 text-center app-text-whisk">Subject</span><span class="text-[9px] text-gray-500 text-center app-text-flow" style="display:none;">รูปสินค้า</span></div>
                    <img class="image-preview-product absolute inset-0 w-full h-full object-cover hidden" alt="product">
                    <div class="image-remove-product image-remove hidden absolute top-1 right-1 z-10 cursor-pointer"><i data-lucide="x-circle" class="w-4 h-4 text-red-500 bg-black/50 rounded-full"></i></div>
                </div>
                <input type="file" class="image-input-product hidden" accept="image/*">
                <div class="image-box-model dashed-box rounded-lg flex flex-col items-center justify-center p-2 h-[80px] cursor-pointer relative overflow-hidden">
                    <div class="image-placeholder-model flex flex-col items-center pointer-events-none"><i data-lucide="user" class="w-4 h-4 mb-1" style="color:#d4af37;"></i><span class="text-[9px] text-gray-500 text-center app-text-whisk">Scene</span><span class="text-[9px] text-gray-500 text-center app-text-flow" style="display:none;">นางแบบ</span></div>
                    <img class="image-preview-model absolute inset-0 w-full h-full object-cover hidden" alt="model">
                    <div class="image-remove-model image-remove hidden absolute top-1 right-1 z-10 cursor-pointer"><i data-lucide="x-circle" class="w-4 h-4 text-red-500 bg-black/50 rounded-full"></i></div>
                </div>
                <input type="file" class="image-input-model hidden" accept="image/*">
                <div class="image-box-style dashed-box rounded-lg flex flex-col items-center justify-center p-2 h-[80px] cursor-pointer relative overflow-hidden">
                    <div class="image-placeholder-style flex flex-col items-center pointer-events-none"><i data-lucide="palette" class="w-4 h-4 mb-1" style="color:#d4af37;"></i><span class="text-[9px] text-gray-500 text-center">Style</span></div>
                    <img class="image-preview-style absolute inset-0 w-full h-full object-cover hidden" alt="style">
                    <div class="image-remove-style image-remove hidden absolute top-1 right-1 z-10 cursor-pointer"><i data-lucide="x-circle" class="w-4 h-4 text-red-500 bg-black/50 rounded-full"></i></div>
                </div>
                <input type="file" class="image-input-style hidden" accept="image/*">
            </div>
            <div class="space-y-2">
                <input type="text" class="input-name w-full input-bg rounded-md p-2 text-xs" placeholder="ชื่อสินค้า (เช่น น้ำพริกผัดหมูสับ)">
                <input type="text" class="input-product-id w-full input-bg rounded-md p-2 text-xs" placeholder="Product ID (TikTok Shop) — ไม่บังคับ">
                <textarea class="input-prompt w-full input-bg rounded-md p-2 text-xs h-14 resize-none" placeholder="Prompt เสริม / บทพูด (ไม่บังคับ)"></textarea>
                <label class="toggle-option cursor-pointer" style="padding:6px 10px;">
                    <div class="toggle-switch" style="transform:scale(0.85);"><input type="checkbox" class="input-use-exact"><span class="toggle-slider"></span></div>
                    <span class="text-[11px] text-gray-300">ใช้ Prompt นี้ตรงๆ (ไม่ให้ AI แต่งเพิ่ม)</span>
                </label>
            </div>`;

        setsWrap.appendChild(wrap);
        if (window.lucide) {
            try { lucide.createIcons({ root: wrap }); } catch (e) { console.error('[Arin] Lucide Set Error:', e); }
        }

        if (existingData) {
            const q = (sel) => wrap.querySelector(sel);
            if (existingData.name) q('.input-name').value = existingData.name;
            if (existingData.prompt) q('.input-prompt').value = existingData.prompt;
            if (existingData.productId) q('.input-product-id').value = existingData.productId;
            if (existingData.useExact) q('.input-use-exact').checked = true;
            ['product', 'model', 'style'].forEach((zone) => {
                const dataKey = zone === 'product' ? 'subject' : (zone === 'model' ? 'scene' : 'style');
                const imgData = existingData[dataKey];
                if (!imgData) return;
                const preview = wrap.querySelector(`.image-preview-${zone}`);
                const holder = wrap.querySelector(`.image-placeholder-${zone}`);
                const rmBtn = wrap.querySelector(`.image-remove-${zone}`);
                const box = wrap.querySelector(`.image-box-${zone}`);
                preview.src = imgData;
                preview.classList.remove('hidden');
                holder.classList.add('hidden');
                rmBtn.classList.remove('hidden');
                box.classList.add('has-image');
            });
        }

        const q = (sel) => wrap.querySelector(sel);
        q('.input-name').addEventListener('input', (e) => { getSetDataById(setId).name = e.target.value; saveState(); });
        q('.input-prompt').addEventListener('input', (e) => { getSetDataById(setId).prompt = e.target.value; saveState(); });
        q('.input-product-id').addEventListener('input', (e) => { getSetDataById(setId).productId = e.target.value; saveState(); });
        q('.input-use-exact').addEventListener('change', (e) => {
            getSetDataById(setId).useExact = e.target.checked;
            e.target.closest('.toggle-option')?.classList.toggle('active', e.target.checked);
            saveState();
        });
        wrap.querySelector('.btn-remove-set').addEventListener('click', () => {
            wrap.classList.add('opacity-0');
            setTimeout(() => {
                wrap.remove();
                productSetsData = productSetsData.filter((s) => s.id !== setId);
                setCount--;
                setsWrap.querySelectorAll('.set-item').forEach((el, i) => {
                    const num = el.querySelector('.set-number');
                    if (num) num.textContent = `ชุดที่ ${i + 1}`;
                });
                updateSetCount();
                LOG.info(`ลบชุดสินค้า ${setId}`);
                saveState();
            }, 300);
        });
        attachImageUpload(wrap, setId);
        setTimeout(() => {
            wrap.classList.remove('opacity-0');
            if (!existingId) document.getElementById('mainScrollArea')?.scrollTo({ top: 99999, behavior: 'smooth' });
        }, 60);
        saveState();
        LOG.info(`เพิ่มชุดสินค้า #${setCount} (id: ${setId})`);
    };

    if (btnAddSet) btnAddSet.addEventListener('click', () => addProductSet());

    const getGeneralSettings = () => ({
        aspectRatio: document.getElementById('aspectRatio')?.value || '1:1',
        imageCount: document.getElementById('imageCount')?.value || '4',
        clipCount: document.getElementById('clipCount')?.value || '2',
        cameraAngle: document.getElementById('cameraAngle')?.value || 'close-up',
        randomCameraToggle: document.getElementById('randomCameraToggle')?.checked || false,
        videoModel: document.getElementById('videoModel')?.value || 'veo31_fast',
        flowImageModel: document.getElementById('flowImageModel')?.value || 'imagen_4',
        flowOutputType: currentFlowOutputType,
        flowVideoMode: currentFlowVideoMode,
        aiProvider: document.getElementById('aiProvider')?.value || 'groq',
        aiProviderFlow: document.getElementById('aiProviderFlow')?.value || 'groq_thai',
        apiKey: document.getElementById('apiKey')?.value || '', // backward compat
        apiKeyGroq: document.getElementById('apiKeyGroq')?.value || '',
        apiKeyGemini: document.getElementById('apiKeyGemini')?.value || '',
        apiKeyOpenRouter: document.getElementById('apiKeyOpenRouter')?.value || '',
        imageStyle: document.getElementById('imageStyle')?.value || 'tiktok_normal',
        videoStyle: document.getElementById('videoStyle')?.value || 'ugc_review',
        videoCameraMotion: document.getElementById('videoCameraMotion')?.value || 'static',
        aiEnhanceToggle: document.getElementById('aiEnhanceToggle')?.checked || false,
        randomSceneToggle: document.getElementById('randomSceneToggle')?.checked || false,
        overlayText: document.getElementById('overlayText')?.value || '',
        noOverlayToggle: document.getElementById('noOverlayToggle')?.checked || false,
        speechLine: document.getElementById('speechLine')?.value || '',
        autoExtendToggle: document.getElementById('autoExtendToggle')?.checked || false,
        autoLoopToggle: document.getElementById('autoLoopToggle')?.checked || false,
        loopCount: document.getElementById('loopCount')?.value || '0',
        delayBetween: document.getElementById('delayBetween')?.value || '15',
        targetApp: currentApp
    });

    const buildQueueItems = () => {
        LOG.step('กำลังสร้าง Queue items...');
        setsWrap.querySelectorAll('.set-item').forEach((wrap) => {
            const id = wrap.getAttribute('data-id');
            const d = getSetDataById(id);
            d.name = wrap.querySelector('.input-name')?.value || '';
            d.prompt = wrap.querySelector('.input-prompt')?.value || '';
            d.productId = wrap.querySelector('.input-product-id')?.value || '';
            d.useExact = wrap.querySelector('.input-use-exact')?.checked || false;
        });

        const general = getGeneralSettings();
        const items = [];
        productSetsData.forEach((set, idx) => {
            if (!set.subject && !set.name && !set.prompt) return;
            let combinedPrompt = [set.name, set.prompt].filter(Boolean).join(' ').trim();
            const styleHints = [];
            if (general.imageStyle && currentApp === 'whisk') styleHints.push(`style: ${general.imageStyle}`);
            let angleToUse = general.cameraAngle;
            if (general.randomCameraToggle) {
                const angles = ['close-up', 'full-body', 'medium', 'extreme close-up', 'wide angle', 'low angle', 'high angle', 'dutch angle', 'over-the-shoulder'];
                angleToUse = angles[Math.floor(Math.random() * angles.length)];
            }
            if (angleToUse) styleHints.push(`camera angle: ${angleToUse}`);
            if (general.overlayText && !general.noOverlayToggle) styleHints.push(`overlay text: "${general.overlayText}"`);
            if (styleHints.length) combinedPrompt += ` | ${styleHints.join(', ')}`;
            items.push({
                id: set.id,
                setName: `ชุดที่ ${idx + 1}`,
                prompt: combinedPrompt,
                subjectImage: set.subject || null,
                sceneImage: set.scene || null,
                styleImage: set.style || null,
                productId: set.productId || null,
                useExact: set.useExact || false
            });
        });
        
        // Inject the correct provider API key into settings backward compat
        const selectedProvider = currentApp === 'flow' ? general.aiProviderFlow : general.aiProvider;
        const providerBase = selectedProvider.replace('_thai', '');
        
        if (providerBase === 'groq') {
            general.apiKey = general.apiKeyGroq || general.apiKey;
        } else if (providerBase === 'gemini') {
            general.apiKey = general.apiKeyGemini || general.apiKey;
        } else if (providerBase === 'openrouter') {
            general.apiKey = general.apiKeyOpenRouter || general.apiKey;
        }

        LOG.info(`รวม ${items.length} งานที่พร้อมรัน`);
        return { items, general };
    };

    if (btnRun) btnRun.addEventListener('click', () => {
        LOG.step('=== กดปุ่ม "เริ่ม Auto Pipeline" ===');
        if (productSetsData.length === 0) return alert('กรุณาเพิ่มชุดสินค้าอย่างน้อย 1 ชุด');
        const { items, general } = buildQueueItems();
        if (items.length === 0) return alert('กรุณาใส่ชื่อสินค้าหรือรูปภาพอย่างน้อย 1 ชุด');
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ action: 'START_QUEUE', items, settings: general }, () => {
                if (chrome.runtime.lastError) LOG.error(chrome.runtime.lastError.message);
                else LOG.success('ส่ง Queue ไปยัง Background สำเร็จ');
            });
        } else {
            LOG.warn('[LOCAL MODE] จำลองการทำงาน');
        }
        queueWrap.classList.remove('hidden');
        btnPause.classList.remove('hidden');
        btnResume.classList.add('hidden');
        isPaused = false;
        if (statusBadge) {
            statusBadge.textContent = `กำลังรัน ${items.length} งาน`;
            statusBadge.style.background = 'rgba(16,185,129,0.15)';
            statusBadge.style.color = '#10b981';
            statusBadge.style.borderColor = 'rgba(16,185,129,0.3)';
        }
    });

    if (btnPause) btnPause.addEventListener('click', () => {
        LOG.warn('หยุดชั่วคราว (PAUSE)');
        if (typeof chrome !== 'undefined' && chrome.runtime) chrome.runtime.sendMessage({ action: 'PAUSE_QUEUE' });
        isPaused = true;
        btnPause.classList.add('hidden');
        btnResume.classList.remove('hidden');
    });
    if (btnResume) btnResume.addEventListener('click', () => {
        LOG.step('ทำงานต่อ (RESUME)');
        if (typeof chrome !== 'undefined' && chrome.runtime) chrome.runtime.sendMessage({ action: 'RESUME_QUEUE' });
        isPaused = false;
        btnResume.classList.add('hidden');
        btnPause.classList.remove('hidden');
    });
    if (btnClear) btnClear.addEventListener('click', () => {
        LOG.info('ล้าง Queue ทั้งหมด');
        if (typeof chrome !== 'undefined' && chrome.runtime) chrome.runtime.sendMessage({ action: 'CLEAR_QUEUE' });
        queueWrap.classList.add('hidden');
        btnPause.classList.add('hidden');
        btnResume.classList.add('hidden');
        if (statusBadge) {
            statusBadge.textContent = 'พร้อมใช้งาน';
            statusBadge.style.background = 'rgba(212,175,55,0.12)';
            statusBadge.style.color = '#d4af37';
            statusBadge.style.borderColor = 'rgba(212,175,55,0.25)';
        }
    });

    if (btnClearLog) {
        btnClearLog.addEventListener('click', () => {
            const logEl = document.getElementById('liveLog');
            if (!logEl) return;
            logEl.innerHTML = '<div class="text-gray-500">รอคำสั่ง...</div>';
            logEl.scrollTop = 0;
            LOG.info('ล้าง log แล้ว');
        });
    }

    const updateQueueUI = (queue) => {
        if (!queue?.length) {
            queueList.innerHTML = '<div class="text-xs text-gray-500 text-center py-2">ไม่มีงานในคิว</div>';
            if (queueStatus) queueStatus.textContent = '0 งาน';
            return;
        }
        const running = queue.filter((q) => ['running', 'typing', 'submitting'].includes(q.status)).length;
        const pending = queue.filter((q) => q.status === 'pending').length;
        const done = queue.filter((q) => q.status === 'completed').length;
        const failed = queue.filter((q) => q.status === 'failed').length;
        if (queueStatus) queueStatus.textContent = `${running ? `รัน ${running}` : ''} ${pending ? `รอ ${pending}` : ''} ${done ? `✓${done}` : ''} ${failed ? `✗${failed}` : ''}`.trim() || `${queue.length} งาน`;
        const labels = { pending: 'รอคิว', running: 'กำลังรัน', completed: 'สำเร็จ ✓', failed: 'ล้มเหลว ✗' };
        queueList.innerHTML = queue.map((item) => {
            const pct = item.status === 'completed' ? 100 : (item.percent || 0);
            let cls = 'queue-item';
            if (['running', 'typing', 'submitting'].includes(item.status)) cls += ' running';
            if (item.status === 'completed') cls += ' completed';
            if (item.status === 'failed') cls += ' failed';
            return `<div class="${cls}"><div class="flex justify-between items-center mb-1"><div class="flex items-center gap-1.5 overflow-hidden"><span class="status-dot"></span><span class="font-bold text-white truncate">${item.setName || 'งาน'}</span><span class="text-gray-400 truncate" style="max-width:120px;">— ${(item.prompt || '').slice(0, 40)}</span></div><span class="text-[9px] px-1.5 py-0.5 rounded text-gray-300 whitespace-nowrap" style="background:#1a1a20;">${labels[item.status] || item.status}</span></div><div class="flex items-center gap-2"><div class="flex-1 progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><span class="text-[9px] text-gray-400 w-6 text-right">${pct}%</span></div>${item.error ? `<div class="mt-1 text-[10px] text-red-400">${item.error}</div>` : ''}</div>`;
        }).join('');
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.action === 'QUEUE_UPDATED') updateQueueUI(msg.queue);
            if (msg.action === 'LOG') {
                const fn = LOG[msg.level] || LOG.info;
                fn(msg.text);
            }
        });
    }

    saveState = async () => {
        const state = { general: getGeneralSettings(), sets: productSetsData };
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) await chrome.storage.local.set({ arinAutoState: state });
            else localStorage.setItem('arinAutoState', JSON.stringify(state));
        } catch (e) {
            LOG.error(`บันทึก State ล้มเหลว: ${e.message}`);
        }
    };

    const loadState = async () => {
        let saved = null;
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const data = await chrome.storage.local.get('arinAutoState');
                saved = data.arinAutoState || null;
            } else {
                const raw = localStorage.getItem('arinAutoState');
                if (raw) saved = JSON.parse(raw);
            }
        } catch (e) { LOG.error(`โหลด State ล้มเหลว: ${e.message}`); }
        if (saved?.general) {
            const g = saved.general;
            const setVal = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
            const setCheck = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
            setVal('aspectRatio', g.aspectRatio);
            setVal('imageCount', g.imageCount);
            setVal('clipCount', g.clipCount);
            setVal('cameraAngle', g.cameraAngle);
            setCheck('randomCameraToggle', g.randomCameraToggle);
            setVal('videoModel', g.videoModel);
            setVal('aiProvider', g.aiProvider);
            setVal('aiProviderFlow', g.aiProviderFlow);
            setVal('apiKey', g.apiKey);
            setVal('apiKeyGroq', g.apiKeyGroq);
            setVal('apiKeyGemini', g.apiKeyGemini);
            setVal('apiKeyOpenRouter', g.apiKeyOpenRouter);
            setVal('imageStyle', g.imageStyle);
            setVal('videoStyle', g.videoStyle);
            setVal('videoCameraMotion', g.videoCameraMotion);
            setCheck('aiEnhanceToggle', g.aiEnhanceToggle);
            setCheck('randomSceneToggle', g.randomSceneToggle);
            setVal('overlayText', g.overlayText);
            setCheck('noOverlayToggle', g.noOverlayToggle);
            setVal('speechLine', g.speechLine);
            setCheck('autoExtendToggle', g.autoExtendToggle);
            setCheck('autoLoopToggle', g.autoLoopToggle);
            setVal('loopCount', g.loopCount);
            setVal('delayBetween', g.delayBetween);
            ['randomCameraToggle', 'aiEnhanceToggle', 'randomSceneToggle', 'noOverlayToggle', 'autoExtendToggle', 'autoLoopToggle'].forEach((id) => {
                const cb = document.getElementById(id);
                if (cb) cb.dispatchEvent(new Event('change'));
            });
            setVal('flowImageModel', g.flowImageModel);
            if (g.flowOutputType) {
                currentFlowOutputType = g.flowOutputType;
                flowMode.setType(g.flowOutputType, 'flow'); // Won't apply visibility yet if app is not flow
            }
            if (g.flowVideoMode) {
                currentFlowVideoMode = g.flowVideoMode;
                flowMode.setVideoMode(g.flowVideoMode, 'flow');
            }
            appMode.setApp(g.targetApp || 'whisk');
            currentApp = g.targetApp || 'whisk';
            flowMode.applyVisibility(currentApp);
        }
        if (saved?.sets?.length) {
            productSetsData = saved.sets;
            saved.sets.forEach((s) => addProductSet(s.id, s));
        } else addProductSet();
        document.querySelectorAll('input, select, textarea').forEach((el) => {
            el.addEventListener('change', saveState);
            if (['text', 'password', 'search', ''].includes(el.type) || el.tagName === 'TEXTAREA') el.addEventListener('input', saveState);
        });
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get('botState', (d) => {
            if (d.botState?.queue?.length) {
                queueWrap.classList.remove('hidden');
                updateQueueUI(d.botState.queue);
            }
        });
    }
    await loadState();
});
