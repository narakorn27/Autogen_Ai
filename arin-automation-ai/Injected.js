// Injected.js — รันใน page context ของ Google Whisk
// Hook fetch/XHR เพื่อดักจับ result URL + จัดการ file upload bypass
(function() {
    if (window.__arinWhiskHookInjected) return;
    window.__arinWhiskHookInjected = true;

    // ── Fetch Hook ──
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

    // ── XHR Hook ──
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

    // ── Upload Request Handler (สำหรับ Subject/Scene/Style zones) ──
    window.addEventListener('message', async (e) => {
        if (e.data?.type !== 'ARIN_UPLOAD_REQUEST') return;

        const target = e.data.target || 'subject';
        const idx = { 'subject': 0, 'scene': 1, 'style': 2 };
        
        // ใช้ index โดยตรง — หลังจากกด "เพิ่มรูปภาพ" แล้ว input[type=file] มี 3 ตัวเสมอ
        const allInputs = document.querySelectorAll('input[type="file"]');
        const fileInput = allInputs[idx[target] ?? 0];

        if (!fileInput) {
            window.postMessage({ type: 'ARIN_UPLOAD_RESULT', success: false, target, error: `no input[${idx[target]}]` }, '*');
            return;
        }

        try {
            const images = e.data.images;
            const dt = new DataTransfer();
            for (const img of images) {
                const mime = img.mime || 'image/jpeg';
                const ext = mime.split('/')[1] || 'jpg';
                const binary = atob(img.base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const blob = new Blob([bytes], { type: mime });
                const file = new File([blob], `${target}_${Date.now()}.${ext}`, { type: mime });
                dt.items.add(file);
            }

            // inject files
            Object.defineProperty(fileInput, 'files', {
                configurable: true,
                get() { return dt.files; }
            });
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            fileInput.dispatchEvent(new Event('input', { bubbles: true }));

            console.log(`[ArinWhisk] ${target} injected OK via index ${idx[target]}, count:`, dt.files.length);
            window.postMessage({ type: 'ARIN_UPLOAD_RESULT', success: true, target, count: dt.files.length }, '*');

        } catch (err) {
            console.error(`[ArinWhisk] Upload error (${target}):`, err.message);
            window.postMessage({ type: 'ARIN_UPLOAD_RESULT', success: false, target, error: err.message }, '*');
        }
    });


    console.log('[ArinWhisk] Injected.js loaded — fetch + XHR hook active ✅');
})();
