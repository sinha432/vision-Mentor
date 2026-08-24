import { useCallback, useRef, useState } from "react";
import { Companion } from "@/components/nova/Companion";
import { NovaDemoPanel } from "@/components/nova/NovaDemoPanel";
import {
  NovaConversationPanel,
  type NovaConversationHandle,
  type NovaConversationStatus,
} from "@/components/nova/NovaConversationPanel";
import { NovaVoiceControl } from "@/components/nova/NovaVoiceControl";
import { useNovaSenses } from "@/hooks/use-nova-senses";
import { expressionLabel, stateLabel } from "@/lib/nova/expression";
import { useNovaVoice, voiceLabel } from "@/lib/nova/nova-voice";
import { Mic2, Radio, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanyNovaActions } from "@/components/nova/CompanyNovaActions";

/**
 * The full Nova console shown on the company dashboard: a left identity
 * column (companion, chip, voice + vision status), a centre conversation
 * stream, and a right rail for voice control + diagnostics.
 */
export function NovaConsole({ className }: { className?: string }) {
  const [status, setStatus] = useState<NovaConversationStatus>({
    state: "idle",
    expression: "neutral",
    pulse: 0,
  });
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const conversationRef = useRef<NovaConversationHandle>(null);

  const senses = useNovaSenses();
  const { status: visionStatus } = senses;
  const { voices: novaVoices, active: activeVoice, fellBack, setVoice } = useNovaVoice();
  const sensing = senses.cameraOn || senses.micOn;

  const handleTapToTalk = useCallback(() => {
    conversationRef.current?.toggleMic();
  }, []);

  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[19rem_minmax(0,1fr)_19rem]",
        className,
      )}
    >
      {/* Left column — identity */}
      <div className="card-3d flex flex-col items-center gap-5 rounded-2xl p-5">
        <div className="w-full max-w-[14rem]">
          <Companion expression={status.expression} talking={status.state === "speaking"} pulse={status.pulse} />
        </div>

        <div className="text-center">
          <h1 className="font-display text-2xl tracking-[0.2em] text-gradient">NOVA</h1>
          <p className="mt-1 text-[10px] tracking-[0.22em] text-muted-foreground uppercase sm:text-xs">
            Vision Mentor X · AI interview companion
          </p>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-cyber/30 bg-surface/60 px-3 py-1 text-[10px] tracking-[0.22em] uppercase backdrop-blur-md">
          <span className="size-1.5 rounded-full bg-cyber" />
          <span className="text-cyber">{stateLabel(status.state)}</span>
          <span className="text-muted-foreground">· {expressionLabel(status.expression)}</span>
        </span>

        {novaVoices.length > 0 && (
          <div className="w-full space-y-1">
            <label
              htmlFor="nova-console-voice-select"
              className="flex items-center gap-1.5 text-[9px] tracking-[0.18em] text-muted-foreground uppercase"
            >
              <Mic2 className="size-3" />
              Nova's voice
            </label>
            <select
              id="nova-console-voice-select"
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
                Preferred voice unavailable — using {activeVoice ? voiceLabel(activeVoice) : "the browser default"}.
              </p>
            )}
          </div>
        )}

        <div className="grid w-full grid-cols-2 gap-2">
          <div className="chip-3d flex flex-col items-center gap-1 rounded-xl p-2.5">
            <Radio className="size-4 text-cyber" />
            <span className="text-[10px] tracking-widest text-muted-foreground uppercase">Voice</span>
            <span className="text-[10px] text-muted-foreground">
              {senses.micOn ? visionStatus.audio.text : "OFFLINE"}
            </span>
          </div>
          <div className="chip-3d flex flex-col items-center gap-1 rounded-xl p-2.5">
            <Camera className="size-4 text-cyber" />
            <span className="text-[10px] tracking-widest text-muted-foreground uppercase">Vision</span>
            <span className="text-center text-[10px] leading-tight text-muted-foreground">
              {senses.cameraOn ? `${visionStatus.posture.text}` : "OFFLINE"}
            </span>
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
          <Camera className="size-3.5" />
          {sensing ? "Stop seeing & hearing me" : "Let Nova see & hear me"}
        </button>
        {senses.error && <p className="text-[11px] text-destructive">{senses.error}</p>}

        <NovaDemoPanel />
      </div>

      {/* Centre column — conversation */}
      <div className="card-3d flex min-h-[28rem] flex-col rounded-2xl p-5 lg:min-h-0">
        <NovaConversationPanel
          ref={conversationRef}
          onStatusChange={setStatus}
          onListeningChange={setListening}
          onMicSupportedChange={setMicSupported}
        />
      </div>

          {/* Right column — voice control + company hiring actions */}
      <div className="flex min-h-0 flex-col gap-5">
        <NovaVoiceControl
          state={status.state}
          listening={listening}
          micSupported={micSupported}
          micLevel={senses.micLevel}
          onTapToTalk={handleTapToTalk}
        />

        <div className="card-3d rounded-2xl p-4">
          <CompanyNovaActions
            onAction={(action) => {
              console.log("Nova company action:", action);
            }}
          />
        </div>
      </div>
    </div>
  );
}
