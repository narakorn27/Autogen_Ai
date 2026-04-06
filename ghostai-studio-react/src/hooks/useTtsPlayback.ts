import { useCallback, useState } from "react";
import type { TtsPlaybackState } from "@/types/tts";

export function useTtsPlayback() {
  const [state, setState] = useState<TtsPlaybackState>({
    playing: false,
    preparing: false,
    error: null
  });

  const markPreparing = useCallback(() => {
    setState({ playing: false, preparing: true, error: null });
  }, []);

  const markStopped = useCallback(() => {
    setState({ playing: false, preparing: false, error: null });
  }, []);

  const markError = useCallback((error: string) => {
    setState({ playing: false, preparing: false, error });
  }, []);

  return { state, markPreparing, markStopped, markError };
}
