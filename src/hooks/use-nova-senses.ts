import { useCallback, useEffect, useRef, useState } from "react";
import { AudioMonitor } from "@/lib/audio-monitor";
import { VisionDetector } from "@/lib/vision-detector";
import { useVisionStatus, type VisionStatus } from "@/lib/vision-status";

export interface NovaSenses {
  /** attach to a <video> element so Nova can see through the camera */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraOn: boolean;
  micOn: boolean;
  /** 0..1 live microphone loudness */
  micLevel: number;
  error: string | null;
  status: VisionStatus;
  enable: (opts?: { camera?: boolean; mic?: boolean }) => Promise<void>;
  disable: () => void;
}

/**
 * Opt-in camera + microphone sensing. Camera frames run through the vision
 * detector (face count, posture, grooming, phone) and mic audio through the
 * audio monitor (noise, multiple voices). Everything stops on unmount.
 */
export function useNovaSenses(): NovaSenses {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<VisionDetector | null>(null);
  const audioRef = useRef<AudioMonitor | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const status = useVisionStatus();

  const disable = useCallback(() => {
    detectorRef.current?.stop();
    detectorRef.current = null;
    audioRef.current?.stop();
    audioRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setMicOn(false);
    setMicLevel(0);
  }, []);

  const enable = useCallback(
    async ({ camera = true, mic = true }: { camera?: boolean; mic?: boolean } = {}) => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot access the camera or microphone.");
        return;
      }
      disable();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: camera
            ? {
                width: { ideal: 1280, max: 1280 },
                height: { ideal: 720, max: 720 },
                frameRate: { ideal: 24, max: 30 },
                facingMode: "user",
              }
            : false,
          audio: mic
            ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            : false,
        });
        streamRef.current = stream;
        setError(null);

        if (camera && stream.getVideoTracks().length) {
          const el = videoRef.current;
          if (el) {
            el.srcObject = stream;
            try {
              await el.play();
            } catch {
              /* autoplay guard */
            }
            const detector = new VisionDetector();
            detectorRef.current = detector;
            void detector.start(el);
          }
          setCameraOn(true);
        }

        if (mic && stream.getAudioTracks().length) {
          const monitor = new AudioMonitor();
          monitor.onLevel(setMicLevel);
          monitor.start(stream);
          audioRef.current = monitor;
          setMicOn(true);
        }
      } catch {
        setError("Camera or microphone permission was denied.");
        disable();
      }
    },
    [disable],
  );

  // stop sensing when the tab is hidden, and always clean up on unmount
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") disable();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      disable();
    };
  }, [disable]);

  return { videoRef, cameraOn, micOn, micLevel, error, status, enable, disable };
}
