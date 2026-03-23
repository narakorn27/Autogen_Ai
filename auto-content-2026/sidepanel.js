document.addEventListener('DOMContentLoaded', () => {
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
        const geo = geoSelect.value;
        const currentText = btnFetchTrends.innerText;
        btnFetchTrends.innerText = 'กำลังโหลด...';
        btnFetchTrends.disabled = true;
        
        try {
            currentTrends = await TrendsFetcher.fetchDailyTrends(geo);
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
        const actionsDiv = document.getElementById('trendsActions');
        const countSpan = document.getElementById('selectedNewsCount');
        
        if (selectedTrends.size > 0) {
            actionsDiv.style.display = 'flex';
            countSpan.innerText = `เลือก ${selectedTrends.size} รายการ`;
        } else {
            actionsDiv.style.display = 'none';
        }
    }

    // Settings logic
    const btnOpenSettings = document.getElementById('btnOpenSettings');
    if (btnOpenSettings) {
        btnOpenSettings.addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });
    }

    console.log('[Auto Content] Side Panel Initialized successfully.');
});
