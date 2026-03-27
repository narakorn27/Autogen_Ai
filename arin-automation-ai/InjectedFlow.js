// InjectedFlow.js — Google Flow page context only
(function() {
    if (window.__arinFlowInjected) return;
    window.__arinFlowInjected = true;

    // ── Fetch Hook: ดัก uploadImage response เพื่อจับ serverId ──
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
        const res = await origFetch.apply(this, args);
        if (url.includes('uploadImage')) {
            try {
                const j = await res.clone().json();
                const serverId = j?.media?.name;
                if (serverId) {
                    console.log('[ArinFlow] upload serverId captured:', serverId);
                    window.postMessage({ type: 'ARIN_FLOW_UPLOAD_SERVERID', serverId }, '*');
                }
            } catch(e) {}
        }
        return res;
    };

    // ── Helper: select card by serverId หรือ LATEST ──
    const selectCardWhenReady = (targetServerId, timeoutMs = 15000) => {
        return new Promise((resolve) => {
            const trySelect = (card) => {
                const fk = Object.keys(card).find(k => k.startsWith('__reactFiber'));
                if (!fk) return false;
                let fiber = card[fk].return;
                for (let d = 0; d < 12; d++) {
                    let s = fiber?.memoizedState;
                    while (s) {
                        const candidates = [
                            s.memoizedState,
                            s.memoizedState?.current?.value,
                            s.memoizedState?.value,
                        ];
                        for (const st of candidates) {
                            if (!st) continue;
                            const isMatch = targetServerId === 'LATEST'
                                ? (st.isUserUpload === true && st.createdTime)
                                : (st.serverId === targetServerId);
                            if (isMatch) {
                                console.log('[ArinFlow] card matched:', st.serverId);
                                const fp = card[fk].memoizedProps;
                                if (fp?.onClick) { fp.onClick(); return true; }
                                const pk = Object.keys(card).find(k => k.startsWith('__reactProps'));
                                if (pk && card[pk]?.onClick) { card[pk].onClick(); return true; }
                                card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                return true;
                            }
                        }
                        s = s.next;
                    }
                    fiber = fiber?.return;
                }
                return false;
            };

            // ลองกับ card ที่มีอยู่แล้ว
            for (const card of document.querySelectorAll('[class*="sc-3038c00b"]')) {
                if (trySelect(card)) { resolve(true); return; }
            }

            // observe DOM รอ card ใหม่
            const timer = setTimeout(() => { obs.disconnect(); resolve(false); }, timeoutMs);
            const obs = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    for (const node of m.addedNodes) {
                        if (node.nodeType !== 1) continue;
                        const cards = [
                            ...(node.className?.includes?.('sc-3038c00b') ? [node] : []),
                            ...(node.querySelectorAll?.('[class*="sc-3038c00b"]') || [])
                        ];
                        for (const card of cards) {
                            if (trySelect(card)) {
                                clearTimeout(timer);
                                obs.disconnect();
                                resolve(true);
                                return;
                            }
                        }
                    }
                }
            });
            obs.observe(document.body, { childList: true, subtree: true });
        });
    };

    // ── Handler: Upload file via input ──
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
                const file = new File([new Blob([bytes], { type: req.mime })], req.filename || `arin_${Date.now()}.jpg`, { type: req.mime });
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
    });

    // ── Handler: Select media card ──
    window.addEventListener('message', async (e) => {
        if (e.data?.type !== 'ARIN_FLOW_SELECT_MEDIA') return;
        const { serverId } = e.data;
        console.log('[ArinFlow] selectMedia request:', serverId || 'LATEST');
        const ok = await selectCardWhenReady(serverId || 'LATEST', 15000);
        window.postMessage({ type: 'ARIN_FLOW_SELECT_RESULT', success: ok }, '*');
    });

    // ── Ping ──
    window.addEventListener('message', (e) => {
        if (e.data?.type === 'ARIN_PING_INJECTED')
            window.postMessage({ type: 'ARIN_INJECTED_READY' }, '*');
    });

    // ── Handler: Count images in input bar ──
    window.addEventListener('message', async (e) => {
        if (e.data?.type !== 'ARIN_FLOW_COUNT_INPUT_IMAGES') return;
        try {
            let count = 0;
            const editorDiv = document.querySelector('div[data-slate-editor="true"]');
            if (editorDiv) {
                let current = editorDiv.parentElement;
                for (let i = 0; i < 5 && current; i++) {
                    const imgs = current.querySelectorAll('img[src*="lh3.googleusercontent"], img[src*="blob:"], img[src*="aisandbox"]');
                    if (imgs.length > 0) {
                        count = imgs.length;
                        break;
                    }
                    current = current.parentElement;
                }
            }
            window.postMessage({ type: 'ARIN_FLOW_INPUT_IMAGE_COUNT', count }, '*');
        } catch (err) {
            window.postMessage({ type: 'ARIN_FLOW_INPUT_IMAGE_COUNT', count: 0 }, '*');
        }
    });

    console.log('[ArinFlow] InjectedFlow.js ready ✅');
})();
