import { useEffect, useMemo, useRef, useState } from "react";
import type { InterviewerMood } from "@/interviewer/lib/interview-types";
import { VISEME_SHAPE, type Viseme } from "@/interviewer/lib/visemes";
import { cn } from "@/lib/utils";

interface AIInterviewerProps {
  /** 0..1 mouth openness driven by live audio amplitude */
  mouth: number;
  /** Current mouth shape derived from the spoken text (phoneme → viseme). */
  viseme?: Viseme;
  speaking: boolean;
  listening: boolean;
  mood: InterviewerMood;
  className?: string;
}

/**
 * Waist-up stylized human interviewer rendered as animated SVG.
 * Handles blinking, idle head sway, brow motion, lip sync, smiling,
 * nodding and hand gestures, all driven by mood + live audio level.
 */
export function AIInterviewer({
  mouth,
  viseme = "rest",
  speaking,
  listening,
  mood,
  className,
}: AIInterviewerProps) {
  const [blink, setBlink] = useState(false);
  const [gesture, setGesture] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [nodPulse, setNodPulse] = useState(0);
  const [gaze, setGaze] = useState(0);
  const moodRef = useRef(mood);
  moodRef.current = mood;

  // Natural, irregular blinking
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      const delay = 1800 + Math.random() * 3800;
      timer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 110);
        if (Math.random() > 0.75) {
          setTimeout(() => {
            setBlink(true);
            setTimeout(() => setBlink(false), 100);
          }, 220);
        }
        loop();
      }, delay);
    };
    loop();
    return () => clearTimeout(timer);
  }, []);

  // Idle head sway + slight listening tilt
  useEffect(() => {
    const timer = setInterval(() => {
      const base = listening ? 3.2 : 1.6;
      setTilt((Math.random() * 2 - 1) * base);
    }, 2600);
    return () => clearInterval(timer);
  }, [listening]);

  // Micro pupil drift — eyes that never move look dead
  useEffect(() => {
    const timer = setInterval(() => {
      setGaze((Math.random() * 2 - 1) * (listening ? 1.5 : 0.9));
    }, 1500);
    return () => clearInterval(timer);
  }, [listening]);

  // Hand gestures while speaking
  useEffect(() => {
    if (!speaking) {
      setGesture(0);
      return;
    }
    const timer = setInterval(() => setGesture(Math.random()), 1400);
    return () => clearInterval(timer);
  }, [speaking]);

  // Nod on approval
  useEffect(() => {
    if (mood === "nod") {
      setNodPulse((n) => n + 1);
    }
  }, [mood]);

  const smile = mood === "smile" || mood === "nod";
  const thinking = mood === "thinking";
  const curious = mood === "curious";

  // Amplitude sets how loud the syllable is; the viseme sets its shape.
  const shape = VISEME_SHAPE[viseme] ?? VISEME_SHAPE.rest;
  const openness = speaking ? Math.max(0.06, Math.min(1, mouth * 0.45 + shape.open * 0.55)) : 0;
  const mouthHeight = 3 + openness * 15;
  const mouthWidth = (26 + (smile ? 6 : 0) - openness * 3) * shape.width;
  const browLift = curious ? -4 : thinking ? 2 : speaking ? -1.5 - openness * 2 : 0;

  const handOffset = useMemo(() => {
    if (!speaking) return { left: 0, right: 0, rot: 0 };
    return {
      left: -6 - gesture * 14,
      right: -3 - (1 - gesture) * 12,
      rot: (gesture - 0.5) * 12,
    };
  }, [gesture, speaking]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      {/* Office background */}
      <div className="absolute inset-0 office-bg" />
      <div className="absolute inset-0 grid-lines opacity-40" />
      <div className="absolute -left-16 top-6 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-10 bottom-0 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
      {/* Office props: window blinds + plant silhouette */}
      <div className="absolute right-6 top-8 hidden h-40 w-32 rounded-md border border-border/60 bg-secondary/20 sm:block">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="mx-2 mt-3 h-1 rounded-full bg-foreground/10" />
        ))}
      </div>
      <div className="absolute bottom-0 left-6 hidden h-24 w-16 sm:block">
        <div className="mx-auto h-10 w-8 rounded-b-md bg-secondary/50" />
        <div className="absolute bottom-9 left-1/2 h-16 w-16 -translate-x-1/2 rounded-full bg-success/15 blur-md" />
      </div>

      <svg
        viewBox="0 0 300 300"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="AI interviewer"
      >
        <defs>
          <linearGradient id="vmx-suit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.30 0.03 255)" />
            <stop offset="100%" stopColor="oklch(0.20 0.025 255)" />
          </linearGradient>
          <linearGradient id="vmx-skin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.82 0.055 62)" />
            <stop offset="100%" stopColor="oklch(0.73 0.062 48)" />
          </linearGradient>
          <linearGradient id="vmx-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.30 0.03 40)" />
            <stop offset="100%" stopColor="oklch(0.19 0.025 40)" />
          </linearGradient>
          <radialGradient id="vmx-rim" cx="50%" cy="35%" r="60%">
            <stop offset="70%" stopColor="oklch(0.79 0.144 191 / 0)" />
            <stop offset="100%" stopColor="oklch(0.79 0.144 191 / 0.22)" />
          </radialGradient>
          {/* Volumetric cheek/jaw shading for a photographic face */}
          <radialGradient id="vmx-cheeklight" cx="50%" cy="42%" r="52%">
            <stop offset="0%" stopColor="oklch(0.90 0.04 62 / 0.55)" />
            <stop offset="60%" stopColor="oklch(0.86 0.05 62 / 0.12)" />
            <stop offset="100%" stopColor="oklch(0.62 0.06 42 / 0.28)" />
          </radialGradient>
          <linearGradient id="vmx-jawshade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="55%" stopColor="oklch(0.60 0.05 40 / 0)" />
            <stop offset="100%" stopColor="oklch(0.52 0.05 38 / 0.38)" />
          </linearGradient>
          <linearGradient id="vmx-lip" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.58 0.10 24)" />
            <stop offset="100%" stopColor="oklch(0.45 0.10 22)" />
          </linearGradient>
          <radialGradient id="vmx-iris" cx="42%" cy="35%" r="70%">
            <stop offset="0%" stopColor="oklch(0.52 0.07 220)" />
            <stop offset="65%" stopColor="oklch(0.34 0.06 225)" />
            <stop offset="100%" stopColor="oklch(0.22 0.04 230)" />
          </radialGradient>
          <filter id="vmx-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
          <filter id="vmx-drop" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx="0"
              dy="4"
              stdDeviation="5"
              floodColor="oklch(0.12 0.02 255)"
              floodOpacity="0.5"
            />
          </filter>
        </defs>

        {/* Body group: subtle breathing */}
        <g
          style={{
            transformOrigin: "150px 260px",
            animation: "breathe 5s ease-in-out infinite",
          }}
        >
          {/* Torso / suit jacket */}
          <path
            d="M150 150 C110 152 78 176 68 214 L58 300 L242 300 L232 214 C222 176 190 152 150 150 Z"
            fill="url(#vmx-suit)"
          />
          {/* Shirt + lapels */}
          <path d="M150 152 L128 300 L172 300 Z" fill="oklch(0.94 0.01 240)" />
          <path d="M150 152 L120 168 L128 300 L142 300 Z" fill="oklch(0.26 0.028 255)" />
          <path d="M150 152 L180 168 L172 300 L158 300 Z" fill="oklch(0.26 0.028 255)" />
          {/* Tie */}
          <path d="M150 158 L143 170 L150 178 L157 170 Z" fill="oklch(0.79 0.144 191)" />
          <path d="M150 178 L143 196 L150 236 L157 196 Z" fill="oklch(0.72 0.13 191)" />
          {/* ID badge */}
          <rect x="186" y="216" width="22" height="14" rx="3" fill="oklch(0.86 0.02 240)" />
          <rect x="189" y="220" width="10" height="2.5" rx="1" fill="oklch(0.45 0.03 255)" />
          <rect x="189" y="225" width="14" height="2" rx="1" fill="oklch(0.6 0.02 255)" />

          {/* Arms + gesturing hands */}
          <g
            style={{
              transform: `translateY(${handOffset.left}px) rotate(${-handOffset.rot}deg)`,
              transformOrigin: "80px 220px",
              transition: "transform 700ms cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <path
              d="M74 206 C58 226 56 254 62 288 L86 288 C82 258 86 232 96 214 Z"
              fill="url(#vmx-suit)"
            />
            <ellipse cx="74" cy="288" rx="15" ry="12" fill="url(#vmx-skin)" />
          </g>
          <g
            style={{
              transform: `translateY(${handOffset.right}px) rotate(${handOffset.rot}deg)`,
              transformOrigin: "220px 220px",
              transition: "transform 700ms cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <path
              d="M226 206 C242 226 244 254 238 288 L214 288 C218 258 214 232 204 214 Z"
              fill="url(#vmx-suit)"
            />
            <ellipse cx="226" cy="288" rx="15" ry="12" fill="url(#vmx-skin)" />
          </g>

          {/* Neck */}
          <path d="M136 128 L164 128 L166 156 L134 156 Z" fill="oklch(0.70 0.06 48)" />

          {/* Head group: sway, tilt, nod */}
          <g
            key={nodPulse}
            style={{
              transformOrigin: "150px 140px",
              transform: `rotate(${tilt}deg)`,
              transition: "transform 1600ms ease-in-out",
              animation: mood === "nod" ? "vmx-nod 900ms ease-in-out" : undefined,
            }}
            filter="url(#vmx-drop)"
          >
            {/* Ears */}
            <ellipse cx="106" cy="92" rx="7" ry="11" fill="oklch(0.72 0.062 48)" />
            <ellipse cx="194" cy="92" rx="7" ry="11" fill="oklch(0.72 0.062 48)" />
            {/* Face */}
            <path
              d="M150 40 C120 40 108 62 108 86 C108 116 126 138 150 138 C174 138 192 116 192 86 C192 62 180 40 150 40 Z"
              fill="url(#vmx-skin)"
            />
            <path
              d="M150 40 C120 40 108 62 108 86 C108 116 126 138 150 138 C174 138 192 116 192 86 C192 62 180 40 150 40 Z"
              fill="url(#vmx-rim)"
            />
            {/* Skin volume: light on the cheekbones, shadow under the jaw */}
            <path
              d="M150 40 C120 40 108 62 108 86 C108 116 126 138 150 138 C174 138 192 116 192 86 C192 62 180 40 150 40 Z"
              fill="url(#vmx-cheeklight)"
            />
            <path
              d="M150 40 C120 40 108 62 108 86 C108 116 126 138 150 138 C174 138 192 116 192 86 C192 62 180 40 150 40 Z"
              fill="url(#vmx-jawshade)"
            />
            {/* Groomed short beard shadow along the jawline */}
            <path
              d="M114 100 C116 126 132 140 150 140 C168 140 184 126 186 100 C182 122 168 132 150 132 C132 132 118 122 114 100 Z"
              fill="oklch(0.34 0.03 40 / 0.30)"
              filter="url(#vmx-soft)"
            />
            {/* Hair: base mass plus strand detail */}
            <path
              d="M106 84 C102 52 122 32 150 32 C178 32 198 52 194 84 C190 70 178 58 150 58 C122 58 110 70 106 84 Z"
              fill="url(#vmx-hair)"
            />
            <g
              stroke="oklch(0.40 0.04 42 / 0.55)"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
            >
              <path d="M114 78 C116 56 132 40 152 39" />
              <path d="M122 74 C126 56 140 42 158 40" />
              <path d="M132 70 C138 54 152 42 168 44" />
              <path d="M186 78 C184 56 172 42 156 39" />
              <path d="M178 72 C176 55 166 44 152 41" />
            </g>
            {/* Sideburns */}
            <path
              d="M108 82 C107 92 109 98 112 100 C110 92 110 86 111 82 Z"
              fill="oklch(0.24 0.025 40)"
            />
            <path
              d="M192 82 C193 92 191 98 188 100 C190 92 190 86 189 82 Z"
              fill="oklch(0.24 0.025 40)"
            />
            {/* Brows */}
            <g
              style={{
                transform: `translateY(${browLift}px)`,
                transition: "transform 180ms ease-out",
              }}
            >
              <path
                d={`M126 76 Q135 ${thinking ? 68 : 71} 145 75`}
                stroke="oklch(0.24 0.03 40)"
                strokeWidth="3.4"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d={`M155 75 Q165 ${curious ? 68 : 71} 174 76`}
                stroke="oklch(0.24 0.03 40)"
                strokeWidth="3.4"
                strokeLinecap="round"
                fill="none"
              />
            </g>
            {/* Eyes */}
            <g>
              <ellipse
                cx="135"
                cy="90"
                rx="9"
                ry={blink ? 0.9 : 5.6}
                fill="oklch(0.97 0.005 240)"
              />
              <ellipse
                cx="165"
                cy="90"
                rx="9"
                ry={blink ? 0.9 : 5.6}
                fill="oklch(0.97 0.005 240)"
              />
              {!blink && (
                <>
                  <circle cx={135 + gaze} cy="90" r="4.4" fill="url(#vmx-iris)" />
                  <circle cx={165 + gaze} cy="90" r="4.4" fill="url(#vmx-iris)" />
                  <circle cx={135 + gaze} cy="90" r="1.9" fill="oklch(0.13 0.01 250)" />
                  <circle cx={165 + gaze} cy="90" r="1.9" fill="oklch(0.13 0.01 250)" />
                  <circle cx={136.4 + gaze} cy="88.2" r="1.2" fill="oklch(0.99 0 0 / 0.92)" />
                  <circle cx={166.4 + gaze} cy="88.2" r="1.2" fill="oklch(0.99 0 0 / 0.92)" />
                  {/* Lower-lid catchlight */}
                  <path
                    d="M129 93.6 Q135 96 141 93.6"
                    stroke="oklch(0.98 0.01 60 / 0.35)"
                    strokeWidth="1"
                    fill="none"
                  />
                  <path
                    d="M159 93.6 Q165 96 171 93.6"
                    stroke="oklch(0.98 0.01 60 / 0.35)"
                    strokeWidth="1"
                    fill="none"
                  />
                </>
              )}
              {/* Upper lash line gives the eyes real weight */}
              <path
                d="M126 86.5 Q135 82.4 144 86.5"
                stroke="oklch(0.22 0.02 40)"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M156 86.5 Q165 82.4 174 86.5"
                stroke="oklch(0.22 0.02 40)"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
              />
            </g>
            {/* Nose */}
            <path
              d="M150 96 Q147 106 152 110"
              stroke="oklch(0.66 0.06 46)"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
            />
            {/* Mouth: lip-synced ellipse + smile curve */}
            {openness > 0.12 ? (
              <g>
                <ellipse
                  cx="150"
                  cy="120"
                  rx={mouthWidth / 2}
                  ry={mouthHeight / 2}
                  fill="oklch(0.26 0.06 20)"
                />
                {/* Upper teeth + tongue read as speech, not a hole */}
                <path
                  d={`M${150 - mouthWidth / 2 + 2} ${120 - mouthHeight / 2 + 1.4} h${mouthWidth - 4} v2.6 h${-(mouthWidth - 4)} Z`}
                  fill="oklch(0.95 0.01 90)"
                />
                {openness > 0.35 && (
                  <ellipse
                    cx="150"
                    cy={120 + mouthHeight / 4}
                    rx={mouthWidth / 3.4}
                    ry={mouthHeight / 5}
                    fill="oklch(0.48 0.11 18)"
                  />
                )}
                <ellipse
                  cx="150"
                  cy="120"
                  rx={mouthWidth / 2}
                  ry={mouthHeight / 2}
                  fill="none"
                  stroke="url(#vmx-lip)"
                  strokeWidth="2.6"
                />
              </g>
            ) : (
              <path
                d={
                  smile
                    ? "M136 118 Q150 130 164 118"
                    : thinking
                      ? "M138 121 Q150 118 162 122"
                      : "M138 120 Q150 124 162 120"
                }
                stroke="oklch(0.44 0.09 22)"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
            )}
            {/* Cheek warmth on smile */}
            {smile && (
              <>
                <ellipse cx="124" cy="106" rx="8" ry="5" fill="oklch(0.72 0.09 30 / 0.45)" />
                <ellipse cx="176" cy="106" rx="8" ry="5" fill="oklch(0.72 0.09 30 / 0.45)" />
              </>
            )}
            {/* Thinking cue */}
            {thinking && (
              <g className="animate-pulse">
                <circle cx="206" cy="52" r="2.6" fill="oklch(0.79 0.144 191)" />
                <circle cx="215" cy="44" r="3.4" fill="oklch(0.79 0.144 191 / 0.7)" />
                <circle cx="226" cy="34" r="4.4" fill="oklch(0.79 0.144 191 / 0.45)" />
              </g>
            )}
          </g>
        </g>
      </svg>

      <style>{`@keyframes vmx-nod {
        0% { transform: translateY(0) rotate(0deg); }
        30% { transform: translateY(5px) rotate(1.5deg); }
        60% { transform: translateY(-2px) rotate(-1deg); }
        100% { transform: translateY(0) rotate(0deg); }
      }`}</style>

      {/* Status chip */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            speaking
              ? "bg-primary animate-pulse"
              : listening
                ? "bg-accent animate-pulse"
                : "bg-muted-foreground",
          )}
        />
        <span className="font-medium">
          {speaking
            ? "Vera is speaking"
            : listening
              ? "Vera is listening"
              : "Vera Kapoor · Interviewer"}
        </span>
      </div>
    </div>
  );
}
