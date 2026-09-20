const MIC_ENABLED_KEY = "vmx.settings.mic-enabled";
export const MIC_ENABLED_EVENT = "vmx:mic-enabled-change";

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