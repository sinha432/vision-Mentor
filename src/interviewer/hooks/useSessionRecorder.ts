import { useCallback, useRef, useState } from "react";

/**
 * Records the candidate's webcam stream locally so the report can replay it
 * against the presence timeline. The clip never leaves the browser.
 */
export function useSessionRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);

  const start = useCallback((stream: MediaStream) => {
    if (recorderRef.current || typeof MediaRecorder === "undefined") {
      if (typeof MediaRecorder === "undefined") setSupported(false);
      return false;
    }
    const candidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ];
    const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported?.(type));
    try {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start(2000);
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setRecording(true);
      return true;
    } catch {
      setSupported(false);
      return false;
    }
  }, []);

  const stop = useCallback(async (): Promise<{
    blob: Blob;
    duration: number;
    mimeType: string;
  } | null> => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    if (!recorder) return null;
    const duration = Math.round((Date.now() - startedAtRef.current) / 1000);
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });
    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (!chunks.length) return null;
    const mimeType = recorder.mimeType || "video/webm";
    return { blob: new Blob(chunks, { type: mimeType }), duration, mimeType };
  }, []);

  return { start, stop, recording, supported };
}
