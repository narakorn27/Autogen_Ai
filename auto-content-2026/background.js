// Service Worker for Auto Content 2026
import { TrendsFetcher } from './lib/trends.js';
import { TMDBFetcher } from './lib/tmdb.js';
import { NewsFetcher } from './lib/news-fetcher.js';
import { AiComposer } from './lib/ai-composer.js';
import { AiImage } from './lib/ai-image.js';
import { FacebookAPI } from './lib/facebook-api.js';

chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    setupAutoBotAlarm();
});

// Restart alarm when settings change or schedule a post
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'triggerAutoBotRestart') {
        console.log('[Background] Restarting Auto Bot Alarm...');
        setupAutoBotAlarm();
    } else if (msg.action === 'schedulePost') {
        const item = msg.data;
        const delayInMinutes = Math.max(1, Math.ceil((item.scheduledAt - Date.now()) / 60000));
        chrome.alarms.create(item.id, { delayInMinutes });
        console.log(`[Background] Alarm created for ${item.id} in ${delayInMinutes} mins.`);
    }
});

async function setupAutoBotAlarm() {
    const data = await chrome.storage.local.get('settings');
    const interval = parseInt(data.settings?.autoBotInterval || '180');
    const enabled = data.settings?.autoBotEnabled || false;

    await chrome.alarms.clear('auto_content_loop');
    
    if (enabled) {
        chrome.alarms.create('auto_content_loop', {
            periodInMinutes: interval,
            delayInMinutes: 1 // Start soon after setup
        });
        console.log(`[Background] Auto Bot Alarm set for every ${interval} minutes.`);
    } else {
        console.log('[Background] Auto Bot is DISABLED.');
    }
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'auto_content_loop') {
        runAutoContentFlow();
    } else if (alarm.name.startsWith('sched_')) {
        executeScheduledPost(alarm.name);
    }
});

async function executeScheduledPost(alarmName) {
    const data = await chrome.storage.local.get(['queue', 'pages']);
    const queue = data.queue || [];
    const itemIndex = queue.findIndex(q => q.id === alarmName);
    
    if (itemIndex === -1) {
        console.log(`[Background] Scheduled item ${alarmName} not found in queue.`);
        return;
    }
    
    const item = queue[itemIndex];
    if (!item.scheduledAt) return; // Not a scheduled post
    
    const pages = data.pages || [];
    const page = pages.find(p => p.id === item.pageId);
    
    if (!page || !page.token) {
        addLog(`❌ โพสต์ตั้งเวลาล้มเหลว: ไม่สิทธิ์ Access Token เพจ ${item.pageName}`);
        return;
    }
    
    try {
        console.log(`[Background] Executing scheduled post for ${item.pageName}`);
        let postId;
        
        if (item.imageUrl) {
            postId = await FacebookAPI.postPhoto(page.id, page.token, item.postText, item.imageUrl);
        } else {
            postId = await FacebookAPI.postText(page.id, page.token, item.postText);
        }
        
        addLog(`✅ โพสต์ตั้งเวลาสำเร็จ: ${item.pageName} (ID: ${postId})`);
        
        // Remove from queue after success
        queue.splice(itemIndex, 1);
        await chrome.storage.local.set({ queue });
        chrome.runtime.sendMessage({ action: 'refreshQueue' }).catch(() => {});
        
    } catch (error) {
        addLog(`❌ โพสต์ตั้งเวลาล้มเหลว (${item.pageName}): ${error.message}`);
    }
}

async function runAutoContentFlow() {
    console.log('[Auto Bot] Starting scheduled flow...');
    
    // Ensure Offscreen is ready
    await createOffscreenDocument();

    const data = await chrome.storage.local.get(['settings', 'pages', 'seenUrls']);
    const settings = data.settings || {};
    const pages = data.pages || [];
    const seenUrls = data.seenUrls || [];

    if (!settings.autoBotEnabled || pages.length === 0) return;

    for (const page of pages) {
        try {
            console.log(`[Auto Bot] Processing Page: ${page.name} (Source: ${page.source})`);
            
            // Check Daily Limit
            if (await isDailyLimitReached(page)) {
                console.log(`[Auto Bot] Daily limit reached for ${page.name}. Skipping.`);
                continue;
            }

            const items = await fetchContentForPage(page, settings);
            
            // Find first item not in seenUrls
            const freshItem = items.find(item => !seenUrls.includes(item.newsUrl));
            
            if (!freshItem) {
                console.log(`[Auto Bot] No new content found for ${page.name}. Skipping.`);
                continue;
            }

            // Mark as seen immediately to prevent race conditions (simple version)
            seenUrls.push(freshItem.newsUrl);
            if (seenUrls.length > 500) seenUrls.shift(); // Limit history size
            await chrome.storage.local.set({ seenUrls });

            // Generate Content
            const postText = await AiComposer.generatePost(
                settings.defaultAiProvider,
                settings[settings.defaultAiProvider + 'ApiKey'],
                [freshItem],
                'Casual', // Default tone for auto bot
                page.topic || 'General'
            );

            // Generate Image (Only if item doesn't have a poster/image already)
            let imageData = null;
            if (freshItem.image && freshItem.image.startsWith('http')) {
                console.log('[Auto Bot] Using existing image/poster from source.');
                imageData = freshItem.image;
            } else {
                const imgPrompt = await AiImage.generatePrompt(
                    settings.defaultAiProvider,
                    settings[settings.defaultAiProvider + 'ApiKey'],
                    postText,
                    'Photorealistic'
                );
                
                imageData = await AiImage.generateImage(
                    settings.geminiApiKey,
                    settings.hfApiKey,
                    'huggingface', // Defaulting to HF as it's more stable for now
                    imgPrompt
                );
            }

            // [NEW] Text Overlay using Offscreen
            let finalImageData = imageData;
            try {
                const overlayHeadline = freshItem.newsTitle.split('|')[0].trim(); // Extract meaningful headline
                const overlaySubline = freshItem.newsSource || 'TRENDING NEWS';
                
                finalImageData = await chrome.runtime.sendMessage({
                    target: 'offscreen',
                    action: 'renderTextOverlay',
                    data: {
                        imageUrl: imageData,
                        headline: overlayHeadline,
                        subline: overlaySubline,
                        logoUrl: page.logo
                    }
                });
                console.log('[Auto Bot] Text Overlay applied successfully.');
            } catch (error) {
                console.warn('[Auto Bot] Text Overlay failed, using original image.', error);
            }

            if (settings.autoBotAction === 'post') {
                console.log(`[Auto Bot] Posting to Facebook: ${page.name}`);
                await FacebookAPI.postPhoto(page.id, page.token, postText, finalImageData);
                addLog(`🚀 โพสต์อัตโนมัติสำเร็จ: ${page.name} - ${freshItem.newsTitle}`);
            } else {
                console.log(`[Auto Bot] Saving to Queue (Draft): ${page.name}`);
                const queueData = await chrome.storage.local.get('queue');
                const queue = queueData.queue || [];
                queue.unshift({
                    id: Date.now().toString(),
                    postText,
                    imageUrl: finalImageData,
                    pageId: page.id,
                    pageName: page.name,
                    createdAt: new Date().toISOString()
                });
                await chrome.storage.local.set({ queue });
                addLog(`💾 เซฟลงคิวอัตโนมัติ: ${page.name} - ${freshItem.newsTitle}`);
            }

            // Increment Daily Count
            await incrementDailyCount(page.id);

        } catch (error) {
            console.error(`[Auto Bot] Error processing page ${page.name}:`, error);
            addLog(`❌ ข้อผิดพลาด (${page.name}): ${error.message}`);
        }
    }
}

async function fetchContentForPage(page, settings) {
    switch (page.source) {
        case 'ai_news': return await NewsFetcher.fetchAiNews();
        case 'games_news': return await NewsFetcher.fetchGamesNews();
        case 'travel_news': return await NewsFetcher.fetchTravelNews();
        case 'google_trends': return await TrendsFetcher.fetchDailyTrends('TH');
        case 'tmdb': return await TMDBFetcher.fetchTrendingMovies(settings.tmdbApiKey);
        case 'evergreen': return await NewsFetcher.fetchEvergreenContent();
        case 'tips': return await NewsFetcher.fetchTipsContent();
        default: return await NewsFetcher.fetchAiNews();
    }
}

async function addLog(message) {
    const data = await chrome.storage.local.get('logs');
    const logs = data.logs || [];
    logs.unshift({
        time: new Date().toLocaleTimeString(),
        message
    });
    if (logs.length > 50) logs.pop();
    await chrome.storage.local.set({ logs });
    
    // Notify sidepanel to refresh logs if open
    chrome.runtime.sendMessage({ action: 'refreshLogs' }).catch(() => {});
}

async function createOffscreenDocument() {
    if (await chrome.offscreen.hasDocument()) return;
    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['CANVAS'],
        justification: 'Rendering text overlay on AI generated images.'
    });
}

async function isDailyLimitReached(page) {
    const data = await chrome.storage.local.get('dailyStats');
    const stats = data.dailyStats || {};
    const today = new Date().toISOString().split('T')[0];
    const pageStat = stats[page.id] || { date: '', count: 0 };
    const maxPosts = page.maxPosts || 5;

    if (pageStat.date === today && pageStat.count >= maxPosts) {
        return true;
    }
    return false;
}

async function incrementDailyCount(pageId) {
    const data = await chrome.storage.local.get('dailyStats');
    const stats = data.dailyStats || {};
    const today = new Date().toISOString().split('T')[0];
    
    if (!stats[pageId] || stats[pageId].date !== today) {
        stats[pageId] = { date: today, count: 1 };
    } else {
        stats[pageId].count++;
    }
    
    await chrome.storage.local.set({ dailyStats: stats });
}
