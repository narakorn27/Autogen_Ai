// lib/trends.js
// Fetch and parse Google Trends RSS Feed

export class TrendsFetcher {
    static async fetchDailyTrends(geo = 'TH') {
        // ... (same implementation)
        const url = `https://trends.google.com/trending/rss?geo=${geo}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const xmlText = await response.text();
        return this.parseXML(xmlText);
    }

    static parseXML(xmlText) {
        // Simple regex-based XML parsing for Service Worker compatibility (No DOMParser)
        const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);
        const trends = [];
        
        for (const match of itemMatches) {
            const itemXml = match[1];
            
            const title = (itemXml.match(/<title>(.*?)<\/title>/) || [])[1] || '';
            const traffic = (itemXml.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/) || [])[1] || '';
            
            let picture = (itemXml.match(/<ht:picture>(.*?)<\/ht:picture>/) || [])[1] || 
                          (itemXml.match(/&lt;ht:picture&gt;(.*?)&lt;\/ht:picture&gt;/) || [])[1] || '';
            
            const newsTitle = (itemXml.match(/<ht:news_item_title>(.*?)<\/ht:news_item_title>/) || [])[1] || '';
            const newsSnippet = (itemXml.match(/<ht:news_item_snippet>(.*?)<\/ht:news_item_snippet>/) || [])[1] || '';
            const newsUrl = (itemXml.match(/<ht:news_item_url>(.*?)<\/ht:news_item_url>/) || [])[1] || '';
            const newsSource = (itemXml.match(/<ht:news_item_source>(.*?)<\/ht:news_item_source>/) || [])[1] || '';

            trends.push({
                id: 'trend_' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
                keyword: title.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim(),
                traffic: traffic.trim(),
                image: picture.trim(),
                newsTitle: (newsTitle || title).replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim(),
                newsSnippet: newsSnippet.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim(),
                newsUrl: newsUrl.trim(),
                newsSource: newsSource.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim()
            });
        }
        
        return trends;
    }
}
