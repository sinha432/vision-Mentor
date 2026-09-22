import { AlertTriangle, ShieldCheck, Users } from "lucide-react";
import { PROCTOR_LABELS, type ProctorEvent } from "@/interviewer/lib/interview-types";
import type { DetectionSignals } from "@/interviewer/lib/detection-types";
import { cn } from "@/lib/utils";

/**
 * Live proctoring status for the interview room: quiet green when the frame is
 * clean, loud red the moment something breaks interview integrity.
 */
export function IntegrityStrip({
  events,
  enabled,
  warnings,
  signals,
  className,
}: {
  events: ProctorEvent[];
  enabled: boolean;
  warnings: number;
  signals?: DetectionSignals;
  className?: string;
}) {
  const recent = events.slice(-3).reverse();
  const flagged = recent.length > 0;
  const phoneDetected = Boolean(
    signals?.devices.some((device) => /phone|cell|mobile|smartphone/i.test(device.label)),
  );
  const multiplePeople = (signals?.faces ?? 0) > 1;
  const noisy = (signals?.noiseLevel ?? 0) >= 55;
  const liveFlagged = phoneDetected || multiplePeople || signals?.backgroundVoice || noisy;

  return (
    <section
      className={cn(
        "rounded-2xl glass p-4",
        (flagged || liveFlagged) && "border border-destructive/40 bg-destructive/5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          {flagged || liveFlagged ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-success" />
          )}
          Interview integrity
        </h2>
        {warnings > 0 && (
          <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] text-destructive">
            {warnings === 1 ? "1 warning" : `${warnings} warnings`}
          </span>
        )}
      </div>

      {!enabled ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Camera off — proctoring is limited to voice and tab monitoring.
        </p>
      ) : !flagged && !liveFlagged ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> One candidate in frame, no second voice, tab in focus.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {phoneDetected && <LiveSignal label="Phone" detail="Phone or device currently visible." />}
          {multiplePeople && <LiveSignal label="People" detail={`${signals?.faces} faces currently visible.`} />}
          {signals?.backgroundVoice && <LiveSignal label="Voice" detail="Background or second voice currently detected." />}
          {noisy && <LiveSignal label="Noise" detail="Sustained loud background noise currently detected." />}
          <ul className="space-y-2">
          {recent.map((event, i) => (
            <li
              key={`${event.t}-${event.kind}-${i}`}
              className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-foreground"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <span>
                <span className="font-medium">{PROCTOR_LABELS[event.kind]}</span>
                {event.detail ? ` — ${event.detail}` : ""}
              </span>
            </li>
          ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Leaving this tab twice ends the interview.
      </p>
    </section>
  );
}

function LiveSignal({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs">
      <span className="font-medium text-destructive">Live {label}</span> — {detail}
    </div>
  );
}
