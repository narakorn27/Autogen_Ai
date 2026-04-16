import { Copy, Download, ExternalLink, Loader2, Play, Square, Stethoscope, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import GlassPanel from "@/components/common/GlassPanel";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { checkHealth, extractYoutubeAudio, listProviders } from "@/services/transcriptService";
import { downloadElevenPreviewMp3, downloadNarration, listElevenVoices, playNarration, splitTtsText, stopNarration, TTS_VOICES } from "@/services/ttsService";
import type { TtsVoice } from "@/types/tts";
import { ELEVEN_THAI_PREVIEW_TEXT, getElevenThaiPreviewFilename, getElevenThaiPreviewPath } from "@/utils/elevenPreviewClips";

export default function DevToolsPage() {
  const [text, setText] = useState("คืนนั้นไม่มีใครกล้าเดินผ่านบ้านหลังนั้นอีก เพราะทุกครั้งที่ไฟดับ จะมีเสียงเคาะจากด้านในตู้เสื้อผ้า");
  const [voiceId, setVoiceId] = useState("Charon");
  const [speakingRate, setSpeakingRate] = useState(0.92);
  const [pitch, setPitch] = useState(-1);
  const [hauntedFx, setHauntedFx] = useState(true);
  const [status, setStatus] = useState("พร้อมทดสอบ TTS");

  const [elevenStatus, setElevenStatus] = useState("ยังไม่ได้โหลดเสียง ElevenLabs");
  const [loadingElevenVoices, setLoadingElevenVoices] = useState(false);
  const [downloadingVoiceId, setDownloadingVoiceId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [elevenVoices, setElevenVoices] = useState<TtsVoice[]>([]);
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [thaiPreviewText, setThaiPreviewText] = useState(ELEVEN_THAI_PREVIEW_TEXT);
  const [bulkFailures, setBulkFailures] = useState<Array<{ name: string; id: string; error: string }>>([]);
  const [transcriptUrl, setTranscriptUrl] = useState("");
  const [transcriptStatus, setTranscriptStatus] = useState("Transcript connector idle");
  const [transcriptProviders, setTranscriptProviders] = useState("managed_google, byo_google");
  const [checkingTranscript, setCheckingTranscript] = useState(false);
  const [extractingAudio, setExtractingAudio] = useState(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const chunks = splitTtsText(text);
  const previewVoices = elevenVoices.filter((voice) => Boolean(voice.previewUrl));

  useEffect(() => {
    return () => {
      stopNarration();
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  async function playTest() {
    setStatus("กำลังสร้างเสียง...");
    try {
      await playNarration({ text, voiceId, speakingRate, pitch, hauntedFx });
      setStatus("กำลังเล่นเสียง");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function exportTest() {
    setStatus("กำลัง export wav...");
    try {
      await downloadNarration({ text, voiceId, speakingRate, pitch }, "ghostai-tts-test.wav");
      setStatus("export wav แล้ว");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  function stopTest() {
    stopNarration();
    setStatus("หยุดเสียงแล้ว");
  }

  async function loadElevenVoices() {
    setLoadingElevenVoices(true);
    setPreviewError("");
    setElevenStatus("กำลังโหลดเสียง ElevenLabs...");
    try {
      const voices = await listElevenVoices();
      setElevenVoices(voices);
      const withPreview = voices.filter((voice) => Boolean(voice.previewUrl)).length;
      setElevenStatus(`โหลด ${voices.length} เสียง • มี preview_url ${withPreview} เสียง`);
    } catch (error) {
      setElevenVoices([]);
      setElevenStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingElevenVoices(false);
    }
  }

  async function handlePlayPreview(voice: TtsVoice) {
    const url = voice.previewUrl;
    if (!url) {
      setPreviewError(`เสียง ${voice.name} ไม่มี preview_url`);
      return;
    }

    setPreviewError("");

    if (previewVoiceId === voice.id && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
      setPreviewVoiceId(null);
      setElevenStatus(`หยุด preview ของ ${voice.name}`);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
    }

    try {
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      setPreviewVoiceId(voice.id);
      setElevenStatus(`กำลังเล่น preview_url ของ ${voice.name}`);
      audio.addEventListener("ended", () => {
        if (previewAudioRef.current === audio) {
          previewAudioRef.current = null;
        }
        setPreviewVoiceId((current) => (current === voice.id ? null : current));
        setElevenStatus(`preview ของ ${voice.name} เล่นจบแล้ว`);
      }, { once: true });
      audio.addEventListener("error", () => {
        if (previewAudioRef.current === audio) {
          previewAudioRef.current = null;
        }
        setPreviewVoiceId((current) => (current === voice.id ? null : current));
        setPreviewError(`เปิด preview_url ของ ${voice.name} ไม่สำเร็จ`);
        setElevenStatus(`preview_url ของ ${voice.name} ใช้งานไม่ได้`);
      }, { once: true });
      await audio.play();
    } catch (error) {
      previewAudioRef.current = null;
      setPreviewVoiceId(null);
      setPreviewError(error instanceof Error ? error.message : String(error));
      setElevenStatus(`เล่น preview_url ของ ${voice.name} ไม่สำเร็จ`);
    }
  }

  async function copyText(value: string, message: string) {
    await navigator.clipboard.writeText(value);
    setElevenStatus(message);
  }

  async function downloadThaiPreviewMp3(voice: TtsVoice) {
    setDownloadingVoiceId(voice.id);
    setElevenStatus(`กำลังสร้าง mp3 ภาษาไทยของ ${voice.name}...`);
    try {
      await downloadElevenPreviewMp3({
        text: thaiPreviewText,
        voiceId: voice.id,
        provider: "elevenlabs",
        modelId: "eleven_v3"
      }, getElevenThaiPreviewFilename(voice.id));
      setElevenStatus(`ดาวน์โหลด mp3 ภาษาไทยของ ${voice.name} แล้ว ให้นำไฟล์ไปไว้ที่ public${getElevenThaiPreviewPath(voice.id)}`);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : String(error));
      setElevenStatus(`สร้าง mp3 ภาษาไทยของ ${voice.name} ไม่สำเร็จ`);
    } finally {
      setDownloadingVoiceId(null);
    }
  }

  async function downloadAllThaiPreviewMp3() {
    if (!elevenVoices.length || !thaiPreviewText.trim()) return;

    setDownloadingAll(true);
    setPreviewError("");
    setBulkFailures([]);
    const failures: Array<{ name: string; id: string; error: string }> = [];
    try {
      for (const [index, voice] of elevenVoices.entries()) {
        setDownloadingVoiceId(voice.id);
        setElevenStatus(`กำลังสร้าง mp3 ภาษาไทย ${index + 1}/${elevenVoices.length} • ${voice.name}`);
        try {
          await downloadElevenPreviewMp3({
            text: thaiPreviewText,
            voiceId: voice.id,
            provider: "elevenlabs",
            modelId: "eleven_v3"
          }, getElevenThaiPreviewFilename(voice.id));
        } catch (error) {
          failures.push({
            name: voice.name,
            id: voice.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
      setBulkFailures(failures);
      if (failures.length) {
        setElevenStatus(`ดาวน์โหลดสำเร็จ ${elevenVoices.length - failures.length}/${elevenVoices.length} เสียง • ข้าม ${failures.length} เสียงที่สร้างไม่สำเร็จ`);
      } else {
        setElevenStatus(`ดาวน์โหลดครบ ${elevenVoices.length} เสียงแล้ว ให้นำไฟล์ทั้งหมดไปไว้ที่ public/previews/elevenlabs-th`);
      }
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : String(error));
      setElevenStatus("โหลด mp3 ไทยทั้งหมดไม่สำเร็จ");
    } finally {
      setDownloadingVoiceId(null);
      setDownloadingAll(false);
    }
  }

  async function handleTranscriptHealth() {
    setCheckingTranscript(true);
    setTranscriptStatus("Checking transcript connector...");
    try {
      const [health, providers] = await Promise.all([checkHealth(), listProviders()]);
      setTranscriptProviders(providers.map((item) => item.mode).join(", ") || "No providers");
      setTranscriptStatus(
        health.ok
          ? `Online - ffmpeg ${health.ffmpegReady ? "ready" : "missing"} - yt-dlp ${health.ytDlpReady ? "ready" : "missing"}`
          : `Offline - ${health.message || "health check failed"}`
      );
    } catch (error) {
      setTranscriptStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setCheckingTranscript(false);
    }
  }

  async function handleExtractTranscriptAudio() {
    if (!transcriptUrl.trim()) {
      setTranscriptStatus("Paste a YouTube URL first.");
      return;
    }
    setExtractingAudio(true);
    setTranscriptStatus("Extracting YouTube audio...");
    try {
      const result = await extractYoutubeAudio(transcriptUrl.trim());
      setTranscriptStatus(
        result.ok
          ? `Extracted audio${result.audioPath ? ` - ${result.audioPath}` : ""}`
          : "Audio extraction returned no usable artifact."
      );
    } catch (error) {
      setTranscriptStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setExtractingAudio(false);
    }
  }

  return (
    <section>
      <PageHeader
        icon={<Stethoscope className="h-8 w-8 text-crimson-500" />}
        title="Dev Tools"
        description="พื้นที่ทดสอบ TTS, preview_url ของ ElevenLabs, และสร้าง mp3 preview ภาษาไทยสำหรับใช้ในหน้า Studio"
      />

      <div className="space-y-6">
        <GlassPanel className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={10} />
            <div className="space-y-4 rounded-2xl border border-dark-700 bg-black/20 p-4">
              <label className="block space-y-2 text-sm text-gray-300">
                <span className="block text-xs uppercase tracking-widest text-gray-500">Voice</span>
                <select
                  className="h-11 w-full rounded-xl border border-dark-600 bg-dark-900/90 px-4 text-sm text-gray-100 outline-none"
                  value={voiceId}
                  onChange={(event) => setVoiceId(event.target.value)}
                >
                  {TTS_VOICES.map((voice) => (
                    <option key={voice.id} value={voice.id}>{voice.name}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm text-gray-300">
                <span className="flex justify-between text-xs uppercase tracking-widest text-gray-500"><span>Rate</span><span>{speakingRate.toFixed(2)}</span></span>
                <input className="h-10 w-full accent-crimson-700" type="range" min={0.75} max={1.2} step={0.01} value={speakingRate} onChange={(event) => setSpeakingRate(Number(event.target.value))} />
              </label>
              <label className="block space-y-2 text-sm text-gray-300">
                <span className="flex justify-between text-xs uppercase tracking-widest text-gray-500"><span>Pitch</span><span>{pitch}</span></span>
                <input className="h-10 w-full accent-crimson-700" type="range" min={-8} max={4} step={1} value={pitch} onChange={(event) => setPitch(Number(event.target.value))} />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-dark-700 bg-black/20 px-3 py-2 text-sm text-gray-300">
                <span>
                  <span className="block text-xs uppercase tracking-widest text-gray-500">Haunted FX</span>
                  <span className="text-xs text-gray-500">preview เท่านั้น</span>
                </span>
                <input className="h-5 w-5 accent-crimson-700" type="checkbox" checked={hauntedFx} onChange={(event) => setHauntedFx(event.target.checked)} />
              </label>
              <div className="grid gap-2">
                <Button variant="crimson" onClick={playTest}>
                  <Volume2 className="h-4 w-4" />
                  ทดสอบเสียง
                </Button>
                <Button variant="panel" onClick={stopTest}>
                  <Square className="h-4 w-4" />
                  หยุดเสียง
                </Button>
                <Button variant="ghost" onClick={exportTest}>
                  <Download className="h-4 w-4" />
                  Export wav
                </Button>
              </div>
              <p className="text-xs text-gray-500">{status}</p>
            </div>
          </div>
          <div className="rounded-xl border border-dark-600 bg-dark-900/80 p-4">
            <h3 className="text-sm font-semibold text-gray-200">Preview Split: {chunks.length} chunk(s)</h3>
            <pre className="mt-3 whitespace-pre-wrap text-xs leading-6 text-gray-400">
              {chunks.map((chunk, index) => `[${index}] len=${chunk.text.length}\n${chunk.text}`).join("\n\n")}
            </pre>
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-4">
          <div className="flex items-center gap-3 text-crimson-300">
            <Stethoscope className="h-5 w-5" />
            <h2 className="text-lg font-semibold text-gray-100">Transcript Connector Check</h2>
          </div>
          <Textarea value={transcriptUrl} onChange={(event) => setTranscriptUrl(event.target.value)} rows={3} placeholder="Paste YouTube URL for transcript connector diagnostics" />
          <div className="flex flex-wrap gap-2">
            <Button variant="panel" onClick={() => void handleTranscriptHealth()} disabled={checkingTranscript || extractingAudio}>
              {checkingTranscript ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
              Health Check
            </Button>
            <Button variant="crimson" onClick={() => void handleExtractTranscriptAudio()} disabled={checkingTranscript || extractingAudio || !transcriptUrl.trim()}>
              {extractingAudio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Extract MP3
            </Button>
          </div>
          <div className="rounded-xl border border-dark-700 bg-black/20 p-4 text-sm text-gray-400">
            <p>{transcriptStatus}</p>
            <p className="mt-2 text-xs text-gray-500">Modes: {transcriptProviders}</p>
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-crimson-500">ElevenLabs</p>
              <h2 className="mt-1 text-lg font-semibold text-gray-100">Preview URL + Thai MP3 Builder</h2>
              <p className="mt-1 text-sm text-gray-500">ใช้เทสดู preview_url จาก API แล้วโหลดไฟล์ mp3 ภาษาไทยของทั้ง 22 เสียงไปเก็บไว้ใน public</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="panel" onClick={() => void downloadAllThaiPreviewMp3()} disabled={downloadingAll || !elevenVoices.length || !thaiPreviewText.trim()}>
                {downloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {downloadingAll ? "กำลังโหลดทั้งหมด..." : "โหลด mp3 ไทยทั้งหมด"}
              </Button>
              <Button variant="crimson" onClick={loadElevenVoices} disabled={loadingElevenVoices || downloadingAll}>
                {loadingElevenVoices ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {loadingElevenVoices ? "กำลังโหลด..." : "โหลดเสียง ElevenLabs"}
              </Button>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-dark-700 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-widest text-gray-500">Thai Preview Script</p>
            <Textarea value={thaiPreviewText} onChange={(event) => setThaiPreviewText(event.target.value)} rows={3} />
            <p className="text-xs text-gray-500">ข้อความนี้จะถูกใช้สร้างไฟล์ mp3 ภาษาไทยแยกต่อเสียง เช่น `TX3LPaxmHKxFdv7VOQHJ.mp3`</p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-dark-700 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-widest text-gray-500">Total Voices</p>
              <p className="mt-2 text-2xl font-black text-gray-100">{elevenVoices.length}</p>
            </div>
            <div className="rounded-xl border border-dark-700 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-widest text-gray-500">With preview_url</p>
              <p className="mt-2 text-2xl font-black text-gray-100">{previewVoices.length}</p>
            </div>
            <div className="rounded-xl border border-dark-700 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-widest text-gray-500">Target Folder</p>
              <p className="mt-2 break-all text-sm font-semibold text-gray-100">public/previews/elevenlabs-th</p>
            </div>
          </div>

          <div className="rounded-xl border border-dark-700 bg-black/20 p-4 text-sm text-gray-400">
            <p>{elevenStatus}</p>
            {previewError ? <p className="mt-2 text-crimson-300">{previewError}</p> : null}
            {bulkFailures.length ? (
              <div className="mt-3 space-y-1">
                <p className="text-xs uppercase tracking-widest text-amber-300">Skipped Voices</p>
                {bulkFailures.map((failure) => (
                  <p key={failure.id} className="text-xs text-amber-200">
                    {failure.name} ({failure.id}) - {failure.error}
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            {elevenVoices.length ? (
              elevenVoices.map((voice) => {
                const hasPreview = Boolean(voice.previewUrl);
                const isPlaying = previewVoiceId === voice.id;
                const isDownloading = downloadingVoiceId === voice.id;
                const targetPath = getElevenThaiPreviewPath(voice.id);
                const targetFilename = getElevenThaiPreviewFilename(voice.id);
                const likelyPaidOnly = voice.category === "professional";
                return (
                  <div key={voice.id} className="rounded-xl border border-dark-700 bg-black/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-gray-100">{voice.name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${hasPreview ? "bg-emerald-950/60 text-emerald-300" : "bg-dark-700 text-gray-400"}`}>
                            {hasPreview ? "preview ready" : "no preview"}
                          </span>
                          {likelyPaidOnly ? (
                            <span className="rounded-full bg-amber-950/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-300">
                              professional
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{voice.id}</p>
                        <p className="mt-1 text-xs text-gray-400">{voice.desc}</p>
                        <p className="mt-2 break-all text-[11px] text-gray-500">{voice.previewUrl || "ไม่มี preview_url จาก ElevenLabs API"}</p>
                        <p className="mt-2 text-[11px] text-blue-300">target mp3: {targetPath}</p>
                        <p className="mt-1 text-[11px] text-gray-500">หลังดาวน์โหลด ให้นำไฟล์ `{targetFilename}` ไปไว้ในโฟลเดอร์ข้างบน</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button variant="panel" onClick={() => handlePlayPreview(voice)} disabled={!hasPreview || downloadingAll}>
                          {isPlaying ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          {isPlaying ? "หยุด" : "เล่น"}
                        </Button>
                        <Button variant="ghost" onClick={() => void copyText(voice.previewUrl || "", "คัดลอก preview_url แล้ว")} disabled={!hasPreview || downloadingAll}>
                          <Copy className="h-4 w-4" />
                          Copy URL
                        </Button>
                        <Button variant="ghost" onClick={() => void copyText(targetPath, "คัดลอก target path แล้ว")} disabled={downloadingAll}>
                          <Copy className="h-4 w-4" />
                          Copy Path
                        </Button>
                        <Button variant="crimson" onClick={() => void downloadThaiPreviewMp3(voice)} disabled={isDownloading || downloadingAll || !thaiPreviewText.trim()}>
                          {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          {isDownloading ? "กำลังสร้าง..." : "โหลด mp3 ไทย"}
                        </Button>
                        {hasPreview ? (
                          <a
                            href={voice.previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-11 items-center gap-2 rounded-xl border border-dark-600 px-4 text-sm text-gray-200 transition hover:border-crimson-700 hover:text-white"
                          >
                            <ExternalLink className="h-4 w-4" />
                            เปิด URL
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dark-700 bg-black/20 p-4 text-sm text-gray-500">
                ยังไม่มีข้อมูลเสียง ElevenLabs ให้กดปุ่มโหลดก่อน ถ้าไม่ได้มักแปลว่ายังไม่มี API key หรือ key ใช้ endpoint voices ไม่ได้
              </div>
            )}
          </div>
        </GlassPanel>
      </div>
    </section>
  );
}
