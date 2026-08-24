import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileJson, Film, Loader2, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SeverityChip } from "@/interviewer/components/vmx/PresenceCoach";
import { proctorSeverity } from "@/interviewer/lib/coach-priority";
import {
  COACH_AREA_LABELS,
  FORENSICS_LABELS,
  PROCTOR_LABELS,
  type CoachingEvent,
  type FlagSeverity,
  type ForensicsFinding,
  type PresenceSample,
  type ProctorEvent,
  type RecordingMeta,
} from "@/interviewer/lib/interview-types";
import { deleteRecording, getRecording } from "@/interviewer/lib/recording-store";
import { exportIntegrityLog, exportMarkedReplay } from "@/interviewer/lib/replay-export";
import { cn } from "@/lib/utils";

interface Marker {
  t: number;
  kind: "coach" | "proctor" | "forensics";
  label: string;
  detail: string;
  severity: FlagSeverity;
  confidence?: number;
  reason?: string;
}

const SEVERITY_STROKE: Record<FlagSeverity, string> = {
  high: "oklch(0.65 0.2 25)",
  medium: "oklch(0.82 0.15 80)",
  low: "oklch(0.7 0.03 250)",
};

const W = 900;
const H = 120;

function line(samples: PresenceSample[], span: number, pick: (s: PresenceSample) => number) {
  return samples
    .map(
      (s) =>
        `${(Math.min(s.t, span) / span) * W},${H - (Math.max(0, Math.min(100, pick(s))) / 100) * H}`,
    )
    .join(" ");
}

function clock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Interview replay: the locally stored webcam clip with the presence track and
 * every coaching / integrity detection overlaid on a scrubbable timeline.
 */
export function ReplayTimeline({
  sessionId,
  recording,
  presence,
  coaching,
  proctor,
  duration,
  forensics = [],
  forensicsLoading = false,
}: {
  sessionId: string;
  recording?: RecordingMeta | null;
  presence: PresenceSample[];
  coaching: CoachingEvent[];
  proctor: ProctorEvent[];
  duration: number;
  /** Post-interview forensics findings, pinned to a replay timestamp. */
  forensics?: ForensicsFinding[];
  forensicsLoading?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [active, setActive] = useState<Marker | null>(null);
  const [cursor, setCursor] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!recording?.id) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void getRecording(recording.id).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setMissing(true);
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [recording?.id]);

  const markers = useMemo<Marker[]>(
    () =>
      [
        ...coaching.map<Marker>((c) => ({
          t: c.t,
          kind: "coach",
          label: COACH_AREA_LABELS[c.area],
          detail: c.instruction,
          severity: c.severity ?? "low",
          confidence: c.confidence,
          reason: c.reason,
        })),
        ...proctor.map<Marker>((p) => ({
          t: p.t,
          kind: "proctor",
          label: PROCTOR_LABELS[p.kind],
          detail: p.detail,
          severity: p.severity ?? proctorSeverity(p.kind),
          confidence: p.confidence,
        })),
        ...forensics.map<Marker>((f) => ({
          t: f.t,
          kind: "forensics",
          label: FORENSICS_LABELS[f.kind],
          detail: f.detail,
          severity: f.severity,
          confidence: f.confidence,
        })),
      ].sort((a, b) => a.t - b.t),
    [coaching, proctor, forensics],
  );

  const span = Math.max(30, duration, presence.at(-1)?.t ?? 0, markers.at(-1)?.t ?? 0);

  function seek(marker: Marker) {
    setActive(marker);
    setCursor(marker.t);
    const video = videoRef.current;
    if (video) {
      video.currentTime = Math.max(0, marker.t);
      void video.play().catch(() => {});
    }
  }

  async function removeClip() {
    if (!recording?.id) return;
    await deleteRecording(recording.id);
    setUrl(null);
    setMissing(true);
  }

  async function exportVideo() {
    if (!recording?.id || exporting) return;
    const blob = await getRecording(recording.id);
    if (!blob) {
      toast.error("The recording is no longer stored on this device.");
      return;
    }
    setExporting(true);
    setProgress(0);
    const ok = await exportMarkedReplay({
      sessionId,
      blob,
      markers,
      presence,
      onProgress: setProgress,
    });
    setExporting(false);
    if (ok) toast.success("Marked replay exported.");
    else toast.error("Could not export the replay in this browser.");
  }

  return (
    <section className="rounded-2xl glass p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Film className="h-4 w-4 text-primary" /> Replay & detections
          {forensicsLoading && (
            <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Running replay forensics…
            </span>
          )}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {url && (
            <Button size="sm" onClick={() => void exportVideo()} disabled={exporting}>
              {exporting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              {exporting ? `Exporting ${Math.round(progress * 100)}%` : "Export marked replay"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportIntegrityLog({ sessionId, coaching, proctor, presence })}
          >
            <FileJson className="mr-1.5 h-3.5 w-3.5" /> Export integrity log
          </Button>
          {url && (
            <Button variant="outline" size="sm" onClick={() => void removeClip()}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete recording
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <div>
          {url ? (
            <video
              ref={videoRef}
              src={url}
              controls
              playsInline
              onTimeUpdate={(e) => setCursor(e.currentTarget.currentTime)}
              className="w-full rounded-xl border border-border/70 bg-black"
            />
          ) : (
            <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 text-sm text-muted-foreground">
              <Video className="h-5 w-5" />
              {missing
                ? "The recording for this session is no longer stored on this device."
                : "No recording was captured — the timeline below still shows every detection."}
            </div>
          )}

          {/* Presence track */}
          <div className="mt-4 rounded-xl bg-secondary/35 p-3">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" preserveAspectRatio="none">
              {[0.25, 0.5, 0.75].map((g) => (
                <line
                  key={g}
                  x1="0"
                  x2={W}
                  y1={H * g}
                  y2={H * g}
                  stroke="currentColor"
                  className="text-border"
                  strokeWidth="1"
                />
              ))}
              <polyline
                points={line(presence, span, (s) => s.eyeContact)}
                fill="none"
                stroke="oklch(0.79 0.144 191)"
                strokeWidth="2.5"
              />
              <polyline
                points={line(presence, span, (s) => s.posture)}
                fill="none"
                stroke="oklch(0.78 0.16 140)"
                strokeWidth="2.5"
              />
              <polyline
                points={line(presence, span, (s) => s.attention)}
                fill="none"
                stroke="oklch(0.82 0.14 85)"
                strokeWidth="2"
                strokeDasharray="5 4"
              />
              {markers.map((m, i) => (
                <g key={`${m.t}-${i}`} onClick={() => seek(m)} className="cursor-pointer">
                  <line
                    x1={(Math.min(m.t, span) / span) * W}
                    x2={(Math.min(m.t, span) / span) * W}
                    y1="0"
                    y2={H}
                    stroke={SEVERITY_STROKE[m.severity]}
                    strokeWidth="2.5"
                    opacity={active?.t === m.t ? 1 : 0.65}
                  />
                  <circle
                    cx={(Math.min(m.t, span) / span) * W}
                    cy="8"
                    r="7"
                    fill={SEVERITY_STROKE[m.severity]}
                  />
                </g>
              ))}
              <line
                x1={(Math.min(cursor, span) / span) * W}
                x2={(Math.min(cursor, span) / span) * W}
                y1="0"
                y2={H}
                stroke="currentColor"
                className="text-foreground"
                strokeWidth="1.5"
              />
            </svg>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
              <Legend color="oklch(0.79 0.144 191)" label="Eye contact" />
              <Legend color="oklch(0.78 0.16 140)" label="Posture" />
              <Legend color="oklch(0.82 0.14 85)" label="Attention" />
              <Legend color={SEVERITY_STROKE.high} label="High severity" />
              <Legend color={SEVERITY_STROKE.medium} label="Medium" />
              <span className="ml-auto tabular-nums">
                {clock(cursor)} / {clock(span)}
              </span>
            </div>
          </div>

          {active && (
            <p className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-sm">
              <span className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-primary">
                {clock(active.t)} · {active.label}
                <SeverityChip severity={active.severity} />
                {typeof active.confidence === "number" && (
                  <span className="text-muted-foreground">
                    {Math.round(active.confidence)}% confidence
                  </span>
                )}
              </span>
              <span className="mt-1 block">{active.detail}</span>
              {active.reason && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  Detected because: {active.reason}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Detection log */}
        <div className="max-h-[26rem] overflow-y-auto pr-1">
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Detections ({markers.length})
          </h3>
          {markers.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {forensicsLoading
                ? "Nothing flagged so far — the replay forensics pass is still analysing sampled frames."
                : "No coaching nudges, integrity flags, or replay forensics findings were raised — this session read clean end to end."}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {markers.map((m, i) => (
                <li key={`${m.t}-log-${i}`}>
                  <button
                    type="button"
                    onClick={() => seek(m)}
                    className={cn(
                      "w-full rounded-lg border border-border/70 px-3 py-2 text-left text-xs transition-colors hover:border-primary/50 hover:bg-secondary/50",
                      active?.t === m.t &&
                        active.label === m.label &&
                        "border-primary/60 bg-secondary/50",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {(m.kind === "proctor" || m.kind === "forensics") && (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                      )}
                      <span className="tabular-nums text-primary">{clock(m.t)}</span>
                      <span className="font-medium">{m.label}</span>
                      <SeverityChip severity={m.severity} />
                      {typeof m.confidence === "number" && (
                        <span className="ml-auto tabular-nums text-[10px] text-muted-foreground">
                          {Math.round(m.confidence)}%
                        </span>
                      )}
                    </span>
                    {typeof m.confidence === "number" && (
                      <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.max(4, Math.min(100, m.confidence))}%`,
                            background: SEVERITY_STROKE[m.severity],
                          }}
                        />
                      </span>
                    )}
                    {m.detail && (
                      <span className="mt-1 block text-muted-foreground">{m.detail}</span>
                    )}
                    {m.reason && (
                      <span className="mt-1 block text-[11px] text-muted-foreground/80">
                        Why: {m.reason}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 w-4 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
