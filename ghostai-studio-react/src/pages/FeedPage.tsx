import { CalendarDays, Copy, ExternalLink, FileAudio, FileText, Loader2, Play, Radio, RefreshCcw, Send, Wand2, Waves, Youtube } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import GlassPanel from "@/components/common/GlassPanel";
import LoadingState from "@/components/common/LoadingState";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requestTextFromActiveProvider } from "@/services/aiService";
import { fetchGhostRadioFeed } from "@/services/feedService";
import { loadSettings } from "@/services/settingsStorage";
import { savePendingStudioTransfer } from "@/services/studioTransferService";
import { checkHealth, extractYoutubeAudio, listProviders, transcribeUpload, transcribeYoutube } from "@/services/transcriptService";
import { playNarration } from "@/services/ttsService";
import type { FeedItem } from "@/types/feed";
import type { TranscriptMode, TranscriptResult } from "@/types/transcript";
import { formatThaiDate } from "@/utils/formatDate";

function getPreferredGoogleApiKey() {
  const settings = loadSettings();
  return settings.byoGoogleApiKey.trim() || settings.ttsKey.trim();
}

export default function FeedPage() {
  const initialSettings = useMemo(() => loadSettings(), []);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [summary, setSummary] = useState("");
  const [rewrite, setRewrite] = useState("");
  const [status, setStatus] = useState("เลือกคลิป ใส่ลิงก์ YouTube หรืออัปโหลดไฟล์เสียง/วิดีโอ เพื่อเริ่มถอดเสียง");
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null);
  const [running, setRunning] = useState<"health" | "transcribe" | "extract" | "summarize" | "rewrite" | "play" | "none">("none");
  const [connectorHealth, setConnectorHealth] = useState("ยังไม่ได้ตรวจสอบ");
  const [providersLabel, setProvidersLabel] = useState("Google STT ของระบบ, Google STT ของคุณเอง");
  const [transcriptMode, setTranscriptMode] = useState<TranscriptMode>(initialSettings.defaultTranscriptMode);
  const [byoGoogleApiKey, setByoGoogleApiKey] = useState(initialSettings.byoGoogleApiKey || initialSettings.ttsKey);
  const [showAdvanced, setShowAdvanced] = useState(initialSettings.showAdvancedTranscriptOptions);

  async function loadFeed() {
    setLoading(true);
    try {
      setItems(await fetchGhostRadioFeed());
    } finally {
      setLoading(false);
    }
  }

  async function refreshConnectorState() {
    setRunning("health");
    try {
      const [health, providers] = await Promise.all([checkHealth(), listProviders()]);
      setConnectorHealth(
        health.ok
          ? `ออนไลน์${health.ffmpegReady === false || health.ytDlpReady === false ? ` แต่ยังไม่พบ${health.ffmpegReady ? "" : " ffmpeg"}${health.ffmpegReady || health.ytDlpReady ? "" : " และ"}${health.ytDlpReady ? "" : " yt-dlp"}` : " และเครื่องมือพร้อมใช้งาน"}`
          : `ออฟไลน์ - ${health.message || "ตรวจสอบสถานะไม่สำเร็จ"}`
      );
      setProvidersLabel(providers.map((item) => item.label).join(", ") || "ยังไม่พบโหมดที่ใช้งานได้");
    } catch (error) {
      setConnectorHealth(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning("none");
    }
  }

  function resetPipeline() {
    setTranscript(null);
    setSummary("");
    setRewrite("");
  }

  function selectItem(item: FeedItem) {
    setSelectedItem(item);
    setYoutubeUrl(item.link);
    setUploadFile(null);
    resetPipeline();
    setStatus(`เลือก "${item.title}" แล้ว พร้อมถอดเสียงจาก YouTube หรือสลับไปใช้อัปโหลดไฟล์แทน`);
  }

  async function handleExtractAudio() {
    if (!youtubeUrl.trim()) {
      setStatus("วางลิงก์ YouTube ก่อนแล้วค่อยสั่งแยกเสียง");
      return;
    }

    setRunning("extract");
    setStatus("กำลังแยกเสียงจาก YouTube ผ่าน PHP connector...");
    try {
      const result = await extractYoutubeAudio(youtubeUrl.trim());
      setStatus(result.ok ? `แยกไฟล์เสียงแล้ว${result.audioPath ? ` - ${result.audioPath}` : ""}` : "แยกเสียงไม่สำเร็จ หรือไม่ได้ไฟล์ที่พร้อมใช้งาน");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning("none");
    }
  }

  async function requestTranscript(mode: TranscriptMode, googleApiKey: string) {
    return uploadFile
      ? transcribeUpload({
          file: uploadFile,
          mode,
          byoGoogleApiKey: mode === "byo_google" ? googleApiKey : "",
          languageHint: "th-TH"
        })
      : transcribeYoutube({
          youtubeUrl: youtubeUrl.trim(),
          mode,
          byoGoogleApiKey: mode === "byo_google" ? googleApiKey : "",
          languageHint: "th-TH"
        });
  }

  async function handleTranscribe() {
    if (!youtubeUrl.trim() && !uploadFile) {
      setStatus("วางลิงก์ YouTube หรือเลือกไฟล์ก่อน");
      return;
    }

    const preferredGoogleKey = byoGoogleApiKey.trim() || getPreferredGoogleApiKey();

    setRunning("transcribe");
    setTranscript(null);
    setSummary("");
    setRewrite("");
    setStatus(uploadFile ? "กำลังอัปโหลดไฟล์และเตรียมถอดเสียง..." : "กำลังดึงเสียงจาก YouTube และเตรียมถอดเสียง...");

    try {
      let nextTranscript = await requestTranscript(transcriptMode, preferredGoogleKey);

      setTranscript(nextTranscript);
      setStatus(`ถอดเสียงจาก ${nextTranscript.providerLabel} เรียบร้อยแล้ว พร้อมวิเคราะห์หรือเขียนใหม่ต่อได้`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      const canFallbackToByo =
        transcriptMode === "managed_google" &&
        preferredGoogleKey &&
        message.toLowerCase().includes("managed google stt key is not configured");

      if (canFallbackToByo) {
        try {
          const fallbackTranscript = await requestTranscript("byo_google", preferredGoogleKey);
          setTranscriptMode("byo_google");
          setByoGoogleApiKey(preferredGoogleKey);
          setTranscript(fallbackTranscript);
          setStatus(`ไม่พบคีย์ Google STT ฝั่งระบบ จึงสลับมาใช้คีย์จาก Settings แทน และถอดเสียงสำเร็จแล้ว`);
          return;
        } catch (fallbackError) {
          setStatus(fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
          return;
        }
      }

      if (transcriptMode === "managed_google" && !preferredGoogleKey && message.toLowerCase().includes("managed google stt key is not configured")) {
        setStatus("ยังไม่ได้ตั้งค่า Google STT key สำหรับการถอดเสียง กรุณาใส่ Google Cloud API Key ในหน้า Settings หรือสลับเป็นโหมดใช้คีย์ของคุณเอง");
        return;
      }

      setStatus(message);
    } finally {
      setRunning("none");
    }
  }

  async function summarizeClip() {
    const sourceTitle = transcript?.sourceTitle || selectedItem?.title || "คลิปที่ไม่ทราบชื่อ";
    const transcriptText = transcript?.text?.trim() || "";
    if (!sourceTitle && !transcriptText) return;

    setRunning("summarize");
    setStatus("กำลังวิเคราะห์บทถอดเสียงเพื่อสรุปและหาแกนคอนเทนต์...");

    const prompt = `Analyze this Thai ghost-story source and produce a concise Thai summary for GhostAI.

Source title: ${sourceTitle}
Source URL: ${youtubeUrl || selectedItem?.link || "-"}
Transcript:
${transcriptText || "(No transcript available. Use the title and source metadata only.)"}

Return plain Thai text in this format:
Hook:
Core mystery:
Story beats:
GhostAI rewrite angle:
Copyright / adaptation note:`;

    try {
      const result = await requestTextFromActiveProvider(prompt, undefined, { temperature: 0.45, maxTokens: 900 });
      setSummary(result);
      setStatus("สรุปเนื้อหาเรียบร้อยแล้ว");
    } catch (error) {
      setSummary(`Hook: ${sourceTitle}

Core mystery: Build a fresh ghost-story angle from this source without copying the original transcript.

Story beats: Open with the strongest eerie idea, escalate with atmosphere, then push toward a reveal that feels made for GhostAI.

GhostAI rewrite angle: Reframe the source as an original Thai narration with its own setup, tension, and closing beat.

Copyright / adaptation note: Use as inspiration only, do not copy the original line by line.`);
      setStatus(error instanceof Error ? `ใช้สรุปสำรองแทน - ${error.message}` : "ใช้สรุปสำรองแทน");
    } finally {
      setRunning("none");
    }
  }

  async function createGhostRewrite() {
    const sourceTitle = transcript?.sourceTitle || selectedItem?.title || "ต้นทาง GhostAI";
    const transcriptText = transcript?.text?.trim() || "";

    setRunning("rewrite");
    setStatus("กำลังเขียนสคริปต์ GhostAI ใหม่จากบทถอดเสียงและโน้ต...");

    const prompt = `Create a brand-new Thai GhostAI narration script for a 2-3 minute clip.

Rules:
- Do not copy the source transcript.
- Treat the source as inspiration and rewrite it into a fresh story.
- Make it feel like GhostAI: eerie, atmospheric, paced, and narration-friendly.
- No markdown.

Source title: ${sourceTitle}
Summary / notes:
${summary || "(No summary available)"}

Transcript source:
${transcriptText || "(No transcript available)"}
`;

    try {
      const result = await requestTextFromActiveProvider(prompt, undefined, { temperature: 0.74, maxTokens: 1400 });
      setRewrite(result);
      setStatus("สคริปต์ Ghost Rewrite พร้อมแล้ว");
    } catch (error) {
      setRewrite(`เรื่องเล่าจาก ${sourceTitle}

คืนนี้ GhostAI จะหยิบแรงบันดาลใจจากคลิปนี้มาเล่าใหม่ในเวอร์ชันที่มีบรรยากาศหนักแน่นกว่าเดิม โดยไม่ยืนยันว่าเป็นเหตุการณ์จริง และไม่คัดลอกต้นฉบับตรง ๆ

ทุกอย่างเริ่มจากเบาะแสเล็ก ๆ ที่ไม่มีใครสนใจ แต่ยิ่งขุดลึกลงไป กลับยิ่งพบว่ามันเหมือนมีใครบางคนกำลังรอให้เรื่องนี้ถูกเล่าซ้ำอีกครั้ง...`);
      setStatus(error instanceof Error ? `ใช้สคริปต์สำรองแทน - ${error.message}` : "ใช้สคริปต์สำรองแทน");
    } finally {
      setRunning("none");
    }
  }

  async function playRewrite() {
    if (!rewrite.trim()) return;
    setRunning("play");
    setStatus("กำลังเล่นเสียงสคริปต์...");
    try {
      await playNarration({ text: rewrite, voiceId: "Charon" });
      setStatus("เริ่มเล่นเสียงพากย์แล้ว");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning("none");
    }
  }

  async function copyRewrite() {
    await navigator.clipboard.writeText(rewrite || summary || transcript?.text || "");
    setStatus("คัดลอกข้อความปัจจุบันแล้ว");
  }

  function sendToStudio() {
    if (!rewrite.trim()) {
      setStatus("ต้องสร้าง Ghost Rewrite ก่อน ถึงจะส่งต่อไป Studio ได้");
      return;
    }

    savePendingStudioTransfer({
      title: transcript?.sourceTitle || selectedItem?.title || "สคริปต์ GhostAI",
      script: rewrite,
      summary,
      sourceTitle: transcript?.sourceTitle || selectedItem?.title,
      sourceUrl: youtubeUrl || selectedItem?.link,
      statusMessage: "นำเข้าสคริปต์จาก Feed transcript pipeline แล้ว"
    });
    window.location.hash = "#/";
  }

  useEffect(() => {
    void loadFeed();
    void refreshConnectorState();
  }, []);

  const transcriptMetaTitle = transcript?.sourceTitle || selectedItem?.title || "ยังไม่ได้เลือกแหล่งข้อมูล";
  const runningBusy = running !== "none";

  return (
    <section>
      <PageHeader
        icon={<Radio className="h-8 w-8 text-crimson-500" />}
        title="คลื่นหลอน"
        highlight="สายงานถอดเสียง"
        description="ดึงคลิปจาก RSS วางลิงก์ YouTube หรืออัปโหลดไฟล์เสียง/วิดีโอ จากนั้นถอดเสียง วิเคราะห์ เขียนใหม่ และส่งสคริปต์กลับเข้า Studio"
        action={
          <Button variant="panel" onClick={() => void loadFeed()}>
            <RefreshCcw className="h-4 w-4" />
            รีเฟรชฟีด
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <GlassPanel className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.25em] text-gray-500">YouTube URL</span>
                <Input value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
              </label>
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.25em] text-gray-500">อัปโหลดไฟล์แทน</span>
                <Input type="file" accept="audio/*,video/*" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} />
              </label>
            </div>

            {showAdvanced ? (
              <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.25em] text-gray-500">โหมดการถอดเสียง</span>
                  <select
                    className="h-11 w-full rounded-xl border border-dark-600 bg-dark-900/90 px-4 text-sm text-gray-100 outline-none transition focus:border-crimson-600"
                    value={transcriptMode}
                    onChange={(event) => setTranscriptMode(event.target.value as TranscriptMode)}
                  >
                    <option value="managed_google">Google STT ของระบบ</option>
                    <option value="byo_google">Google STT ของคุณเอง</option>
                  </select>
                </label>
                {transcriptMode === "byo_google" ? (
                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.25em] text-gray-500">คีย์ Google STT ของคุณ</span>
                    <Input
                      type="password"
                      value={byoGoogleApiKey}
                      onChange={(event) => setByoGoogleApiKey(event.target.value)}
                      placeholder="ใส่ Google Cloud API Key ของคุณ"
                    />
                  </label>
                ) : (
                  <div className="rounded-xl border border-dark-700 bg-black/20 p-4 text-sm text-gray-400">
                    โหมดของระบบจะใช้คีย์ที่ฝั่ง connector ตั้งไว้ ถ้า local เครื่องนี้ยังไม่ได้ตั้งฝั่งระบบ ระบบจะพยายามใช้คีย์ Google จากหน้า Settings แทนให้อัตโนมัติ
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button variant="crimson" onClick={() => void handleTranscribe()} disabled={runningBusy}>
                {running === "transcribe" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Waves className="h-4 w-4" />}
                ถอดเสียง
              </Button>
              <Button variant="panel" onClick={() => void handleExtractAudio()} disabled={!youtubeUrl.trim() || runningBusy}>
                {running === "extract" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileAudio className="h-4 w-4" />}
                แยก MP3
              </Button>
              <Button variant="ghost" onClick={() => void refreshConnectorState()} disabled={runningBusy}>
                {running === "health" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                เช็ก Connector
              </Button>
            </div>

            <div className="rounded-xl border border-dark-700 bg-black/20 p-4 text-sm text-gray-400">
              <p>{status}</p>
              <p className="mt-2 text-xs text-gray-500">สถานะระบบถอดเสียง: {connectorHealth}</p>
              <p className="mt-1 text-xs text-gray-500">โหมดที่รองรับ: {providersLabel}</p>
              {uploadFile ? <p className="mt-1 text-xs text-blue-300">ไฟล์ที่เลือก: {uploadFile.name}</p> : null}
            </div>
          </GlassPanel>

          <div>
            {loading ? (
              <LoadingState label="กำลังดึงฟีด..." />
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {items.map((item) => (
                  <Card key={`${item.link}-${item.pubDate}`} className="group h-full overflow-hidden transition-all hover:-translate-y-1 hover:border-crimson-700">
                    <div className="relative aspect-video overflow-hidden bg-black">
                      <img
                        src={item.thumbnail || "https://images.unsplash.com/photo-1505635552518-3448ff116af3?q=80&w=600&auto=format&fit=crop"}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-md border border-white/10 bg-black/70 px-3 py-1 text-[10px] text-white">
                        <Youtube className="h-3 w-3 text-red-500" />
                        YouTube
                      </div>
                    </div>
                    <CardContent className="space-y-3 pt-4">
                      <h3 className="line-clamp-2 font-semibold leading-snug text-gray-100">{item.title}</h3>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <StatusBadge>{item.source === "youtube" ? "ฟีดเรื่องเล่า" : "ข้อมูลทดลอง"}</StatusBadge>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {formatThaiDate(item.pubDate)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant="panel" size="sm" onClick={() => selectItem(item)}>
                          เลือก
                        </Button>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-dark-600 bg-dark-800/80 text-sm font-semibold text-gray-300 transition hover:border-crimson-600 hover:text-white"
                        >
                          <ExternalLink className="h-4 w-4" />
                          ต้นทาง
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <GlassPanel className="sticky top-24 h-fit space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-crimson-500">สายงานคอนเทนต์</p>
              <h2 className="mt-1 text-xl font-semibold text-gray-100">{transcriptMetaTitle}</h2>
              <p className="mt-2 text-sm text-gray-400">{status}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-dark-700 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">โหมดถอดเสียง</p>
                <p className="mt-2 text-sm font-semibold text-gray-100">{transcriptMode === "managed_google" ? "Google STT ของระบบ" : "Google STT ของคุณเอง"}</p>
              </div>
              <div className="rounded-xl border border-dark-700 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">แหล่งข้อมูล</p>
                <p className="mt-2 text-sm font-semibold text-gray-100">{uploadFile ? "ไฟล์อัปโหลด" : youtubeUrl ? "ลิงก์ YouTube" : "กำลังรอ"}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Button variant="panel" onClick={() => void summarizeClip()} disabled={!transcript && !selectedItem}>
                {running === "summarize" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                วิเคราะห์
              </Button>
              <Button variant="crimson" onClick={() => void createGhostRewrite()} disabled={!transcript && !selectedItem}>
                {running === "rewrite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                เขียนใหม่สไตล์ GhostAI
              </Button>
            </div>

            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-[0.25em] text-gray-500">บทถอดเสียง</span>
              <Textarea
                value={transcript?.text || ""}
                onChange={(event) => setTranscript((current) => (current ? { ...current, text: event.target.value } : current))}
                rows={10}
                placeholder="ข้อความที่ถอดเสียงแล้วจะแสดงตรงนี้หลัง STT ทำงานเสร็จ"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-[0.25em] text-gray-500">สรุป / โน้ต</span>
              <Textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={8} placeholder="สรุปวิเคราะห์และแนวทางดัดแปลง" />
            </label>

            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-[0.25em] text-gray-500">สคริปต์ Ghost Rewrite</span>
              <Textarea value={rewrite} onChange={(event) => setRewrite(event.target.value)} rows={12} placeholder="สคริปต์ GhostAI ฉบับเขียนใหม่" />
            </label>

            <div className="flex flex-wrap gap-3">
              <Button variant="panel" onClick={copyRewrite} disabled={!rewrite && !summary && !transcript?.text}>
                <Copy className="h-4 w-4" />
                คัดลอก
              </Button>
              <Button variant="panel" onClick={() => void playRewrite()} disabled={!rewrite || runningBusy}>
                {running === "play" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                เล่นเสียงสคริปต์
              </Button>
              <Button variant="crimson" onClick={sendToStudio} disabled={!rewrite}>
                <Send className="h-4 w-4" />
                ส่งเข้า Studio
              </Button>
            </div>
          </GlassPanel>
        </div>
      </div>
    </section>
  );
}
