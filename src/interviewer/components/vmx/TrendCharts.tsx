import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DetectionSample } from "@/interviewer/lib/detection-types";
import type { RecordingMeta, Turn } from "@/interviewer/lib/interview-types";
import { getRecording } from "@/interviewer/lib/recording-store";

function clock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Interactive session trend graphs: confidence, posture, eye contact and
 * emotion always come from the detection track; speaking pace and filler-word
 * frequency render only when the per-sample fields exist. Clicking a point
 * seeks the replay clip to that timestamp.
 */
export function TrendCharts({
  samples,
  turns,
  createdAt,
  recording,
}: {
  samples: DetectionSample[];
  turns: Turn[];
  createdAt: number;
  recording?: RecordingMeta | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!recording?.id) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void getRecording(recording.id).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [recording?.id]);

  const data = useMemo(
    () =>
      samples.map((s) => {
        const extra = s as DetectionSample & {
          speakingPace?: number;
          fillerRate?: number;
        };
        return {
          t: s.t,
          time: clock(s.t),
          confidence: s.confidence,
          posture: s.posture,
          eyeContact: s.eyeContact,
          attention: s.attention,
          speakingPace: typeof extra.speakingPace === "number" ? extra.speakingPace : undefined,
          fillerRate: typeof extra.fillerRate === "number" ? extra.fillerRate : undefined,
          emotion: s.emotion,
        };
      }),
    [samples],
  );

  const hasPace = data.some((d) => typeof d.speakingPace === "number");
  const hasFiller = data.some((d) => typeof d.fillerRate === "number");

  const markers = useMemo(
    () =>
      turns
        .filter((t) => t.question)
        .map((t, i) => ({
          t: Math.max(0, Math.round((t.askedAt - createdAt) / 1000)),
          label: `Q${i + 1}`,
        })),
    [turns, createdAt],
  );

  function seek(t: unknown) {
    const seconds = typeof t === "number" ? t : Number(t);
    if (!Number.isFinite(seconds) || !videoRef.current) return;
    videoRef.current.currentTime = seconds;
    void videoRef.current.play().catch(() => {});
  }

  if (data.length === 0) {
    return (
      <section className="rounded-2xl glass p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <LineChartIcon className="h-4 w-4 text-primary" /> Session trends
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          No per-second telemetry was recorded for this session (camera may have been off, or
          on-device detection did not run) — trend graphs need that track to render.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl glass p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <LineChartIcon className="h-4 w-4 text-primary" /> Session trends
        </h2>
        <p className="text-xs text-muted-foreground">Click any point to jump the replay there.</p>
      </div>

      {url && (
        <video
          ref={videoRef}
          src={url}
          controls
          playsInline
          className="mt-4 w-full max-w-md rounded-xl border border-border/70 bg-black"
        />
      )}

      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} onClick={(e) => e && seek(e.activeLabel)}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
            <XAxis dataKey="t" tickFormatter={(v) => clock(Number(v))} className="text-[10px]" />
            <YAxis domain={[0, 100]} className="text-[10px]" />
            <Tooltip
              labelFormatter={(v) => `t = ${clock(Number(v))}`}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {markers.map((m) => (
              <ReferenceLine
                key={m.label}
                x={m.t}
                stroke="oklch(0.7 0.15 25)"
                strokeDasharray="4 3"
                label={{ value: m.label, position: "top", fontSize: 10 }}
              />
            ))}
            <Line type="monotone" dataKey="confidence" name="Confidence" stroke="oklch(0.79 0.144 191)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="posture" name="Posture" stroke="oklch(0.78 0.16 140)" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="eyeContact" name="Eye contact" stroke="oklch(0.82 0.14 85)" dot={false} strokeWidth={2} />
            {hasPace && (
              <Line type="monotone" dataKey="speakingPace" name="Speaking pace" stroke="oklch(0.65 0.2 300)" dot={false} strokeWidth={2} />
            )}
            {hasFiller && (
              <Line type="monotone" dataKey="fillerRate" name="Filler-word rate" stroke="oklch(0.65 0.2 25)" dot={false} strokeWidth={2} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {!hasPace && !hasFiller && (
        <p className="mt-2 text-xs text-muted-foreground">
          Speaking-pace and filler-word trend lines appear once per-second delivery telemetry is
          captured for a session.
        </p>
      )}
    </section>
  );
}
