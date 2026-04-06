import type { TtsSynthesisRequest } from "@/types/tts";

export async function synthesizeNarration(request: TtsSynthesisRequest): Promise<Blob | null> {
  console.info("[GhostAI] เตรียมย้าย logic TTS เข้ามาใน ttsService", request);
  return null;
}
