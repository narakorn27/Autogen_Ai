// Service Worker for Auto Content 2026

chrome.runtime.onInstalled.addListener(() => {
    // กำหนดให้คลิก extension icon แล้วเปิด Side Panel เสมอ
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

// Setup Alarms สำหรับ Auto Run Loop
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'auto_content_loop') {
        console.log('[Auto Content] Triggering scheduled content loop...');
        runAutoContentFlow();
    }
});

// ฟังก์ชันหลักสำหรับ Auto Run (ยังไม่ใส่ logic เต็มรูปแบบ)
async function runAutoContentFlow() {
    chrome.storage.local.get('autoRun', (data) => {
        if (!data.autoRun || !data.autoRun.enabled) return;
        
        // TODO: 
        // 1. Fetch Trends
        // 2. Generate Text
        // 3. Generate Image
        // 4. Create Overlay
        // 5. Post to Facebook
        
        console.log('[Auto Content] Flow executed. Ready for next phase.');
    });
}
