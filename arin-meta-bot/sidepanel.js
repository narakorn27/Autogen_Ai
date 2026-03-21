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

    // Initial state: hide everything until check
    licenseGate.classList.add('hidden');
    mainWrapper.classList.add('hidden');

    // 1. Generate Machine ID
    const machineId = await getMachineId();
    machineIdDisplay.innerText = `Device ID: ${machineId.substring(0, 16)}...`;

    // 2. Check if already active
    const data = await chrome.storage.local.get('licenseInfo');
    if (data.licenseInfo && data.licenseInfo.key) {
        verifyAndLoad(data.licenseInfo.key, machineId);
    } else {
        licenseGate.classList.remove('hidden');
    }

    // 3. Activate Button
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

    /**
     * ตรวจสอบ License และโหลด Code
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
                    await chrome.storage.local.set({ licenseInfo: { key, expires_at: result.expires_at } });
                }
                
                showStatus('สำเร็จ! กำลังโหลดบอท...', 'success');
                
                // เก็บ code ไว้ใน background เพื่อกระจาย
                chrome.runtime.sendMessage({ 
                    action: 'LICENSE_VERIFIED', 
                    code: result.code,
                    key: key,
                    mId: mId
                });

                // รัน core logic ของ sidepanel ทันที
                if (result.code.sidepanel) {
                    licenseGate.classList.add('hidden');
                    mainWrapper.classList.remove('hidden'); // Show main UI
                    
                    const runner = new Function(result.code.sidepanel);
                    runner();
                }
                
                return true;
            } else {
                showStatus(result.message || 'License ไม่ถูกต้อง', 'error');
                licenseGate.classList.remove('hidden');
                mainWrapper.classList.add('hidden');
                return false;
            }
        } catch (err) {
            console.error('Verify error:', err);
            showStatus('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
            return false;
        }
    }

    function showStatus(msg, type) {
        statusMsg.innerText = msg;
        statusMsg.className = `status-msg ${type}`;
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
});
