import { CalendarDays, Play, Radio, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import LoadingState from "@/components/common/LoadingState";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchGhostRadioFeed } from "@/services/feedService";
import type { FeedItem } from "@/types/feed";
import { formatThaiDate } from "@/utils/formatDate";

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadFeed() {
    setLoading(true);
    setItems(await fetchGhostRadioFeed());
    setLoading(false);
  }

  useEffect(() => {
    void loadFeed();
  }, []);

  return (
    <section>
      <PageHeader
        icon={<Radio className="h-8 w-8 text-crimson-500" />}
        title="คลื่นหลอน"
        highlight="THE GHOST RADIO"
        description="ฟีด RSS จาก YouTube พร้อม service กลางสำหรับต่อยอด transcript / rewrite / TTS"
        action={
          <Button variant="panel" onClick={loadFeed}>
            <RefreshCcw className="h-4 w-4" />
            รีเฟรชคลื่น
          </Button>
        }
      />

      {loading ? (
        <LoadingState label="กำลังปรับจูนคลื่นวิญญาณ..." />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <a key={`${item.link}-${item.pubDate}`} href={item.link} target="_blank" rel="noreferrer">
              <Card className="group h-full overflow-hidden transition-all hover:-translate-y-1 hover:border-crimson-700">
                <div className="relative aspect-video overflow-hidden bg-black">
                  <img
                    src={item.thumbnail || "https://images.unsplash.com/photo-1505635552518-3448ff116af3?q=80&w=600&auto=format&fit=crop"}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute right-3 top-3 flex items-center gap-1 rounded-md border border-white/10 bg-black/70 px-3 py-1 text-[10px] text-white">
                    <Play className="h-3 w-3 text-red-500" />
                    YouTube
                  </div>
                </div>
                <CardContent className="space-y-3 pt-4">
                  <h3 className="line-clamp-2 font-semibold leading-snug text-gray-100">{item.title}</h3>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <StatusBadge>{item.source === "youtube" ? "เรื่องเล่า" : "Mock"}</StatusBadge>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {formatThaiDate(item.pubDate)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
