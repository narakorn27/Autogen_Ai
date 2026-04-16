import { loadSettings } from "@/services/settingsStorage";
import type {
  ExtractedYoutubeAudio,
  TranscriptHealth,
  TranscriptProviderInfo,
  TranscriptUploadRequest,
  TranscriptYoutubeRequest,
  TranscriptResult
} from "@/types/transcript";

function getConnectorUrl() {
  const { sttConnectorUrl } = loadSettings();
  return sttConnectorUrl.trim().replace(/\/+$/, "");
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || `HTTP ${response.status}` };
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data && typeof data.message === "string"
        ? data.message
        : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export async function checkHealth(): Promise<TranscriptHealth> {
  const connectorUrl = getConnectorUrl();
  if (!connectorUrl) throw new Error("Please configure STT Connector URL in Settings first.");
  const response = await fetch(`${connectorUrl}/api/health.php`);
  return parseResponse<TranscriptHealth>(response);
}

export async function listProviders(): Promise<TranscriptProviderInfo[]> {
  const connectorUrl = getConnectorUrl();
  if (!connectorUrl) throw new Error("Please configure STT Connector URL in Settings first.");
  const response = await fetch(`${connectorUrl}/api/providers.php`);
  const data = await parseResponse<{ providers?: TranscriptProviderInfo[] }>(response);
  return data.providers || [];
}

export async function transcribeYoutube(request: TranscriptYoutubeRequest): Promise<TranscriptResult> {
  const connectorUrl = getConnectorUrl();
  if (!connectorUrl) throw new Error("Please configure STT Connector URL in Settings first.");

  const response = await fetch(`${connectorUrl}/api/transcribe_youtube.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  return parseResponse<TranscriptResult>(response);
}

export async function transcribeUpload(request: TranscriptUploadRequest): Promise<TranscriptResult> {
  const connectorUrl = getConnectorUrl();
  if (!connectorUrl) throw new Error("Please configure STT Connector URL in Settings first.");

  const formData = new FormData();
  formData.append("file", request.file);
  formData.append("mode", request.mode);
  if (request.byoGoogleApiKey) formData.append("byoGoogleApiKey", request.byoGoogleApiKey);
  if (request.languageHint) formData.append("languageHint", request.languageHint);

  const response = await fetch(`${connectorUrl}/api/transcribe_upload.php`, {
    method: "POST",
    body: formData
  });

  return parseResponse<TranscriptResult>(response);
}

export async function extractYoutubeAudio(youtubeUrl: string): Promise<ExtractedYoutubeAudio> {
  const connectorUrl = getConnectorUrl();
  if (!connectorUrl) throw new Error("Please configure STT Connector URL in Settings first.");

  const response = await fetch(`${connectorUrl}/api/extract_youtube_audio.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ youtubeUrl })
  });

  return parseResponse<ExtractedYoutubeAudio>(response);
}

export async function testGoogleSttKey(apiKey: string): Promise<{ ok: boolean; message: string; detail?: string }> {
  const connectorUrl = getConnectorUrl();
  if (!connectorUrl) throw new Error("Please configure STT Connector URL in Settings first.");

  const response = await fetch(`${connectorUrl}/api/test_google_stt_key.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ apiKey })
  });

  return parseResponse<{ ok: boolean; message: string; detail?: string }>(response);
}
