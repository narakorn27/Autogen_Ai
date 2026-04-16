const STORAGE_KEY = "gh_pending_studio_transfer";

export type PendingStudioTransfer = {
  title?: string;
  script: string;
  summary?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  statusMessage?: string;
};

export function savePendingStudioTransfer(payload: PendingStudioTransfer) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function consumePendingStudioTransfer(): PendingStudioTransfer | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(STORAGE_KEY);

  try {
    return JSON.parse(raw) as PendingStudioTransfer;
  } catch {
    return null;
  }
}
