import {
  Camera,
  CheckCircle2,
  CircleAlert,
  Eye,
  Mic,
  Smartphone,
  Users,
} from "lucide-react";

import type { DetectionSignals } from "@/interviewer/lib/detection-types";
import { cn } from "@/lib/utils";

interface LiveMonitoringPanelProps {
  signals: DetectionSignals;
  enabled: boolean;
}

function StatusRow({
  icon: Icon,
  label,
  value,
  danger = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>

      <span
        className={cn(
          "text-xs font-semibold",
          danger ? "text-destructive" : "text-success",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function LiveMonitoringPanel({
  signals,
  enabled,
}: LiveMonitoringPanelProps) {
  const phoneDetected = signals.devices.some((device) =>
    /phone|cell|mobile|tablet/i.test(device.label),
  );

  const secondScreenDetected = signals.devices.some((device) =>
    /laptop|monitor|screen|tv|keyboard/i.test(device.label),
  );

  const multipleFaces = signals.faces > 1;

  const faceMissing = enabled && signals.ready && !signals.faceVisible;

  const otherVoice = signals.backgroundVoice;

  return (
    <section className="rounded-2xl glass p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm font-semibold">
            Live monitoring
          </h2>

          <p className="mt-0.5 text-[11px] text-muted-foreground">
            On-device interview integrity
          </p>
        </div>

        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium",
            enabled && signals.ready
              ? "bg-success/10 text-success"
              : "bg-secondary text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              enabled && signals.ready ? "bg-success" : "bg-muted-foreground",
            )}
          />
          {enabled && signals.ready ? "LIVE" : "WAITING"}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <StatusRow
          icon={Camera}
          label="Camera"
          value={!enabled ? "OFF" : faceMissing ? "FACE MISSING" : "ACTIVE"}
          danger={faceMissing}
        />

        <StatusRow
          icon={Users}
          label="People in frame"
          value={
            !enabled
              ? "—"
              : multipleFaces
                ? `${signals.faces} DETECTED`
                : signals.faceVisible
                  ? "1 CANDIDATE"
                  : "NONE"
          }
          danger={multipleFaces || faceMissing}
        />

        <StatusRow
          icon={Smartphone}
          label="Phone"
          value={phoneDetected ? "DETECTED" : "CLEAR"}
          danger={phoneDetected}
        />

        <StatusRow
          icon={CircleAlert}
          label="Second screen"
          value={secondScreenDetected ? "DETECTED" : "CLEAR"}
          danger={secondScreenDetected}
        />

        <StatusRow
          icon={Mic}
          label="Voice"
          value={
            otherVoice
              ? "OTHER VOICE"
              : signals.speaking
                ? "CANDIDATE"
                : "QUIET"
          }
          danger={otherVoice}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric
          icon={Eye}
          label="Eye"
          value={signals.eyeContact}
        />

        <Metric
          label="Posture"
          value={signals.posture}
        />

        <Metric
          label="Movement"
          value={signals.movement}
        />
      </div>

      {(phoneDetected ||
        secondScreenDetected ||
        multipleFaces ||
        faceMissing ||
        otherVoice) && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />

          <p className="text-[11px] leading-relaxed text-destructive">
            {phoneDetected
              ? "A phone or mobile device is visible."
              : secondScreenDetected
                ? "A possible second-screen device is visible."
                : multipleFaces
                  ? "More than one person is visible."
                  : faceMissing
                    ? "Your face is not clearly visible."
                    : "Background speech was detected while you were not speaking."}
          </p>
        </div>
      )}
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-secondary/30 px-2 py-2 text-center">
      <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-widest text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>

      <div className="mt-0.5 font-display text-sm font-semibold tabular-nums">
        {Math.round(value)}%
      </div>
    </div>
  );
}