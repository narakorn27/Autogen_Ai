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

    // ─── Upload Request Handler ───
    window.addEventListener('message', async (e) => {
        if (e.data?.type !== 'ARIN_UPLOAD_REQUEST') return;

        const fileInput = document.querySelector('input[type="file"]');
        if (!fileInput) {
            window.postMessage({ type: 'ARIN_UPLOAD_RESULT', success: false, error: 'no input' }, '*');
            return;
        }

        try {
            const images = e.data.images; // ✅ รับ array แทน single
            const dt = new DataTransfer();

            for (const img of images) {
                const mime = img.mime || 'image/jpeg';
                const ext = mime.split('/')[1] || 'jpg';
                const binary = atob(img.base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const blob = new Blob([bytes], { type: mime });
                const file = new File([blob], `frame_${Date.now()}_${dt.files.length}.${ext}`, { type: mime });
                dt.items.add(file);
            }

            // Override ผ่าน Object.defineProperty ใน page context (React bypass)
            Object.defineProperty(fileInput, 'files', {
                configurable: true,
                get() { return dt.files; }
            });

            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            fileInput.dispatchEvent(new Event('input', { bubbles: true }));

            console.log('[ArinHook] Files injected OK, count:', dt.files.length);

            window.postMessage({ 
                type: 'ARIN_UPLOAD_RESULT', 
                success: true, 
                count: dt.files.length 
            }, '*');
        } catch (err) {
            console.error('[ArinHook] Upload error:', err.message);
            window.postMessage({ 
                type: 'ARIN_UPLOAD_RESULT', 
                success: false, 
                error: err.message 
            }, '*');
        }
    });

    console.log('[ArinHook] injected.js loaded — fetch + XHR hook active');
})();