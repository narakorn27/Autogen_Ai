// lib/news-fetcher.js
// Fetch and parse RSS feeds for news with REAL images

export class NewsFetcher {
    static async fetchAiNews(geo = 'TH') {
        // Use Google News topic RSS for Technology/AI (includes images!)
        const topicId = 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FuUm9HZ0pVU0NBQVAB'; // Technology
        return this._fetchGoogleNewsTopic(topicId, geo, 'AI');
    }

    static async fetchGamesNews(geo = 'TH') {
        // Use Google News topic RSS for Entertainment (includes images!)
        const topicId = 'CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FuUm9HZ0pVU0NBQVAB'; // Entertainment
        return this._fetchGoogleNewsTopic(topicId, geo, 'เกม');
    }

    static async fetchTravelNews(geo = 'TH') {
        // Use Google News topic RSS for Travel (includes images!)
        const topicId = 'CAAqIggKIhxDQkFTRHdvSkwyMHZNREp1YTJjU0FuUm9LQUFQAQ'; // Travel
        return this._fetchGoogleNewsTopic(topicId, geo, 'ท่องเที่ยว');
    }

    static async fetchEvergreenContent() {
        const pool = [
            { title: 'เทคนิคการจัดสวนหน้าบ้านให้ดูร่มรื่น', snippet: 'การจัดสวนไม่ใช่แค่เรื่องของความสวยงาม แต่ยังช่วยลดอุณหภูมิในบ้านได้ด้วย...' },
            { title: 'วิธีดูแลสุขภาพช่วงหน้าร้อน', snippet: 'ดื่มน้ำให้เพียงพอและหลีกเลี่ยงการออกแดดจัดในช่วงกลางวัน...' },
            { title: 'รวม 5 แหล่งท่องเที่ยวลับในกรุงเทพฯ', snippet: 'คาเฟ่และชุมชนเก่าแก่ที่หลายคนอาจยังไม่เคยไปสัมผัส...' },
            { title: 'เทรนด์เทคโนโลยี AI ในปี 2026', snippet: 'สรุปการเปลี่ยนแปลงที่สำคัญที่จะเกิดขึ้นกับชีวิตประจำวันของเรา...' },
            { title: 'วิธีออมเงินฉบับพนักงานออฟฟิศ', snippet: 'เริ่มออมแต่น้อย สะสมความมั่งคั่งในระยะยาวด้วยวินัยการออม...' }
        ];
        
        return pool.map(item => ({
            id: 'evergreen_' + Math.random().toString(36).substr(2, 5),
            keyword: 'เกร็ดความรู้',
            traffic: 'EVERGREEN',
            image: 'icons/icon128.png', 
            newsTitle: item.title,
            newsSnippet: item.snippet,
            newsUrl: 'https://news.google.com',
            newsSource: 'Auto Evergreen'
        }));
    }

    static async fetchTipsContent() {
        const pool = [
            { title: 'วิธีไล่ยุงด้วยสมุนไพรธรรมชาติ', snippet: 'ใช้ตะไคร้หอมหรือเปลือกส้มตากแห้งวางตามจุดต่างๆ ในบ้าน...' },
            { title: 'เทคนิคการนอนหลับให้มีประสิทธิภาพ', snippet: 'หลีกเลี่ยงหน้าจออย่างน้อย 1 ชั่วโมงก่อนนอนและคุมอุณหภูมิห้องให้เหมาะสม...' },
            { title: 'วิธีขจัดคราบกาแฟบนเสื้อผ้าพื้นฐาน', snippet: 'ใช้น้ำส้มสายชูผสมน้ำเช็ดเบาๆ ก่อนนำไปซักปกติ...' },
            { title: 'สูตรลดพุงง่ายๆ ด้วยการดื่มน้ำเปล่า', snippet: 'ดื่มน้ำ 1 แก้วทันทีหลังจากตื่นนอนเพื่อกระตุ้นระบบเผาผลาญ...' },
            { title: 'วิธีดูแลต้นไม้ในร่มให้ใบเขียวสด', snippet: 'อย่ารดน้ำบ่อยเกินไปและเช็ดฝุ่นออกจากใบเพื่อให้ต้นไม้สังเคราะห์แสงได้ดี...' },
            { title: 'เทคนิคการทำความสะอาดคีย์บอร์ด', snippet: 'ใช้คอตตอนบัดชุบแอลกอฮอล์เช็ดตามซอก หรือใช้เยลลี่ทำความสะอาดดูดฝุ่น...' },
            { title: 'วิธีไล่มดออกจากห้องครัวแบบถาวร', snippet: 'ใช้น้ำส้มสายชูผสมน้ำเช็ดตามทางที่มดเดิน หรือโรยแป้งฝุ่นกันมดขาเข้า...' },
            { title: 'สูตรหมักไก่นุ่มแบบร้านอาหาร', snippet: 'ใช้น้ำสับปะรดหรือนมจืดหมักทิ้งไว้ 30 นาทีช่วยให้เนื้อนุ่มมาก...' },
            { title: 'วิธีประหยัดแบตเตอรี่มือถือขั้นเทพ', snippet: 'ปิดฟีเจอร์เบื้องหลังที่ไม่จำเป็นและลดความสว่างหน้าจอลง 20%...' },
            { title: 'เทคนิคการจัดกระเป๋าเดินทางสไตล์โปร', snippet: 'ใช้วิธีม้วนเสื้อผ้าแทนการพับเพื่อประหยัดพื้นที่และลดรอยยับ...' }
        ];
        
        return pool.map(item => ({
            id: 'tips_' + Math.random().toString(36).substr(2, 5),
            keyword: 'เทคนิคดีๆ',
            traffic: 'USEFUL',
            image: 'icons/icon128.png', 
            newsTitle: item.title,
            newsSnippet: item.snippet,
            newsUrl: 'https://news.google.com', 
            newsSource: 'Daily Tips'
        }));
    }

    // ====== NEW: Fetch from Google News Topic RSS (with images!) ======
    static async _fetchGoogleNewsTopic(topicId, geo, label) {
        const gl = geo === 'TH' ? 'TH' : geo;
        const hl = geo === 'TH' ? 'th' : 'en-US';
        const url = `https://news.google.com/rss/topics/${topicId}?hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`;
        
        console.log(`[NewsFetcher] Fetching topic RSS: ${label} for geo: ${geo}`);
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const xmlText = await response.text();
            return this.parseNewsXML(xmlText, label);
        } catch (error) {
            console.error(`[NewsFetcher] Topic fetch failed for ${label}, falling back to search...`, error);
            // Fallback to search RSS if topic fails
            const query = label === 'AI' ? (geo === 'TH' ? 'AI ปัญญาประดิษฐ์' : 'Artificial Intelligence') :
                          label === 'เกม' ? (geo === 'TH' ? 'ข่าวเกมส์' : 'Gaming News') :
                          (geo === 'TH' ? 'ท่องเที่ยว' : 'Travel News');
            return this._fetchGoogleNews(query, geo);
        }
    }

    // ====== OLD: Search-based RSS (no images, used as fallback) ======
    static async _fetchGoogleNews(query, geo) {
        const encodedQuery = encodeURIComponent(query);
        const gl = geo === 'TH' ? 'th' : 'us';
        const hl = geo === 'TH' ? 'th' : 'en-US';
        const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            
            const xmlText = await response.text();
            return this.parseNewsXML(xmlText);
        } catch (error) {
            console.error('[NewsFetcher] Error:', error);
            throw error;
        }
    }

    static parseNewsXML(xmlText, label = 'ข่าวล่าสุด') {
        const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);
        const news = [];
        
        for (const match of itemMatches) {
            const itemXml = match[1];
            
            const title = (itemXml.match(/<title>(.*?)<\/title>/) || [])[1] || '';
            const link = (itemXml.match(/<link>(.*?)<\/link>/) || [])[1] || '';
            const pubDate = (itemXml.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
            const source = (itemXml.match(/<source.*?>(.*?)<\/source>/) || [])[1] || '';
            
            // === Image extraction (multiple strategies) ===
            let image = '';
            
            // 1. media:content or media:thumbnail (Topic RSS often has this)
            const mediaMatch = itemXml.match(/<media:(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i);
            if (mediaMatch) image = mediaMatch[1];
            
            // 2. enclosure tag
            if (!image) {
                const encMatch = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
                if (encMatch) image = encMatch[1];
            }
            
            // 3. img inside description (decode HTML entities first!)
            if (!image) {
                const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/i);
                if (descMatch) {
                    const decoded = descMatch[1]
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&amp;/g, '&')
                        .replace(/&quot;/g, '"');
                    const imgMatch = decoded.match(/<img[^>]+src=["']([^"']+)["']/i);
                    if (imgMatch) image = imgMatch[1];
                }
            }

            news.push({
                id: 'news_' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
                keyword: label,
                traffic: 'NEW',
                image: image || 'icons/icon128.png', 
                newsTitle: title.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'),
                newsSnippet: `แหล่งข่าวจาก ${source.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')} (${pubDate})`,
                newsUrl: link,
                newsSource: source.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'),
                pubDate: pubDate
            });
        }
        
        return news;
    }
}
