const MIC_ENABLED_KEY = "vmx.settings.mic-enabled";
const CAMERA_ENABLED_KEY = "vmx.settings.camera-enabled";
export const MIC_ENABLED_EVENT = "vmx:mic-enabled-change";
export const CAMERA_ENABLED_EVENT = "vmx:camera-enabled-change";

export function readMicEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const value = window.localStorage.getItem(MIC_ENABLED_KEY);
  return value === null ? true : value === "true";
}

export function writeMicEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MIC_ENABLED_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent(MIC_ENABLED_EVENT, { detail: enabled }));
}

export function readCameraEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const value = window.localStorage.getItem(CAMERA_ENABLED_KEY);
  return value === "true";
}

export function writeCameraEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CAMERA_ENABLED_KEY, String(enabled));
  window.dispatchEvent(new CustomEvent(CAMERA_ENABLED_EVENT, { detail: enabled }));
}