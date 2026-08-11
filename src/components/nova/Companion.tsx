import { useEffect, useState } from "react";
import { useMouthOpen } from "@/hooks/use-mouth-open";
import { useEyeGaze } from "@/hooks/use-eye-gaze";
import type { NovaExpression } from "@/lib/nova/expression";
import { cn } from "@/lib/utils";

type Expression = NovaExpression;

interface CompanionProps {
  expression: Expression;
  talking: boolean;
  /** increments once per speech boundary event to pulse the mouth */
  pulse: number;
  className?: string;
  /** lip-sync wave-rate multiplier — used by the expression/lip-sync demo */
  speed?: number;
}

const EYE_L = { x: 87, y: 104 };
const EYE_R = { x: 153, y: 104 };
const MOUTH = { x: 120, y: 158 };

const BLINK_STYLE = { transformBox: "fill-box", transformOrigin: "center" } as const;

/** pupil size per expression (right eye may differ for a lopsided look) */
const PUPIL: Record<Expression, { rx: number; ry: number; rxR?: number; ryR?: number }> = {
  neutral: { rx: 11, ry: 14 },
  happy: { rx: 11, ry: 14 }, // happy uses closed arc eyes instead
  angry: { rx: 11.5, ry: 6.5 },
  confused: { rx: 11, ry: 13.5, rxR: 9.5, ryR: 8.5 },
  sad: { rx: 10.5, ry: 11 },
  surprised: { rx: 13, ry: 16.5 },
  thinking: { rx: 10.5, ry: 13 },
};

/** brow strokes per expression (inner end drops for angry, lifts for sad) */
const BROWS: Partial<Record<Expression, string[]>> = {
  angry: ["M70 84 L106 96", "M170 84 L134 96"],
  sad: ["M72 92 L106 82", "M168 92 L134 82"],
  confused: ["M70 80 L104 78", "M136 94 L170 92"],
  surprised: ["M68 78 L104 75", "M136 75 L172 78"],
  thinking: ["M134 84 L168 80"],
};

/** resting mouth path per expression; surprised gets an "o" instead */
function restingMouthPath(expression: Expression): string | null {
  switch (expression) {
    case "happy":
      return "M92 150 Q120 172 148 150";
    case "sad":
      return "M96 166 Q120 150 144 166";
    case "angry":
      return "M98 166 Q120 152 142 166";
    case "confused":
      return "M94 158 q7 -7 13 0 t13 0 t13 0 t13 0";
    case "thinking":
      return "M102 162 q12 4 24 -2";
    case "surprised":
      return null;
    default:
      return "M96 158 h48";
  }
}

export function Companion({ expression, talking, pulse, className, speed = 1 }: CompanionProps) {
  const { open, shape, reduced } = useMouthOpen(talking, pulse, speed);
  const gaze = useEyeGaze(expression, talking);

  // talking mouth geometry — `shape` swings between a wide "eh" and a round "oh"
  const aperture = open * (8 + shape * 13);
  const w = Math.max(8, (54 - open * 8) * (1.16 - shape * 0.48));
  const lipT = 2.4 + open * 1.4;
  // opacity always eases so speech start/stop never snaps; only the
  // per-frame aperture geometry skips the transition while actively talking
  const geometryTransition = talking && !reduced ? "none" : "d 150ms ease-out";
  const talkingOpacity = talking ? Math.min(1, 0.25 + open * 1.6) : 0;
  const [restingVisible, setRestingVisible] = useState(!talking);
  useEffect(() => {
    if (talking) {
      setRestingVisible(false);
      return;
    }
    // the resting mouth only fades back in once the talking mouth has
    // fully faded out, sharing the same MOUTH anchor so there is no jump
    const id = window.setTimeout(() => setRestingVisible(true), 200);
    return () => window.clearTimeout(id);
  }, [talking]);
  const restingOpacity = restingVisible ? 1 : 0;

  const pupil = PUPIL[expression];
  const blink = expression !== "surprised" && !reduced;
  const brows = BROWS[expression];
  const restingPath = restingMouthPath(expression);
  // solid accent stroke on every mouth so it never competes visually with
  // the gradient eyes/brows; neutral is thickened to match the eyes' weight
  const restingMouthWidth = expression === "neutral" ? 9 : 7;

  return (
    <div className="relative flex items-center justify-center">
      <div className="companion-aura" aria-hidden />
      <svg
        viewBox="0 0 240 240"
        className={cn(
          "relative z-10 w-full drop-shadow-[0_0_28px_var(--glow-soft)]",
          talking ? "animate-companion-bob" : "animate-companion-float",
          className,
        )}
        role="img"
        aria-label={`Nova is ${talking ? "talking" : expression}`}
      >
        <defs>
          <radialGradient id="orbFill" cx="50%" cy="35%">
            <stop offset="0%" stopColor="var(--orb-hi)" />
            <stop offset="100%" stopColor="var(--orb-lo)" />
          </radialGradient>
          <linearGradient id="featureFill" gradientUnits="userSpaceOnUse" x1="0" y1="40" x2="0" y2="200">
            <stop offset="0%" stopColor="var(--accent-hi)" />
            <stop offset="100%" stopColor="var(--accent-lo)" />
          </linearGradient>
          <radialGradient id="cavityFill">
            <stop offset="0%" stopColor="oklch(0.12 0.04 265)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--orb-lo)" stopOpacity="0.6" />
          </radialGradient>
        </defs>

        {/* body / ring layer */}
        <circle cx="120" cy="120" r="98" fill="url(#orbFill)" />
        <circle
          cx="120"
          cy="120"
          r="98"
          fill="none"
          stroke="url(#featureFill)"
          strokeWidth="1.5"
          opacity="0.7"
        />
        <circle
          cx="120"
          cy="120"
          r="110"
          fill="none"
          stroke="url(#featureFill)"
          strokeWidth="0.75"
          strokeDasharray="6 12"
          opacity="0.5"
          className="animate-companion-spin origin-center"
        />

        {/* face — keyed so expression changes crossfade smoothly */}
        <g key={expression} className="animate-face-fade">
          {/* brows */}
          {brows && (
            <g
              fill="none"
              stroke="url(#featureFill)"
              strokeWidth="6"
              strokeLinecap="round"
              opacity="0.95"
            >
              {brows.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
          )}

          {/* eyes — arc eyes for happy, gazing pupils for everything else */}
          {expression === "happy" ? (
            <g fill="none" stroke="url(#featureFill)" strokeWidth="9" strokeLinecap="round">
              <path d="M68 108 q18 -22 36 0" />
              <path d="M136 108 q18 -22 36 0" />
            </g>
          ) : (
            <g
              fill="url(#featureFill)"
              style={{
                transform: `translate(${gaze.x}px, ${gaze.y}px)`,
                transition: reduced ? "none" : "transform 340ms cubic-bezier(0.33, 1, 0.68, 1)",
              }}
            >
              <ellipse
                cx={EYE_L.x}
                cy={EYE_L.y}
                rx={pupil.rx}
                ry={pupil.ry}
                className={blink ? "animate-companion-blink" : undefined}
                style={BLINK_STYLE}
              />
              <ellipse
                cx={EYE_R.x}
                cy={EYE_R.y}
                rx={pupil.rxR ?? pupil.rx}
                ry={pupil.ryR ?? pupil.ry}
                className={blink ? "animate-companion-blink" : undefined}
                style={BLINK_STYLE}
              />
            </g>
          )}

          {/* happy blush */}
          {expression === "happy" && (
            <g fill="var(--accent-hi)" opacity="0.16">
              <ellipse cx="66" cy="134" rx="10" ry="5.5" />
              <ellipse cx="174" cy="134" rx="10" ry="5.5" />
            </g>
          )}

          {/* resting mouth per expression */}
          {restingPath ? (
            <path
              d={restingPath}
              fill="none"
              stroke="var(--accent-hi)"
              strokeWidth={restingMouthWidth}
              strokeLinecap="round"
              opacity={restingOpacity}
              style={{ transition: "opacity 200ms ease-out" }}
            />
          ) : (
            <ellipse
              cx={MOUTH.x}
              cy={MOUTH.y}
              rx="7.5"
              ry="9.5"
              fill="url(#cavityFill)"
              stroke="var(--accent-hi)"
              strokeWidth="3"
              opacity={restingOpacity}
              style={{ transition: "opacity 200ms ease-out" }}
            />
          )}

          {/* thinking dots */}
          {expression === "thinking" && (
            <g fill="url(#featureFill)">
              {[0, 1, 2].map((i) => (
                <circle
                  key={i}
                  cx={186 + i * 14}
                  cy={44 - i * 8}
                  r={3 + i}
                  className="animate-companion-think"
                  style={{ animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </g>
          )}
        </g>

        {/* talking mouth — dark cavity + glowing lips morphing through visemes */}
        <g opacity={talkingOpacity} style={{ transition: "opacity 180ms ease-out" }}>
          <path
            d={`M ${MOUTH.x - w / 2} ${MOUTH.y}
                Q ${MOUTH.x} ${MOUTH.y - aperture} ${MOUTH.x + w / 2} ${MOUTH.y}
                Q ${MOUTH.x} ${MOUTH.y + aperture * 1.25} ${MOUTH.x - w / 2} ${MOUTH.y} Z`}
            fill="url(#cavityFill)"
            opacity={0.4 + open * 0.55}
          />
          <g fill="none" stroke="var(--accent-hi)" strokeLinecap="round" style={{ transition: geometryTransition }}>
            <path
              d={`M ${MOUTH.x - w / 2} ${MOUTH.y + 0.4}
                  Q ${MOUTH.x} ${MOUTH.y - aperture - 0.8} ${MOUTH.x + w / 2} ${MOUTH.y + 0.4}`}
              strokeWidth={lipT}
              opacity="0.95"
            />
            <path
              d={`M ${MOUTH.x - w / 2} ${MOUTH.y + 0.4}
                  Q ${MOUTH.x} ${MOUTH.y + aperture * 1.35 + 1} ${MOUTH.x + w / 2} ${MOUTH.y + 0.4}`}
              strokeWidth={lipT}
              opacity="0.85"
            />
          </g>
          {/* corner ticks so the mouth reads as articulating, not glowing */}
          <g fill="var(--accent-hi)">
            <circle cx={MOUTH.x - w / 2} cy={MOUTH.y + 0.4} r="1.2" />
            <circle cx={MOUTH.x + w / 2} cy={MOUTH.y + 0.4} r="1.2" />
          </g>
        </g>
      </svg>
    </div>
  );
}
