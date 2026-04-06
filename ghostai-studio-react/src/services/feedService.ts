import type { FeedItem } from "@/types/feed";

const RSS_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=UCM246zZ4qMNmDw8JOPjFquw";

export const mockFeedItems: FeedItem[] = [
  {
    title: "ห้องข้างหมายเลข 404 | คุณ A",
    link: "https://youtube.com",
    thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop",
    pubDate: new Date().toISOString(),
    source: "mock"
  },
  {
    title: "ทางเปลี่ยวคืนนั้น | คุณ B",
    link: "https://youtube.com",
    thumbnail: "https://images.unsplash.com/photo-1626245137107-7756e1cd4ece?q=80&w=600&auto=format&fit=crop",
    pubDate: new Date(Date.now() - 86400000).toISOString(),
    source: "mock"
  }
];

export function parseYouTubeFeedXml(xmlText: string): FeedItem[] {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");

  return Array.from(xml.querySelectorAll("entry"))
    .map((entry) => ({
      title: entry.querySelector("title")?.textContent?.trim() || "Untitled",
      link: entry.querySelector("link")?.getAttribute("href") || "https://youtube.com",
      pubDate: entry.querySelector("published")?.textContent || new Date().toISOString(),
      thumbnail: entry.querySelector("media\\:thumbnail, thumbnail")?.getAttribute("url") || "",
      source: "youtube" as const
    }))
    .filter((item) => item.link);
}

export async function fetchGhostRadioFeed(): Promise<FeedItem[]> {
  if (window.location.protocol === "file:") return mockFeedItems;

  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(RSS_URL)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const items = parseYouTubeFeedXml(await response.text());
    return items.length ? items : mockFeedItems;
  } catch {
    return mockFeedItems;
  }
}
