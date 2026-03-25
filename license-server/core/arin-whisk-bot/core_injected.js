// Injected.js — รันใน page context ของ Google Whisk
// Hook fetch/XHR เพื่อดักจับ result URL + จัดการ file upload bypass
(function() {
    if (window.__arinWhiskHookInjected) return;
    window.__arinWhiskHookInjected = true;

    // ── Fetch Hook: ปิดชั่วคราวสำหรับ Whisk เพราะทำให้ดึง history มาตอนโหลด (ใช้ DOM scan ใน content.js ปลอดภัยกว่า) ──
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
        return origFetch.apply(this, args);
    };

    // ── XHR Hook: ปิดชั่วคราวเช่นกัน ──
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        return origOpen.apply(this, [method, url, ...rest]);
    };

    // ── Upload Request Handler (สำหรับ Subject/Scene/Style zones) ──
    window.addEventListener('message', async (e) => {
        if (e.data?.type !== 'ARIN_UPLOAD_REQUEST') return;

        const target = e.data.target || 'subject'; // 'subject' | 'scene' | 'style'
        
        // หา upload zone ที่ตรงกับ target
        const findUploadZone = () => {
            // หา container ที่มีข้อความตรงกับ target
            const labels = {
                'subject': ['Subject', 'subject', 'หัวข้อ'],
                'scene': ['Scene', 'scene', 'ฉาก'],
                'style': ['Style', 'style', 'สไตล์']
            };
            
            const targetLabels = labels[target] || labels['subject'];
            
            // หา heading/label ที่ตรงกัน
            const allEls = document.querySelectorAll('h2, h3, span, label, p, div');
            for (const el of allEls) {
                const text = (el.innerText || '').trim().toLowerCase();
                if (targetLabels.some(l => text.includes(l.toLowerCase()))) {
                    // หา input[type="file"] ที่ใกล้ที่สุด
                    let parent = el.parentElement;
                    for (let i = 0; i < 8 && parent; i++) {
                        const fileInput = parent.querySelector('input[type="file"]');
                        if (fileInput) return fileInput;
                        // หา dropzone/upload area
                        const dropArea = parent.querySelector('[class*="upload"], [class*="drop"], [role="button"]');
                        if (dropArea) {
                            const fi = dropArea.querySelector('input[type="file"]');
                            if (fi) return fi;
                        }
                        parent = parent.parentElement;
                    }
                }
            }
            
            // Fallback: หา input[type="file"] ตัวที่ N
            const allInputs = document.querySelectorAll('input[type="file"]');
            const idx = { 'subject': 0, 'scene': 1, 'style': 2 };
            return allInputs[idx[target] || 0] || null;
        };

        const fileInput = findUploadZone();
        if (!fileInput) {
            window.postMessage({ type: 'ARIN_UPLOAD_RESULT', success: false, error: `no input for ${target}` }, '*');
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

            Object.defineProperty(fileInput, 'files', {
                configurable: true,
                get() { return dt.files; }
            });

            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            fileInput.dispatchEvent(new Event('input', { bubbles: true }));

            console.log(`[ArinWhisk] ${target} file injected OK, count:`, dt.files.length);

            window.postMessage({ 
                type: 'ARIN_UPLOAD_RESULT', 
                success: true, 
                target,
                count: dt.files.length 
            }, '*');
        } catch (err) {
            console.error(`[ArinWhisk] Upload error (${target}):`, err.message);
            window.postMessage({ 
                type: 'ARIN_UPLOAD_RESULT', 
                success: false, 
                target,
                error: err.message 
            }, '*');
        }
    });

    console.log('[ArinWhisk] Injected.js loaded — fetch + XHR hook active ✅');
})();
