// lib/rss2json-fetcher.js
export class Rss2JsonFetcher {
    static THAI_SOURCES = {
        thairath: 'https://www.thairath.co.th/rss/news',
        matichon: 'https://www.matichon.co.th/feed',
        khaosod: 'https://www.khaosod.co.th/feed'
    };

    static async fetchSource(sourceName) {
        const rssUrl = this.THAI_SOURCES[sourceName];
        if (!rssUrl) throw new Error(`Unknown RSS source: ${sourceName}`);

        const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`RSS2JSON Error: ${res.status}`);
        const data = await res.json();

        return (data.items || []).map(item => ({
            id: `rss_${sourceName}_` + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            keyword: sourceName,
            traffic: 'TH',
            image: item.thumbnail || item.enclosure?.link || 'icons/icon128.png',
            newsTitle: item.title || '',
            newsSnippet: (item.description || '').replace(/<[^>]+>/g, '').slice(0, 150),
            newsUrl: item.link,
            newsSource: sourceName.charAt(0).toUpperCase() + sourceName.slice(1),
            pubDate: item.pubDate
        }));
    }

    static async fetchAll() {
        const results = await Promise.allSettled(
            Object.keys(this.THAI_SOURCES).map(name => this.fetchSource(name))
        );
        return results
            .filter(r => r.status === 'fulfilled')
            .flatMap(r => r.value);
    }
}
