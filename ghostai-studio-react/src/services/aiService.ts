import type { AiConnectionResult, StoryGenerationRequest } from "@/types/ai";

export async function testAiConnection(provider: string, apiKey: string): Promise<AiConnectionResult> {
  if (!apiKey.trim()) {
    return { success: false, message: `ยังไม่มี API key สำหรับ ${provider}` };
  }

  return {
    success: true,
    message: `เตรียม service สำหรับทดสอบ ${provider} แล้ว แต่ยังไม่ได้ย้าย logic API จริงเข้ามา`
  };
}

export async function generateStoryDraft(request: StoryGenerationRequest): Promise<string> {
  return `ร่างเรื่องจาก keyword: ${request.keyword}\n\nไฟล์ aiService.ts เตรียมไว้สำหรับย้าย logic จาก story-gen.js ในเฟสถัดไป`;
}
