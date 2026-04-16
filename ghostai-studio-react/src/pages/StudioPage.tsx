import { Check, Copy, Download, Image, RefreshCw, Sparkles, Tags, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import GlassPanel from "@/components/common/GlassPanel";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AudioFxPanel from "@/features/tts/AudioFxPanel";
import TtsVoicePicker from "@/features/tts/TtsVoicePicker";
import { generateStoryDraft, requestTextFromActiveProvider, testAiConnection } from "@/services/aiService";
import { consumePendingStudioTransfer } from "@/services/studioTransferService";
import { TTS_ENGINE_OPTIONS, TTS_VOICES, downloadNarration, downloadNarrationWithFx, listElevenVoices, listGoogleTtsVoices, playNarration, stopNarration, updateNarrationFx } from "@/services/ttsService";
import type { StoryGenerationRequest } from "@/types/ai";
import type { AiProvider } from "@/types/settings";
import type { TtsAudioFxSettings, TtsVoice } from "@/types/tts";
import { ELEVEN_THAI_PREVIEW_TEXT, getElevenThaiPreviewPath } from "@/utils/elevenPreviewClips";

type StudioMetadata = {
  title: string;
  description: string;
  hashtags: string;
};

const DEFAULT_METADATA: StudioMetadata = {
  title: "",
  description: "",
  hashtags: "#เรื่องผี #เล่าเรื่องผี #GhostAI #หลอนก่อนนอน"
};

const DEFAULT_AUDIO_FX: TtsAudioFxSettings = {
  reverb: false,
  pitchLow: false,
  whisper: false,
  staticNoise: false,
  ambientMix: true,
  masterVolume: 0.8
};

export default function StudioPage() {
  const [aiProvider, setAiProvider] = useState<AiProvider>((localStorage.getItem("gh_active_ai") as AiProvider) || "gemini");
  const [keyword, setKeyword] = useState("บ้านร้างท้ายซอย");
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [goreLevel, setGoreLevel] = useState(60);
  const [style, setStyle] = useState("เรื่องเล่า");
  const [voiceId, setVoiceId] = useState(localStorage.getItem("gh_primary_voice") || "Charon");
  const [secondaryVoiceId, setSecondaryVoiceId] = useState(localStorage.getItem("gh_secondary_voice") || "Zephyr");
  const [dialogueMode, setDialogueMode] = useState(false);
  const [speakingRate, setSpeakingRate] = useState(0.92);
  const [pitch, setPitch] = useState(-1);
  const [audioFx, setAudioFx] = useState<TtsAudioFxSettings>(DEFAULT_AUDIO_FX);
  const [story, setStory] = useState("");
  const [metadata, setMetadata] = useState<StudioMetadata>(DEFAULT_METADATA);
  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [audioAssetsReady, setAudioAssetsReady] = useState(false);
  const [audioGenerating, setAudioGenerating] = useState(false);
  const [ttsEngineId, setTtsEngineId] = useState(() => window.localStorage.getItem("gh_tts_engine") || "eleven-v3");
  const [availableVoices, setAvailableVoices] = useState<TtsVoice[]>([...TTS_VOICES]);
  const [voiceListLoading, setVoiceListLoading] = useState(false);
  const [ttsPreparing, setTtsPreparing] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsApiStatus, setTtsApiStatus] = useState("");
  const [ttsApiChecking, setTtsApiChecking] = useState(false);
  const [status, setStatus] = useState("พร้อมสร้างสคริปต์เรื่องผี");
  const [thumbnailSeed, setThumbnailSeed] = useState(7);
  const thumbnailCanvasRef = useRef<HTMLCanvasElement>(null);
  const playbackActionIdRef = useRef(0);
  const previewSampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const selectedTtsEngine = TTS_ENGINE_OPTIONS.find((engine) => engine.id === ttsEngineId) || TTS_ENGINE_OPTIONS[0];
  const selectedVoice = availableVoices.find((voice) => voice.id === voiceId) || TTS_VOICES.find((voice) => voice.id === voiceId);

  const wordCount = story.trim() ? story.trim().split(/\s+/).length : 0;
  const scriptChars = story.length;
  const estimatedMinutes = Math.max(1, Math.ceil(wordCount / 130));
  const thumbnailTitle = metadata.title || keyword || "GHOSTAI";
  const estimatedCredits = selectedTtsEngine.provider === "elevenlabs" ? Math.ceil(scriptChars * (selectedTtsEngine.creditsPerChar || 1)) : null;
  const estimatedRequests = selectedTtsEngine.charLimit
    ? Math.max(1, Math.ceil(Math.max(scriptChars, 1) / selectedTtsEngine.charLimit))
    : 1;
  const limitSummary = selectedTtsEngine.charLimit
    ? `${selectedTtsEngine.charLimit.toLocaleString()} chars/request - ~${estimatedRequests} req`
    : selectedTtsEngine.provider === "google"
      ? "voice/API"
      : "docs";
  const currentTtsKey = selectedTtsEngine.provider === "elevenlabs"
    ? window.localStorage.getItem("gh_api_eleven")?.trim() || ""
    : window.localStorage.getItem("gh_api_tts")?.trim() || "";
  const ttsProviderStatus = ttsApiStatus || (currentTtsKey ? "มี API key" : "ยังไม่มี API key");
  const activityState = ttsPlaying
    ? "Playing"
    : ttsPreparing || loading || metadataLoading || audioGenerating
      ? "Working"
      : "Ready";
  const activityTone = ttsPlaying
    ? "border-emerald-700/70 bg-emerald-950/40 text-emerald-200"
    : ttsPreparing || loading || metadataLoading || audioGenerating
      ? "border-amber-700/70 bg-amber-950/40 text-amber-200"
      : "border-crimson-800/70 bg-crimson-950/35 text-crimson-200";

  async function handleCheckTtsApi() {
    const provider = selectedTtsEngine.provider === "elevenlabs" ? "elevenlabs" : "tts";
    const apiKey = selectedTtsEngine.provider === "elevenlabs"
      ? window.localStorage.getItem("gh_api_eleven")?.trim() || ""
      : window.localStorage.getItem("gh_api_tts")?.trim() || "";

    if (!apiKey) {
      setTtsApiStatus("ยังไม่มี API key");
      return;
    }

    setTtsApiChecking(true);
    setTtsApiStatus("กำลังตรวจสอบ...");
    try {
      const result = await testAiConnection(provider, apiKey);
      setTtsApiStatus(result.success ? `เชื่อมต่อได้ • ${result.message}` : `เชื่อมต่อไม่ได้ • ${result.message}`);
    } finally {
      setTtsApiChecking(false);
    }
  }

  useEffect(() => {
    setTtsApiStatus("");
  }, [ttsEngineId]);

  useEffect(() => {
    drawThumbnailCanvas(thumbnailCanvasRef.current, {
      title: thumbnailTitle,
      style,
      durationMinutes,
      goreLevel,
      seed: thumbnailSeed
    });
  }, [thumbnailTitle, style, durationMinutes, goreLevel, thumbnailSeed]);

  useEffect(() => {
    const pendingTransfer = consumePendingStudioTransfer();
    if (!pendingTransfer?.script?.trim()) return;

    setStory(pendingTransfer.script);
    setKeyword(pendingTransfer.title || pendingTransfer.sourceTitle || keyword);
    setMetadata((current) => ({
      ...current,
      title: pendingTransfer.title || pendingTransfer.sourceTitle || current.title,
      description: pendingTransfer.summary || current.description
    }));
    setAudioAssetsReady(false);
    setAudioGenerating(false);
    setStatus(pendingTransfer.statusMessage || "Imported script from Feed pipeline.");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadVoices() {
      setVoiceListLoading(true);
      try {
        const voices = selectedTtsEngine.provider === "elevenlabs"
          ? await listElevenVoices()
          : await listGoogleTtsVoices();
        if (cancelled) return;
        setAvailableVoices(
          voices.length
            ? voices
            : selectedTtsEngine.provider === "elevenlabs"
              ? []
              : [...TTS_VOICES]
        );
      } catch {
        if (cancelled) return;
        setAvailableVoices(selectedTtsEngine.provider === "elevenlabs" ? [] : [...TTS_VOICES]);
      } finally {
        if (!cancelled) setVoiceListLoading(false);
      }
    }

    void loadVoices();

    return () => {
      cancelled = true;
    };
  }, [selectedTtsEngine.provider, ttsApiStatus]);

  useEffect(() => {
    if (!availableVoices.length) return;
    if (!availableVoices.some((voice) => voice.id === voiceId)) {
      selectVoice(availableVoices[0].id);
    }
    if (!availableVoices.some((voice) => voice.id === secondaryVoiceId)) {
      selectSecondaryVoice(availableVoices[Math.min(1, availableVoices.length - 1)].id);
    }
  }, [availableVoices]);

  async function handleGenerate() {
    setLoading(true);
    setStatus("กำลังเขียนเรื่อง...");
    try {
      const request: StoryGenerationRequest = {
        keyword,
        genre: "สยองขวัญ",
        goreLevel,
        style,
        durationMinutes,
        provider: aiProvider
      };
      const result = await generateStoryDraft(request);
      setStory(result);
      setAudioAssetsReady(false);
      setAudioGenerating(false);
      handleStopAudio();
      setStatus("สร้างเรื่องเสร็จแล้ว");

      // ตั้งค่า metadata เบื้องต้นทันที เพื่อให้ผู้ใช้ export ได้โดยไม่ต้องกด AI เพิ่ม
      setMetadata({
        title: extractTitle(result, keyword),
        description: createFallbackDescription(result, keyword),
        hashtags: DEFAULT_METADATA.hashtags
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateMetadata() {
    if (!story.trim()) {
      setStatus("ต้องมีสคริปต์ก่อนสร้าง metadata");
      return;
    }

    setMetadataLoading(true);
    setStatus("กำลังสร้าง title/description/hashtags...");
    try {
      const prompt = `จากสคริปต์เรื่องผีต่อไปนี้ ช่วยสร้าง metadata สำหรับ YouTube/TikTok ภาษาไทย

ตอบกลับเป็น JSON เท่านั้น ห้ามใส่ markdown:
{
  "title": "ชื่อคลิปไม่เกิน 70 ตัวอักษร",
  "description": "คำอธิบาย 2-3 บรรทัด ชวนคลิก แต่ไม่หลอกเกินจริง",
  "hashtags": "#แท็ก1 #แท็ก2 #แท็ก3 #แท็ก4"
}

คีย์เวิร์ดหลัก: ${keyword}
สคริปต์:
${story.slice(0, 3500)}`;

      const text = await requestTextFromActiveProvider(prompt, undefined, { temperature: 0.55, maxTokens: 500 });
      setMetadata(parseMetadata(text, story, keyword));
      setStatus("สร้าง metadata เสร็จแล้ว");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setMetadataLoading(false);
    }
  }

  async function handlePlay() {
    if (!story.trim() || ttsPreparing) return;
    const actionId = playbackActionIdRef.current + 1;
    playbackActionIdRef.current = actionId;
    setStatus("กำลังสร้างเสียง...");
    setTtsPreparing(true);
    setTtsPlaying(false);
    try {
      const audio = await playNarration({
        text: story,
        voiceId,
        secondaryVoiceId,
        provider: selectedTtsEngine.provider,
        modelId: selectedTtsEngine.modelId,
        dialogueMode,
        speakingRate,
        pitch,
        hauntedFx: true,
        audioFx
      });
      if (playbackActionIdRef.current !== actionId) return;
      if (!audio) {
        setStatus("หยุดเสียงแล้ว");
        return;
      }
      audio.addEventListener("ended", () => {
        if (playbackActionIdRef.current !== actionId) return;
        setTtsPlaying(false);
        setStatus("เสียงเล่นจบแล้ว");
      }, { once: true });
      setTtsPlaying(true);
      setStatus("กำลังเล่นเสียง");
    } catch (error) {
      if (playbackActionIdRef.current !== actionId) return;
      setTtsPlaying(false);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      if (playbackActionIdRef.current === actionId) setTtsPreparing(false);
    }
  }

  async function handleGenerateAudioAssets() {
    if (selectedTtsEngine.provider === "elevenlabs" && !window.localStorage.getItem("gh_api_eleven")?.trim()) {
      setStatus("ยังไม่ได้ตั้ง ElevenLabs API Key ในหน้า Settings");
      return;
    }

    if (selectedTtsEngine.provider === "google" && !window.localStorage.getItem("gh_api_tts")?.trim()) {
      setStatus("ยังไม่ได้ตั้ง Google Cloud TTS Key ในหน้า Settings");
      return;
    }
    if (!story.trim()) {
      setStatus("ต้องมีสคริปต์ก่อนสร้างเสียงและภาพ");
      return;
    }

    setAudioGenerating(true);
    setAudioAssetsReady(false);
    setThumbnailSeed((seed) => seed + 1);
    setStatus(`Preparing media assets with ${selectedTtsEngine.label}`);
    try {
      setAudioAssetsReady(true);
      if (selectedTtsEngine.provider === "elevenlabs" && selectedTtsEngine.charLimit) {
        const overLimit = scriptChars > selectedTtsEngine.charLimit;
        setStatus(
          overLimit
            ? `${selectedTtsEngine.label}: script ${scriptChars.toLocaleString()} chars exceeds ${selectedTtsEngine.charLimit.toLocaleString()} chars/request, auto-splitting into about ${estimatedRequests} requests`
            : `${selectedTtsEngine.label}: script ${scriptChars.toLocaleString()} chars / about ${estimatedCredits?.toLocaleString() || 0} credits`
        );
      } else {
        setStatus(`Ready to generate audio with ${selectedTtsEngine.label}`);
      }
    } finally {
      setAudioGenerating(false);
    }
  }

  function handleStopAudio() {
    playbackActionIdRef.current += 1;
    stopNarration();
    setTtsPreparing(false);
    setTtsPlaying(false);
    setStatus("หยุดเสียงแล้ว");
  }

  useEffect(() => {
    return () => {
      stopNarration();
      if (previewSampleAudioRef.current) {
        previewSampleAudioRef.current.pause();
        previewSampleAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    updateNarrationFx(audioFx);
  }, [audioFx]);

  async function handleDownloadAudio() {
    if (!story.trim()) return;
    setStatus("กำลัง export ไฟล์เสียง...");
    try {
      await downloadNarration({
        text: story,
        voiceId,
        secondaryVoiceId,
        provider: selectedTtsEngine.provider,
        modelId: selectedTtsEngine.modelId,
        dialogueMode,
        speakingRate,
        pitch
      }, `${slugify(metadata.title || keyword || "ghostai-narration")}.wav`);
      setStatus("export ไฟล์เสียง .wav แล้ว");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleDownloadAudioWithFx() {
    if (!story.trim()) return;
    setStatus("กำลัง export ไฟล์เสียงพร้อม FX preset...");
    try {
      await downloadNarrationWithFx({
        text: story,
        voiceId,
        secondaryVoiceId,
        provider: selectedTtsEngine.provider,
        modelId: selectedTtsEngine.modelId,
        dialogueMode,
        speakingRate,
        pitch,
        audioFx
      }, `${slugify(metadata.title || keyword || "ghostai-narration")}-fx.wav`);
      setStatus("export ไฟล์เสียงพร้อม FX .wav แล้ว");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function previewVoice(nextVoiceId: string) {
    const voice = availableVoices.find((item) => item.id === nextVoiceId);
    const localPreviewPath = selectedTtsEngine.provider === "elevenlabs" ? getElevenThaiPreviewPath(nextVoiceId) : "";
    const fallbackPreviewUrl = voice?.previewUrl || "";

    const stopSampleAudio = () => {
      if (!previewSampleAudioRef.current) return;
      previewSampleAudioRef.current.pause();
      previewSampleAudioRef.current.currentTime = 0;
      previewSampleAudioRef.current = null;
    };

    const playSampleFromUrl = async (url: string, label: string) => {
      stopNarration();
      stopSampleAudio();
      const audio = new Audio(url);
      previewSampleAudioRef.current = audio;
      audio.preload = "auto";
      audio.onended = () => {
        if (previewSampleAudioRef.current === audio) previewSampleAudioRef.current = null;
      };
      await audio.play();
      setStatus(label);
    };

    setStatus(`Preparing voice preview ${nextVoiceId}...`);
    try {
      if (localPreviewPath) {
        try {
          await playSampleFromUrl(localPreviewPath, `Playing local mp3 preview ${nextVoiceId}`);
          return;
        } catch {}
      }

      if (fallbackPreviewUrl) {
        try {
          await playSampleFromUrl(fallbackPreviewUrl, `Playing sample preview ${nextVoiceId}`);
          return;
        } catch {}
      }

      await playNarration({
        text: ELEVEN_THAI_PREVIEW_TEXT,
        voiceId: nextVoiceId,
        provider: selectedTtsEngine.provider,
        modelId: selectedTtsEngine.modelId,
        speakingRate,
        pitch,
        hauntedFx: true,
        audioFx
      });
      setStatus(`Playing generated preview ${nextVoiceId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  function selectVoice(nextVoiceId: string) {
    setVoiceId(nextVoiceId);
    localStorage.setItem("gh_primary_voice", nextVoiceId);
  }

  function selectSecondaryVoice(nextVoiceId: string) {
    setSecondaryVoiceId(nextVoiceId);
    localStorage.setItem("gh_secondary_voice", nextVoiceId);
  }

  function selectAiProvider(nextProvider: AiProvider) {
    setAiProvider(nextProvider);
    localStorage.setItem("gh_active_ai", nextProvider);
  }

  function selectTtsEngine(nextEngineId: string) {
    setTtsEngineId(nextEngineId);
    localStorage.setItem("gh_tts_engine", nextEngineId);
  }

  async function copyMetadata() {
    const text = `${metadata.title}\n\n${metadata.description}\n\n${metadata.hashtags}`.trim();
    await navigator.clipboard.writeText(text || "ยังไม่มี metadata");
    setStatus("คัดลอก metadata แล้ว");
  }

  function exportScript() {
    const content = [
      `# ${metadata.title || extractTitle(story, keyword)}`,
      "",
      "## Metadata",
      metadata.description,
      metadata.hashtags,
      "",
      "## Script",
      story || "ยังไม่มีสคริปต์"
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(metadata.title || keyword || "ghostai-script")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("export ไฟล์ .txt แล้ว");
  }

  function exportThumbnail() {
    const canvas = thumbnailCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${slugify(thumbnailTitle)}-thumbnail.png`;
    link.click();
    setStatus("export thumbnail .png แล้ว");
  }

  return (
    <section>
      <PageHeader
        icon={<Wand2 className="h-8 w-8 text-crimson-500" />}
        title="AI Studio"
        highlight="CONTROL"
        description="ศูนย์กลางสร้างสคริปต์ พากย์เสียง ทำ metadata และเตรียม content package สำหรับปล่อยคลิป"
      />

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <GlassPanel className="space-y-4">
          <div className="flex items-center gap-3 text-crimson-300">
            <Sparkles className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Story Generator</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="คีย์เวิร์ด เช่น บ้านร้าง โรงแรม ป่าลึก" />
            <Button variant="crimson" onClick={handleGenerate} disabled={loading}>
              {loading ? "กำลังสร้าง..." : "สร้างเรื่อง"}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <label className="space-y-2 text-sm text-gray-300">
              <span className="block text-xs uppercase tracking-widest text-gray-500">AI Model</span>
              <select
                className="h-11 w-full rounded-xl border border-crimson-900/60 bg-dark-900/90 px-4 text-sm text-gray-100 shadow-inner transition hover:border-crimson-600"
                value={aiProvider}
                onChange={(event) => selectAiProvider(event.target.value as AiProvider)}
              >
                <option value="gemini">Gemini (Google)</option>
                <option value="groq">Groq</option>
                <option value="openrouter">OpenRouter</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-gray-300">
              <span className="block text-xs uppercase tracking-widest text-gray-500">ความยาว</span>
              <select className="h-11 w-full rounded-xl border border-dark-600 bg-dark-900/90 px-4 text-sm text-gray-100" value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}>
                <option value={1}>1 นาที</option>
                <option value={3}>3 นาที</option>
                <option value={5}>5 นาที</option>
                <option value={10}>10 นาที</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-gray-300">
              <span className="block text-xs uppercase tracking-widest text-gray-500">สไตล์</span>
              <select className="h-11 w-full rounded-xl border border-dark-600 bg-dark-900/90 px-4 text-sm text-gray-100" value={style} onChange={(event) => setStyle(event.target.value)}>
                <option value="เรื่องเล่า">เรื่องเล่า</option>
                <option value="ข่าว">ข่าว</option>
                <option value="ตำนาน">ตำนาน</option>
                <option value="พอดแคสต์">พอดแคสต์</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-gray-300">
              <span className="flex justify-between text-xs uppercase tracking-widest text-gray-500">
                <span>ระดับความหลอน / โหด</span>
                <span>{getHorrorLevelLabel(goreLevel)} Ã‚Â· {goreLevel}%</span>
              </span>
              <input className="h-11 w-full accent-crimson-700" type="range" min={1} max={100} value={goreLevel} onChange={(event) => setGoreLevel(Number(event.target.value))} />
              <span className="block text-[11px] leading-relaxed text-gray-500">คุมโทนความกดดัน เลือดสาด และความแรงของฉากพีค ไม่ใช่แค่ gore อย่างเดียว</span>
            </label>
          </div>

          <Textarea value={story} onChange={(event) => setStory(event.target.value)} rows={18} placeholder="สคริปต์ที่สร้างจะมาอยู่ตรงนี้" />

          <div className="grid gap-3 rounded-2xl border border-dark-700 bg-black/20 p-4 md:grid-cols-3">
            <div className="rounded-xl border border-blue-900/60 bg-blue-950/20 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-300/80">Words</p>
              <p className="mt-1 text-lg font-black text-blue-100">{wordCount.toLocaleString()}</p>
              <p className="mt-1 text-xs text-blue-200/70">คำประมาณในสคริปต์ปัจจุบัน</p>
            </div>
            <div className="rounded-xl border border-violet-900/60 bg-violet-950/20 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300/80">Narration Est.</p>
              <p className="mt-1 text-lg font-black text-violet-100">{estimatedMinutes} นาที</p>
              <p className="mt-1 text-xs text-violet-200/70">เวลาพากย์โดยประมาณ</p>
            </div>
            <div className={`rounded-xl border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${activityTone}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] opacity-80">Status</p>
              <p className="mt-1 text-sm font-black">{status}</p>
              <p className="mt-1 text-xs opacity-75">{activityState === "Ready" ? "พร้อมเริ่มทำงาน" : activityState === "Working" ? "ระบบกำลังประมวลผล" : "กำลังเล่นเสียงอยู่"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="panel" onClick={handleGenerateMetadata} disabled={!story.trim() || metadataLoading}>
              <Tags className="h-4 w-4" />
              {metadataLoading ? "กำลังสร้าง metadata..." : "สร้าง metadata"}
            </Button>
            <Button variant="ghost" onClick={exportScript} disabled={!story.trim()}>
              <Download className="h-4 w-4" />
              Export .txt
            </Button>
          </div>

        </GlassPanel>

        <div className="space-y-6">
          <GlassPanel className="space-y-4">
            <div className="flex items-center gap-3 text-crimson-300">
              <Image className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Thumbnail Preview</h2>
            </div>
            <canvas
              ref={thumbnailCanvasRef}
              width={1280}
              height={720}
              className="aspect-video w-full rounded-3xl border border-crimson-900/60 bg-black shadow-2xl"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">canvas preview สำหรับ export thumbnail โดยตรงจาก React</p>
              <div className="flex gap-2">
                <Button variant="panel" size="sm" onClick={() => setThumbnailSeed((seed) => seed + 1)}>
                  <RefreshCw className="h-4 w-4" />
                  เจนใหม่
                </Button>
                <Button variant="ghost" size="sm" onClick={exportThumbnail}>
                  <Download className="h-4 w-4" />
                  Export .png
                </Button>
              </div>
            </div>
          </GlassPanel>
            {false && <GlassPanel className="space-y-4">
              <div className="flex items-center gap-3 text-crimson-300">
                <Image className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Media Assets</h2>
              </div>
              <div className="rounded-3xl border border-dark-700 bg-black/30 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-crimson-500">Voice + TTS Model</p>
                <h3 className="mt-2 text-xl font-black text-gray-100">เลือก engine ก่อนสร้างเสียง</h3>
                <p className="mt-2 text-sm text-gray-400">กดสร้างก่อน แล้วค่อยเปิดภาพปกกับแผงเสียงพากย์ + Realtime FX ตาม flow เดิม</p>
                <div className="mt-4 space-y-3">
                  {TTS_ENGINE_OPTIONS.map((engine) => {
                    const selected = engine.id === selectedTtsEngine.id;
                    return (
                      <button
                        key={engine.id}
                        type="button"
                        onClick={() => selectTtsEngine(engine.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-crimson-600 bg-crimson-950/30" : "border-dark-700 bg-dark-950/60 hover:border-crimson-800"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-100">{engine.label}</span>
                              {engine.recommendation ? <span className="rounded border border-crimson-700/70 bg-crimson-950/50 px-2 py-0.5 text-[10px] font-bold uppercase text-crimson-300">{engine.recommendation}</span> : null}
                            </div>
                            <p className="mt-1 text-xs text-blue-300">{engine.modelId}</p>
                            <p className="mt-2 text-sm text-gray-400">{engine.description}</p>
                          </div>
                          {selected ? <Check className="h-5 w-5 shrink-0 text-crimson-400" /> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button className="mt-5 w-full" variant="crimson" onClick={handleGenerateAudioAssets} disabled={!story.trim() || audioGenerating}>
                  {audioGenerating ? "กำลังเตรียม..." : `สร้างภาพ + เสียง [${selectedTtsEngine.label}]`}
                </Button>
              </div>
            </GlassPanel>}

          <GlassPanel className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-crimson-500">Metadata</p>
                <h2 className="text-lg font-semibold text-gray-100">Title / Description / Hashtags</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={copyMetadata}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
            <Input value={metadata.title} onChange={(event) => setMetadata({ ...metadata, title: event.target.value })} placeholder="ชื่อคลิป" />
            <Textarea value={metadata.description} onChange={(event) => setMetadata({ ...metadata, description: event.target.value })} rows={5} placeholder="คำอธิบายคลิป" />
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">Tags</span>
                <Button variant="ghost" size="sm" onClick={() => void navigator.clipboard.writeText(metadata.hashtags)}>
                  <Copy className="h-4 w-4" />
                  Copy Tags
                </Button>
              </div>
              <div className="flex min-h-20 flex-wrap gap-2 rounded-xl border border-dark-700 bg-dark-900/80 p-3">
                {parseHashtagChips(metadata.hashtags).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setMetadata({ ...metadata, hashtags: removeHashtag(metadata.hashtags, tag) })}
                    className="rounded-full border border-dark-600 bg-dark-800 px-3 py-1 text-xs text-gray-300 transition hover:border-crimson-600 hover:text-white"
                    title="กดเพื่อลบ tag นี้"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <Input value={metadata.hashtags} onChange={(event) => setMetadata({ ...metadata, hashtags: event.target.value })} placeholder="#hashtags" />
            </div>
          </GlassPanel>
        </div>
      </div>

      <div className="mt-6 grid gap-6 2xl:grid-cols-[430px_1fr]">
        <div>
          <TtsVoicePicker
            title={selectedTtsEngine.provider === "elevenlabs" ? "เลือกเสียงพากย์ ElevenLabs" : "เลือกเสียงพากย์ Google TTS"}
            description={
              voiceListLoading
                ? "กำลังโหลดรายชื่อเสียงจาก API..."
                : selectedTtsEngine.provider === "elevenlabs"
                  ? "แสดงเสียงที่บัญชี ElevenLabs นี้ใช้งานได้จริงจาก API และกด play เพื่อ preview ก่อนใช้จริง"
                  : "แสดงเสียงภาษาไทยที่โหลดได้จาก Google Text-to-Speech และกด play เพื่อ preview ก่อนใช้จริง"
            }
            voices={availableVoices}
            selectedVoiceId={voiceId}
            onSelect={selectVoice}
            onPreview={previewVoice}
          />
          <div className="mt-4 rounded-3xl border border-dark-700 bg-black/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-crimson-500">Dialogue Mode</p>
                <p className="mt-1 text-xs text-gray-500">ใช้เมื่อต้องการสลับเสียงตามบรรทัด เช่น ผู้เล่า: / วิญญาณ:</p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-crimson-700"
                  checked={dialogueMode}
                  onChange={(event) => setDialogueMode(event.target.checked)}
                />
                เปิดสลับเสียง
              </label>
            </div>
            <select
              className="mt-4 h-11 w-full rounded-xl border border-dark-600 bg-dark-900/90 px-4 text-sm text-gray-100"
              value={secondaryVoiceId}
              onChange={(event) => selectSecondaryVoice(event.target.value)}
              disabled={!dialogueMode}
            >
              {availableVoices.map((voice) => (
                <option key={voice.id} value={voice.id}>{voice.name} ({voice.id})</option>
              ))}
            </select>
          </div>
        </div>

        <AudioFxPanel
          settings={audioFx}
          assetsReady={audioAssetsReady}
          engineOptions={TTS_ENGINE_OPTIONS}
          selectedEngineId={selectedTtsEngine.id}
          audioProviderLabel={selectedTtsEngine.label}
          providerStatus={ttsProviderStatus}
          modelLabel={selectedTtsEngine.modelId}
          voiceLabel={selectedVoice ? `${selectedVoice.name} (${selectedVoice.id})` : voiceId}
          apiReady={Boolean(currentTtsKey)}
          checkingApi={ttsApiChecking}
          onCheckApi={handleCheckTtsApi}
          onSelectEngine={selectTtsEngine}
          onGenerateAssets={handleGenerateAudioAssets}
          generatingAssets={audioGenerating}
          scriptChars={scriptChars}
          estimatedCredits={estimatedCredits}
          limitSummary={limitSummary}
          status={ttsPreparing ? "กำลังสร้างเสียง..." : ttsPlaying ? "กำลังเล่นเสียง" : story.trim() ? "พร้อมเล่นเสียง" : "หยุดอยู่"}
          playing={ttsPlaying}
          preparing={ttsPreparing}
          disabled={!story.trim()}
          onChange={setAudioFx}
          onPlay={handlePlay}
          onStop={handleStopAudio}
          onExportFx={handleDownloadAudioWithFx}
          onExportRaw={handleDownloadAudio}
          onExportImage={exportThumbnail}
        />
        {false && (
          <div className="rounded-3xl border border-dark-700 bg-black/40 p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-crimson-500">เสียงพากย์ + Realtime FX</p>
            <h3 className="mt-2 text-xl font-black text-gray-100">ยังไม่เปิดแผงเสียง</h3>
            <p className="mt-2 text-sm text-gray-400">เลือก model ด้านขวาก่อน แล้วกดสร้างภาพ + เสียง ถึงจะเปิด player, export และ Audio FX realtime</p>
          </div>
        )}
      </div>
    </section>
  );
}

function extractTitle(story: string, keyword: string) {
  const firstLine = story.split("\n").find((line) => line.trim());
  return firstLine?.replace(/^#+\s*/, "").slice(0, 80) || `เรื่องเล่าจาก${keyword}`;
}

function createFallbackDescription(story: string, keyword: string) {
  const clean = story.replace(/\s+/g, " ").trim();
  const excerpt = clean.slice(0, 180);
  return excerpt ? `${excerpt}...` : `เรื่องเล่าผีจากคีย์เวิร์ด ${keyword} สร้างโดย GhostAI Studio`;
}

function parseMetadata(text: string, story: string, keyword: string): StudioMetadata {
  try {
    const jsonText = text.replace(/```json|```/g, "").trim();
    const data = JSON.parse(jsonText) as Partial<StudioMetadata>;
    return {
      title: data.title || extractTitle(story, keyword),
      description: data.description || createFallbackDescription(story, keyword),
      hashtags: data.hashtags || DEFAULT_METADATA.hashtags
    };
  } catch {
    return {
      title: extractTitle(story, keyword),
      description: createFallbackDescription(story, keyword),
      hashtags: DEFAULT_METADATA.hashtags
    };
  }
}

function parseHashtagChips(value: string) {
  const tags = value
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
  return Array.from(new Set(tags));
}

function removeHashtag(value: string, tagToRemove: string) {
  return parseHashtagChips(value).filter((tag) => tag !== tagToRemove).join(" ");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "ghostai-script";
}

function drawThumbnailCanvas(
  canvas: HTMLCanvasElement | null,
  payload: { title: string; style: string; durationMinutes: number; goreLevel: number; seed: number }
) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const width = canvas.width;
  const height = canvas.height;
  const rng = createSeededRandom(payload.seed);
  const hueShift = Math.floor(rng() * 24);
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#030303");
  gradient.addColorStop(0.46, hueShift > 12 ? "#240909" : "#1f0b0b");
  gradient.addColorStop(1, hueShift > 12 ? "#4c0519" : "#530808");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = 0.16;
  for (let index = 0; index < 42; index += 1) {
    const x = rng() * width;
    const y = rng() * height;
    const radius = 30 + rng() * 180;
    const mist = context.createRadialGradient(x, y, 0, x, y, radius);
    mist.addColorStop(0, `rgba(255,255,255,${0.06 + rng() * 0.08})`);
    mist.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = mist;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.18;
  context.strokeStyle = "#ffffff";
  for (let x = 0; x < width; x += 48) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += 48) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.restore();

  const glowX = 260 + rng() * 420;
  const glowY = 130 + rng() * 220;
  const glow = context.createRadialGradient(glowX, glowY, 20, glowX, glowY, 440);
  glow.addColorStop(0, "rgba(220,38,38,0.72)");
  glow.addColorStop(1, "rgba(220,38,38,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(0,0,0,0.52)";
  context.fillRect(0, height - 210, width, 210);

  context.save();
  context.globalAlpha = 0.18;
  context.fillStyle = "#dc2626";
  for (let index = 0; index < 7; index += 1) {
    const x = 780 + rng() * 430;
    const y = 70 + rng() * 430;
    context.fillRect(x, y, 6 + rng() * 14, 80 + rng() * 240);
  }
  context.restore();

  context.fillStyle = "#fecaca";
  context.font = "700 30px Arial";
  context.letterSpacing = "8px";
  context.fillText("GHOSTAI STUDIO", 70, 90);

  context.fillStyle = "#ffffff";
  context.shadowColor = "rgba(220,38,38,0.85)";
  context.shadowBlur = 26;
  context.font = "900 82px Arial";
  wrapCanvasText(context, payload.title, 70, 300, width - 140, 92, 3);
  context.shadowBlur = 0;

  context.fillStyle = "#d1d5db";
  context.font = "500 30px Arial";
  context.fillText(`${payload.style} � ${payload.durationMinutes} นาที � ${getHorrorLevelLabel(payload.goreLevel)} ${payload.goreLevel}%`, 70, height - 72);

  context.fillStyle = "rgba(127,29,29,0.88)";
  context.fillRect(width - 250, 54, 180, 58);
  context.fillStyle = "#fff1f2";
  context.font = "800 26px Arial";
  context.fillText("HAUNTED", width - 224, 92);
}

function getHorrorLevelLabel(level: number) {
  if (level >= 85) return "หลอนโหด";
  if (level >= 65) return "หลอนจัด";
  if (level >= 40) return "หลอนกดดัน";
  return "หลอนเบา";
}

function createSeededRandom(seed: number) {
  let state = Math.max(1, Math.floor(seed)) % 2147483647;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words.length ? words : [text]) {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
      continue;
    }
    line = testLine;
  }
  if (line) lines.push(line);

  lines.slice(0, maxLines).forEach((currentLine, index) => {
    const suffix = index === maxLines - 1 && lines.length > maxLines ? "..." : "";
    context.fillText(`${currentLine}${suffix}`, x, y + index * lineHeight);
  });
}







