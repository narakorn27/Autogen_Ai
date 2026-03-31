// ═══════════════════════════════════════════════════════════
// AR Automation Flow Bot — Sidepanel v1.0
// Source: arin-flow-ext (functions) + arin-ex-autoflow (debug)
// ═══════════════════════════════════════════════════════════
'use strict';

// ─── Logger ───
const LOG = (() => {
    const el = () => document.getElementById('liveLog');
    const colors = { 
        info: '#e2e8f0', 
        success: '#4ade80', 
        warn: '#f59e0b', 
        error: '#ef4444', 
        step: '#60a5fa',
        upload: '#eab308',      /* สีเหลืองทอง */
        action: '#c084fc',      /* สีม่วงสลัว */
        check: '#2dd4bf'        /* สีฟ้าอมเขียว */
    };
    const emojis = {
        step: '▶ ', upload: '📤 ', action: '⚡ ', check: '🔍 ', success: '✅ ', error: '❌ ', warn: '⚠️ ', info: '💬 '
    };
    const push = (msg, level = 'info') => {
        const now = new Date().toLocaleTimeString('th-TH');
        console.log(`[AR Flow] ${msg}`);
        const logEl = el();
        if (!logEl) return;
        const ph = logEl.querySelector('.text-muted');
        if (ph) ph.remove();
        const line = document.createElement('div');
        line.className = 'log-line';
        line.style.color = colors[level] || colors.info;
        line.innerHTML = `<span style="opacity:0.6">[${now}]</span> ${emojis[level] || ''}${msg}`;
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
    };
    return {
        info: m => push(m, 'info'), success: m => push(m, 'success'),
        warn: m => push(m, 'warn'), error: m => push(m, 'error'), 
        step: m => push(m, 'step'), upload: m => push(m, 'upload'),
        action: m => push(m, 'action'), check: m => push(m, 'check')
    };
})();

document.addEventListener('DOMContentLoaded', async () => {
    LOG.info('AR Flow Bot v1.0 เริ่มต้นแล้ว ✅');

    // ─── DOM refs ───
    const $ = id => document.getElementById(id);
    const btnRun = $('btnRun'), btnPause = $('btnPause'), btnResume = $('btnResume'), btnClear = $('btnClear');
    const queueWrap = $('queueWrap'), queueList = $('queueList'), queueStatus = $('queueStatus');
    const statusBadge = $('statusBadge');
    const productSets = $('productSets'), setCountText = $('setCountText'), btnAddSet = $('btnAddSet');

    let setCount = 0, MAX_SETS = 15;
    let productSetsData = [];
    let currentOutputType = 'video', currentVideoMode = 'text';
    let isPaused = false;
    let saveState = async () => {};

    // ─── Section Collapse ───
    document.querySelectorAll('.section-header').forEach(hdr => {
        hdr.addEventListener('click', () => {
            const id = hdr.getAttribute('data-target');
            const body = $(id);
            const icon = $(`icon-${id}`);
            if (!body) return;
            const isCollapsed = body.classList.contains('collapsed');
            if (isCollapsed) {
                body.classList.remove('collapsed');
                body.style.maxHeight = '2000px';
                icon?.classList.remove('collapsed');
            } else {
                body.classList.add('collapsed');
                body.style.maxHeight = '0px';
                icon?.classList.add('collapsed');
            }
        });
    });

    // ─── Output Type Toggle ───
    const btnTypeImage = $('btnTypeImage'), btnTypeVideo = $('btnTypeVideo');
    const btnModeText = $('btnModeText'), btnModeFrame = $('btnModeFrame');

    const applyTypeUI = () => {
        const isImg = currentOutputType === 'image';
        btnTypeImage.classList.toggle('active', isImg);
        btnTypeVideo.classList.toggle('active', !isImg);
        $('wrapVideoMode')?.classList.toggle('hidden', isImg);
        $('wrapImageModel')?.classList.toggle('hidden', !isImg);
        $('wrapVideoModel')?.classList.toggle('hidden', isImg);
    };

    const applyModeUI = () => {
        const isText = currentVideoMode === 'text';
        btnModeText.classList.toggle('active', isText);
        btnModeFrame.classList.toggle('active', !isText);
    };

    btnTypeImage.addEventListener('click', () => { currentOutputType = 'image'; applyTypeUI(); saveState(); });
    btnTypeVideo.addEventListener('click', () => { currentOutputType = 'video'; applyTypeUI(); saveState(); });
    btnModeText.addEventListener('click', () => { currentVideoMode = 'text'; applyModeUI(); saveState(); });
    btnModeFrame.addEventListener('click', () => { currentVideoMode = 'frame'; applyModeUI(); saveState(); });
    applyTypeUI(); applyModeUI();

    // ─── API Key Modal ───
    const apiModal = $('apiModal');

    document.querySelectorAll('.btn-toggle-eye').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = $(btn.dataset.target);
            input.type = input.type === 'password' ? 'text' : 'password';
        });
    });

    document.querySelectorAll('.btn-test-api').forEach(btn => {
        btn.addEventListener('click', () => {
            const prov = btn.dataset.provider;
            const key = $(`apiKey_${prov}`)?.value;
            if (!key) return alert('กรอก Key ก่อน');
            btn.disabled = true; btn.textContent = '...';
            const msg = $(`apiMsg_${prov}`);
            chrome?.runtime?.sendMessage({ action: 'VALIDATE_API_KEY', provider: prov, apiKey: key }, r => {
                btn.disabled = false; btn.textContent = 'ทดสอบ';
                if (msg) {
                    msg.textContent = r?.valid ? '✓ ใช้งานได้' : `✗ ${r?.error || 'Error'}`;
                    msg.style.color = r?.valid ? '#4ade80' : '#ef4444';
                    msg.classList.remove('hidden');
                    setTimeout(() => msg.classList.add('hidden'), 4000);
                }
            });
        });
    });

    document.querySelectorAll('.btn-save-api').forEach(btn => {
        btn.addEventListener('click', async () => {
            await saveState();
            chrome?.runtime?.sendMessage({ action: 'API_KEY_UPDATED' });
            const msg = $(`apiMsg_${btn.dataset.provider}`);
            if (msg) {
                msg.textContent = '✓ บันทึกแล้ว'; msg.style.color = '#4ade80';
                msg.classList.remove('hidden');
                setTimeout(() => msg.classList.add('hidden'), 3000);
            }
            LOG.success(`บันทึก API Key (${btn.dataset.provider})`);
        });
    });

    $('btnSettings')?.addEventListener('click', () => apiModal.classList.remove('hidden'));
    $('btnEditApiKey')?.addEventListener('click', () => apiModal.classList.remove('hidden'));
    $('btnCloseModal')?.addEventListener('click', () => apiModal.classList.add('hidden'));
    apiModal?.addEventListener('click', e => { if (e.target === apiModal) apiModal.classList.add('hidden'); });

    // ─── Product Sets ───
    const readFile = (file, cb) => {
        const r = new FileReader();
        r.onload = e => cb(e.target.result);
        r.readAsDataURL(file);
    };

    const getSetData = id => {
        let d = productSetsData.find(s => s.id === id);
        if (!d) { d = { id }; productSetsData.push(d); }
        return d;
    };

    const updateSetCount = () => { setCountText.textContent = setCount; };

    const addProductSet = (existingId = null, data = null) => {
        if (setCount >= MAX_SETS && !existingId) return alert(`สูงสุด ${MAX_SETS} ชุด`);
        setCount++;
        updateSetCount();
        const setId = existingId || `set_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        if (!data) productSetsData.push({ id: setId });

        const wrap = document.createElement('div');
        wrap.className = 'product-set';
        wrap.setAttribute('data-id', setId);
        wrap.innerHTML = `
            <div class="set-header">
                <span class="set-num">ชุดที่ ${setCount}</span>
                <button class="btn-rm-set">✕</button>
            </div>
            <div class="set-images">
                <div class="dashed-box" style="height:72px" data-zone="product">
                    <div class="placeholder"><span class="placeholder-icon">📸</span><span class="placeholder-text">รูปสินค้า</span></div>
                    <img class="preview hidden" alt="">
                    <div class="rm-img hidden">✕</div>
                </div>
                <input type="file" class="file-product hidden" accept="image/*">
                <div class="dashed-box" style="height:72px" data-zone="scene">
                    <div class="placeholder"><span class="placeholder-icon">👤</span><span class="placeholder-text">นางแบบ</span></div>
                    <img class="preview hidden" alt="">
                    <div class="rm-img hidden">✕</div>
                </div>
                <input type="file" class="file-scene hidden" accept="image/*">
            </div>
            <div class="set-fields">
                <input type="text" class="input-name input-field" placeholder="ชื่อสินค้า (เช่น น้ำพริกผัดหมูสับ)">
                <textarea class="input-prompt input-field" style="min-height:48px" placeholder="Prompt เสริม / บทพูด (ไม่บังคับ)"></textarea>
                <label class="toggle-option" style="transform:scale(0.95)">
                    <div class="toggle-switch" style="transform:scale(0.85)"><input type="checkbox" class="input-exact"><span class="toggle-slider"></span></div>
                    <span class="toggle-option-label" style="font-size:11px">ใช้ Prompt ตรงๆ (ไม่ AI แต่ง)</span>
                </label>
            </div>`;

        productSets.appendChild(wrap);

        // Restore existing data
        if (data) {
            if (data.name) wrap.querySelector('.input-name').value = data.name;
            if (data.prompt) wrap.querySelector('.input-prompt').value = data.prompt;
            if (data.useExact) wrap.querySelector('.input-exact').checked = true;
            ['product', 'scene'].forEach(zone => {
                const key = zone === 'product' ? 'subject' : 'scene';
                if (data[key]) {
                    const box = wrap.querySelector(`[data-zone="${zone}"]`);
                    const preview = box.querySelector('.preview');
                    preview.src = data[key]; preview.classList.remove('hidden');
                    box.querySelector('.placeholder').classList.add('hidden');
                    box.querySelector('.rm-img').classList.remove('hidden');
                    box.classList.add('has-img');
                }
            });
        }

        // Image upload handlers
        ['product', 'scene'].forEach(zone => {
            const box = wrap.querySelector(`[data-zone="${zone}"]`);
            const input = wrap.querySelector(`.file-${zone}`);
            const dataKey = zone === 'product' ? 'subject' : 'scene';

            const applyImage = (dataUrl) => {
                getSetData(setId)[dataKey] = dataUrl;
                const preview = box.querySelector('.preview');
                preview.src = dataUrl; preview.classList.remove('hidden');
                box.querySelector('.placeholder').classList.add('hidden');
                box.querySelector('.rm-img').classList.remove('hidden');
                box.classList.add('has-img');
                LOG.step(`อัปโหลดรูป [${zone}] ชุด ${setId}`);
                saveState();
            };

            box.addEventListener('click', e => { if (!e.target.closest('.rm-img')) input.click(); });
            box.addEventListener('dragover', e => { e.preventDefault(); box.style.borderColor = 'var(--accent)'; });
            box.addEventListener('dragleave', () => { box.style.borderColor = ''; });
            box.addEventListener('drop', e => { e.preventDefault(); box.style.borderColor = ''; const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) readFile(f, applyImage); });
            input.addEventListener('change', e => { const f = e.target.files[0]; if (f) readFile(f, applyImage); });

            box.querySelector('.rm-img').addEventListener('click', e => {
                e.stopPropagation();
                getSetData(setId)[dataKey] = null;
                const preview = box.querySelector('.preview');
                preview.src = ''; preview.classList.add('hidden');
                box.querySelector('.placeholder').classList.remove('hidden');
                box.querySelector('.rm-img').classList.add('hidden');
                box.classList.remove('has-img');
                input.value = '';
                saveState();
            });
        });

        // Text inputs
        wrap.querySelector('.input-name').addEventListener('input', e => { getSetData(setId).name = e.target.value; saveState(); });
        wrap.querySelector('.input-prompt').addEventListener('input', e => { getSetData(setId).prompt = e.target.value; saveState(); });
        wrap.querySelector('.input-exact').addEventListener('change', e => { getSetData(setId).useExact = e.target.checked; saveState(); });

        // Remove
        wrap.querySelector('.btn-rm-set').addEventListener('click', () => {
            wrap.style.opacity = '0'; wrap.style.transform = 'translateY(-8px)';
            setTimeout(() => {
                wrap.remove();
                productSetsData = productSetsData.filter(s => s.id !== setId);
                setCount--;
                productSets.querySelectorAll('[data-id]').forEach((el, i) => {
                    const num = el.querySelector('.set-num');
                    if (num) num.textContent = `ชุดที่ ${i + 1}`;
                });
                updateSetCount(); saveState();
            }, 300);
        });

        if (!existingId) $('mainScroll')?.scrollTo({ top: 99999, behavior: 'smooth' });
        saveState();
    };

    btnAddSet?.addEventListener('click', () => addProductSet());

    // ─── Get Settings ───
    const getSettings = () => ({
        aspectRatio: $('aspectRatio')?.value || '1:1',
        outputCount: $('outputCount')?.value || '2',
        clipCount: $('outputCount')?.value || '2',
        cameraAngle: $('cameraAngle')?.value || 'close-up',
        randomCameraToggle: $('randomCameraToggle')?.checked || false,
        flowImageModel: $('flowImageModel')?.value || 'banana_nano_2',
        videoModel: $('videoModel')?.value || 'veo31_fast',
        flowOutputType: currentOutputType,
        flowVideoMode: currentVideoMode,
        aiProvider: $('aiProvider')?.value || 'groq',
        apiKey: '',
        apiKeyGroq: $('apiKey_groq')?.value || '',
        apiKeyGemini: $('apiKey_gemini')?.value || '',
        apiKeyOpenRouter: $('apiKey_openrouter')?.value || '',
        imageStyle: $('imageStyle')?.value || 'tiktok_normal',
        videoStyle: $('videoStyle')?.value || 'ugc_review',
        aiEnhanceToggle: $('aiEnhanceToggle')?.checked || false,
        randomSceneToggle: $('randomSceneToggle')?.checked || false,
        overlayText: $('overlayText')?.value || '',
        noOverlayToggle: $('noOverlayToggle')?.checked || false,
        autoLoopToggle: $('autoLoopToggle')?.checked || false,
        loopCount: $('loopCount')?.value || '0',
        delayBetween: $('delayBetween')?.value || '15',
        targetApp: 'flow'
    });

    // ─── Build Queue ───
    const buildQueue = () => {
        productSets.querySelectorAll('[data-id]').forEach(wrap => {
            const id = wrap.getAttribute('data-id');
            const d = getSetData(id);
            d.name = wrap.querySelector('.input-name')?.value || '';
            d.prompt = wrap.querySelector('.input-prompt')?.value || '';
            d.useExact = wrap.querySelector('.input-exact')?.checked || false;
        });

        const settings = getSettings();
        const prov = settings.aiProvider;
        if (prov === 'groq') settings.apiKey = settings.apiKeyGroq;
        else if (prov === 'gemini') settings.apiKey = settings.apiKeyGemini;
        else if (prov === 'openrouter') settings.apiKey = settings.apiKeyOpenRouter;

        const items = [];
        productSetsData.forEach((set, idx) => {
            if (!set.subject && !set.name && !set.prompt) return;
            let prompt = [set.name, set.prompt].filter(Boolean).join(' ').trim();
            const hints = [];
            if (settings.imageStyle) hints.push(`style: ${settings.imageStyle}`);
            let angle = settings.cameraAngle;
            if (settings.randomCameraToggle) {
                const angles = ['close-up', 'full-body', 'medium', 'extreme close-up', 'wide angle', 'low angle', 'high angle', 'dutch angle'];
                angle = angles[Math.floor(Math.random() * angles.length)];
            }
            if (angle) hints.push(`camera: ${angle}`);
            if (settings.overlayText && !settings.noOverlayToggle) hints.push(`text: "${settings.overlayText}"`);
            if (hints.length) prompt += ` | ${hints.join(', ')}`;

            items.push({
                id: set.id, setName: `ชุดที่ ${idx + 1}`,
                prompt, subjectImage: set.subject || null, sceneImage: set.scene || null,
                useExact: set.useExact || false
            });
        });
        return { items, settings };
    };

    // ─── Run / Pause / Resume / Clear ───
    btnRun?.addEventListener('click', () => {
        if (productSetsData.length === 0) return alert('เพิ่มชุดสินค้าอย่างน้อย 1 ชุด');
        const { items, settings } = buildQueue();
        if (items.length === 0) return alert('ใส่ข้อมูลอย่างน้อย 1 ชุด');
        LOG.step(`=== เริ่ม Auto Pipeline — ${items.length} งาน ===`);
        chrome?.runtime?.sendMessage({ action: 'START_QUEUE', items, settings }, () => {
            if (chrome.runtime.lastError) LOG.error(chrome.runtime.lastError.message);
            else LOG.success('ส่ง Queue สำเร็จ ✅');
        });
        queueWrap.classList.add('visible');
        btnPause.classList.remove('hidden'); btnResume.classList.add('hidden');
        isPaused = false;
        statusBadge.textContent = `รัน ${items.length} งาน`;
        statusBadge.className = 'status-badge running';
    });

    btnPause?.addEventListener('click', () => {
        chrome?.runtime?.sendMessage({ action: 'PAUSE_QUEUE' });
        isPaused = true; btnPause.classList.add('hidden'); btnResume.classList.remove('hidden');
        statusBadge.textContent = 'หยุดชั่วคราว';
        statusBadge.className = 'status-badge warning';
    });

    btnResume?.addEventListener('click', () => {
        chrome?.runtime?.sendMessage({ action: 'RESUME_QUEUE' });
        isPaused = false; btnResume.classList.add('hidden'); btnPause.classList.remove('hidden');
        statusBadge.textContent = 'กำลังรัน';
        statusBadge.className = 'status-badge running';
    });

    btnClear?.addEventListener('click', () => {
        chrome?.runtime?.sendMessage({ action: 'CLEAR_QUEUE' });
        queueWrap.classList.remove('visible');
        btnPause.classList.add('hidden'); btnResume.classList.add('hidden');
        statusBadge.textContent = 'พร้อมใช้งาน';
        statusBadge.className = 'status-badge';
    });

    // ─── Log Controls ───
    $('btnClearLog')?.addEventListener('click', () => {
        $('liveLog').innerHTML = '<div class="text-muted">รอคำสั่ง...</div>';
    });

    $('btnCopyLog')?.addEventListener('click', () => {
        const logEl = $('liveLog');
        const text = Array.from(logEl.querySelectorAll('.log-line')).map(l => l.textContent).join('\n');
        navigator.clipboard.writeText(text).then(() => LOG.success('Copy log สำเร็จ'));
    });

    // ─── Debug Tools (from arin-ex-autoflow) ───
    const sendDebugAction = async (payloadType, extra = {}) => {
        LOG.step(`Debug: ${payloadType}...`);
        const response = await new Promise(resolve => {
            chrome.runtime.sendMessage({
                action: 'RUN_CONTENT_ACTION',
                payload: { type: payloadType, ...extra }
            }, resolve);
        });
        if (response?.ok) {
            LOG.success(`${payloadType} — สำเร็จ`);
        } else {
            LOG.error(`${payloadType} — ${response?.error || 'Unknown error'}`);
        }
    };

    $('btnTestSelectors')?.addEventListener('click', () => sendDebugAction('TEST_SELECTORS'));
    $('btnTestPrompt')?.addEventListener('click', () => sendDebugAction('TEST_PROMPT', { prompt: 'Test prompt from AR Flow Bot' }));
    $('btnTestUpload')?.addEventListener('click', async () => {
        // Use first product set image if available
        const firstSet = productSetsData.find(s => s.subject);
        if (!firstSet?.subject) return LOG.warn('ไม่มีรูปสินค้า — เพิ่มรูปก่อนทดสอบ');
        const images = [{ dataUrl: firstSet.subject, name: 'test-upload.png', type: 'image/png' }];
        sendDebugAction('TEST_UPLOAD', { images });
    });
    $('btnTestGenerate')?.addEventListener('click', () => sendDebugAction('TEST_GENERATE'));
    $('btnRunFull')?.addEventListener('click', async () => {
        const firstSet = productSetsData.find(s => s.subject || s.name || s.prompt);
        const images = [];
        if (firstSet?.subject) images.push({ dataUrl: firstSet.subject, name: 'subject.png', type: 'image/png' });
        if (firstSet?.scene) images.push({ dataUrl: firstSet.scene, name: 'scene.png', type: 'image/png' });
        const prompt = [firstSet?.name, firstSet?.prompt].filter(Boolean).join(' ') || 'Test prompt';
        sendDebugAction('RUN_FULL', { images, prompt });
    });

    // ─── Queue UI ───
    const updateQueueUI = (queue) => {
        if (!queue?.length) {
            queueList.innerHTML = '<div class="text-muted" style="text-align:center;padding:8px;font-size:12px">ไม่มีงานในคิว</div>';
            queueStatus.textContent = '0 งาน';
            return;
        }
        const running = queue.filter(q => ['running', 'typing', 'submitting'].includes(q.status)).length;
        const pending = queue.filter(q => q.status === 'pending').length;
        const done = queue.filter(q => q.status === 'completed').length;
        const failed = queue.filter(q => q.status === 'failed').length;
        queueStatus.textContent = [running && `รัน ${running}`, pending && `รอ ${pending}`, done && `✓${done}`, failed && `✗${failed}`].filter(Boolean).join(' ') || `${queue.length} งาน`;

        queueList.innerHTML = queue.map(item => {
            const pct = item.status === 'completed' ? 100 : (item.percent || 0);
            const stClass = item.status === 'completed' ? 'completed' : item.status === 'failed' ? 'failed' : ['running', 'typing', 'submitting'].includes(item.status) ? 'running' : '';
            const labels = { pending: 'รอ', running: 'รัน', typing: 'พิมพ์', submitting: 'ส่ง', completed: '✓', failed: '✗' };
            return `<div class="queue-item ${stClass}">
                <div class="queue-item-header">
                    <div class="queue-item-info"><span class="status-dot"></span><span class="queue-item-name">${item.setName || 'งาน'}</span><span class="queue-item-prompt">— ${(item.prompt || '').slice(0, 30)}</span></div>
                    <span class="queue-item-tag">${labels[item.status] || item.status}</span>
                </div>
                <div class="queue-progress"><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><span class="progress-label">${pct}%</span></div>
                ${item.error ? `<div class="queue-item-error">${item.error}</div>` : ''}
            </div>`;
        }).join('');
    };

    // ─── Listen Messages from Background ───
    if (chrome?.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener(msg => {
            if (msg.action === 'QUEUE_UPDATED') {
                updateQueueUI(msg.queue);
                queueWrap.classList.add('visible');
            }
            if (msg.action === 'LOG') (LOG[msg.level] || LOG.info)(msg.text);
        });
    }

    // ─── Save / Load State ───
    saveState = async () => {
        const state = { general: getSettings(), sets: productSetsData };
        try {
            if (chrome?.storage) await chrome.storage.local.set({ arinFlowState: state });
            else localStorage.setItem('arinFlowState', JSON.stringify(state));
        } catch (e) { LOG.error(`Save failed: ${e.message}`); }
    };

    const loadState = async () => {
        let saved = null;
        try {
            if (chrome?.storage) {
                const d = await chrome.storage.local.get('arinFlowState');
                saved = d.arinFlowState;
            } else {
                const raw = localStorage.getItem('arinFlowState');
                if (raw) saved = JSON.parse(raw);
            }
        } catch (e) { LOG.error(`Load failed: ${e.message}`); }

        if (saved?.general) {
            const g = saved.general;
            const sv = (id, v) => { const el = $(id); if (el && v !== undefined) el.value = v; };
            const sc = (id, v) => { const el = $(id); if (el) el.checked = !!v; };
            sv('aspectRatio', g.aspectRatio); sv('outputCount', g.outputCount || g.clipCount);
            sv('cameraAngle', g.cameraAngle); sc('randomCameraToggle', g.randomCameraToggle);
            sv('flowImageModel', g.flowImageModel); sv('videoModel', g.videoModel);
            sv('aiProvider', g.aiProvider);
            sv('apiKey_groq', g.apiKeyGroq); sv('apiKey_gemini', g.apiKeyGemini); sv('apiKey_openrouter', g.apiKeyOpenRouter);
            sv('imageStyle', g.imageStyle); sv('videoStyle', g.videoStyle);
            sc('aiEnhanceToggle', g.aiEnhanceToggle); sc('randomSceneToggle', g.randomSceneToggle);
            sv('overlayText', g.overlayText); sc('noOverlayToggle', g.noOverlayToggle);
            sc('autoLoopToggle', g.autoLoopToggle); sv('loopCount', g.loopCount); sv('delayBetween', g.delayBetween);
            if (g.flowOutputType) { currentOutputType = g.flowOutputType; applyTypeUI(); }
            if (g.flowVideoMode) { currentVideoMode = g.flowVideoMode; applyModeUI(); }
        }

        if (saved?.sets?.length) {
            productSetsData = saved.sets;
            saved.sets.forEach(s => addProductSet(s.id, s));
        } else { addProductSet(); }

        // Auto-save on input change
        document.querySelectorAll('input, select, textarea').forEach(el => {
            el.addEventListener('change', saveState);
            if (['text', 'password', ''].includes(el.type) || el.tagName === 'TEXTAREA') el.addEventListener('input', saveState);
        });
    };

    // ─── Init ───
    if (chrome?.storage) {
        chrome.storage.local.get('botState', d => {
            if (d.botState?.queue?.length) { queueWrap.classList.add('visible'); updateQueueUI(d.botState.queue); }
        });
    }
    await loadState();
});
