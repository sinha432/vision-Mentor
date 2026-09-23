import { Camera, CheckCircle2, CircleHelp, Sparkles, TriangleAlert } from "lucide-react";
import type { AppearanceReview, AppearanceAssessment, AppearanceAssessmentStatus } from "@/interviewer/lib/interview-types";

interface AppearanceGroomingPanelProps {
  appearance?: AppearanceReview;
  legacySummary?: string;
  loading?: boolean;
  hasRecording?: boolean;
}

const labels: Record<keyof Pick<AppearanceReview, "grooming" | "hair" | "attire">, string> = {
  grooming: "Grooming",
  hair: "Hair for office work",
  attire: "Formal attire",
};

const statusLabels: Record<AppearanceAssessmentStatus, string> = {
  positive: "Looks suitable",
  needs_attention: "Could be improved",
  uncertain: "Needs a clearer frame",
  not_visible: "Not visible",
};

function statusIcon(status: AppearanceAssessmentStatus) {
  if (status === "positive") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "needs_attention") return <TriangleAlert className="h-4 w-4 text-warning" />;
  return <CircleHelp className="h-4 w-4 text-muted-foreground" />;
}

function AssessmentRow({
  label,
  assessment,
}: {
  label: string;
  assessment: AppearanceAssessment;
}) {
  return (
    <div className="rounded-xl bg-secondary/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {statusIcon(assessment.status)}
          <h3 className="text-sm font-semibold">{label}</h3>
        </div>
        <span className="text-xs text-muted-foreground">{statusLabels[assessment.status]}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {assessment.evidence || "There is not enough visible evidence to assess this reliably."}
      </p>
      {assessment.recommendation && (
        <p className="mt-2 text-xs leading-relaxed text-foreground/80">
          <span className="font-medium text-primary">Suggestion:</span> {assessment.recommendation}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{assessment.t == null ? "No evidence timestamp" : `Frame at ${formatTime(assessment.t)}`}</span>
        <span>{Math.round(assessment.confidence)}% confidence</span>
      </div>
    </div>
  );
}

export function AppearanceGroomingPanel({
  appearance,
  legacySummary,
  loading = false,
  hasRecording = false,
}: AppearanceGroomingPanelProps) {
  return (
    <section className="rounded-2xl glass p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Sparkles className="h-4 w-4 text-primary" /> Appearance &amp; grooming
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Advisory camera feedback about visible presentation for a formal interview. It does not
        affect your performance or hiring score.
      </p>

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Camera className="h-4 w-4 animate-pulse text-primary" /> Reviewing available interview frames…
        </p>
      ) : appearance?.assessed ? (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <AssessmentRow label={labels.grooming} assessment={appearance.grooming} />
          <AssessmentRow label={labels.hair} assessment={appearance.hair} />
          <AssessmentRow label={labels.attire} assessment={appearance.attire} />
        </div>
      ) : legacySummary ? (
        <div className="mt-4 rounded-xl bg-secondary/35 p-4 text-sm leading-relaxed text-muted-foreground">
          {legacySummary}
          <p className="mt-2 text-xs">Detailed category results are unavailable for this older session.</p>
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-secondary/35 p-4 text-sm leading-relaxed text-muted-foreground">
          {hasRecording
            ? "Appearance feedback could not be generated for the available frames. No conclusion was added."
            : "No camera recording was available, so appearance and grooming could not be assessed."}
        </p>
      )}
    </section>
  );
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
