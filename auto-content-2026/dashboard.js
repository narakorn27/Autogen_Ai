// dashboard.js - News Dashboard Module
import { NewsFetcher } from './lib/news-fetcher.js';
import { TrendsFetcher } from './lib/trends.js';
import { TMDBFetcher } from './lib/tmdb.js';
import { NewsApiFetcher } from './lib/newsapi-fetcher.js';
import { Rss2JsonFetcher } from './lib/rss2json-fetcher.js';

let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    updateClock();
    setInterval(updateClock, 30000);

    // Theme Toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Source & Geo Selects
    document.getElementById('dashboardSource').addEventListener('change', () => fetchAllSources());
    document.getElementById('dashboardGeo').addEventListener('change', () => fetchAllSources());

    // Filter Chips
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.source;
            console.log('[Dashboard] Filter changed to:', currentFilter);
            renderFilteredNews();
        });
    });

    // Refresh Button
    document.getElementById('btnRefresh').addEventListener('click', () => fetchAllSources());

    // Initial Fetch
    fetchAllSources();
});

let allNewsData = [];

async function fetchAllSources() {
    const loadingState = document.getElementById('loadingState');
    const newsGrid = document.getElementById('newsGrid');
    const sourceSelect = document.getElementById('dashboardSource').value;
    const geo = document.getElementById('dashboardGeo').value;

    loadingState.style.display = 'flex';
    // Don't clear the grid, just show loading overlay if we want seamless. 
    // But for now, let's clear it to show it's working.
    // newsGrid.innerHTML = ''; 

    console.log('[Dashboard] Fetching sources for Geo:', geo, 'Source Select:', sourceSelect);

    try {
        const data = await chrome.storage.local.get('settings');
        const tmdbKey = data.settings?.tmdbApiKey;
        const newsApiKey = data.settings?.newsApiKey;

        const promises = [];

        // Determine which sources to fetch based on selector
        if (sourceSelect === 'all' || sourceSelect === 'google_trends') {
            promises.push(TrendsFetcher.fetchDailyTrends(geo).then(data => ({ source: 'trends', data })));
        }
        if (sourceSelect === 'all' || sourceSelect === 'newsapi_tech') {
            promises.push(NewsApiFetcher.fetchTopHeadlines(newsApiKey, geo === 'TH' ? 'th' : 'us', 'technology').then(data => ({ source: 'newsapi_tech', data })));
        }
        if (sourceSelect === 'all' || sourceSelect === 'thairath') {
            promises.push(Rss2JsonFetcher.fetchSource('thairath').then(data => ({ source: 'thairath', data })));
        }
        if (sourceSelect === 'all' || sourceSelect === 'matichon') {
            promises.push(Rss2JsonFetcher.fetchSource('matichon').then(data => ({ source: 'matichon', data })));
        }
        if (sourceSelect === 'all' || sourceSelect === 'khaosod') {
            promises.push(Rss2JsonFetcher.fetchSource('khaosod').then(data => ({ source: 'khaosod', data })));
        }
        if (sourceSelect === 'all' || sourceSelect === 'ai_news') {
            promises.push(NewsFetcher.fetchAiNews(geo).then(data => ({ source: 'ai', data })));
        }
        if (sourceSelect === 'all' || sourceSelect === 'games_news') {
            promises.push(NewsFetcher.fetchGamesNews(geo).then(data => ({ source: 'games', data })));
        }
        if (sourceSelect === 'all' || sourceSelect === 'travel_news') {
            promises.push(NewsFetcher.fetchTravelNews(geo).then(data => ({ source: 'travel', data })));
        }
        if (sourceSelect === 'all' || sourceSelect === 'tech_news') {
            promises.push(NewsFetcher._fetchGoogleNews(geo === 'TH' ? 'เทคโนโลยี' : 'Technology', geo).then(data => ({ source: 'tech', data })));
        }
        if (sourceSelect === 'all' || sourceSelect === 'tmdb') {
            const lang = geo === 'TH' ? 'th-TH' : 'en-US';
            promises.push(TMDBFetcher.fetchTrendingMovies(tmdbKey, lang).then(data => ({ source: 'tmdb', data })));
        }
        if (sourceSelect === 'all' || sourceSelect === 'tips') {
            promises.push(NewsFetcher.fetchTipsContent().then(data => ({ source: 'tips', data })));
        }

        const results = await Promise.allSettled(promises);
        
        allNewsData = [];
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value.data) {
                const source = result.value.source;
                const items = result.value.data;
                console.log(`[Dashboard] Source ${source} returned ${items.length} items`);
                
                items.forEach(item => {
                    allNewsData.push({
                        ...item,
                        sourceGroup: source
                    });
                });
            } else if (result.status === 'rejected') {
                console.error('[Dashboard] Fetch Error:', result.reason);
            }
        });

        // Sort by Date (Reverse) - Most recent first
        // Note: TMDB and Tips might not have standard pubDate strings, we handle it
        allNewsData.sort((a, b) => {
            const dateA = a.pubDate ? new Date(a.pubDate) : new Date(0);
            const dateB = b.pubDate ? new Date(b.pubDate) : new Date(0);
            return dateB - dateA;
        });

        console.log('[Dashboard] Total news loaded:', allNewsData.length);
        renderFilteredNews();

    } catch (error) {
        console.error('[Dashboard] Error fetching news:', error);
    } finally {
        loadingState.style.display = 'none';
    }
}

function renderFilteredNews() {
    const newsGrid = document.getElementById('newsGrid');
    const newsCount = document.getElementById('newsCount');
    
    // Filter logic
    let filtered = allNewsData;
    if (currentFilter !== 'all') {
        filtered = allNewsData.filter(item => {
            if (currentFilter === 'ai_news') return item.sourceGroup === 'ai';
            if (currentFilter === 'games_news') return item.sourceGroup === 'games';
            if (currentFilter === 'travel_news') return item.sourceGroup === 'travel';
            if (currentFilter === 'google_trends') return item.sourceGroup === 'trends';
            if (currentFilter === 'tmdb') return item.sourceGroup === 'tmdb';
            if (currentFilter === 'tips') return item.sourceGroup === 'tips';
            if (currentFilter === 'newsapi_tech') return item.sourceGroup === 'newsapi_tech';
            if (currentFilter === 'thairath') return item.sourceGroup === 'thairath';
            return true;
        });
    }

    newsCount.innerText = `${filtered.length} รายการ`;

    if (filtered.length === 0) {
        newsGrid.innerHTML = `
            <div class="empty-state">
                <p>ไม่พบข้อมูลในหมวดหมู่นี้ ลองเลือกแหล่งข้อมูลอื่น</p>
            </div>
        `;
        return;
    }

    newsGrid.innerHTML = filtered.map(item => renderNewsCard(item)).join('');
}

function renderNewsCard(item) {
    const imageUrl = item.image && item.image.length > 5 ? item.image : 'icons/icon128.png';
    const sourceLabel = item.sourceGroup.toUpperCase();
    const sourceClass = item.sourceGroup;
    
    return `
        <article class="news-card" onclick="window.open('${item.newsUrl}', '_blank')">
            <div class="card-image-wrap">
                <img src="${imageUrl}" class="card-image" loading="lazy" onerror="this.src='icons/icon128.png'">
                <div class="card-badge ${sourceClass}">${item.traffic || ''}</div>
            </div>
            <div class="card-body">
                <div class="card-meta">
                    <span class="card-source ${sourceClass}">${item.newsSource || sourceLabel}</span>
                    <span class="card-time">${formatDate(item.pubDate)}</span>
                </div>
                <h3 class="card-title">${item.newsTitle}</h3>
                <p class="card-snippet">${item.newsSnippet || ''}</p>
            </div>
        </article>
    `;
}

// ===== Theme Management =====
function initTheme() {
    const savedTheme = localStorage.getItem('dashboard-theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    }
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('dashboard-theme', isLight ? 'light' : 'dark');
    console.log('[Dashboard] Theme changed to:', isLight ? 'light' : 'dark');
}

// ===== Helpers =====
function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const timeDisplay = document.getElementById('timeDisplay');
    if (timeDisplay) timeDisplay.innerText = timeStr;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    } catch {
        return dateStr;
    }
}
