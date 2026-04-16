export const ELEVEN_THAI_PREVIEW_TEXT = "คืนนี้ GhostAI จะเล่าเรื่องนี้ให้คุณฟัง ด้วยเสียงที่มาจากความมืด";

export function getElevenThaiPreviewFilename(voiceId: string) {
  return `${voiceId}.mp3`;
}

export function getElevenThaiPreviewPath(voiceId: string) {
  return `/previews/elevenlabs-th/${getElevenThaiPreviewFilename(voiceId)}`;
}
