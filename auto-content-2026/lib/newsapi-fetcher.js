// lib/newsapi-fetcher.js
// Fetches news from NewsAPI.org — has real images (urlToImage)!

export class NewsApiFetcher {
    static async fetchTopHeadlines(apiKey, country = 'th', category = 'technology') {
        const url = `https://newsapi.org/v2/top-headlines?country=${country}&category=${category}&pageSize=20&apiKey=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`NewsAPI Error: ${res.status}`);
        const data = await res.json();

        let articles = data.articles || [];

        // ถ้าเป็นการดึงจากประเทศไทย และได้ข่าวมา 0 รายการ (ปกติของ NewsAPI ที่ไม่ได้เก็บข่าวไทยไว้ในบาง category)
        // เราจะสลับแผนสำรองมาเป็นการค้นหาคำศัพท์ Global ภาษาไทยแทน
        if (articles.length === 0 && country === 'th') {
            const query = category === 'technology' ? 'เทคโนโลยี OR มือถือ OR ไอที' : 'บันเทิง OR ดารา OR ซีรีส์';
            return await this.searchNews(apiKey, query, 'th');
        }

        if (data.status !== 'ok') throw new Error(data.message || 'NewsAPI Error');

        return articles.map(article => ({
            id: 'newsapi_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            keyword: category,
            traffic: 'NEWS',
            image: article.urlToImage || 'icons/icon128.png',
            newsTitle: article.title || '',
            newsSnippet: article.description || '',
            newsUrl: article.url,
            newsSource: article.source?.name || 'NewsAPI',
            pubDate: article.publishedAt
        }));
    }

    static async searchNews(apiKey, query, language = 'th') {
        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=${language}&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`NewsAPI Error: ${res.status}`);
        const data = await res.json();

        return (data.articles || []).map(article => ({
            id: 'newsapi_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            keyword: query,
            traffic: 'NEWS',
            image: article.urlToImage || 'icons/icon128.png',
            newsTitle: article.title || '',
            newsSnippet: article.description || '',
            newsUrl: article.url,
            newsSource: article.source?.name || 'NewsAPI',
            pubDate: article.publishedAt
        }));
    }
}
