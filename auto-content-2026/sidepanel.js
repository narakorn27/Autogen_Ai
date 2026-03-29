import { TrendsFetcher } from './lib/trends.js';
import { TMDBFetcher } from './lib/tmdb.js';
import { NewsFetcher } from './lib/news-fetcher.js';
import { AiComposer } from './lib/ai-composer.js';
import { AiImage } from './lib/ai-image.js';
import { FacebookAPI } from './lib/facebook-api.js';
import { NewsApiFetcher } from './lib/newsapi-fetcher.js';
import { Rss2JsonFetcher } from './lib/rss2json-fetcher.js';

// No need for DOMContentLoaded since it's a module
(async () => {
    // UI Elements
    const logContainer = document.getElementById('logContainer');
    const statsSuccess = document.querySelector('.stat-item:nth-child(1) .stat-value');
    const statsDrafts = document.querySelector('.stat-item:nth-child(2) .stat-value');
    const statsPages = document.querySelector('.stat-item:nth-child(3) .stat-value');

    // Navigate setup
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            const targetId = `${tab.dataset.tab}-tab`;
            document.getElementById(targetId).classList.add('active');
        });
    });

    // -------- Trends Logic --------
    const btnFetchTrends = document.getElementById('btnFetchTrends');
    const geoSelect = document.getElementById('trendGeo');
    const listContainer = document.getElementById('newsListContainer');
    
    let currentTrends = [];
    const selectedTrends = new Set();

    btnFetchTrends.addEventListener('click', async () => {
        const source = document.getElementById('trendSource').value;
        const geo = geoSelect.value;
        const currentText = btnFetchTrends.innerText;
        btnFetchTrends.innerText = 'กำลังโหลด...';
        btnFetchTrends.disabled = true;
        
        try {
            if (source === 'google_trends') {
                currentTrends = await TrendsFetcher.fetchDailyTrends(geo);
            } else if (source === 'tmdb') {
                 // Get API Key from storage
                 const data = await new Promise(resolve => chrome.storage.local.get('settings', resolve));
                 const tmdbKey = data.settings?.tmdbApiKey;
                 const lang = geo === 'TH' ? 'th-TH' : 'en-US';
                 currentTrends = await TMDBFetcher.fetchTrendingMovies(tmdbKey, lang);
            } else if (source === 'newsapi_tech') {
                const data = await new Promise(resolve => chrome.storage.local.get('settings', resolve));
                currentTrends = await NewsApiFetcher.fetchTopHeadlines(data.settings?.newsApiKey, geo === 'TH' ? 'th' : 'us', 'technology');
            } else if (source === 'newsapi_ent') {
                const data = await new Promise(resolve => chrome.storage.local.get('settings', resolve));
                currentTrends = await NewsApiFetcher.fetchTopHeadlines(data.settings?.newsApiKey, geo === 'TH' ? 'th' : 'us', 'entertainment');
            } else if (source === 'thairath' || source === 'matichon' || source === 'khaosod') {
                currentTrends = await Rss2JsonFetcher.fetchSource(source);
            } else if (source === 'ai_news') {
                 currentTrends = await NewsFetcher.fetchAiNews(geo);
            } else if (source === 'games_news') {
                 currentTrends = await NewsFetcher.fetchGamesNews(geo);
            } else if (source === 'travel_news') {
                 currentTrends = await NewsFetcher.fetchTravelNews(geo);
            } else {
                 throw new Error('ยังไม่รองรับแหล่งข้อมูลนี้');
            }
            
            selectedTrends.clear();
            renderTrends();
        } catch (error) {
            listContainer.innerHTML = `<p class="placeholder-text" style="color:var(--danger)">เกิดข้อผิดพลาด: ${error.message}</p>`;
        } finally {
            btnFetchTrends.innerText = currentText;
            btnFetchTrends.disabled = false;
        }
    });

    function renderTrends() {
        if (!currentTrends || currentTrends.length === 0) {
            listContainer.innerHTML = '<p class="placeholder-text">ไม่พบเทรนด์ในขณะนี้</p>';
            return;
        }

        listContainer.innerHTML = currentTrends.map((trend, index) => `
            <div class="news-item" data-id="${trend.id}">
                <img src="${trend.image || 'icons/icon48.png'}" class="news-thumb">
                <div class="news-content">
                    <div class="news-title">${trend.keyword}: ${trend.newsTitle}</div>
                    <div class="news-meta">
                        <span class="traffic-badge">🔥 ${trend.traffic}</span>
                        <span>${trend.newsSource}</span>
                    </div>
                </div>
            </div>
        `).join('');

        // Add Select Listeners
        document.querySelectorAll('.news-item').forEach(item => {
            item.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                if (selectedTrends.has(id)) {
                    selectedTrends.delete(id);
                    this.classList.remove('selected');
                } else {
                    selectedTrends.add(id);
                    this.classList.add('selected');
                }
                updateSelectionCount();
            });
        });
        
        updateSelectionCount();
    }

    function updateSelectionCount() {
        // ... (Keep existing code inside updateSelectionCount)
        const actionsDiv = document.getElementById('trendsActions');
        const countSpan = document.getElementById('selectedNewsCount');
        
        if (selectedTrends.size > 0) {
            actionsDiv.style.display = 'flex';
            countSpan.innerText = `เลือก ${selectedTrends.size} รายการ`;
        } else {
            actionsDiv.style.display = 'none';
        }
    }

    // -------- Transfer to Compose Logic --------
    const btnSendToCompose = document.getElementById('btnSendToCompose');
    let pendingAiContext = null;

    if (btnSendToCompose) {
        btnSendToCompose.addEventListener('click', () => {
            // Get selected items
            const selectedData = currentTrends.filter(t => selectedTrends.has(t.id));
            if (selectedData.length === 0) return;
            
            pendingAiContext = selectedData;

            // Switch to Compose Tab
            document.querySelector('.tab-btn[data-tab="compose"]').click();
            
            // Set prompt indicator
            const composeTextarea = document.getElementById('postContent');
            composeTextarea.value = `[ระบบ]: โหลดข้อมูล ${selectedData.length} เรื่องเรียบร้อย\n\nพร้อมให้ AI เขียนโพสต์ให้แล้วครับ!\nกรุณาเลือก Tone/Niche แล้วกดปุ่ม "✨ ให้ AI เขียนโพสต์ให้" ด้านบน 👆`;
            
            // Set thumbnail preview map
            const imgContainer = document.getElementById('imagePreviewContainer');
            if (selectedData[0].image) {
                imgContainer.innerHTML = `<img src="${selectedData[0].image}" alt="Preview">`;
            }
        });
    }

    // -------- Generate AI Content Logic --------
    const btnGenerateAI = document.getElementById('btnGenerateAI');
    if (btnGenerateAI) {
        btnGenerateAI.addEventListener('click', async () => {
            if (!pendingAiContext || pendingAiContext.length === 0) {
                alert('กรุณาเลือกข่าวหรือหนังจากแท็บ Trends ก่อนครับ');
                return;
            }

            const tone = document.getElementById('composeTone').selectedOptions[0].innerText;
            const niche = document.getElementById('composeNiche').value;
            const postContent = document.getElementById('postContent');
            
            const originalText = btnGenerateAI.innerText;
            btnGenerateAI.innerText = '⏳ AI กำลังพิมพ์...';
            btnGenerateAI.disabled = true;
            postContent.value = 'กำลังประสานงานกับ AI ค่ายที่คุณเลือก รอกระพริบตาเดียว...';

            try {
                // Get API Keys from Settings
                const data = await new Promise(resolve => chrome.storage.local.get('settings', resolve));
                const settings = data.settings || {};
                
                const provider = document.getElementById('composeProvider').value;
                let apiKey = '';
                if (provider === 'groq') apiKey = settings.groqApiKey;
                else if (provider === 'openrouter') apiKey = settings.openrouterApiKey;
                else apiKey = settings.geminiApiKey;

                const generatedText = await AiComposer.generatePost(provider, apiKey, pendingAiContext, tone, niche);
                
                // Show result
                postContent.value = generatedText;
                
            } catch (error) {
                postContent.value = '❌ เกิดข้อผิดพลาด: ' + error.message;
            } finally {
                btnGenerateAI.innerText = originalText;
                btnGenerateAI.disabled = false;
            }
        });
    }

    // Settings logic
    const btnOpenSettings = document.getElementById('btnOpenSettings');
    if (btnOpenSettings) {
        btnOpenSettings.addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });
    }

    // -------- Generate AI Image Logic --------
    const btnGenerateImage = document.getElementById('btnGenerateImage');
    if (btnGenerateImage) {
        btnGenerateImage.addEventListener('click', async () => {
            const postContent = document.getElementById('postContent').value.trim();
            if (!postContent || postContent.includes('กำลังประสานงาน')) {
                alert('กรุณาให้ AI เขียนเนื้อหาโพสต์ให้เสร็จก่อนครับ ระบบจะใช้อ่านเป็นข้อมูลอ้างอิงในการสร้างภาพให้ตรงปก');
                return;
            }

            const ratio = document.getElementById('imageRatio').value;
            const style = document.getElementById('imageStyle').value;
            const provider = document.getElementById('imageProvider').value;
            const imgContainer = document.getElementById('imagePreviewContainer');
            
            const originalText = btnGenerateImage.innerText;
            btnGenerateImage.innerText = '⏳ AI กำลังวาดภาพ...';
            btnGenerateImage.disabled = true;
            imgContainer.innerHTML = '<span class="placeholder-text" style="font-size:11px;">กำลังคิด Prompt & วาดภาพ...</span>';

            try {
                // Get API Keys
                const data = await new Promise(resolve => chrome.storage.local.get('settings', resolve));
                const geminiKey = data.settings?.geminiApiKey;
                const hfKey = data.settings?.hfApiKey;
                
                // Fetch the API Key for the text provider to generate the prompt
                const textProvider = document.getElementById('composeProvider').value;
                let textApiKey = '';
                if (textProvider === 'groq') textApiKey = data.settings?.groqApiKey;
                else if (textProvider === 'openrouter') textApiKey = data.settings?.openrouterApiKey;
                else textApiKey = data.settings?.geminiApiKey;

                if (provider === 'huggingface' && !hfKey) throw new Error('ไม่พบ Hugging Face Token ในออปชัน 설정');
                if (provider === 'gemini' && !geminiKey) throw new Error('ไม่พบ Gemini API Key ในออปชัน 설정');

                // 1. Generate Prompt based on post text (Uses Groq/OpenRouter/Gemini based on Compose settings)
                const imagePrompt = await AiImage.generatePrompt(textProvider, textApiKey, postContent, style);
                console.log('[Auto Content] Generated Image Prompt:', imagePrompt);
                
                // 2. Generate Image
                const imageUrl = await AiImage.generateImage(geminiKey, hfKey, provider, imagePrompt, ratio);
                
                // 3. Render
                imgContainer.innerHTML = `<img src="${imageUrl}" alt="AI Generated Image" title="${imagePrompt}" style="width:100%; height:100%; object-fit:contain; border-radius: 8px;">`;
                
            } catch (error) {
                console.error(error);
                imgContainer.innerHTML = `<span class="placeholder-text" style="color:#ef4444; font-size:11px;">❌ เจนรูปภาพล้มเหลว</span>`;
                alert('เกิดข้อผิดพลาดในการสร้างภาพ: ' + error.message);
            } finally {
                btnGenerateImage.innerText = originalText;
                btnGenerateImage.disabled = false;
            }
        });
    }

    // -------- Facebook Auto Post Logic --------
    let storedPages = [];
    const postPageSelect = document.getElementById('postPage');

    const btnPostNow = document.getElementById('btnPostNow');
    if (btnPostNow) {
        btnPostNow.addEventListener('click', async () => {
            const pageId = postPageSelect.value;
            const postContent = document.getElementById('postContent').value.trim();
            const imgContainer = document.getElementById('imagePreviewContainer');
            const imgElement = imgContainer.querySelector('img');

            if (!pageId) {
                alert('กรุณาเลือกเพจที่จะโพสต์ก่อนครับ (สามารถเพิ่มเพจได้ในหน้า Settings)');
                return;
            }
            if (!postContent || postContent.includes('กำลังประสานงาน')) {
                alert('กรุณาให้ AI เขียนเนื้อหาโพสต์ให้เสร็จก่อนครับ');
                return;
            }

            // Find the selected page data to get the token
            const selectedPage = storedPages.find(p => p.id === pageId);
            if (!selectedPage || !selectedPage.token) {
                alert('ไม่พบ Access Token ของเพจนี้ กรุณาตรวจสอบในหน้าตั้งค่า');
                return;
            }

            const originalText = btnPostNow.innerText;
            btnPostNow.innerText = '⏳ กำลังส่งข้อมูลไปยัง Facebook...';
            btnPostNow.disabled = true;

            try {
                let postId;
                if (imgElement && imgElement.src && imgElement.src.startsWith('data:image')) {
                    // Post with photo (Base64)
                    postId = await FacebookAPI.postPhoto(selectedPage.id, selectedPage.token, postContent, imgElement.src);
                } else if (imgElement && imgElement.src) {
                    // Post with photo (URL)
                    postId = await FacebookAPI.postPhoto(selectedPage.id, selectedPage.token, postContent, imgElement.src);
                } else {
                    // Post text only
                    postId = await FacebookAPI.postText(selectedPage.id, selectedPage.token, postContent);
                }

                alert(`✅ โพสต์ลง Facebook สำเร็จ! (Post ID: ${postId})`);
                
            } catch (error) {
                console.error('[Facebook Post Error]', error);
                alert(`❌ โพสต์ล้มเหลว: ${error.message}`);
            } finally {
                btnPostNow.innerText = originalText;
                btnPostNow.disabled = false;
            }
        });
    }

    // -------- Save to Queue (Draft & Scheduled) --------
    const btnSchedule = document.getElementById('btnSchedule');
    const btnSchedulePost = document.getElementById('btnSchedulePost');
    
    if (btnSchedulePost) {
        btnSchedulePost.addEventListener('click', async () => {
            const pageId = postPageSelect.value;
            const postContent = document.getElementById('postContent').value.trim();
            const imgContainer = document.getElementById('imagePreviewContainer');
            const imgElement = imgContainer.querySelector('img');
            const scheduledTime = document.getElementById('scheduleTime').value;

            if (!pageId) { alert('กรุณาเลือกเพจที่จะโพสต์ตั้งเวลาก่อนครับ'); return; }
            if (!postContent || postContent.includes('กำลังประสานงาน')) { alert('กรุณาให้ AI เขียนเนื้อหาใหเสร็จก่อนครับ'); return; }
            if (!scheduledTime) { alert('กรุณาระบุวันและเวลาที่ต้องการโพสต์ครับ'); return; }
            
            const scheduledTimestamp = new Date(scheduledTime).getTime();
            if (scheduledTimestamp <= Date.now()) { alert('กรุณาตั้งเวลาในอนาคตครับ'); return; }

            const data = await new Promise(resolve => chrome.storage.local.get('queue', resolve));
            const queue = data.queue || [];
            const selectedPage = storedPages.find(p => p.id === pageId);
            
            const queueItem = {
                id: 'sched_' + Date.now(),
                pageId: pageId,
                pageName: selectedPage ? selectedPage.name : 'Unknown Page',
                postText: postContent,
                imageUrl: imgElement ? imgElement.src : null,
                createdAt: new Date().toISOString(),
                scheduledAt: scheduledTimestamp // Mark as scheduled
            };

            queue.push(queueItem); 
            await new Promise(resolve => chrome.storage.local.set({ queue }, resolve));
            
            // Inform Background to set an alarm
            chrome.runtime.sendMessage({
                target: 'background',
                action: 'schedulePost',
                data: queueItem
            });
            
            alert('⏰ ตั้งเวลาโพสต์สำเร็จ! ระบบจะดันขึ้นคิวรอโพสต์ (เปิด Browser ทิ้งไว้ด้วยนะครับ)');
            document.querySelector('.tab-btn[data-tab="queue"]').click();
            renderQueue();
        });
    }

    if (btnSchedule) {
        btnSchedule.addEventListener('click', async () => {
            const pageId = postPageSelect.value;
            const postContent = document.getElementById('postContent').value.trim();
            const imgContainer = document.getElementById('imagePreviewContainer');
            const imgElement = imgContainer.querySelector('img');

            if (!pageId) {
                alert('กรุณาเลือกเพจที่จะโพสต์ก่อนบันทึกลงคิวครับ');
                return;
            }
            if (!postContent || postContent.includes('กำลังประสานงาน')) {
                alert('กรุณาให้ AI เขียนเนื้อหาโพสต์ให้เสร็จก่อนครับ');
                return;
            }

            const data = await new Promise(resolve => chrome.storage.local.get('queue', resolve));
            const queue = data.queue || [];
            
            const selectedPage = storedPages.find(p => p.id === pageId);
            
            const queueItem = {
                id: 'draft_' + Date.now(),
                pageId: pageId,
                pageName: selectedPage ? selectedPage.name : 'Unknown Page',
                postText: postContent,
                imageUrl: imgElement ? imgElement.src : null,
                createdAt: new Date().toISOString()
            };

            queue.unshift(queueItem); // Add to beginning
            
            await new Promise(resolve => chrome.storage.local.set({ queue }, resolve));
            
            alert('✅ บันทึกลงคิว (Draft) สำเร็จ! สามารถไปดูและเปลี่ยนรูปได้ที่แท็บ Queue ครับ');
            
            // Switch to Queue tab
            document.querySelector('.tab-btn[data-tab="queue"]').click();
            renderQueue();
        });
    }

    // -------- Queue Tab Logic --------
    const queueListContainer = document.getElementById('queueListContainer');
    const btnClearQueue = document.getElementById('btnClearQueue');

    if (btnClearQueue) {
        btnClearQueue.addEventListener('click', async () => {
            if (confirm('คุณแน่ใจหรือไม่ว่าต้องการล้างคิวและ Drafts ทั้งหมด?')) {
                await new Promise(resolve => chrome.storage.local.set({ queue: [] }, resolve));
                renderQueue();
            }
        });
    }

    async function renderQueue() {
        if (!queueListContainer) return;
        
        const data = await new Promise(resolve => chrome.storage.local.get('queue', resolve));
        const queue = data.queue || [];
        
        if (queue.length === 0) {
            queueListContainer.innerHTML = '<p class="placeholder-text">ไม่มีร่างโพสต์ หรือ งานตั้งเวลาในคิว</p>';
            return;
        }

        queueListContainer.innerHTML = queue.map((item, index) => {
            const isScheduled = !!item.scheduledAt;
            const timeStr = isScheduled ? new Date(item.scheduledAt).toLocaleString('th-TH') : 'Draft (บันทึกร่าง)';
            return `
            <div class="queue-item" data-id="${item.id}" style="${isScheduled ? 'border-left: 3px solid var(--warning);' : ''}">
                <div class="queue-item-header">
                    <span>📄 ${item.pageName}</span>
                    <span style="font-size: 10px; color: ${isScheduled ? 'var(--warning)' : 'var(--text-secondary)'}">${isScheduled ? '⏰ ' : ''}${timeStr}</span>
                    <button class="btn-danger-sm" onclick="window.deleteQueueItem('${item.id}')" style="padding: 2px 6px;">ลบทิ้ง</button>
                </div>
                <div class="queue-item-content">${item.postText.replace(/\n/g, '<br>')}</div>
                ${item.imageUrl && item.imageUrl.length > 10 ? `<img src="${item.imageUrl}" class="queue-item-media">` : '<div style="font-size: 11px; color: #ef4444;">[ยังไม่มีภาพประกอบ / รอเปลี่ยนภาพ]</div>'}
                
                <div class="queue-actions">
                    <div class="upload-btn-overlay" style="flex: 1;">
                        <button class="btn-secondary-sm" style="width: 100%;">📷 เปลี่ยนรูปภาพ</button>
                        <input type="file" accept="image/*" onchange="window.replaceQueueImage(event, '${item.id}')" />
                    </div>
                    <button class="btn-primary-sm" style="flex: 1;" onclick="window.postQueueItem(event, '${item.id}')">🚀 โพสต์ทันที</button>
                </div>
            </div>
            `;
        }).join('');
    }

    // Attach to window so onclick inline handlers can access them
    window.deleteQueueItem = async (id) => {
        const data = await new Promise(resolve => chrome.storage.local.get('queue', resolve));
        const queue = (data.queue || []).filter(item => item.id !== id);
        await new Promise(resolve => chrome.storage.local.set({ queue }, resolve));
        
        // Clear alarm just in case it was a scheduled post
        if (id.startsWith('sched_')) {
            chrome.alarms.clear(id);
        }
        
        renderQueue();
    };

    window.replaceQueueImage = async (event, id) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64data = reader.result;
            const data = await new Promise(resolve => chrome.storage.local.get('queue', resolve));
            const queue = data.queue || [];
            const itemIndex = queue.findIndex(item => item.id === id);
            if (itemIndex > -1) {
                queue[itemIndex].imageUrl = base64data;
                await new Promise(resolve => chrome.storage.local.set({ queue }, resolve));
                renderQueue();
            }
        };
        reader.readAsDataURL(file);
    };

    window.postQueueItem = async (event, id) => {
        const data = await new Promise(resolve => chrome.storage.local.get(['queue', 'pages'], resolve));
        const queue = data.queue || [];
        const pages = data.pages || [];
        
        const itemIndex = queue.findIndex(item => item.id === id);
        if (itemIndex === -1) return;
        
        const item = queue[itemIndex];
        const page = pages.find(p => p.id === item.pageId);
        
        if (!page || !page.token) {
            alert('❌ ไม่พบข้อมูลเพจหรือ Token กรุณาตรวจสอบ Settings');
            return;
        }

        const btn = event.target;
        const originalBtnText = btn.innerText;
        btn.innerText = '⏳ โพสต์...';
        btn.disabled = true;

        try {
            let postId;
            if (item.imageUrl && (item.imageUrl.startsWith('data:image') || item.imageUrl.startsWith('http'))) {
                postId = await FacebookAPI.postPhoto(page.id, page.token, item.postText, item.imageUrl);
            } else {
                postId = await FacebookAPI.postText(page.id, page.token, item.postText);
            }

            alert(`✅ โพสต์สำเร็จ! (Post ID: ${postId})`);
            
            // Remove from queue after posting
            queue.splice(itemIndex, 1);
            await new Promise(resolve => chrome.storage.local.set({ queue }, resolve));
            renderQueue();
        } catch (error) {
            console.error(error);
            alert(`❌ โพสต์ล้มเหลว: ${error.message}`);
            btn.innerText = originalBtnText;
            btn.disabled = false;
        }
    };

    // Init UI from settings
    chrome.storage.local.get(['settings', 'pages'], (data) => {
        if (data.settings && data.settings.defaultAiProvider) {
            const selector = document.getElementById('composeProvider');
            if (selector) selector.value = data.settings.defaultAiProvider;
        }

        // Populate Pages Dropdown
        if (data.pages && postPageSelect) {
            storedPages = data.pages;
            postPageSelect.innerHTML = '<option value="">-- เลือกเพจที่จะโพสต์ --</option>';
            data.pages.forEach(page => {
                if (page.name && page.id && page.token) {
                    const option = document.createElement('option');
                    option.value = page.id;
                    option.textContent = `📄 ${page.name}`;
                    postPageSelect.appendChild(option);
                }
            });
        }
    });

    async function refreshLogs() {
        if (!logContainer) return;
        const data = await chrome.storage.local.get('logs');
        const logs = data.logs || [];
        
        if (logs.length === 0) {
            logContainer.innerHTML = '<div class="placeholder-text">ยังไม่มีประวัติการทำงาน</div>';
            return;
        }

        logContainer.innerHTML = logs.map(log => `
            <div class="log-item info">
                <span class="time">[${log.time}]</span> ${log.message}
            </div>
        `).join('');
    }

    async function refreshAnalytics() {
        const data = await chrome.storage.local.get(['queue', 'pages', 'logs']);
        const statsObj = {
            success: (data.logs || []).filter(l => l.message?.includes('สำเร็จ')).length,
            drafts: (data.queue || []).length,
            pages: (data.pages || []).length
        };

        if (statsSuccess) statsSuccess.textContent = statsObj.success;
        if (statsDrafts) statsDrafts.textContent = statsObj.drafts;
        if (statsPages) statsPages.textContent = statsObj.pages;
    }

    // Listener for background messages
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'refreshLogs') refreshLogs();
        if (msg.action === 'refreshQueue') {
            renderQueue();
            refreshAnalytics();
        }
    });

    // Initial load
    renderQueue();
    refreshLogs();
    refreshAnalytics();
    
    console.log('[Auto Content] Side Panel Initialized successfully.');
})();
