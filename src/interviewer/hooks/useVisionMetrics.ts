import { useCallback, useEffect, useRef, useState } from "react";
import type { VisionMetrics } from "@/interviewer/lib/interview-types";

interface Accum {
  frames: number;
  centered: number;
  motion: number;
  brightness: number;
  blinks: number;
  timeline: { t: number; emotion: string; value: number }[];
}

/**
 * Lightweight in-browser presence analysis. Samples the webcam frame on a
 * canvas and derives heuristic engagement signals (framing, stillness,
 * attention, blink-like luminance dips) without shipping a heavy CV model.
 */
export function useVisionMetrics(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  active: boolean,
  onSample?: (sample: { eyeContact: number; posture: number; attention: number }) => void,
) {
  const sampleRef = useRef(onSample);
  sampleRef.current = onSample;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shotCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotRef = useRef<{ dataUrl: string; quality: number } | null>(null);
  const prevRef = useRef<Uint8ClampedArray | null>(null);
  const accumRef = useRef<Accum>({
    frames: 0,
    centered: 0,
    motion: 0,
    brightness: 0,
    blinks: 0,
    timeline: [],
  });
  const startRef = useRef(Date.now());
  const [live, setLive] = useState({ eyeContact: 0, attention: 0, posture: 0 });

  /**
   * Grab one full-size frame for the appearance review. Called a couple of
   * times during the session; the best-lit, best-framed frame wins.
   */
  const captureSnapshot = useCallback(
    (framing: number, brightness: number) => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      if (!shotCanvasRef.current) shotCanvasRef.current = document.createElement("canvas");
      const canvas = shotCanvasRef.current;
      const sourceWidth = video.videoWidth || 1280;
      const sourceHeight = video.videoHeight || 720;
      const scale = Math.min(1, 720 / sourceWidth);
      canvas.width = Math.max(640, Math.round(sourceWidth * scale));
      canvas.height = Math.max(360, Math.round(sourceHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // A frame that is too dark or washed out is useless for grooming feedback.
      const quality = framing * 100 - Math.abs(brightness - 0.55) * 120;
      if (snapshotRef.current && snapshotRef.current.quality >= quality) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        snapshotRef.current = { dataUrl: canvas.toDataURL("image/jpeg", 0.84), quality };
      } catch {
        /* tainted canvas — skip the appearance review */
      }
    },
    [videoRef],
  );

  useEffect(() => {
    if (!active) return;
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;
    canvas.width = 64;
    canvas.height = 48;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const interval = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

      let motion = 0;
      const prev = prevRef.current;
      if (prev) {
        for (let i = 0; i < data.length; i += 16) {
          motion += Math.abs(data[i] - prev[i]);
        }
        motion /= data.length / 16;
      }
      prevRef.current = new Uint8ClampedArray(data);

      // Brightness of the centre band vs. the frame: a face fills the middle.
      let centreSum = 0;
      let centreCount = 0;
      let frameSum = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
          frameSum += lum;
          if (
            y > canvas.height * 0.15 &&
            y < canvas.height * 0.75 &&
            x > canvas.width * 0.25 &&
            x < canvas.width * 0.75
          ) {
            centreSum += lum;
            centreCount += 1;
          }
        }
      }
      const centre = centreSum / Math.max(1, centreCount);
      const frame = frameSum / (canvas.width * canvas.height);
      const framing = Math.max(0, Math.min(1, (centre - frame) * 4 + 0.55));

      const a = accumRef.current;
      a.frames += 1;
      a.centered += framing;
      a.motion += motion;
      a.brightness += centre;
      if (motion > 6 && motion < 14) a.blinks += 1;

      const eyeContact = Math.round(framing * 100);
      const attention = Math.round(Math.max(0, 100 - Math.min(100, motion * 6)));
      const posture = Math.round(Math.max(0, Math.min(100, 100 - Math.abs(framing - 0.72) * 190)));
      setLive({ eyeContact, attention, posture });
      // ~1s cadence for the replay presence track.
      if (a.frames % 2 === 0) sampleRef.current?.({ eyeContact, posture, attention });

      if (a.frames % 6 === 0) {
        const t = Math.round((Date.now() - startRef.current) / 1000);
        const emotion = attention > 78 ? "engaged" : attention > 55 ? "neutral" : "distracted";
        a.timeline.push({ t, emotion, value: attention });
        if (a.timeline.length > 120) a.timeline.shift();
      }

      // Keep the best frame continuously so short interviews and report-time
      // appearance checks never depend on reaching a fixed checkpoint.
      if (a.frames <= 20 || a.frames % 20 === 0) {
        captureSnapshot(framing, centre);
      }
    }, 500);

    return () => window.clearInterval(interval);
  }, [active, videoRef, captureSnapshot]);

  const summarize = useCallback((): VisionMetrics => {
    const a = accumRef.current;
    if (!a.frames)
      return {
        eyeContact: 0,
        attention: 0,
        posture: 0,
        blinkRate: 0,
        emotionTimeline: [],
        enabled: false,
      };
    const framing = a.centered / a.frames;
    const motion = a.motion / a.frames;
    const minutes = Math.max(0.5, (Date.now() - startRef.current) / 60000);
    return {
      eyeContact: Math.round(Math.min(100, framing * 118)),
      attention: Math.round(Math.max(0, 100 - Math.min(100, motion * 6))),
      posture: Math.round(Math.max(0, Math.min(100, 100 - Math.abs(framing - 0.72) * 190))),
      blinkRate: Math.round(a.blinks / minutes),
      emotionTimeline: a.timeline.slice(-60),
      enabled: true,
    };
  }, []);

  const getSnapshot = useCallback(() => snapshotRef.current?.dataUrl ?? null, []);

  const captureSnapshotNow = useCallback(async (): Promise<string | null> => {
  const video = videoRef.current;

  if (!video) return null;

  // Wait until the camera has produced real video dimensions.
  const waitForVideo = async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        return true;
      }

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 100);
      });
    }

    return false;
  };

  const ready = await waitForVideo();

  if (!ready) {
    console.warn("[Appearance] Camera video was not ready for capture.");
    return null;
  }

  if (!shotCanvasRef.current) {
    shotCanvasRef.current = document.createElement("canvas");
  }

  const canvas = shotCanvasRef.current;

  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;

  // Keep enough resolution for hair, beard and clothing analysis.
  const maxWidth = 1280;
  const scale = Math.min(1, maxWidth / sourceWidth);

  canvas.width = Math.max(640, Math.round(sourceWidth * scale));
  canvas.height = Math.max(360, Math.round(sourceHeight * scale));

  const ctx = canvas.getContext("2d", {
    alpha: false,
    willReadFrequently: false,
  });

  if (!ctx) {
    console.warn("[Appearance] Could not create capture canvas.");
    return null;
  }

  // Clear any previous frame.
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Capture the CURRENT camera frame.
  ctx.drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  try {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    if (!dataUrl.startsWith("data:image/jpeg")) {
      console.warn("[Appearance] Invalid camera image generated.");
      return null;
    }

    // Reject suspiciously tiny images.
    if (dataUrl.length < 20_000) {
      console.warn(
        "[Appearance] Captured image is unexpectedly small:",
        dataUrl.length,
      );
      return null;
    }

    snapshotRef.current = {
      dataUrl,
      quality: 100,
    };

    console.info("[Appearance] Fresh camera frame captured", {
      width: canvas.width,
      height: canvas.height,
      bytes: dataUrl.length,
    });

    return dataUrl;
  } catch (error) {
    console.error("[Appearance] Failed to encode camera frame:", error);
    return null;
  }
}, [videoRef]);

  return { live, summarize, getSnapshot, captureSnapshotNow };
}
