import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./use-mouth-open";
import type { NovaExpression as Expression } from "@/lib/nova/expression";

interface Gaze {
  x: number;
  y: number;
}

/** resting gaze bias per expression — where the eyes naturally settle */
const BIAS: Record<Expression, Gaze> = {
  neutral: { x: 0, y: 0 },
  happy: { x: 0, y: 0 },
  angry: { x: 0, y: 1.5 },
  confused: { x: 2.5, y: -1 },
  sad: { x: 0, y: 3.5 },
  surprised: { x: 0, y: -1.5 },
  thinking: { x: -6.5, y: -5 },
};

/**
 * Autonomous eye movement: the gaze saccades to a new spot every couple of
 * seconds (smaller, livelier hops while talking) around a per-expression
 * bias, so Nova reads as alive instead of staring straight ahead.
 */
export function useEyeGaze(expression: Expression, talking: boolean) {
  const reduced = usePrefersReducedMotion();
  const [gaze, setGaze] = useState<Gaze>({ x: 0, y: 0 });
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setGaze(BIAS[expression]);
      return;
    }

    let cancelled = false;
    const hop = () => {
      const bias = BIAS[expression];
      // thinking keeps a steadier upward gaze; everything else wanders
      const jitter = expression === "thinking" ? 0.3 : 1;
      const rangeX = (talking ? 4 : 6) * jitter;
      const rangeY = (talking ? 2 : 3) * jitter;
      setGaze({
        x: bias.x + (Math.random() * 2 - 1) * rangeX,
        y: bias.y + (Math.random() * 2 - 1) * rangeY,
      });
      if (!cancelled) {
        timer.current = window.setTimeout(hop, 1400 + Math.random() * 2400);
      }
    };
    hop();

    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [expression, talking, reduced]);

  return gaze;
}
