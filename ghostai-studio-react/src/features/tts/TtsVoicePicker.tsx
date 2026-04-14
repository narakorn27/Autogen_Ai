import { CheckCircle2, Play } from "lucide-react";
import type { TtsVoice } from "@/types/tts";
import { cn } from "@/utils/cn";

type TtsVoicePickerProps = {
  title?: string;
  description?: string;
  voices: readonly TtsVoice[];
  selectedVoiceId: string;
  onSelect: (voiceId: string) => void;
  onPreview: (voiceId: string) => void;
};

export default function TtsVoicePicker({
  title = "เลือกเสียงพากย์",
  description = "เลือกเสียงหลักสำหรับ narration และกด play เพื่อ preview ก่อนใช้จริง",
  voices,
  selectedVoiceId,
  onSelect,
  onPreview
}: TtsVoicePickerProps) {
  return (
    <div className="space-y-4 rounded-3xl border border-crimson-950/60 bg-[#0c0b0b]/90 p-5">
      <div className="flex items-start justify-between gap-3 border-b border-dark-700/80 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-crimson-500">Voice Casting</p>
          <h3 className="mt-1 text-xl font-black text-gray-100">{title}</h3>
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        </div>
        <p className="shrink-0 rounded-full border border-dark-700 bg-black/40 px-3 py-1 text-xs text-gray-500">{voices.length} voices</p>
      </div>

      <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
        {!voices.length ? (
          <div className="rounded-xl border border-dark-700 bg-dark-950/70 p-4 text-sm text-gray-500">
            No voices available for this provider yet.
          </div>
        ) : null}
        {voices.map((voice) => {
          const selected = voice.id === selectedVoiceId;
          return (
            <button
              key={voice.id}
              type="button"
              onClick={() => onSelect(voice.id)}
              className={cn(
                "group flex w-full items-center gap-4 rounded-xl border border-dark-600 bg-dark-900/70 p-3 text-left transition-all hover:border-crimson-700 hover:bg-crimson-950/20",
                selected && "border-crimson-700 bg-crimson-950/35 shadow-[0_0_0_1px_rgba(220,38,38,0.35)]"
              )}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dark-600 bg-black/50 text-xs font-bold text-gray-300">
                {voice.gender === "M" ? "M" : "F"}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm font-bold text-gray-200", selected && "text-white")}>
                  {voice.name}
                </span>
                <span className={cn("block truncate text-xs text-gray-500", selected && "text-crimson-300")}>
                  {voice.desc}
                </span>
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onPreview(voice.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onPreview(voice.id);
                  }
                }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/60 text-gray-400 transition hover:text-white"
                aria-label={`preview ${voice.name}`}
              >
                <Play className="h-4 w-4" />
              </span>
              {selected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-crimson-500" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
