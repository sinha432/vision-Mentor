import {
  SEVERITY_RANK,
  type CoachArea,
  type CoachingEvent,
  type FlagSeverity,
  type ProctorKind,
} from "./interview-types";

/**
 * How much each presentation area costs a candidate at its worst. Gaze and
 * posture read as disinterest and sink a round; grooming and pace are
 * noticeable; framing is mostly polish.
 */
const AREA_WEIGHT: Record<CoachArea, number> = {
  eye_contact: 3,
  posture: 3,
  grooming: 2,
  hair: 2,
  delivery: 2,
  framing: 1,
};

/**
 * Severity blends how damaging the area is with how sure the detector is: a
 * high-weight area only becomes "high" when the detection is confident.
 */
export function deriveSeverity(area: CoachArea, confidence: number): FlagSeverity {
  const weight = AREA_WEIGHT[area] ?? 1;
  const sure = Math.max(0, Math.min(100, confidence)) / 100;
  const score = weight * sure;
  if (score >= 2.3) return "high";
  if (score >= 1.2) return "medium";
  return "low";
}

const PROCTOR_SEVERITY: Record<ProctorKind, FlagSeverity> = {
  multiple_people: "high",
  device_visible: "high",
  multiple_voices: "high",
  ended_early: "high",
  tab_switch: "medium",
  warning_issued: "high",
  face_missing: "medium",
  looking_away: "medium",
  background_noise: "low",
  unusual_movement: "low",
};

export function proctorSeverity(kind: ProctorKind): FlagSeverity {
  return PROCTOR_SEVERITY[kind] ?? "medium";
}

/** Highest severity first, then most confident, then oldest. */
export function byPriority(a: CoachingEvent, b: CoachingEvent) {
  const rank = SEVERITY_RANK[b.severity ?? "low"] - SEVERITY_RANK[a.severity ?? "low"];
  if (rank !== 0) return rank;
  const sure = (b.confidence ?? 0) - (a.confidence ?? 0);
  if (sure !== 0) return sure;
  return a.t - b.t;
}

/**
 * Pick the single correction worth interrupting for. Low-severity items are
 * held back for the panel and the report so the candidate is never nagged.
 */
export function pickSpokenCorrection(pending: CoachingEvent[]): CoachingEvent | null {
  const worth = pending.filter((e) => (e.severity ?? "low") !== "low");
  if (!worth.length) return null;
  return [...worth].sort(byPriority)[0];
}
