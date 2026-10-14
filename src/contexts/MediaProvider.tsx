import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  CAMERA_ENABLED_EVENT,
  MIC_ENABLED_EVENT,
  readCameraEnabled,
  readMicEnabled,
  writeCameraEnabled,
  writeMicEnabled,
} from "@/interviewer/lib/media-settings";

type MediaState = {
  stream: MediaStream | null;
  cameraEnabled: boolean;
  micEnabled: boolean;
  cameraConnected: boolean;
  micConnected: boolean;
  cameraStatus: "disabled" | "requesting" | "connected" | "denied" | "unavailable" | "ended";
  micStatus: "disabled" | "requesting" | "connected" | "denied" | "unavailable" | "ended";
  error: string | null;
  setCameraEnabled: (enabled: boolean) => void;
  setMicEnabled: (enabled: boolean) => void;
};

function accessFailureStatus(error: unknown): "denied" | "unavailable" {
  return error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "PermissionDeniedError")
    ? "denied"
    : "unavailable";
}

const MediaContext = createContext<MediaState | null>(null);

function trackIsLive(track: MediaStreamTrack | undefined) {
  return track?.readyState === "live";
}

export function MediaProvider({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const mediaRoute = pathname === "/" || pathname === "/chatbot" || pathname.startsWith("/interviewer");
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabledState] = useState(readCameraEnabled);
  const [micEnabled, setMicEnabledState] = useState(readMicEnabled);
  const [cameraConnected, setCameraConnected] = useState(false);
  const [micConnected, setMicConnected] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<MediaState["cameraStatus"]>("disabled");
  const [micStatus, setMicStatus] = useState<MediaState["micStatus"]>("disabled");
  const [error, setError] = useState<string | null>(null);

  const refreshConnection = useCallback(() => {
    const current = streamRef.current;
    setCameraConnected(trackIsLive(current?.getVideoTracks()[0]));
    setMicConnected(trackIsLive(current?.getAudioTracks()[0]));
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    refreshConnection();
  }, [refreshConnection]);

  const acquire = useCallback(async (wantCamera: boolean, wantMic: boolean) => {
    const requestId = ++requestRef.current;
    stopTracks();
    setCameraStatus(wantCamera ? "requesting" : "disabled");
    setMicStatus(wantMic ? "requesting" : "disabled");
    if (!wantCamera && !wantMic) {
      setError(null);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera or microphone access is not available in this browser.");
      if (wantCamera) setCameraStatus("unavailable");
      if (wantMic) setMicStatus("unavailable");
      return;
    }

    const tracks: MediaStreamTrack[] = [];
    let nextCameraStatus: MediaState["cameraStatus"] = wantCamera ? "unavailable" : "disabled";
    let nextMicStatus: MediaState["micStatus"] = wantMic ? "unavailable" : "disabled";
    try {
      const combined = await navigator.mediaDevices.getUserMedia({ video: wantCamera, audio: wantMic });
      tracks.push(...combined.getTracks());
      nextCameraStatus = wantCamera && combined.getVideoTracks().length ? "connected" : nextCameraStatus;
      nextMicStatus = wantMic && combined.getAudioTracks().length ? "connected" : nextMicStatus;
    } catch {
      if (wantCamera) {
        try {
          const camera = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          tracks.push(...camera.getVideoTracks());
          nextCameraStatus = camera.getVideoTracks().length ? "connected" : "unavailable";
        } catch (error) { nextCameraStatus = accessFailureStatus(error); }
      }
      if (wantMic) {
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          tracks.push(...mic.getAudioTracks());
          nextMicStatus = mic.getAudioTracks().length ? "connected" : "unavailable";
        } catch (error) { nextMicStatus = accessFailureStatus(error); }
      }
    }

    if (requestId !== requestRef.current) {
      tracks.forEach((track) => track.stop());
      return;
    }
    if (tracks.length) {
      const next = new MediaStream(tracks);
      streamRef.current = next;
      setStream(next);
      setError(null);
      tracks.forEach((track) => track.addEventListener("ended", () => {
        if (streamRef.current !== next) return;
        if (track.kind === "video") setCameraStatus("ended");
        if (track.kind === "audio") setMicStatus("ended");
        refreshConnection();
      }));
    } else {
      setError("Camera or microphone access was denied.");
    }
    setCameraStatus(nextCameraStatus);
    setMicStatus(nextMicStatus);
    refreshConnection();
  }, [refreshConnection, stopTracks]);

  useEffect(() => {
    const onCamera = (event: Event) => setCameraEnabledState((event as CustomEvent<boolean>).detail);
    const onMic = (event: Event) => setMicEnabledState((event as CustomEvent<boolean>).detail);
    window.addEventListener(CAMERA_ENABLED_EVENT, onCamera);
    window.addEventListener(MIC_ENABLED_EVENT, onMic);
    return () => {
      window.removeEventListener(CAMERA_ENABLED_EVENT, onCamera);
      window.removeEventListener(MIC_ENABLED_EVENT, onMic);
    };
  }, []);

  useEffect(() => {
    if (!mediaRoute) return;
    void acquire(cameraEnabled, micEnabled);
  }, [acquire, cameraEnabled, mediaRoute, micEnabled]);

  useEffect(() => () => {
    requestRef.current += 1;
    stopTracks();
  }, [stopTracks]);

  const setCameraEnabled = useCallback((enabled: boolean) => {
    writeCameraEnabled(enabled);
    setCameraEnabledState(enabled);
  }, []);
  const setMicEnabled = useCallback((enabled: boolean) => {
    writeMicEnabled(enabled);
    setMicEnabledState(enabled);
  }, []);

  const value = useMemo(
    () => ({ stream, cameraEnabled, micEnabled, cameraConnected, micConnected, cameraStatus, micStatus, error, setCameraEnabled, setMicEnabled }),
    [stream, cameraEnabled, micEnabled, cameraConnected, micConnected, cameraStatus, micStatus, error, setCameraEnabled, setMicEnabled],
  );
  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

export function useMedia() {
  const value = useContext(MediaContext);
  if (!value) throw new Error("useMedia must be used inside MediaProvider");
  return value;
}