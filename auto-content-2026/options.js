document.addEventListener('DOMContentLoaded', () => {
    const defaultAiProvider = document.getElementById('defaultAiProvider');
    const geminiInput = document.getElementById('geminiApiKey');
    const groqInput = document.getElementById('groqApiKey');
    const openrouterInput = document.getElementById('openrouterApiKey');
    const hfInput = document.getElementById('hfApiKey');
    const tmdbInput = document.getElementById('tmdbApiKey');
    const newsApiInput = document.getElementById('newsApiKey');
    
    // Auto Bot Settings
    const autoBotEnabled = document.getElementById('autoBotEnabled');
    const autoBotInterval = document.getElementById('autoBotInterval');
    const autoBotAction = document.getElementById('autoBotAction');
    
    let pagesData = []; // Array to hold page objects

    const btnSave = document.getElementById('btnSave');
    const saveStatus = document.getElementById('saveStatus');
    const pagesList = document.getElementById('pagesList');
    const btnAddPage = document.getElementById('btnAddPage');
    const btnExport = document.getElementById('btnExport');
    const btnImport = document.getElementById('btnImport');
    const importFile = document.getElementById('importFile');

    // โหลดข้อมูลเก่ามาแสดง
    chrome.storage.local.get(['settings', 'pages'], (data) => {
        if (data.settings) {
            defaultAiProvider.value = data.settings.defaultAiProvider || 'gemini';
            geminiInput.value = data.settings.geminiApiKey || '';
            groqInput.value = data.settings.groqApiKey || '';
            openrouterInput.value = data.settings.openrouterApiKey || '';
            hfInput.value = data.settings.hfApiKey || '';
            tmdbInput.value = data.settings.tmdbApiKey || '';
            newsApiInput.value = data.settings.newsApiKey || '';
            
            if (autoBotEnabled) autoBotEnabled.checked = data.settings.autoBotEnabled || false;
            if (autoBotInterval) autoBotInterval.value = data.settings.autoBotInterval || '180';
            if (autoBotAction) autoBotAction.value = data.settings.autoBotAction || 'draft';
        }
        if (data.pages) {
            pagesData = data.pages;
        }
        renderPages();
    });

    // -------- Render Facebook Pages Array --------
    function renderPages() {
        pagesList.innerHTML = '';
        if (pagesData.length === 0) {
            pagesList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary); border: 1px dashed var(--border); border-radius: 8px;">ยังไม่มีเพจในระบบ กดปุ่ม + เพิ่มเพจใหม่ เพื่อเริ่มต้น</div>';
            return;
        }

        pagesData.forEach((page, index) => {
            const div = document.createElement('div');
            div.className = 'page-item';
            div.innerHTML = `
                <div class="page-item-header">
                    <span>เพจลำดับที่ ${index + 1}</span>
                    <button class="btn-danger-sm" data-index="${index}">ลบเพจ</button>
                </div>
                <div class="form-group mb-10">
                    <label>ชื่อเพจ (สำหรับแสดงผล)</label>
                    <input type="text" class="page-name-input" value="${page.name || ''}" data-index="${index}" placeholder="เช่น เพจข่าวด่วน">
                </div>
                <div class="form-group mb-10">
                    <label>Page ID</label>
                    <input type="text" class="page-id-input" value="${page.id || ''}" data-index="${index}" placeholder="123456789012345">
                </div>
                <div class="form-group mb-10">
                    <label>Page Access Token (Long-lived)</label>
                    <input type="password" class="page-token-input" value="${page.token || ''}" data-index="${index}" placeholder="EAAGm0P...">
                </div>
                <!-- Content Source for Auto Bot -->
                <div class="form-group mb-10" style="background:#f4f4f5; padding: 10px; border-radius: 6px;">
                    <label>แหล่งเนื้อหา (Source สำหรับบอทอัตโนมัติ)</label>
                    <select class="page-source-input select-sm mb-5" data-index="${index}">
                        <option value="ai_news" ${page.source === 'ai_news' ? 'selected' : ''}>🤖 ข่าว AI (Google News)</option>
                        <option value="games_news" ${page.source === 'games_news' ? 'selected' : ''}>🎮 ข่าววงการเกมส์ (Games)</option>
                        <option value="travel_news" ${page.source === 'travel_news' ? 'selected' : ''}>✈️ ข่าวท่องเที่ยว</option>
                        <option value="google_trends" ${page.source === 'google_trends' ? 'selected' : ''}>🔥 Google Trends (TH)</option>
                        <option value="tmdb" ${page.source === 'tmdb' ? 'selected' : ''}>🎬 ข่าวหนังใหม่ TMDB</option>
                        <option value="evergreen" ${page.source === 'evergreen' ? 'selected' : ''}>🌱 เนื้อหา Evergreen (เกร็ดความรู้)</option>
                        <option value="tips" ${page.source === 'tips' ? 'selected' : ''}>💡 เทคนิค/How-to (Tips)</option>
                    </select>
                    <input type="text" class="page-topic-input input-sm mb-5" value="${page.topic || ''}" data-index="${index}" placeholder="Niche/หัวข้อเพิ่มเติม เช่น 'สรุปข่าวสั้นๆ'">
                    
                    <div style="display:flex; align-items:center; gap:10px; margin-top:5px;">
                        <div class="logo-preview" style="width:30px; height:30px; background:#ddd; border-radius:4px; overflow:hidden;">
                            ${page.logo ? `<img src="${page.logo}" style="width:100%; height:100%; object-fit:cover;">` : ''}
                        </div>
                        <label class="btn-secondary-sm" style="font-size:11px; padding:4px 8px; cursor:pointer;">
                            📷 อัปโหลดโลโก้ Page (Watermark)
                            <input type="file" class="page-logo-input" data-index="${index}" style="display:none;" accept="image/*">
                        </label>
                    </div>
                    <div class="form-group mt-10" style="border-top: 1px solid #ddd; padding-top: 10px;">
                        <label style="font-size:11px; color:#666;">📢 จำกัดจำนวนโพสต์สูงสุดต่อวัน (Safety Limit)</label>
                        <input type="number" class="page-max-posts-input input-sm" style="width:70px;" value="${page.maxPosts || 5}" data-index="${index}" min="1" max="50">
                        <span style="font-size:11px; color:#999;"> โพสต์ / วัน</span>
                    </div>
                </div>
            `;
            pagesList.appendChild(div);
        });

        // Event listeners for page items
        document.querySelectorAll('.btn-danger-sm').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                pagesData.splice(idx, 1);
                renderPages();
            });
        });
        document.querySelectorAll('.page-name-input').forEach(input => {
            input.addEventListener('input', (e) => { pagesData[e.target.getAttribute('data-index')].name = e.target.value; });
        });
        document.querySelectorAll('.page-id-input').forEach(input => {
            input.addEventListener('input', (e) => { pagesData[e.target.getAttribute('data-index')].id = e.target.value; });
        });
        document.querySelectorAll('.page-token-input').forEach(input => {
            input.addEventListener('input', (e) => { pagesData[e.target.getAttribute('data-index')].token = e.target.value; });
        });
        document.querySelectorAll('.page-source-input').forEach(select => {
            select.addEventListener('change', (e) => { pagesData[e.target.getAttribute('data-index')].source = e.target.value; });
        });
        document.querySelectorAll('.page-topic-input').forEach(input => {
            input.addEventListener('input', (e) => { pagesData[e.target.getAttribute('data-index')].topic = e.target.value; });
        });
        document.querySelectorAll('.page-logo-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = e.target.getAttribute('data-index');
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (prev) => {
                        pagesData[idx].logo = prev.target.result;
                        renderPages(); // Re-render to show preview
                    };
                    reader.readAsDataURL(file);
                }
            });
        });
        document.querySelectorAll('.page-max-posts-input').forEach(input => {
            input.addEventListener('input', (e) => { pagesData[e.target.getAttribute('data-index')].maxPosts = parseInt(e.target.value) || 5; });
        });
    }

    btnAddPage.addEventListener('click', () => {
        pagesData.push({ id: '', name: '', token: '', source: 'ai_news', topic: '' });
        renderPages();
    });

    // บันทึกข้อมูล
    btnSave.addEventListener('click', () => {
        const settings = {
            defaultAiProvider: defaultAiProvider.value,
            geminiApiKey: geminiInput.value.trim(),
            groqApiKey: groqInput.value.trim(),
            openrouterApiKey: openrouterInput.value.trim(),
            hfApiKey: hfInput.value.trim(),
            tmdbApiKey: tmdbInput.value.trim(),
            newsApiKey: newsApiInput.value.trim(),
            autoBotEnabled: autoBotEnabled ? autoBotEnabled.checked : false,
            autoBotInterval: autoBotInterval ? autoBotInterval.value : '180',
            autoBotAction: autoBotAction ? autoBotAction.value : 'draft'
        };

        chrome.storage.local.set({ settings, pages: pagesData }, () => {
            // แจ้งเตือน background.js ให้โหลดคิวใหม่
            chrome.runtime.sendMessage({ action: 'triggerAutoBotRestart' }).catch(() => {});
            
            // แสดงข้อความยืนยันการบันทึก
            saveStatus.textContent = 'บันทึกสำเร็จ! ✔️';
            saveStatus.classList.add('show');
            setTimeout(() => {
                saveStatus.classList.remove('show');
            }, 3000);
        });
    });

    // -------- API Testing Logic --------
    function setStatus(id, msg, type = '') {
        const el = document.getElementById(id);
        el.textContent = msg;
        el.className = `status-msg ${type}`;
    }

    document.getElementById('testGemini').addEventListener('click', async () => {
        const key = geminiInput.value.trim();
        if (!key) return setStatus('geminiStatus', '❌ กรุณาใส่ API Key ก่อนทดสอบ', 'error');
        setStatus('geminiStatus', '⏳ กำลังทดสอบการเชื่อมต่อ...', '');
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }] })
            });
            if (!res.ok) throw new Error((await res.json().catch(()=>({})))?.error?.message || res.statusText);
            setStatus('geminiStatus', '✅ เชื่อมต่อสำเร็จ! พร้อมเขียนโพสต์', 'success');
        } catch(e) { setStatus('geminiStatus', '❌ ' + e.message, 'error'); }
    });

    document.getElementById('testGroq').addEventListener('click', async () => {
        const key = groqInput.value.trim();
        if (!key) return setStatus('groqStatus', '❌ กรุณาใส่ API Key ก่อนทดสอบ', 'error');
        setStatus('groqStatus', '⏳ กำลังทดสอบ...', '');
        try {
            const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { 'Authorization': `Bearer ${key}` }});
            if (!res.ok) throw new Error((await res.json().catch(()=>({})))?.error?.message || res.statusText);
            setStatus('groqStatus', '✅ เชื่อมต่อ Groq สำเร็จ!', 'success');
        } catch(e) { setStatus('groqStatus', '❌ ' + e.message, 'error'); }
    });

    document.getElementById('testOpenRouter').addEventListener('click', async () => {
        const key = openrouterInput.value.trim();
        if (!key) return setStatus('openrouterStatus', '❌ กรุณาใส่ API Key ก่อน', 'error');
        setStatus('openrouterStatus', '⏳ กำลังทดสอบ...', '');
        try {
            const res = await fetch('https://openrouter.ai/api/v1/auth/key', { headers: { 'Authorization': `Bearer ${key}` }});
            if (!res.ok) throw new Error((await res.json().catch(()=>({})))?.error?.message || res.statusText);
            setStatus('openrouterStatus', '✅ เชื่อมต่อ OpenRouter สำเร็จ!', 'success');
        } catch(e) { setStatus('openrouterStatus', '❌ ' + e.message, 'error'); }
    });

    document.getElementById('testHf').addEventListener('click', async () => {
        const key = hfInput.value.trim();
        if (!key) return setStatus('hfStatus', '❌ กรุณาใส่ API Key ก่อน', 'error');
        setStatus('hfStatus', '⏳ กำลังทดสอบ...', '');
        try {
            // Test requesting user info
            const res = await fetch('https://huggingface.co/api/whoami-v2', { headers: { 'Authorization': `Bearer ${key}` }});
            if (!res.ok) throw new Error((await res.json().catch(()=>({})))?.error || res.statusText);
            setStatus('hfStatus', '✅ เชื่อมต่อ Hugging Face สำเร็จ!', 'success');
        } catch(e) { setStatus('hfStatus', '❌ ' + e.message, 'error'); }
    });

    document.getElementById('testTmdb').addEventListener('click', async () => {
        const key = tmdbInput.value.trim();
        if (!key) return setStatus('tmdbStatus', '❌ กรุณาใส่ API Key ก่อน', 'error');
        setStatus('tmdbStatus', '⏳ กำลังทดสอบ...', '');
        try {
            const res = await fetch(`https://api.themoviedb.org/3/authentication?api_key=${key}`);
            if (!res.ok) throw new Error((await res.json().catch(()=>({})))?.status_message || res.statusText);
            setStatus('tmdbStatus', '✅ เชื่อมต่อ TMDB สำเร็จดึงหนังได้เลย!', 'success');
        } catch(e) { setStatus('tmdbStatus', '❌ ' + e.message, 'error'); }
    });

    document.getElementById('testNewsApi').addEventListener('click', async () => {
        const key = newsApiInput.value.trim();
        if (!key) return setStatus('newsApiStatus', '❌ กรุณาใส่ API Key ก่อน', 'error');
        setStatus('newsApiStatus', '⏳ กำลังทดสอบ...', '');
        try {
            const res = await fetch(`https://newsapi.org/v2/top-headlines?country=th&apiKey=${key}`);
            const data = await res.json();
            if (data.status !== 'ok') throw new Error(data.message || res.statusText);
            setStatus('newsApiStatus', '✅ เชื่อมต่อ NewsAPI สำเร็จ!', 'success');
        } catch(e) { setStatus('newsApiStatus', '❌ ' + e.message, 'error'); }
    });

    // -------- Import / Export Settings --------
    btnExport.addEventListener('click', () => {
        chrome.storage.local.get(['settings', 'pages'], (data) => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `auto-content-2026-settings-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    });

    btnImport.addEventListener('click', () => {
        importFile.click();
    });

    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.settings || data.pages) {
                    chrome.storage.local.set(data, () => {
                        saveStatus.textContent = '✅ นำเข้าสำเร็จ! กำลังรีโหลด...';
                        saveStatus.classList.add('show');
                        setTimeout(() => location.reload(), 1500);
                    });
                } else {
                    alert('ไฟล์ไม่ถูกต้อง กรุณาเลือกไฟล์ที่มาจากการ Export ของระบบนี้เท่านั้น');
                }
            } catch (err) {
                alert('เกิดข้อผิดพลาดในการอ่านไฟล์: ' + err.message);
            }
        };
        reader.readAsText(file);
    });
});
