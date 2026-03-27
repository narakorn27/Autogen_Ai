const fs = require('fs');

const injectedFile = 'c:/Users/66990/Desktop/autogen_ai/arin-automation-ai/InjectedFlow.js';
let injected = fs.readFileSync(injectedFile, 'utf8').split('\n');

const injNew = `    // ── Handler: Upload file via input ──
    window.addEventListener('message', async (e) => {
        if (e.data?.type !== 'ARIN_FLOW_UPLOAD_REQUEST') return;
        const requests = e.data.files ? e.data.files : [{ base64: e.data.base64, mime: e.data.mime, filename: e.data.filename }];
        try {
            const input = document.querySelector('input.sc-a40aa0db-0')
                       || document.querySelector('input[type="file"][accept="image/*"]');
            if (!input) {
                window.postMessage({ type: 'ARIN_FLOW_UPLOAD_RESULT', success: false, error: 'no input' }, '*');
                return;
            }

            const dt = new DataTransfer();
            for (const req of requests) {
                if (!req.base64) continue;
                const binary = atob(req.base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const file = new File([new Blob([bytes], { type: req.mime })], req.filename || \`arin_\${Date.now()}.jpg\`, { type: req.mime });
                dt.items.add(file);
            }

            Object.defineProperty(input, 'files', { configurable: true, get() { return dt.files; } });

            const rk = Object.keys(input).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactProps'));
            if (rk) {
                const onChange = input[rk]?.memoizedProps?.onChange || input[rk]?.onChange;
                if (onChange) {
                    onChange({ target: input, currentTarget: input, bubbles: true });
                    window.postMessage({ type: 'ARIN_FLOW_UPLOAD_RESULT', success: true }, '*');
                    return;
                }
            }
            input.dispatchEvent(new Event('change', { bubbles: true }));
            window.postMessage({ type: 'ARIN_FLOW_UPLOAD_RESULT', success: true, fallback: true }, '*');
        } catch (err) {
            window.postMessage({ type: 'ARIN_FLOW_UPLOAD_RESULT', success: false, error: err.message }, '*');
        }
    });`.split('\n');

injected.splice(91 - 1, 126 - 91 + 1, ...injNew);
fs.writeFileSync(injectedFile, injected.join('\n'));
console.log('InjectedFlow updated.');

const contentFile = 'c:/Users/66990/Desktop/autogen_ai/arin-automation-ai/content-flow.js';
let content = fs.readFileSync(contentFile, 'utf8').split('\n');

const step1New = `    // ─── Step 1: อัปโหลดภาพ (ถ้ามี) ───
    const imagesToUpload = [];
    if (data.subjectImage) imagesToUpload.push({ data: data.subjectImage, name: data.sourceFilename || data.imageName || 'subject.jpg', type: 'Subject' });
    if (data.sceneImage) imagesToUpload.push({ data: data.sceneImage, name: 'scene.jpg', type: 'Scene' });
    if (data.image && imagesToUpload.length === 0) imagesToUpload.push({ data: data.image, name: data.imageName || 'image.jpg', type: 'Image' });

    if (imagesToUpload.length > 0 || mode === 'frame_to_video') {
        if (imagesToUpload.length === 0) throw new Error('โหมด Frame to Video ต้องการรูปภาพประกอบ');
        
        sendProgress(promptId, 5, 'uploading');
        sendLog(\`อัปโหลดภาพพร้อมกัน \${imagesToUpload.length} ภาพ...\`, 'step');
        
        const successIds = await handleFlowMultipleImagesUpload(imagesToUpload);
        if (successIds.length < imagesToUpload.length) {
            sendLog(\`อัปโหลด/เลือกภาพไม่ครบ (ได้ \${successIds.length}/\${imagesToUpload.length})\`, 'warn');
        }
        await humanSleep(800, 1200);
    }`.split('\n');

content.splice(583 - 1, 668 - 583 + 1, ...step1New);

const uploadNew = `// ── แทนที่ handleFlowImageUpload เดิม ให้รองรับอัปโหลดพร้อมกัน ──
const handleFlowMultipleImagesUpload = async (imagesObjArray) => {
    sendLog(\`เริ่มต้นอัปโหลดภาพพร้อมกัน \${imagesObjArray.length} ภาพ...\`, 'info');
    if (!imagesObjArray || imagesObjArray.length === 0) return [];

    const capturedServerIds = [];
    const serverIdListener = (e) => {
        if (e.data?.type === 'ARIN_FLOW_UPLOAD_SERVERID') {
            capturedServerIds.push(e.data.serverId);
        }
    };
    window.addEventListener('message', serverIdListener);

    try {
        // 1. คลิกปุ่ม "เพิ่มสื่อ"
        const addBtn = Array.from(document.querySelectorAll('button')).find(b => {
            const txt = b.innerText || '';
            const rect = b.getBoundingClientRect();
            return (txt.includes('สร้าง') && txt.includes('add_2')) || 
                   (txt.includes('เพิ่มสื่อ') && rect.top > window.innerHeight * 0.5) ||
                   (txt.includes('Attach image'));
        });
        if (addBtn) {
            sendLog('คลิกปุ่ม "เพิ่มสื่อ"...', 'info');
            await humanClick(addBtn);
            await sleep(1200);
        }

        // 2. รอ input โผล่
        const startWait = Date.now();
        let input = null;
        while (Date.now() - startWait < 5000) {
            input = document.querySelector('input.sc-a40aa0db-0') || document.querySelector('input[type="file"][accept="image/*"]');
            if (input) break;
            await sleep(300);
        }
        if (!input) { sendLog('input ไม่โผล่', 'error'); return []; }

        // 3. เตรียมไฟล์ทั้งหมดส่งผ่าน postMessage
        const filesToInject = [];
        for (const img of imagesObjArray) {
            const mimeMatch = img.data.match(/data:([^;]+);/);
            const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const base64 = img.data.includes(',') ? img.data.split(',')[1] : img.data;
            filesToInject.push({ base64, mime, filename: img.name });
        }

        const countBefore = getThumbnailCount();
        sendLog(\`Thumbnail ก่อน upload: \${countBefore} (กำลังอัป \${filesToInject.length} ภาพ)\`, 'info');

        // 4. Upload ผ่าน Injected.js พร้อมกัน
        const injected = await new Promise((resolve) => {
            const handler = (e) => {
                if (e.data?.type === 'ARIN_FLOW_UPLOAD_RESULT') {
                    window.removeEventListener('message', handler);
                    resolve(e.data);
                }
            };
            window.addEventListener('message', handler);
            window.postMessage({
                type: 'ARIN_FLOW_UPLOAD_REQUEST',
                files: filesToInject
            }, '*');
            setTimeout(() => {
                window.removeEventListener('message', handler);
                resolve({ success: false, error: 'timeout' });
            }, 10000);
        });

        if (!injected.success) {
            sendLog(\`inject upload ล้มเหลว: \${injected.error}\`, 'error');
            return [];
        }
        sendLog('inject สำเร็จ ✅ รอข้อมูลจาก server...', 'info');

        // 5. รอ thumbnail อัปเดตเต็มจำนวน (thumbnail เพิ่มขึ้นเท่ากับจำนวนภาพ)
        await waitForThumbnailAdded(countBefore + filesToInject.length - 1, 30000);

        // 6. รอ serverId 
        const startParams = Date.now();
        while (capturedServerIds.length < filesToInject.length && (Date.now() - startParams < 15000)) {
            await sleep(500);
        }
        
        sendLog(\`ได้ serverId มารวม \${capturedServerIds.length} ภาพ\`, 'info');

        // 7. Select Card ทีละใบจาก serverIds ที่จับได้
        const successIds = [];
        const idsToSelect = capturedServerIds.length > 0 ? capturedServerIds : ['LATEST'];
        
        let currentInputCount = 0;
        try {
            currentInputCount = await new Promise((resolve) => {
                const h = (e) => {
                    if (e.data?.type === 'ARIN_FLOW_INPUT_IMAGE_COUNT') {
                        window.removeEventListener('message', h);
                        resolve(e.data.count);
                    }
                };
                window.addEventListener('message', h);
                window.postMessage({ type: 'ARIN_FLOW_COUNT_INPUT_IMAGES' }, '*');
                setTimeout(() => { window.removeEventListener('message', h); resolve(0); }, 1000);
            });
        } catch (e) {}

        for (const sid of idsToSelect) {
            sendLog(\`กำลัง select card: \${sid.slice(0,8)}...\`, 'info');
            
            let selectOk = false;
            for (let attempt = 1; attempt <= 2; attempt++) {
                selectOk = await new Promise((resolve) => {
                    const h = (e) => {
                        if (e.data?.type === 'ARIN_FLOW_SELECT_RESULT') {
                            window.removeEventListener('message', h);
                            resolve(e.data.success);
                        }
                    };
                    window.addEventListener('message', h);
                    window.postMessage({
                        type: 'ARIN_FLOW_SELECT_MEDIA',
                        serverId: sid
                    }, '*');
                    setTimeout(() => { window.removeEventListener('message', h); resolve(false); }, 10000);
                });

                if (selectOk) {
                    let uploaded = false;
                    for (let w = 0; w < 10; w++) {
                        await sleep(1000);
                        let latestCount = await new Promise((resolve) => {
                            const h = (e) => {
                                if (e.data?.type === 'ARIN_FLOW_INPUT_IMAGE_COUNT') {
                                    window.removeEventListener('message', h);
                                    resolve(e.data.count);
                                }
                            };
                            window.addEventListener('message', h);
                            window.postMessage({ type: 'ARIN_FLOW_COUNT_INPUT_IMAGES' }, '*');
                            setTimeout(() => { window.removeEventListener('message', h); resolve(0); }, 1000);
                        });
                        if (latestCount > currentInputCount) {
                            uploaded = true;
                            currentInputCount = latestCount;
                            break;
                        }
                    }
                    if (uploaded) {
                        sendLog(\`ตรวจ input bar: มีรูปเข้าแล้ว ✅\`, 'success');
                        successIds.push(sid);
                        break;
                    } else {
                        sendLog(\`ตรวจ input bar: ไม่พบรูป (อาจติด UI) ⚠️ ลองอีกครั้ง...\`, 'warn');
                        selectOk = false;
                    }
                } else {
                    sendLog(\`select card ล้มเหลว ❌ ลองอีกครั้ง...\`, 'warn');
                }
                if (!selectOk && attempt === 1) await humanSleep(1000, 2000);
            }
            if (selectOk) await sleep(500);
        }
        
        return successIds;

    } finally {
        window.removeEventListener('message', serverIdListener);
    }
};`.split('\n');

content.splice(214, 407 - 215 + 1, ...uploadNew);

fs.writeFileSync(contentFile, content.join('\n'));
console.log('content-flow.js updated.');
