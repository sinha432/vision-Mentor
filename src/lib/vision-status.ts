import { useEffect, useState } from "react";

export type Level = "good" | "warn" | "bad" | "idle";
export type Signal = { text: string; level: Level };

export type EnvironmentWarning = {
  id: string;
  message: string;
  level: "warn" | "bad";
};

export type VisionStatus = {
  eye: Signal;
  posture: Signal;
  /** grooming / formal wear read */
  grooming: Signal;
  /** number of people currently visible */
  people: number;
  /** phone in frame / in hand */
  phone: boolean;
  leftHand: Signal;
  rightHand: Signal;
  /** microphone environment read */
  audio: Signal;
  warnings: EnvironmentWarning[];
};

const INITIAL: VisionStatus = {
  eye: { text: "Waiting…", level: "idle" },
  posture: { text: "Waiting…", level: "idle" },
  grooming: { text: "Waiting…", level: "idle" },
  people: 0,
  phone: false,
  leftHand: { text: "Waiting…", level: "idle" },
  rightHand: { text: "Waiting…", level: "idle" },
  audio: { text: "Ready", level: "good" },
  warnings: [],
};

let current: VisionStatus = INITIAL;
const listeners = new Set<(s: VisionStatus) => void>();

/** Knowledge-based rule layer: turn raw signals into ranked warnings. */
function deriveWarnings(s: VisionStatus): EnvironmentWarning[] {
  const out: EnvironmentWarning[] = [];
  if (s.people > 2)
    out.push({ id: "people", message: "More than two people detected in frame", level: "bad" });
  if (s.phone)
    out.push({
      id: "phone",
      message: "Please don't use your phone during the interview",
      level: "bad",
    });
  if (s.audio.level === "bad")
    out.push({ id: "audio", message: `Audio disturbance — ${s.audio.text}`, level: "bad" });
  else if (s.audio.level === "warn")
    out.push({ id: "audio-warn", message: `Background noise — ${s.audio.text}`, level: "warn" });
  if (s.posture.level === "bad" || s.posture.level === "warn")
    out.push({
      id: "posture",
      message: `Posture — ${s.posture.text}`,
      level: s.posture.level === "bad" ? "bad" : "warn",
    });
  if (s.eye.level === "bad")
    out.push({ id: "eye", message: `Eye contact — ${s.eye.text}`, level: "warn" });
  if (s.grooming.level === "warn" || s.grooming.level === "bad")
    out.push({
      id: "grooming",
      message: `Appearance — ${s.grooming.text}`,
      level: s.grooming.level === "bad" ? "bad" : "warn",
    });
  // hard problems first
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "bad" ? -1 : 1));
}

export function patchVisionStatus(next: Partial<VisionStatus>) {
  const merged: VisionStatus = { ...current, ...next, warnings: [] };
  merged.warnings = deriveWarnings(merged);
  current = merged;
  listeners.forEach((l) => l(merged));
}

/** Back-compat helper used by the vision detector. */
export function setVisionStatus(next: Partial<VisionStatus>) {
  patchVisionStatus(next);
}

export function resetVisionStatus() {
  current = INITIAL;
  listeners.forEach((l) => l(INITIAL));
}

export function useVisionStatus(): VisionStatus {
  const [s, setS] = useState<VisionStatus>(current);
  useEffect(() => {
    const l = (v: VisionStatus) => setS(v);
    listeners.add(l);
    setS(current);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return s;
}
