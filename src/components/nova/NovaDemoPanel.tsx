import { useEffect, useRef, useState } from "react";
import { FlaskConical, ChevronDown } from "lucide-react";
import { Companion } from "@/components/nova/Companion";
import { NOVA_EXPRESSIONS, expressionLabel, type NovaExpression } from "@/lib/nova/expression";
import { cn } from "@/lib/utils";

const SPEEDS = [
  { key: "slow", label: "Slow", value: 0.55 },
  { key: "normal", label: "Normal", value: 1 },
  { key: "fast", label: "Fast", value: 1.8 },
] as const;

/**
 * Hidden-by-default dev/demo panel: lets you trigger every Nova expression
 * and run the lip-sync loop at slow/normal/fast speed so mouth animation and
 * expression transitions can be inspected without a live conversation.
 */
export function NovaDemoPanel() {
  const [open, setOpen] = useState(false);
  const [expression, setExpression] = useState<NovaExpression>("neutral");
  const [talking, setTalking] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [pulse, setPulse] = useState(0);
  const pulseTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!talking) {
      if (pulseTimer.current) window.clearInterval(pulseTimer.current);
      return;
    }
    // fake word boundaries so the mouth accents the same way real speech does
    pulseTimer.current = window.setInterval(() => setPulse((p) => p + 1), 260 / speed);
    return () => {
      if (pulseTimer.current) window.clearInterval(pulseTimer.current);
    };
  }, [talking, speed]);

  useEffect(() => {
    if (!open) setTalking(false);
  }, [open]);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mx-auto flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] tracking-[0.18em] text-muted-foreground/50 uppercase transition-colors hover:text-muted-foreground"
        aria-expanded={open}
      >
        <FlaskConical className="size-3" />
        Demo
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-3 w-full space-y-3 rounded-xl border border-cyber/20 bg-surface/50 p-3 backdrop-blur-md">
          <div className="mx-auto w-24">
            <Companion expression={expression} talking={talking} pulse={pulse} speed={speed} />
          </div>

          <div>
            <p className="mb-1.5 text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
              Expressions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {NOVA_EXPRESSIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setExpression(e)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                    expression === e
                      ? "border-cyber bg-cyber/15 text-cyber"
                      : "border-border/50 text-muted-foreground hover:border-cyber/40",
                  )}
                >
                  {expressionLabel(e)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
              Lip-sync demo
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTalking((v) => !v)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                  talking
                    ? "border-cyber bg-cyber/15 text-cyber"
                    : "border-border/50 text-muted-foreground hover:border-cyber/40",
                )}
              >
                {talking ? "Stop talking" : "Start talking"}
              </button>
              {SPEEDS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSpeed(s.value)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                    speed === s.value
                      ? "border-cyber bg-cyber/15 text-cyber"
                      : "border-border/50 text-muted-foreground hover:border-cyber/40",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
