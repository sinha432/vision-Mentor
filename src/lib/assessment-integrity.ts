export type AssessmentViolation = "phone" | "audio";

export const ASSESSMENT_PHONE_DETECTION_PRIORITY_CONFIDENCE = 90;
export const ASSESSMENT_HIGH_NOISE_DURATION_MS = 10_000;

export type AssessmentStrikeState = {
  phone: number;
  audio: number;
  lastAudioWarningAt: number | null;
};

export type AssessmentStrikeDecision = {
  state: AssessmentStrikeState;
  warningNumber: number | null;
  shouldTerminate: boolean;
};

export function assessmentViolationForEvent(kind: string): AssessmentViolation | null {
  if (kind === "device_visible") return "phone";
  if (kind === "background_noise" || kind === "background_voice") return "audio";
  return null;
}

export function shouldTerminateForAssessmentEvent(event: {
  kind: string;
  confidence: number;
}): boolean {
  return event.kind === "background_noise" && event.confidence >= 55;
}

export function recordAssessmentViolation(
  state: AssessmentStrikeState,
  violation: AssessmentViolation,
  now: number,
  audioCooldownMs = 10_000,
): AssessmentStrikeDecision {
  if (
    violation === "audio" &&
    state.lastAudioWarningAt !== null &&
    now - state.lastAudioWarningAt < audioCooldownMs
  ) {
    return { state, warningNumber: null, shouldTerminate: false };
  }

  const warningNumber = state[violation] + 1;
  const nextState: AssessmentStrikeState = {
    ...state,
    [violation]: warningNumber,
    ...(violation === "audio" ? { lastAudioWarningAt: now } : {}),
  };

  return {
    state: nextState,
    warningNumber,
    shouldTerminate: warningNumber >= 3,
  };
}
