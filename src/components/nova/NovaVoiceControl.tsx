import { useEffect, useMemo, useState } from "react";
import { Mic, MonitorSmartphone, Radio, ShieldCheck, Video } from "lucide-react";
import { stateLabel, type NovaState } from "@/lib/nova/expression";
import { cn } from "@/lib/utils";

export interface NovaVoiceControlProps {
  state: NovaState;
  listening: boolean;
  micSupported: boolean;
  micLevel?: number;
  onTapToTalk: () => void;
  className?: string;
}

const BAR_COUNT = 24;

function useDiagnostics() {
  const [speechApi, setSpeechApi] = useState(false);
  const [webcam, setWebcam] = useState<"checking" | "available" | "unavailable">("checking");
  const [mic, setMic] = useState<"checking" | "available" | "unavailable">("checking");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setSpeechApi(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition) && "speechSynthesis" in window);

    if (!navigator.mediaDevices?.enumerateDevices) {
      setWebcam("unavailable");
      setMic("unavailable");
      return;
    }
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        setWebcam(devices.some((d) => d.kind === "videoinput") ? "available" : "unavailable");
        setMic(devices.some((d) => d.kind === "audioinput") ? "available" : "unavailable");
      })
      .catch(() => {
        setWebcam("unavailable");
        setMic("unavailable");
      });
  }, []);

  return { speechApi, webcam, mic };
}

export function NovaVoiceControl({
  state,
  listening,
  micSupported,
  micLevel = 0,
  onTapToTalk,
  className,
}: NovaVoiceControlProps) {
  const { speechApi, webcam, mic } = useDiagnostics();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!listening && state !== "speaking") return;
    const id = window.setInterval(() => setTick((t) => t + 1), 90);
    return () => window.clearInterval(id);
  }, [listening, state]);

  const bars = useMemo(() => {
    const active = listening || state === "speaking";
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      if (!active) return 0.08;
      const base = 0.35 + 0.5 * Math.abs(Math.sin((tick + i * 3) * 0.35));
      const level = listening ? Math.max(base, micLevel) : base;
      return Math.min(1, level);
    });
  }, [tick, listening, state, micLevel]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="card-3d rounded-2xl p-5">
        <h3 className="mb-4 text-center text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
          Voice control
        </h3>

        <button
          type="button"
          onClick={onTapToTalk}
          disabled={!micSupported}
          className={cn(
            "mx-auto flex size-28 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-40",
            listening
              ? "bg-destructive text-destructive-foreground shadow-[0_0_0_10px_color-mix(in_oklab,var(--destructive)_18%,transparent)]"
              : "btn-3d text-primary-foreground",
          )}
        >
          <Mic className="size-9" />
        </button>
        <p className="mt-3 text-center text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
          {listening ? "Listening…" : micSupported ? "Tap to talk" : "Mic unsupported"}
        </p>

        <div className="mt-5 flex h-10 items-end justify-center gap-[3px]">
          {bars.map((v, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-cyber transition-all duration-100"
              style={{ height: `${Math.max(8, v * 40)}px`, opacity: 0.35 + v * 0.65 }}
            />
          ))}
        </div>
      </div>

      <div className="card-3d rounded-2xl p-5">
        <h3 className="mb-3 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
          Diagnostics
        </h3>
        <ul className="space-y-2.5 text-xs">
          <DiagRow icon={MonitorSmartphone} label="System" value="Online" tone="good" />
          <DiagRow
            icon={Radio}
            label="Speech API"
            value={speechApi ? "Supported" : "Unsupported"}
            tone={speechApi ? "good" : "bad"}
          />
          <DiagRow
            icon={Video}
            label="Webcam"
            value={webcam === "checking" ? "Checking…" : webcam === "available" ? "Available" : "Not found"}
            tone={webcam === "available" ? "good" : webcam === "checking" ? "idle" : "bad"}
          />
          <DiagRow
            icon={Mic}
            label="Mic"
            value={mic === "checking" ? "Checking…" : mic === "available" ? "Available" : "Not found"}
            tone={mic === "available" ? "good" : mic === "checking" ? "idle" : "bad"}
          />
          <DiagRow icon={ShieldCheck} label="Status" value={stateLabel(state)} tone="good" />
        </ul>
      </div>
    </div>
  );
}

function DiagRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "good" | "bad" | "idle";
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-surface/40 px-3 py-2">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span
        className={cn(
          "font-medium",
          tone === "good" && "text-cyber",
          tone === "bad" && "text-destructive",
          tone === "idle" && "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </li>
  );
}
