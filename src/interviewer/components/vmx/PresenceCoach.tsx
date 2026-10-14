import {
  SEVERITY_LABELS,
  type AppearanceAnalysisStatus,
  type AppearanceReview,
  type CoachingEvent,
  type FlagSeverity,
} from "@/interviewer/lib/interview-types";
import { Eye, Loader2, PersonStanding, Scissors, Shirt, Sparkles, Waves } from "lucide-react";
import { byPriority } from "@/interviewer/lib/coach-priority";
import { cn } from "@/lib/utils";

const ICONS = {
  posture: PersonStanding,
  eye_contact: Eye,
  hair: Scissors,
  grooming: Sparkles,
  attire: Shirt,
  framing: Eye,
  delivery: Waves,
} as const;

export const SEVERITY_STYLES: Record<FlagSeverity, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-warning/15 text-warning border-warning/30",
  low: "bg-secondary/60 text-muted-foreground border-border",
};

export function SeverityChip({ severity }: { severity: FlagSeverity }) {
  return (
    <span
      className={cn(
        "rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        SEVERITY_STYLES[severity],
      )}
    >
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

export function PresenceCoach({
  events,
  checking,
  enabled,
  lastCaptureAt,
  appearance,
  appearanceStatus,
  appearanceError,
  className,
}: {
  events: CoachingEvent[];
  appearance?: AppearanceReview | null;
  appearanceStatus?: AppearanceAnalysisStatus;
  appearanceError?: string | null;
  checking: boolean;
  enabled: boolean;
  lastCaptureAt?: number | null;
  className?: string;
}) {
  // Most urgent first so the biggest fix is always on top.
  const latest = [...events.slice(-8)].sort(byPriority).slice(0, 3);

  return (
    <section className={cn("rounded-2xl glass p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Presence coach</h2>
        {checking ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        ) : enabled && lastCaptureAt ? (
          <span className="text-[10px] text-success">Camera frame captured</span>
        ) : null}
      </div>
      {appearance?.assessed && (
        <div className="mt-3 rounded-lg border border-border/70 p-3">
          <h3 className="text-xs font-semibold">Latest live appearance check</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {[
              { label: "Formal attire", assessment: appearance.attire },
              { label: "Hair", assessment: appearance.hair },
              { label: "Beard & grooming", assessment: appearance.grooming },
            ].map(({ label, assessment }) => (
              <div key={label} className="rounded-md bg-secondary/35 p-2 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground">
                    {assessment.status === "positive"
                      ? "Suitable"
                      : assessment.status === "needs_attention"
                        ? "Needs attention"
                        : assessment.status === "uncertain"
                          ? "Uncertain"
                          : "Not visible"}
                  </span>
                </div>
                {assessment.evidence && (
                  <p className="mt-1 text-muted-foreground">{assessment.evidence}</p>
                )}
                <p className="mt-1 text-muted-foreground">
                  {Math.round(assessment.confidence)}% confidence
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      {appearanceStatus === "checking" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Checking attire, hair, and facial grooming from the latest camera frame…
        </p>
      )}
      {appearanceStatus === "frame_unusable" && (
        <p className="mt-2 rounded-md bg-warning/10 p-2 text-xs text-warning">
          Appearance could not be assessed because the candidate was not clearly visible. Move into
          frame and improve front lighting; the check will retry.
          {appearanceError ? ` ${appearanceError}` : ""}
        </p>
      )}
      {appearanceStatus === "analysis_failed" && (
        <p className="mt-2 rounded-md bg-warning/10 p-2 text-xs text-warning">
          Appearance analysis failed and was not scored. The camera check will retry.
          {appearanceError ? ` ${appearanceError}` : ""}
        </p>
      )}

      {!enabled ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Turn the camera on to get live posture, eye contact and grooming corrections.
        </p>
      ) : latest.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Watching your posture, eye contact, grooming and speaking pace…
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {latest.map((e, i) => {
            const Icon = ICONS[e.area];
            const severity = e.severity ?? "low";
            return (
              <li
                key={`${e.t}-${e.area}-${e.instruction}`}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs leading-relaxed",
                  i === 0
                    ? "bg-primary/10 text-foreground"
                    : "bg-secondary/35 text-muted-foreground",
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", i === 0 ? "text-primary" : "")} />
                  <SeverityChip severity={severity} />
                  {typeof e.confidence === "number" && (
                    <span className="ml-auto tabular-nums text-[10px] text-muted-foreground">
                      {Math.round(e.confidence)}% sure
                    </span>
                  )}
                </div>
                <p className="mt-1.5">{e.instruction}</p>
                {e.reason && <p className="mt-1 text-[11px] text-muted-foreground">{e.reason}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
