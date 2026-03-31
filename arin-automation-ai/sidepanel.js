'use strict';

const API_BASE = 'https://ar.paragonlandth.com/v1';
const PRODUCT = 'arin-whisk-bot';

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

    if (licenseGate) licenseGate.classList.add('hidden');
    if (mainWrapper) mainWrapper.classList.add('hidden');

    const machineId = await getMachineId();
    if (machineIdDisplay) machineIdDisplay.innerText = `Device ID: ${machineId.substring(0, 16)}...`;

    const cached = await chrome.storage.local.get('licenseInfo');
    if (cached.licenseInfo?.key) {
        const success = await verifyAndLoad(cached.licenseInfo.key, machineId);
        if (!success && licenseGate) licenseGate.classList.remove('hidden');
    } else if (licenseGate) {
        licenseGate.classList.remove('hidden');
    }

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

    if (btnLogout) {
        btnLogout.onclick = async () => {
            if (!confirm('ต้องการออกจากระบบใช่ไหม?')) return;
            await chrome.storage.local.remove(['licenseInfo', 'licenseVerified']);
            chrome.runtime.sendMessage({ action: 'LICENSE_REVOKED' });
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
            if (!result.success) {
                showStatus(result.message || 'License ไม่ถูกต้องหรือหมดอายุ', 'error');
                if (licenseGate) licenseGate.classList.remove('hidden');
                if (mainWrapper) mainWrapper.classList.add('hidden');
                return false;
            }

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

            showStatus('สำเร็จ! กำลังโหลดระบบ...', 'success');
            updateLicenseStatusBar(result.expires_at, result.plan || 'Standard');
            chrome.runtime.sendMessage({ action: 'LICENSE_VERIFIED', key, mId });
            if (licenseGate) licenseGate.classList.add('hidden');
            if (mainWrapper) mainWrapper.classList.remove('hidden');
            initMainUI();
            return true;
        } catch (err) {
            console.error('Verify error:', err);
            const local = await chrome.storage.local.get('licenseInfo');
            if (local.licenseInfo?.expires_at && getDaysRemaining(local.licenseInfo.expires_at) > 0) {
                updateLicenseStatusBar(local.licenseInfo.expires_at, local.licenseInfo.plan || 'Standard');
                chrome.runtime.sendMessage({ action: 'LICENSE_VERIFIED', key: local.licenseInfo.key, mId });
                if (licenseGate) licenseGate.classList.add('hidden');
                if (mainWrapper) mainWrapper.classList.remove('hidden');
                initMainUI();
                return true;
            }
            showStatus('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'error');
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
        return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    let mainUiInitialized = false;
    function initMainUI() {
        if (mainUiInitialized) return;
        mainUiInitialized = true;

        const btnAddSet = document.getElementById('btnAddSet');
        const setsWrap = document.getElementById('productSetsContainer');
        const setCountEl = document.getElementById('setCountText');
        const btnRun = document.getElementById('btnRun');
        const btnPause = document.getElementById('btnPause');
        const btnResume = document.getElementById('btnResume');
        const btnClear = document.getElementById('btnClear');
        const queueList = document.getElementById('queueList');
        const queueStatus = document.getElementById('queueStatus');
        const queueWrap = document.getElementById('queueContainer');
        const statusBadge = document.getElementById('statusBadge');
        const btnClearLog = document.getElementById('btnClearLog');
        const btnOpenApiSettings = document.getElementById('btnOpenApiSettings');
        const btnEditApiConfig = document.getElementById('btnEditApiConfig');
        const btnCloseApiModal = document.getElementById('btnCloseApiModal');
        const apiSettingsModal = document.getElementById('apiSettingsModal');
        let setCount = 0;
        const MAX_SETS = 15;
        let productSetsData = [];
        let isPaused = false;
        let saveState = async () => {};

        try {
            LOG.info('Arin Automation AI (Whisk) พร้อมใช้งาน');
            

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
        bindToggle('autoLoopToggle', 'toggleAutoLoopWrap', () => saveState());

        const openApiModal = () => apiSettingsModal?.classList.remove('hidden');
        const closeApiModal = () => apiSettingsModal?.classList.add('hidden');

        if (btnOpenApiSettings) btnOpenApiSettings.addEventListener('click', openApiModal);
        if (btnEditApiConfig) btnEditApiConfig.addEventListener('click', openApiModal);
        if (btnCloseApiModal) btnCloseApiModal.addEventListener('click', closeApiModal);
        if (apiSettingsModal) {
            apiSettingsModal.addEventListener('click', (e) => {
                if (e.target === apiSettingsModal) closeApiModal();
            });
        }

        ['Groq', 'Gemini', 'OpenRouter'].forEach((provider) => {
            const keyInput = document.getElementById(`apiKey${provider}`);
            const toggleBtn = document.getElementById(`btnToggleKey${provider}`);
            const saveBtn = document.getElementById(`btnSave${provider}`);
            const testBtn = document.getElementById(`btnTest${provider}`);
            const msg = document.getElementById(`validationMsg${provider}`);
            const providerValue = provider.toLowerCase();

            if (toggleBtn && keyInput) {
                toggleBtn.addEventListener('click', () => {
                    const isHidden = keyInput.type === 'password';
                    keyInput.type = isHidden ? 'text' : 'password';
                    const icon = toggleBtn.querySelector('[data-lucide]');
                    if (icon && window.lucide) {
                        icon.setAttribute('data-lucide', isHidden ? 'eye-off' : 'eye');
                        lucide.createIcons({ root: toggleBtn });
                    }
                });
            }

            if (saveBtn && keyInput) {
                saveBtn.addEventListener('click', async () => {
                    saveBtn.disabled = true;
                    const original = saveBtn.innerHTML;
                    saveBtn.innerHTML = `<!-- @license lucide-static v1.7.0 - ISC -->
<svg
  class="lucide lucide-loader"
  xmlns="http://www.w3.org/2000/svg"
  width="100%"
  height="100%"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
 class="w-3.5 h-3.5 animate-spin">
  <path d="M12 2v4" />
  <path d="m16.2 7.8 2.9-2.9" />
  <path d="M18 12h4" />
  <path d="m16.2 16.2 2.9 2.9" />
  <path d="M12 18v4" />
  <path d="m4.9 19.1 2.9-2.9" />
  <path d="M2 12h4" />
  <path d="m4.9 4.9 2.9 2.9" />
</svg> บันทึก...`;
                    
                    await saveState();
                    chrome.runtime?.sendMessage?.({ action: 'API_KEY_UPDATED' });
                    if (msg) {
                        msg.textContent = '✓ บันทึกสำเร็จ';
                        msg.style.color = '#10b981';
                        msg.classList.remove('hidden');
                        setTimeout(() => msg.classList.add('hidden'), 3000);
                    }
                    setTimeout(() => {
                        saveBtn.disabled = false;
                        saveBtn.innerHTML = original;
                    }, 500);
                });
            }

            if (testBtn && keyInput) {
                testBtn.addEventListener('click', () => {
                    const key = keyInput.value.trim();
                    if (!key) return alert('กรุณากรอก API Key ก่อนทดสอบ');
                    testBtn.disabled = true;
                    const original = testBtn.innerHTML;
                    testBtn.innerHTML = `<!-- @license lucide-static v1.7.0 - ISC -->
<svg
  class="lucide lucide-loader"
  xmlns="http://www.w3.org/2000/svg"
  width="100%"
  height="100%"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
 class="w-3.5 h-3.5 animate-spin">
  <path d="M12 2v4" />
  <path d="m16.2 7.8 2.9-2.9" />
  <path d="M18 12h4" />
  <path d="m16.2 16.2 2.9 2.9" />
  <path d="M12 18v4" />
  <path d="m4.9 19.1 2.9-2.9" />
  <path d="M2 12h4" />
  <path d="m4.9 4.9 2.9 2.9" />
</svg> กำลังทดสอบ...`;
                    
                    if (msg) {
                        msg.textContent = 'กำลังตรวจสอบ...';
                        msg.style.color = '#e2e8f0';
                        msg.classList.remove('hidden');
                    }
                    chrome.runtime.sendMessage({
                        action: 'VALIDATE_API_KEY',
                        provider: providerValue,
                        apiKey: key
                    }, (response) => {
                        testBtn.disabled = false;
                        testBtn.innerHTML = original;
                        if (msg) {
                            if (response?.valid) {
                                msg.textContent = '✓ ใช้งานได้';
                                msg.style.color = '#10b981';
                            } else {
                                msg.textContent = `✗ ไม่ถูกต้อง: ${response?.error || 'Unknown error'}`;
                                msg.style.color = '#ef4444';
                            }
                        }
                    });
                });
            }

            if (keyInput && msg) {
                keyInput.addEventListener('input', () => msg.classList.add('hidden'));
            }
        });

        const updateSetCount = () => { if (setCountEl) setCountEl.textContent = setCount; };

        const getSetDataById = (id) => {
            let data = productSetsData.find((item) => item.id === id);
            if (!data) {
                data = { id };
                productSetsData.push(data);
            }
            return data;
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
                if (!box || !input || !preview || !holder || !removeBtn) return;

                const dataKey = zone === 'product' ? 'subject' : (zone === 'model' ? 'scene' : 'style');
                const applyImage = (dataUrl) => {
                    getSetDataById(setId)[dataKey] = dataUrl;
                    preview.src = dataUrl;
                    preview.classList.remove('hidden');
                    holder.classList.add('hidden');
                    removeBtn.classList.remove('hidden');
                    box.classList.add('has-image');
                    saveState();
                };

                box.addEventListener('click', (e) => {
                    if (!e.target.closest('.image-remove')) input.click();
                });
                box.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    box.style.borderColor = '#d4af37';
                });
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
            setCount += 1;
            updateSetCount();

            const setId = existingId || `set_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            if (!existingData) productSetsData.push({ id: setId });

            const wrap = document.createElement('div');
            wrap.className = 'set-item rounded-lg p-3 relative opacity-0 transition-opacity duration-300';
            wrap.style.cssText = 'background-color:#0e0e14;border:1px solid #2a2a3a;';
            wrap.setAttribute('data-id', setId);
            wrap.innerHTML = `
                <div class="flex justify-between items-center mb-3">
                    <span class="set-number text-xs font-bold" style="color:#d4af37;">ชุดที่ ${setCount}</span>
                    <button class="btn-remove-set text-gray-500 hover:text-red-400 p-1 rounded-full transition"><!-- @license lucide-static v1.7.0 - ISC -->
<svg
  class="lucide lucide-x"
  xmlns="http://www.w3.org/2000/svg"
  width="100%"
  height="100%"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
 class="w-3.5 h-3.5">
  <path d="M18 6 6 18" />
  <path d="m6 6 12 12" />
</svg></button>
                </div>
                <div class="grid grid-cols-3 gap-2 mb-3 product-images-grid">
                    <div class="image-box-product dashed-box rounded-lg flex flex-col items-center justify-center p-2 h-[80px] cursor-pointer relative overflow-hidden">
                        <div class="image-placeholder-product flex flex-col items-center pointer-events-none"><!-- @license lucide-static v1.7.0 - ISC -->
<svg
  class="lucide lucide-image-plus"
  xmlns="http://www.w3.org/2000/svg"
  width="100%"
  height="100%"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
 class="w-4 h-4 mb-1" style="color:#d4af37;">
  <path d="M16 5h6" />
  <path d="M19 2v6" />
  <path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5" />
  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  <circle cx="9" cy="9" r="2" />
</svg><span class="text-[9px] text-gray-500 text-center">Subject</span></div>
                        <img class="image-preview-product absolute inset-0 w-full h-full object-cover hidden" alt="product">
                        <div class="image-remove-product image-remove hidden absolute top-1 right-1 z-10 cursor-pointer"><!-- @license lucide-static v1.7.0 - ISC -->
<svg
  class="lucide lucide-x-circle"
  xmlns="http://www.w3.org/2000/svg"
  width="100%"
  height="100%"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
 class="w-4 h-4 text-red-500 bg-black/50 rounded-full">
  <circle cx="12" cy="12" r="10" />
  <path d="m15 9-6 6" />
  <path d="m9 9 6 6" />
</svg></div>
                    </div>
                    <input type="file" class="image-input-product hidden" accept="image/*">
                    <div class="image-box-model dashed-box rounded-lg flex flex-col items-center justify-center p-2 h-[80px] cursor-pointer relative overflow-hidden">
                        <div class="image-placeholder-model flex flex-col items-center pointer-events-none"><!-- @license lucide-static v1.7.0 - ISC -->
<svg
  class="lucide lucide-user"
  xmlns="http://www.w3.org/2000/svg"
  width="100%"
  height="100%"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
 class="w-4 h-4 mb-1" style="color:#d4af37;">
  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
  <circle cx="12" cy="7" r="4" />
</svg><span class="text-[9px] text-gray-500 text-center">Scene</span></div>
                        <img class="image-preview-model absolute inset-0 w-full h-full object-cover hidden" alt="model">
                        <div class="image-remove-model image-remove hidden absolute top-1 right-1 z-10 cursor-pointer"><!-- @license lucide-static v1.7.0 - ISC -->
<svg
  class="lucide lucide-x-circle"
  xmlns="http://www.w3.org/2000/svg"
  width="100%"
  height="100%"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
 class="w-4 h-4 text-red-500 bg-black/50 rounded-full">
  <circle cx="12" cy="12" r="10" />
  <path d="m15 9-6 6" />
  <path d="m9 9 6 6" />
</svg></div>
                    </div>
                    <input type="file" class="image-input-model hidden" accept="image/*">
                    <div class="image-box-style dashed-box rounded-lg flex flex-col items-center justify-center p-2 h-[80px] cursor-pointer relative overflow-hidden">
                        <div class="image-placeholder-style flex flex-col items-center pointer-events-none"><!-- @license lucide-static v1.7.0 - ISC -->
<svg
  class="lucide lucide-palette"
  xmlns="http://www.w3.org/2000/svg"
  width="100%"
  height="100%"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
 class="w-4 h-4 mb-1" style="color:#d4af37;">
  <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
  <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
  <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
  <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
  <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
</svg><span class="text-[9px] text-gray-500 text-center">Style</span></div>
                        <img class="image-preview-style absolute inset-0 w-full h-full object-cover hidden" alt="style">
                        <div class="image-remove-style image-remove hidden absolute top-1 right-1 z-10 cursor-pointer"><!-- @license lucide-static v1.7.0 - ISC -->
<svg
  class="lucide lucide-x-circle"
  xmlns="http://www.w3.org/2000/svg"
  width="100%"
  height="100%"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
 class="w-4 h-4 text-red-500 bg-black/50 rounded-full">
  <circle cx="12" cy="12" r="10" />
  <path d="m15 9-6 6" />
  <path d="m9 9 6 6" />
</svg></div>
                    </div>
                    <input type="file" class="image-input-style hidden" accept="image/*">
                </div>
                <div class="space-y-2">
                    <input type="text" class="input-name w-full input-bg rounded-md p-2 text-xs" placeholder="ชื่อสินค้า">
                    <input type="text" class="input-product-id w-full input-bg rounded-md p-2 text-xs" placeholder="Product ID (ไม่บังคับ)">
                    <textarea class="input-prompt w-full input-bg rounded-md p-2 text-xs h-14 resize-none" placeholder="Prompt เสริม (ไม่บังคับ)"></textarea>
                    <label class="toggle-option cursor-pointer" style="padding:6px 10px;">
                        <div class="toggle-switch" style="transform:scale(0.85);"><input type="checkbox" class="input-use-exact"><span class="toggle-slider"></span></div>
                        <span class="text-[11px] text-gray-300">ใช้ Prompt นี้ตรงๆ</span>
                    </label>
                </div>`;

            setsWrap.appendChild(wrap);
            if (window.lucide) {
                setTimeout(() => {
                    try { lucide.createIcons({ root: wrap }); } catch (e) { console.error('[Arin] Lucide Set Error:', e); }
                }, 100);
            }

            if (existingData) {
                const q = (sel) => wrap.querySelector(sel);
                if (existingData.name) q('.input-name').value = existingData.name;
                if (existingData.prompt) q('.input-prompt').value = existingData.prompt;
                if (existingData.productId) q('.input-product-id').value = existingData.productId;
                if (existingData.useExact) {
                    q('.input-use-exact').checked = true;
                    q('.input-use-exact').closest('.toggle-option')?.classList.add('active');
                }
                ['product', 'model', 'style'].forEach((zone) => {
                    const dataKey = zone === 'product' ? 'subject' : (zone === 'model' ? 'scene' : 'style');
                    const imgData = existingData[dataKey];
                    if (!imgData) return;
                    wrap.querySelector(`.image-preview-${zone}`).src = imgData;
                    wrap.querySelector(`.image-preview-${zone}`).classList.remove('hidden');
                    wrap.querySelector(`.image-placeholder-${zone}`).classList.add('hidden');
                    wrap.querySelector(`.image-remove-${zone}`).classList.remove('hidden');
                    wrap.querySelector(`.image-box-${zone}`).classList.add('has-image');
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
                    productSetsData = productSetsData.filter((item) => item.id !== setId);
                    setCount -= 1;
                    setsWrap.querySelectorAll('.set-item').forEach((item, index) => {
                        const num = item.querySelector('.set-number');
                        if (num) num.textContent = `ชุดที่ ${index + 1}`;
                    });
                    updateSetCount();
                    saveState();
                }, 300);
            });

            attachImageUpload(wrap, setId);
            wrap.classList.remove('opacity-0');
            if (!existingId) {
                setTimeout(() => {
                    document.getElementById('mainScrollArea')?.scrollTo({ top: 99999, behavior: 'smooth' });
                }, 60);
            }
            saveState();
        };

        if (btnAddSet) btnAddSet.addEventListener('click', () => addProductSet());

        const getGeneralSettings = () => ({
            aspectRatio: document.getElementById('aspectRatio')?.value || '1:1',
            cameraAngle: document.getElementById('cameraAngle')?.value || 'close-up',
            randomCameraToggle: document.getElementById('randomCameraToggle')?.checked || false,
            aiProvider: document.getElementById('aiProvider')?.value || 'groq',
            apiKey: document.getElementById('apiKey')?.value || '',
            apiKeyGroq: document.getElementById('apiKeyGroq')?.value || '',
            apiKeyGemini: document.getElementById('apiKeyGemini')?.value || '',
            apiKeyOpenRouter: document.getElementById('apiKeyOpenRouter')?.value || '',
            aiEnhanceToggle: document.getElementById('aiEnhanceToggle')?.checked || false,
            randomSceneToggle: document.getElementById('randomSceneToggle')?.checked || false,
            overlayText: document.getElementById('overlayText')?.value || '',
            noOverlayToggle: document.getElementById('noOverlayToggle')?.checked || false,
            autoLoopToggle: document.getElementById('autoLoopToggle')?.checked || false,
            loopCount: document.getElementById('loopCount')?.value || '0',
            delayBetween: document.getElementById('delayBetween')?.value || '15'
        });

        const buildQueueItems = () => {
            setsWrap.querySelectorAll('.set-item').forEach((wrap) => {
                const id = wrap.getAttribute('data-id');
                const data = getSetDataById(id);
                data.name = wrap.querySelector('.input-name')?.value || '';
                data.prompt = wrap.querySelector('.input-prompt')?.value || '';
                data.productId = wrap.querySelector('.input-product-id')?.value || '';
                data.useExact = wrap.querySelector('.input-use-exact')?.checked || false;
            });

            const general = getGeneralSettings();
            const items = [];
            productSetsData.forEach((set, index) => {
                if (!set.subject && !set.name && !set.prompt) return;
                let combinedPrompt = [set.name, set.prompt].filter(Boolean).join(' ').trim();
                const styleHints = [];
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
                    setName: `ชุดที่ ${index + 1}`,
                    prompt: combinedPrompt,
                    subjectImage: set.subject || null,
                    sceneImage: set.scene || null,
                    styleImage: set.style || null,
                    productId: set.productId || null,
                    useExact: set.useExact || false
                });
            });

            const providerBase = general.aiProvider.replace('_thai', '');
            if (providerBase === 'groq') general.apiKey = general.apiKeyGroq || general.apiKey;
            if (providerBase === 'gemini') general.apiKey = general.apiKeyGemini || general.apiKey;
            if (providerBase === 'openrouter') general.apiKey = general.apiKeyOpenRouter || general.apiKey;
            return { items, general };
        };

        if (btnRun) {
            btnRun.addEventListener('click', () => {
                if (productSetsData.length === 0) return alert('กรุณาเพิ่มชุดสินค้าอย่างน้อย 1 ชุด');
                const { items, general } = buildQueueItems();
                if (items.length === 0) return alert('กรุณาใส่ชื่อสินค้าหรือรูปภาพอย่างน้อย 1 ชุด');
                chrome.runtime?.sendMessage?.({ action: 'START_QUEUE', items, settings: general }, () => {
                    if (chrome.runtime.lastError) LOG.error(chrome.runtime.lastError.message);
                    else LOG.success('ส่ง Queue ไปยัง Background สำเร็จ');
                });
                queueWrap?.classList.remove('hidden');
                btnPause?.classList.remove('hidden');
                btnResume?.classList.add('hidden');
                isPaused = false;
                if (statusBadge) {
                    statusBadge.textContent = `กำลังรัน ${items.length} งาน`;
                    statusBadge.style.background = 'rgba(16,185,129,0.15)';
                    statusBadge.style.color = '#10b981';
                    statusBadge.style.borderColor = 'rgba(16,185,129,0.3)';
                }
            });
        }

        if (btnPause) {
            btnPause.addEventListener('click', () => {
                chrome.runtime?.sendMessage?.({ action: 'PAUSE_QUEUE' });
                isPaused = true;
                btnPause.classList.add('hidden');
                btnResume?.classList.remove('hidden');
            });
        }

        if (btnResume) {
            btnResume.addEventListener('click', () => {
                chrome.runtime?.sendMessage?.({ action: 'RESUME_QUEUE' });
                isPaused = false;
                btnResume.classList.add('hidden');
                btnPause?.classList.remove('hidden');
            });
        }

        if (btnClear) {
            btnClear.addEventListener('click', () => {
                chrome.runtime?.sendMessage?.({ action: 'CLEAR_QUEUE' });
                queueWrap?.classList.add('hidden');
                btnPause?.classList.add('hidden');
                btnResume?.classList.add('hidden');
                if (statusBadge) {
                    statusBadge.textContent = 'พร้อมใช้งาน';
                    statusBadge.style.background = 'rgba(212,175,55,0.12)';
                    statusBadge.style.color = '#d4af37';
                    statusBadge.style.borderColor = 'rgba(212,175,55,0.25)';
                }
            });
        }

        if (btnClearLog) {
            btnClearLog.addEventListener('click', () => {
                const logEl = document.getElementById('liveLog');
                if (!logEl) return;
                logEl.innerHTML = '<div class="text-gray-500">รอคำสั่ง...</div>';
            });
        }

        const updateQueueUI = (queue) => {
            if (!queueList) return;
            if (!queue?.length) {
                queueList.innerHTML = '<div class="text-xs text-gray-500 text-center py-2">ไม่มีงานในคิว</div>';
                if (queueStatus) queueStatus.textContent = '0 งาน';
                return;
            }
            const labels = { pending: 'รอคิว', running: 'กำลังรัน', completed: 'สำเร็จ ✓', failed: 'ล้มเหลว ✗' };
            queueList.innerHTML = queue.map((item) => {
                const pct = item.status === 'completed' ? 100 : (item.percent || 0);
                let cls = 'queue-item';
                if (['running', 'typing', 'submitting'].includes(item.status)) cls += ' running';
                if (item.status === 'completed') cls += ' completed';
                if (item.status === 'failed') cls += ' failed';
                return `<div class="${cls}"><div class="flex justify-between items-center mb-1"><div class="flex items-center gap-1.5 overflow-hidden"><span class="status-dot"></span><span class="font-bold text-white truncate">${item.setName || 'งาน'}</span><span class="text-gray-400 truncate" style="max-width:120px;">- ${(item.prompt || '').slice(0, 40)}</span></div><span class="text-[9px] px-1.5 py-0.5 rounded text-gray-300 whitespace-nowrap" style="background:#1a1a20;">${labels[item.status] || item.status}</span></div><div class="flex items-center gap-2"><div class="flex-1 progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><span class="text-[9px] text-gray-400 w-6 text-right">${pct}%</span></div>${item.error ? `<div class="mt-1 text-[10px] text-red-400">${item.error}</div>` : ''}</div>`;
            }).join('');
        };

        chrome.runtime?.onMessage?.addListener((msg) => {
            if (msg.action === 'QUEUE_UPDATED') updateQueueUI(msg.queue);
            if (msg.action === 'LOG') {
                const fn = LOG[msg.level] || LOG.info;
                fn(msg.text);
            }
        });

        saveState = async () => {
            const state = { general: getGeneralSettings(), sets: productSetsData };
            try {
                await chrome.storage.local.set({ arinAutoState: state });
            } catch (e) {
                LOG.error(`บันทึก State ล้มเหลว: ${e.message}`);
            }
        };

        const loadState = async () => {
            let saved = null;
            try {
                const data = await chrome.storage.local.get('arinAutoState');
                saved = data.arinAutoState || null;
            } catch (e) {
                LOG.error(`โหลด State ล้มเหลว: ${e.message}`);
            }

            if (saved?.general) {
                const g = saved.general;
                const setVal = (id, value) => {
                    const el = document.getElementById(id);
                    if (el && value !== undefined) el.value = value;
                };
                const setCheck = (id, value) => {
                    const el = document.getElementById(id);
                    if (el) el.checked = !!value;
                };
                setVal('aspectRatio', g.aspectRatio);
                setVal('cameraAngle', g.cameraAngle);
                setCheck('randomCameraToggle', g.randomCameraToggle);
                setVal('aiProvider', g.aiProvider);
                setVal('apiKey', g.apiKey);
                setVal('apiKeyGroq', g.apiKeyGroq);
                setVal('apiKeyGemini', g.apiKeyGemini);
                setVal('apiKeyOpenRouter', g.apiKeyOpenRouter);
                setCheck('aiEnhanceToggle', g.aiEnhanceToggle);
                setCheck('randomSceneToggle', g.randomSceneToggle);
                setVal('overlayText', g.overlayText);
                setCheck('noOverlayToggle', g.noOverlayToggle);
                setCheck('autoLoopToggle', g.autoLoopToggle);
                setVal('loopCount', g.loopCount);
                setVal('delayBetween', g.delayBetween);
                ['randomCameraToggle', 'aiEnhanceToggle', 'randomSceneToggle', 'noOverlayToggle', 'autoLoopToggle'].forEach((id) => {
                    const cb = document.getElementById(id);
                    if (cb) cb.dispatchEvent(new Event('change'));
                });
            }

            if (saved?.sets?.length) {
                productSetsData = saved.sets;
                saved.sets.forEach((item) => addProductSet(item.id, item));
            } else {
                addProductSet();
            }

            document.querySelectorAll('#main-content-wrapper input, #main-content-wrapper select, #main-content-wrapper textarea').forEach((el) => {
                el.addEventListener('change', saveState);
                if (['text', 'password', 'search', ''].includes(el.type) || el.tagName === 'TEXTAREA') {
                    el.addEventListener('input', saveState);
                }
            });
        };

        chrome.storage.local.get('botState', (data) => {
            if (data.botState?.queue?.length) {
                queueWrap?.classList.remove('hidden');
            }
        });

        loadState();
        } catch (fatalErr) {
            console.error('[Arin] UI Exception:', fatalErr);
            LOG.error('UI Exception: ' + fatalErr.message);
            alert('Arin JS Error: ' + fatalErr.message);
        }
    }
});
