import { AlertTriangle, Camera, CameraOff, Mic2, Radio } from "lucide-react";
import { Companion } from "@/components/nova/Companion";
import { NovaDemoPanel } from "@/components/nova/NovaDemoPanel";
import { useNovaSenses } from "@/hooks/use-nova-senses";
import {
  expressionLabel,
  stateLabel,
  type NovaExpression,
  type NovaState,
} from "@/lib/nova/expression";
import { useNovaVoice, voiceLabel } from "@/lib/nova/nova-voice";
import type { Level } from "@/lib/vision-status";
import { cn } from "@/lib/utils";

export function levelColor(l: Level): string {
  if (l === "good") return "var(--cyber)";
  if (l === "warn") return "var(--amber)";
  if (l === "bad") return "var(--destructive)";
  return "var(--muted-foreground)";
}

export interface NovaPanelProps {
  state: NovaState;
  expression: NovaExpression;
  pulse: number;
  /** show the camera preview tile inside the panel */
  showPreview?: boolean;
  className?: string;
  /** Nova reacts to what the sensors report */
  onSenseExpression?: (expression: NovaExpression) => void;
}

/**
 * The Nova surface: companion face, identity, live status and the
 * VOICE / VISION channel cards driven by the camera and microphone.
 */
export function NovaPanel({
  state,
  expression,
  pulse,
  showPreview = false,
  className,
}: NovaPanelProps) {
  const senses = useNovaSenses();
  const { status } = senses;
  const { voices: novaVoices, active: activeVoice, fellBack, setVoice } = useNovaVoice();
  const sensing = senses.cameraOn || senses.micOn;
  const worst = status.warnings[0];

  return (
    <div className={cn("relative flex flex-col items-center gap-5 p-5", className)}>
      <div className="relative w-full max-w-[16rem]">
        <Companion expression={expression} talking={state === "speaking"} pulse={pulse} />
      </div>

      <div className="text-center">
        <h2 className="font-display text-2xl tracking-[0.2em] text-gradient">NOVA</h2>
        <p className="mt-1 text-[10px] tracking-[0.22em] text-muted-foreground uppercase sm:text-xs">
          Vision Mentor X · AI interview companion
        </p>
      </div>

      <span className="inline-flex items-center gap-2 rounded-full border border-cyber/30 bg-surface/60 px-3 py-1 text-[10px] tracking-[0.22em] uppercase backdrop-blur-md">
        <span className="size-1.5 rounded-full bg-cyber" />
        <span className="text-cyber">{stateLabel(state)}</span>
        <span className="text-muted-foreground">· {expressionLabel(expression)}</span>
      </span>

      {novaVoices.length > 0 && (
        <div className="w-full space-y-1">
          <label
            htmlFor="nova-voice-select"
            className="flex items-center gap-1.5 text-[9px] tracking-[0.18em] text-muted-foreground uppercase"
          >
            <Mic2 className="size-3" />
            Nova's voice
          </label>
          <select
            id="nova-voice-select"
            value={activeVoice?.voiceURI ?? ""}
            onChange={(e) => setVoice(e.target.value)}
            className="w-full rounded-lg border border-cyber/25 bg-surface/60 px-2.5 py-1.5 text-[11px] text-foreground backdrop-blur-md focus:border-cyber focus:outline-none"
          >
            {novaVoices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {voiceLabel(v)}
              </option>
            ))}
          </select>
          {fellBack && (
            <p className="text-[10px] text-muted-foreground">
              Preferred voice unavailable — using{" "}
              {activeVoice ? voiceLabel(activeVoice) : "the browser default"}.
            </p>
          )}
        </div>
      )}

      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="chip-3d flex flex-col items-center gap-1 rounded-xl p-2.5">
          <Radio className="size-4 text-cyber" />
          <span className="text-[10px] tracking-widest text-muted-foreground uppercase">Voice</span>
          <span className="text-[10px]" style={{ color: levelColor(status.audio.level) }}>
            {senses.micOn ? "Connected" : "Not connected"}
          </span>
          {senses.micOn && (
            <span className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
              <span
                className="block h-full rounded-full bg-cyber transition-[width] duration-100"
                style={{ width: `${Math.round(senses.micLevel * 100)}%` }}
              />
            </span>
          )}
        </div>

        <div className="chip-3d flex flex-col items-center gap-1 rounded-xl p-2.5">
          <Camera className="size-4 text-cyber" />
          <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
            Vision
          </span>
          <span
            className="text-center text-[10px] leading-tight"
            style={{ color: levelColor(status.posture.level) }}
          >
            {senses.cameraOn
              ? `${status.posture.text} · ${status.people} person${status.people === 1 ? "" : "s"}`
              : "OFFLINE"}
          </span>
        </div>
      </div>

      <div className="grid w-full grid-cols-2 gap-2 text-[10px]">
        <div className="chip-3d rounded-xl p-2 text-center">
          <span className="block uppercase tracking-widest text-muted-foreground">Left hand</span>
          <span className="text-cyber">{status.leftHand.text}</span>
        </div>
        <div className="chip-3d rounded-xl p-2 text-center">
          <span className="block uppercase tracking-widest text-muted-foreground">Right hand</span>
          <span className="text-cyber">{status.rightHand.text}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => (sensing ? senses.disable() : void senses.enable())}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all",
          sensing ? "chip-3d text-muted-foreground" : "btn-3d text-primary-foreground",
        )}
      >
        {sensing ? <CameraOff className="size-3.5" /> : <Camera className="size-3.5" />}
        {sensing ? "Stop seeing & hearing me" : "Let Nova see & hear me"}
      </button>

      {senses.error && <p className="text-[11px] text-destructive">{senses.error}</p>}
      {!sensing && !senses.error && (
        <p className="max-w-[16rem] text-center text-[11px] leading-relaxed text-muted-foreground">
          Camera and microphone stay off until you allow them, and stop the moment you switch them
          off.
        </p>
      )}

      {showPreview && (
        <div className="relative w-full overflow-hidden rounded-xl border border-cyber/25 bg-background/40">
          <video
            ref={senses.videoRef}
            autoPlay
            playsInline
            muted
            className={cn("aspect-video w-full object-cover", !senses.cameraOn && "opacity-20")}
          />
          {!senses.cameraOn && (
            <span className="absolute inset-0 grid place-items-center text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
              Camera off
            </span>
          )}
        </div>
      )}

      {!showPreview && (
        <video ref={senses.videoRef} autoPlay playsInline muted className="hidden" />
      )}

      {sensing && status.warnings.length > 0 && (
        <ul className="w-full space-y-1.5">
          {status.warnings.slice(0, 3).map((w) => (
            <li
              key={w.id}
              className="flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] leading-snug"
              style={{
                borderColor: w.level === "bad" ? "var(--destructive)" : "var(--amber)",
                color: w.level === "bad" ? "var(--destructive)" : "var(--amber)",
              }}
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{w.message}</span>
            </li>
          ))}
        </ul>
      )}

      {sensing && status.warnings.length === 0 && worst === undefined && (
        <p className="text-[11px] text-cyber">Environment looks good — carry on.</p>
      )}

      <NovaDemoPanel />
    </div>
  );
}
