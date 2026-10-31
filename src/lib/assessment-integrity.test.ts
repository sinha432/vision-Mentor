import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSESSMENT_HIGH_NOISE_DURATION_MS,
  assessmentViolationForEvent,
  recordAssessmentViolation,
  shouldTerminateForAssessmentEvent,
  type AssessmentStrikeState,
} from "./assessment-integrity.ts";

const initialState = (): AssessmentStrikeState => ({
  phone: 0,
  audio: 0,
  lastAudioWarningAt: null,
});

test("phone and audio maintain independent three-warning limits", () => {
  let state = initialState();
  const phoneOne = recordAssessmentViolation(state, "phone", 20_000);
  state = phoneOne.state;
  assert.equal(phoneOne.warningNumber, 1);
  assert.equal(phoneOne.shouldTerminate, false);

  const audioOne = recordAssessmentViolation(state, "audio", 20_001);
  state = audioOne.state;
  assert.equal(audioOne.warningNumber, 1);
  assert.equal(audioOne.shouldTerminate, false);

  const phoneTwo = recordAssessmentViolation(state, "phone", 20_002);
  state = phoneTwo.state;
  assert.equal(phoneTwo.warningNumber, 2);
  assert.equal(phoneTwo.shouldTerminate, false);

  const phoneThree = recordAssessmentViolation(state, "phone", 20_003);
  assert.equal(phoneThree.warningNumber, 3);
  assert.equal(phoneThree.shouldTerminate, true);
  assert.equal(phoneThree.state.audio, 1);
});

test("overlapping background-noise and background-voice events share one audio strike", () => {
  const first = recordAssessmentViolation(initialState(), "audio", 30_000);
  const overlap = recordAssessmentViolation(first.state, "audio", 30_001);
  assert.equal(first.warningNumber, 1);
  assert.equal(overlap.warningNumber, null);
  assert.equal(overlap.state.audio, 1);

  const afterCooldown = recordAssessmentViolation(overlap.state, "audio", 40_000);
  assert.equal(afterCooldown.warningNumber, 2);
});

test("only phone and sustained-audio event kinds consume violation strikes", () => {
  assert.equal(assessmentViolationForEvent("device_visible"), "phone");
  assert.equal(assessmentViolationForEvent("background_noise"), "audio");
  assert.equal(assessmentViolationForEvent("background_voice"), "audio");
  assert.equal(assessmentViolationForEvent("face_missing"), null);
});

test("phone detections only terminate after three warnings, regardless of confidence", () => {
  assert.equal(
    shouldTerminateForAssessmentEvent({
      kind: "device_visible",
      confidence: 100,
    }),
    false,
  );
  let state = initialState();
  for (let warning = 1; warning <= 3; warning += 1) {
    const decision = recordAssessmentViolation(state, "phone", warning * 10_000);
    state = decision.state;
    assert.equal(decision.warningNumber, warning);
    assert.equal(decision.shouldTerminate, warning === 3);
  }
  assert.equal(
    shouldTerminateForAssessmentEvent({
      kind: "background_noise",
      confidence: 55,
    }),
    true,
  );
  assert.equal(
    shouldTerminateForAssessmentEvent({
      kind: "background_voice",
      confidence: 100,
    }),
    false,
  );
  assert.equal(
    shouldTerminateForAssessmentEvent({
      kind: "background_noise",
      confidence: 54,
    }),
    false,
  );
  assert.equal(ASSESSMENT_HIGH_NOISE_DURATION_MS, 10_000);
});
