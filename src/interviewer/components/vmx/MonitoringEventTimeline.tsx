import {
  AlertTriangle,
  Clock3,
  Smartphone,
  UserRound,
  Volume2,
} from "lucide-react";

import type { DetectionEvent } from "@/interviewer/hooks/useDetectionEngine";

type MonitoringEvent = DetectionEvent & {
  t: number;
};

interface MonitoringEventTimelineProps {
  events: MonitoringEvent[];
}

const EVENT_META: Record<
  DetectionEvent["kind"],
  {
    label: string;
    icon: typeof AlertTriangle;
  }
> = {
  multiple_people: {
    label: "Multiple people",
    icon: UserRound,
  },

  face_missing: {
    label: "Face missing",
    icon: UserRound,
  },

  looking_away: {
    label: "Looking away",
    icon: AlertTriangle,
  },

  device_visible: {
    label: "Device detected",
    icon: Smartphone,
  },

  background_voice: {
    label: "Background voice",
    icon: Volume2,
  },

  background_noise: {
    label: "Background noise",
    icon: Volume2,
  },

  unusual_movement: {
    label: "Unusual movement",
    icon: AlertTriangle,
  },

  hand_gesture: {
    label: "Hand gesture",
    icon: AlertTriangle,
  },
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) {
    return "--:--";
  }

  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function MonitoringEventTimeline({
  events,
}: MonitoringEventTimelineProps) {
  const recentEvents = [...events].reverse().slice(0, 8);

  return (
    <section className="rounded-2xl glass p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm font-semibold">
            Monitoring events
          </h2>

          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Recent interview integrity signals
          </p>
        </div>

        <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-medium text-muted-foreground">
          {events.length}
        </span>
      </div>

      {recentEvents.length === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-secondary/30 px-3 py-3 text-[11px] text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          No monitoring events detected.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {recentEvents.map((event, index) => {
            const meta = EVENT_META[event.kind];
            const Icon = meta?.icon ?? AlertTriangle;

            return (
              <div
                key={`${event.kind}-${event.t}-${index}`}
                className="flex items-start gap-3 rounded-lg bg-secondary/30 px-3 py-2.5"
              >
                <div className="mt-0.5 rounded-md bg-destructive/10 p-1.5 text-destructive">
                  <Icon className="h-3.5 w-3.5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold">
                      {meta?.label ?? event.kind}
                    </span>

                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {formatTime(event.t)}
                    </span>
                  </div>

                  {event.detail && (
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                      {event.detail}
                    </p>
                  )}

                  {event.confidence != null && (
                    <p className="mt-1 text-[9px] text-muted-foreground">
                      Confidence {Math.round(event.confidence)}%
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}