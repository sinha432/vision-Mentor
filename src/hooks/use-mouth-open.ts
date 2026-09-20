import { useEffect, useRef, useState } from "react";

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Procedural syllable wave used by the companion (0 = closed, 1 = wide). */
export function mouthWave(t: number) {
  return (
    0.45 +
    0.34 * Math.sin(t * 15.5) +
    0.16 * Math.sin(t * 7.3 + 1.1) +
    0.08 * Math.sin(t * 26.7 + 0.4)
  );
}

/**
 * Drives mouth-openness plus a viseme "shape" value (0 = wide "eh",
 * 1 = round "oh") whether or not speechSynthesis boundary events ever fire.
 * `pulse` increments per boundary and adds a syllable accent + shape shift.
 * `speed` scales the wave rate — used by the lip-sync speed demo control.
 */
export function useMouthOpen(talking: boolean, pulse: number, speed = 1) {
  const [state, setState] = useState({ open: 0, shape: 0.5 });
  const reduced = usePrefersReducedMotion();
  const accentAt = useRef(-1e6);
  const seed = useRef(0);

  useEffect(() => {
    if (pulse) {
      accentAt.current = performance.now();
      // golden-ratio hop so consecutive words land on visibly different shapes
      seed.current = pulse * 2.399;
    }
  }, [pulse]);

  useEffect(() => {
    if (!talking) {
      // ease the aperture closed instead of snapping so it can hand off
      // cleanly to the resting mouth. Keep the updates constrained so the UI
      // does not churn on every animation frame while idle.
      if (reduced) {
        setState({ open: 0, shape: 0.5 });
        return;
      }
      let raf = 0;
      let lastPaint = 0;
      const from = state.open;
      const start = performance.now();
      const duration = 180;
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - p) * (1 - p);
        if (now - lastPaint >= 1000 / 30) {
          lastPaint = now;
          setState((prev) => ({ open: from * (1 - eased), shape: prev.shape }));
        }
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }

    if (reduced) {
      let on = false;
      const id = window.setInterval(() => {
        on = !on;
        setState({ open: on ? 0.6 : 0.1, shape: 0.5 });
      }, 320);
      return () => window.clearInterval(id);
    }

    let raf = 0;
    let lastPaint = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      const t = elapsed * speed;
      // ease the mouth in over the first ~180ms so speech start doesn't snap
      const rampIn = Math.min(1, elapsed / 0.18);
      const decay = Math.max(0, 1 - (now - accentAt.current) / 160);
      const open = rampIn * Math.min(1, Math.max(0.05, mouthWave(t) + decay * 0.45));
      // slow viseme drift, re-seeded on every word boundary
      const shape = Math.min(
        1,
        Math.max(0, 0.5 + 0.45 * Math.sin(t * 6.1 + seed.current) * Math.sin(t * 2.7 + 1.3)),
      );
      if (now - lastPaint >= 1000 / 30) {
        lastPaint = now;
        setState({ open, shape });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talking, reduced, speed]);

  return { open: state.open, shape: state.shape, reduced };
}
