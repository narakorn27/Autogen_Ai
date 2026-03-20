// injected.js — รันใน page context (ไม่ใช่ content script context)
// ไฟล์นี้ถูก inject ผ่าน chrome.scripting.executeScript หรือ web_accessible_resources
(function() {
    if (window.__arinFetchHookInjected) return;
    window.__arinFetchHookInjected = true;

    const origFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        const res = await origFetch.apply(this, args);

        if (url.includes('flowMedia') || url.includes('getMediaUrl')) {
            try {
                const json = await res.clone().json();
                const ts = Date.now();
                const mediaList = json.media || [];

                mediaList.forEach(item => {
                    const imgUrl = item?.image?.generatedImage?.fifeUrl;
                    const vidUrl = item?.video?.generatedVideo?.fifeUrl;
                    if (imgUrl) window.postMessage({ type: 'ARIN_MEDIA_URL', url: imgUrl, mediaType: 'image', ts }, '*');
                    if (vidUrl) window.postMessage({ type: 'ARIN_MEDIA_URL', url: vidUrl, mediaType: 'video', ts }, '*');
                });

                // fallback regex ถ้า structure เปลี่ยน
                if (mediaList.length === 0) {
                    const matches = JSON.stringify(json).match(/"fifeUrl":"(https:[^"]+)"/g);
                    if (matches) {
                        matches.forEach(m => {
                            const u = m.replace(/"fifeUrl":"/, '').replace(/"$/, '');
                            window.postMessage({ type: 'ARIN_MEDIA_URL', url: u, mediaType: 'unknown', ts }, '*');
                        });
                    }
                }
            } catch(e) {}
        }

        return res;
    };

    // Hook XHR ด้วย
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        if (typeof url === 'string' && (url.includes('flowMedia') || url.includes('getMediaUrl'))) {
            this.addEventListener('load', function() {
                try {
                    const json = JSON.parse(this.responseText);
                    const ts = Date.now();
                    (json.media || []).forEach(item => {
                        const imgUrl = item?.image?.generatedImage?.fifeUrl;
                        const vidUrl = item?.video?.generatedVideo?.fifeUrl;
                        if (imgUrl) window.postMessage({ type: 'ARIN_MEDIA_URL', url: imgUrl, mediaType: 'image', ts }, '*');
                        if (vidUrl) window.postMessage({ type: 'ARIN_MEDIA_URL', url: vidUrl, mediaType: 'video', ts }, '*');
                    });
                } catch(e) {}
            });
        }
        return origOpen.apply(this, [method, url, ...rest]);
    };

    console.log('[ArinHook] injected.js loaded — fetch + XHR hook active');
})();