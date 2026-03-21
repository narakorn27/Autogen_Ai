// ── Loader Content Script (แจกลูกค้า) ──

(async function() {
    console.log('[Arin Loader] Content script loaded. Requesting core...');

    // ดึง core logic จาก background/storage
    chrome.runtime.sendMessage({ action: 'GET_CORE_CONTENT' }, (response) => {
        if (response && response.code) {
            console.log('[Arin Loader] Core content received. Executing...');
            try {
                // รัน core content logic
                const runner = new Function('injectedCode', response.code);
                runner(response.injected);
            } catch (e) {
                console.error('[Arin Loader] Core Execution failed:', e);
            }
        } else {
            console.log('[Arin Loader] Waiting for license activation...');
        }
    });
})();