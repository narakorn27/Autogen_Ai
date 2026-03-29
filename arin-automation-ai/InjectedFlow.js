// InjectedFlow.js — Google Flow page context only
// v7.6: countInputImages — รองรับ blob / googleusercontent / aisandbox ไม่ใช่แค่ getMediaUrlRedirect
//       + กรองตำแหน่งใกล้ slate (ลด false positive จาก history panel)
//       + fallback ค้น serverId ใน attribute ของ node ใกล้ composer
(function() {
    if (window.__arinFlowInjected) return;
    window.__arinFlowInjected = true;

    // ── Fetch Hook: ดัก uploadImage response เพื่อจับ serverId ──
    window.__arinUploadedServerIds = new Set();
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
        const res = await origFetch.apply(this, args);
        // non-blocking, res.ok เท่านั้น
        if (url.includes('uploadImage') && res.ok) {
            try {
                res.clone().json().then(j => {
                    const serverId = j?.media?.name;
                    if (serverId) {
                        console.log('[ArinFlow] upload serverId captured:', serverId);
                        window.__arinUploadedServerIds.add(serverId);
                        window.postMessage({ type: 'ARIN_FLOW_UPLOAD_SERVERID', serverId }, '*');
                    }
                }).catch(() => {});
            } catch(e) {}
        }
        return res;
    };

    // ── Handler: Upload file via input ──
    window.__arinUploadInProgress = false;
    window.addEventListener('message', async (e) => {
        if (e.data?.type !== 'ARIN_FLOW_UPLOAD_REQUEST') return;

        if (window.__arinUploadInProgress) {
            console.warn('[ArinFlow] upload already in progress, ignoring');
            window.postMessage({ type: 'ARIN_FLOW_UPLOAD_RESULT', success: false, error: 'already in progress' }, '*');
            return;
        }
        window.__arinUploadInProgress = true;

        // Flow รองรับแค่ 1 รูป — ใช้แค่ไฟล์แรก
        const requests = e.data.files ? e.data.files.slice(0, 1) : [{ base64: e.data.base64, mime: e.data.mime, filename: e.data.filename }];
        try {
            const input = document.querySelector('input.sc-a40aa0db-0')
                       || document.querySelector('input[type="file"][accept="image/*"]');
            if (!input) {
                window.postMessage({ type: 'ARIN_FLOW_UPLOAD_RESULT', success: false, error: 'no input' }, '*');
                window.__arinUploadInProgress = false;
                return;
            }

            const dt = new DataTransfer();
            for (const req of requests) {
                if (!req.base64) continue;
                const binary = atob(req.base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const file = new File(
                    [new Blob([bytes], { type: req.mime })],
                    req.filename || `arin_${Date.now()}.jpg`,
                    { type: req.mime }
                );
                dt.items.add(file);
            }

            Object.defineProperty(input, 'files', { configurable: true, get() { return dt.files; } });

            // trigger React onChange
            const rk = Object.keys(input).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactProps'));
            if (rk) {
                const onChange = input[rk]?.memoizedProps?.onChange || input[rk]?.onChange;
                if (onChange) {
                    onChange({ target: input, currentTarget: input, bubbles: true });
                    window.postMessage({ type: 'ARIN_FLOW_UPLOAD_RESULT', success: true }, '*');
                    window.__arinUploadInProgress = false;
                    return;
                }
            }
            input.dispatchEvent(new Event('change', { bubbles: true }));
            window.postMessage({ type: 'ARIN_FLOW_UPLOAD_RESULT', success: true, fallback: true }, '*');
        } catch (err) {
            window.postMessage({ type: 'ARIN_FLOW_UPLOAD_RESULT', success: false, error: err.message }, '*');
        }
        window.__arinUploadInProgress = false;
    });

    // ── Ping ──
    window.addEventListener('message', (e) => {
        if (e.data?.type === 'ARIN_PING_INJECTED')
            window.postMessage({ type: 'ARIN_INJECTED_READY' }, '*');
    });

    // ── Handler: Reset uploaded serverIds ──
    window.addEventListener('message', (e) => {
        if (e.data?.type !== 'ARIN_FLOW_RESET_SERVERIDS') return;
        if (window.__arinUploadedServerIds) {
            window.__arinUploadedServerIds.clear();
            console.log('[ArinFlow] __arinUploadedServerIds cleared');
        }
        window.__arinUploadInProgress = false;
    });

    // ── Media URL heuristics (Flow เปลี่ยนรูปแบบ src ได้) ──
    function flowMediaSrcLooksLikeThumbnail(img) {
        const s = (img.currentSrc || img.src || '').trim();
        if (!s) return false;
        return (
            s.includes('getMediaUrlRedirect') ||
            s.includes('blob:') ||
            s.includes('lh3.googleusercontent') ||
            s.includes('googleusercontent.com') ||
            s.includes('aisandbox') ||
            /googleapis\.com.*\/(media|image|v1)/i.test(s)
        );
    }

    function rectNearComposer(rect, slateRect) {
        if (!rect || rect.width < 16 || rect.height < 16) return false;
        const padX = 280;
        const padY = 180;
        return (
            rect.bottom >= slateRect.top - padY &&
            rect.top <= slateRect.bottom + padY &&
            rect.right >= slateRect.left - padX &&
            rect.left <= slateRect.right + padX
        );
    }

    function countThumbsNearSlateInRoot(root, slateRect) {
        const imgs = Array.from(root.querySelectorAll('img')).filter(flowMediaSrcLooksLikeThumbnail);
        return imgs.filter(img => rectNearComposer(img.getBoundingClientRect(), slateRect));
    }

    function subtreeHasServerIdAttr(root, serverId) {
        if (!serverId || !root?.querySelectorAll) return false;
        const maxNodes = 800;
        let n = 0;
        for (const el of root.querySelectorAll('*')) {
            if (++n > maxNodes) break;
            const attrs = el.attributes;
            if (!attrs?.length) continue;
            for (let i = 0; i < attrs.length; i++) {
                const v = attrs[i].value;
                if (v && v.includes(serverId)) return true;
            }
        }
        return false;
    }

    // ── Handler: Count images in input bar ──
    window.addEventListener('message', async (e) => {
        if (e.data?.type !== 'ARIN_FLOW_COUNT_INPUT_IMAGES') return;
        try {
            const slate = document.querySelector('div[data-slate-editor="true"]');
            if (!slate) {
                window.postMessage({ type: 'ARIN_FLOW_INPUT_IMAGE_COUNT', count: 0, strategy: 'no-slate' }, '*');
                return;
            }

            const slateRect = slate.getBoundingClientRect();
            const maxComposerThumbs = 6;

            let cur = slate.parentElement;
            for (let depth = 1; depth <= 12 && cur && cur !== document.body; depth++) {
                const thumbs = countThumbsNearSlateInRoot(cur, slateRect);
                if (thumbs.length >= 1 && thumbs.length <= maxComposerThumbs) {
                    window.postMessage({
                        type: 'ARIN_FLOW_INPUT_IMAGE_COUNT',
                        count: thumbs.length,
                        strategy: `ancestor-geo-${depth}`
                    }, '*');
                    return;
                }
                cur = cur.parentElement;
            }

            const globalNear = Array.from(document.querySelectorAll('img'))
                .filter(flowMediaSrcLooksLikeThumbnail)
                .filter(img => rectNearComposer(img.getBoundingClientRect(), slateRect));
            if (globalNear.length >= 1 && globalNear.length <= maxComposerThumbs) {
                window.postMessage({
                    type: 'ARIN_FLOW_INPUT_IMAGE_COUNT',
                    count: globalNear.length,
                    strategy: 'global-geo'
                }, '*');
                return;
            }

            // หลายรูปในแถบเดียวกัน (เช่น history ใกล้ composer) — ถ้ามี serverId จาก upload ล่าสุด ให้ยึด 1 รูปที่ใกล้ slate ที่สุด
            if (globalNear.length > maxComposerThumbs && window.__arinUploadedServerIds?.size > 0) {
                const cx = (slateRect.left + slateRect.right) / 2;
                const refY = slateRect.top;
                const ranked = globalNear
                    .map(img => {
                        const r = img.getBoundingClientRect();
                        const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - refY);
                        return { img, d };
                    })
                    .sort((a, b) => a.d - b.d);
                if (ranked[0] && ranked[0].d < 420) {
                    window.postMessage({
                        type: 'ARIN_FLOW_INPUT_IMAGE_COUNT',
                        count: 1,
                        strategy: 'global-geo-closest+sid'
                    }, '*');
                    return;
                }
            }

            if (window.__arinUploadedServerIds?.size > 0) {
                let matched = 0;
                document.querySelectorAll('img').forEach(img => {
                    const blob = (img.currentSrc || img.src || '') + ' ' + (img.srcset || '');
                    window.__arinUploadedServerIds.forEach(sid => {
                        if (sid && blob.includes(sid)) matched++;
                    });
                });
                if (matched > 0) {
                    window.postMessage({
                        type: 'ARIN_FLOW_INPUT_IMAGE_COUNT',
                        count: Math.min(matched, maxComposerThumbs),
                        strategy: 'serverId-in-src'
                    }, '*');
                    return;
                }
            }

            if (window.__arinUploadedServerIds?.size > 0) {
                cur = slate.parentElement;
                for (let depth = 1; depth <= 10 && cur && cur !== document.body; depth++) {
                    for (const sid of window.__arinUploadedServerIds) {
                        if (subtreeHasServerIdAttr(cur, sid)) {
                            window.postMessage({
                                type: 'ARIN_FLOW_INPUT_IMAGE_COUNT',
                                count: 1,
                                strategy: `serverId-attr-depth-${depth}`
                            }, '*');
                            return;
                        }
                    }
                    cur = cur.parentElement;
                }
            }

            window.postMessage({ type: 'ARIN_FLOW_INPUT_IMAGE_COUNT', count: 0, strategy: 'none' }, '*');
        } catch (err) {
            window.postMessage({ type: 'ARIN_FLOW_INPUT_IMAGE_COUNT', count: 0, strategy: 'error' }, '*');
        }
    });

    console.log('[ArinFlow] InjectedFlow.js v7.6 ready ✅');
})();