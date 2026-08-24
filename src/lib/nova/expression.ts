export type NovaExpression =
  | "neutral"
  | "happy"
  | "angry"
  | "confused"
  | "sad"
  | "surprised"
  | "thinking";

export type NovaState = "idle" | "listening" | "speaking" | "thinking";

/** Canonical ordered list of every expression Nova can show — used to cycle demos. */
export const NOVA_EXPRESSIONS: NovaExpression[] = [
  "neutral",
  "happy",
  "angry",
  "confused",
  "sad",
  "surprised",
  "thinking",
];

/** Pseudo-speech envelope — layered sines so the mouth never loops obviously. */
export function mouthWave(t: number): number {
  return (
    0.45 +
    0.34 * Math.sin(t * 15.5) +
    0.16 * Math.sin(t * 7.3 + 1.1) +
    0.08 * Math.sin(t * 26.7 + 0.4)
  );
}

export function expressionLabel(expression: NovaExpression): string {
  switch (expression) {
    case "happy":
      return "Cheerful";
    case "angry":
      return "Firm";
    case "confused":
      return "Puzzled";
    case "sad":
      return "Concerned";
    case "surprised":
      return "Surprised";
    case "thinking":
      return "Thinking";
    default:
      return "Neutral";
  }
}

export function stateLabel(state: NovaState): string {
  switch (state) {
    case "listening":
      return "Listening";
    case "speaking":
      return "Speaking";
    case "thinking":
      return "Thinking";
    default:
      return "Idle";
  }
}

/** Knowledge-based intent + sentiment read of a turn, mapped to a face. */
const RULES: { match: RegExp; expression: NovaExpression }[] = [
  { match: /\b(thanks|thank you|great|awesome|nice|love|perfect|well done|excellent)\b/i, expression: "happy" },
  { match: /\b(wow|really\?|no way|incredible|amazing|unbelievable)\b/i, expression: "surprised" },
  { match: /\b(confus|don'?t understand|do not understand|unclear|what do you mean|huh)\b/i, expression: "confused" },
  { match: /\b(sad|worried|nervous|anxious|scared|failed|rejected|stressed|tired)\b/i, expression: "sad" },
  { match: /\b(stupid|useless|hate|shut up|rubbish|idiot|dumb)\b/i, expression: "angry" },
  { match: /\b(why|how|explain|compare|analy[sz]e|score|evaluate|think)\b/i, expression: "thinking" },
  { match: /\?\s*$/, expression: "thinking" },
];

export function analyzeExpression(text: string, fallback: NovaExpression = "neutral"): NovaExpression {
  const value = text.trim();
  if (!value) return fallback;
  for (const rule of RULES) if (rule.match.test(value)) return rule.expression;
  return fallback;
}
