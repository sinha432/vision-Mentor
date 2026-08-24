import { useState } from "react";
import { Bug, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DetectionSignals, StrikeKind } from "@/interviewer/lib/detection-types";
import type { ProctoringVisionResult, ProctoringAudioResult } from "@/interviewer/lib/proctoring.functions";

const STRIKE_LABELS: Record<StrikeKind, string> = {
  phone: "Phone",
  multiple_faces: "Multiple faces",
  second_voice: "Second voice",
  left_frame: "Left frame",
  left_tab: "Left tab",
};

/**
 * QA-only debug panel: raw per-frame detection signals, the latest Groq
 * vision/audio proctoring verdicts, per-kind strike counts and the two-strike
 * end reason (if any). Collapsed and hidden behind a small toggle by default —
 * never shown to candidates.
 */
export function ProctorDebugPanel({
  signals,
  strikes,
  endReason,
  lastVision,
  lastAudio,
}: {
  signals: DetectionSignals;
  strikes: Record<StrikeKind, number>;
  endReason: string | null;
  lastVision: ProctoringVisionResult | null;
  lastAudio: ProctoringAudioResult | null;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 font-display font-semibold text-amber-600 dark:text-amber-400"
      >
        <span className="flex items-center gap-1.5">
          <Bug className="h-3.5 w-3.5" /> QA proctor debug
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="mb-1 font-medium text-foreground/80">Per-frame signals</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10.5px] text-muted-foreground">
              <span>ready: {String(signals.ready)}</span>
              <span>degraded: {String(signals.degraded)}</span>
              <span>faces: {signals.faces}</span>
              <span>gaze: {signals.gaze}</span>
              <span>eyeContact: {signals.eyeContact}</span>
              <span>posture: {signals.posture}</span>
              <span>movement: {signals.movement}</span>
              <span>expression: {signals.expression}</span>
              <span>
                devices: {signals.devices.length ? signals.devices.map((d) => `${d.label}(${d.score})`).join(", ") : "none"}
              </span>
              <span>voiceLevel: {signals.voiceLevel}</span>
              <span>noiseLevel: {signals.noiseLevel}</span>
              <span>speaking: {String(signals.speaking)}</span>
              <span>backgroundVoice: {String(signals.backgroundVoice)}</span>
              <span>pauses: {signals.pauses}</span>
              <span>longestPause: {signals.longestPause}</span>
              <span>speechPace: {signals.speechPace}</span>
            </div>
          </div>

          <div>
            <p className="mb-1 font-medium text-foreground/80">Last Groq vision verdict</p>
            {lastVision ? (
              <p className="font-mono text-[10.5px] text-muted-foreground">
                phoneVisible: {String(lastVision.phoneVisible)} · confidence: {lastVision.phoneConfidence} ·
                notes: {lastVision.notes || "—"}
              </p>
            ) : (
              <p className="text-muted-foreground">none yet</p>
            )}
          </div>

          <div>
            <p className="mb-1 font-medium text-foreground/80">Last Groq audio verdict</p>
            {lastAudio ? (
              <p className="font-mono text-[10.5px] text-muted-foreground">
                secondSpeaker: {String(lastAudio.secondSpeaker)} · musicOrTv: {String(lastAudio.musicOrTv)} ·
                confidence: {lastAudio.confidence} · notes: {lastAudio.notes || "—"}
              </p>
            ) : (
              <p className="text-muted-foreground">none yet</p>
            )}
          </div>

          <div>
            <p className="mb-1 font-medium text-foreground/80">Strike counts</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STRIKE_LABELS) as StrikeKind[]).map((kind) => (
                <span
                  key={kind}
                  className={cn(
                    "rounded-full px-2 py-0.5 font-mono text-[10.5px]",
                    strikes[kind] > 0 ? "bg-destructive/15 text-destructive" : "bg-secondary/60 text-muted-foreground",
                  )}
                >
                  {STRIKE_LABELS[kind]}: {strikes[kind] ?? 0}
                </span>
              ))}
            </div>
          </div>

          {endReason && (
            <div className="rounded-lg bg-destructive/10 px-2 py-1.5 text-destructive">
              <span className="font-medium">Ended:</span> {endReason}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
