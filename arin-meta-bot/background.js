// ── Loader Background Logic (แจกลูกค้า) ──

let coreCode = null;

// สำหรับ MV3: background service worker ไม่สามารถ eval() ได้โดยตรง
// แต่เราสามารถรัน logic ส่วนใหญ่ผ่าน message passing และ chrome.scripting ได้
// หรือถ้าเป็น unpacked extension อาจจะพยายามใช้ sandbox (แต่ที่นี่เราจะเน้นไปที่การรับ code มาเก็บไว้)

chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'LICENSE_VERIFIED') {
        coreCode = message.code;
        // เก็บลง storage เพื่อให้ content script ดึงไปใช้ได้
        chrome.storage.local.set({ coreCode: message.code });
        
        console.log('[Arin Loader] License Verified. Core code received.');

        // สำหรับ Background Logic: 
        // เนื่องจาก MV3 Service Worker เข้มงวดเรื่อง eval 
        // วิธีที่ยืดหยุ่นที่สุดคือการรัน logic ผ่าน "Dynamic Content Script" 
        // หรือถ้าต้องการ background queue จริงๆ อาจต้องใช้ offscreen document
        // ในที่นี้เราจะพยายามรัน code background (ถ้าทำได้ในสภาพแวดล้อมนั้น)
        try {
            if (coreCode && coreCode.background) {
                const runner = new Function(coreCode.background);
                runner();
            }
        } catch (e) {
            console.error('[Arin Loader] Background Core Execution failed:', e);
        }
    }

    if (message.action === 'GET_CORE_CONTENT') {
        chrome.storage.local.get('coreCode', (data) => {
            sendResponse({ code: data.coreCode?.content, injected: data.coreCode?.injected });
        });
        return true;
    }

    // ต่อคิว heartbeat ทุก 30 นาที
    if (message.action === 'START_HEARTBEAT') {
        chrome.alarms.create('arin_heartbeat', { periodInMinutes: 30 });
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'arin_heartbeat') {
        // ส่ง signal ให้ sidepanel ไปเช็คกับ server
        chrome.runtime.sendMessage({ action: 'DO_HEARTBEAT' }).catch(() => {});
    }
});