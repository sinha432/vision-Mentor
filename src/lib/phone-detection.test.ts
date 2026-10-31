import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyVisionObjectLabel,
  isHandNearObject,
  PhoneDetectionTracker,
} from "./phone-detection.ts";

test("phone detection requires five matching frames in the rolling eight-frame window", () => {
  const tracker = new PhoneDetectionTracker();
  for (let frame = 0; frame < 4; frame += 1) {
    assert.equal(
      tracker.record({
        label: "cell phone",
        confidence: 0.9,
        detectorCategory: "phone",
        detectorConfidence: 0.9,
        classifierCategory: "phone",
        classifierConfidence: 0.95,
      }).confirmed,
      false,
    );
  }
  assert.equal(
    tracker.record({
      label: "cell phone",
      confidence: 0.9,
      detectorCategory: "phone",
      detectorConfidence: 0.9,
      classifierCategory: "phone",
      classifierConfidence: 0.95,
    }).state,
    "phone_detected",
  );
});

test("isolated phone detections are possible, not confirmed", () => {
  const tracker = new PhoneDetectionTracker();
  assert.equal(
    tracker.record({
      label: "cell phone",
      confidence: 0.9,
      detectorCategory: "phone",
      detectorConfidence: 0.9,
      classifierCategory: "phone",
      classifierConfidence: 0.95,
    }).state,
    "possible_phone",
  );
  for (let frame = 0; frame < 7; frame += 1) {
    assert.equal(tracker.record(null).confirmed, false);
  }
});

test("wallet and other rectangular classes never count as phone detections", () => {
  const tracker = new PhoneDetectionTracker();
  for (let frame = 0; frame < 8; frame += 1) {
    const result = tracker.record({
      label: "cell phone",
      confidence: 0.99,
      detectorCategory: "wallet",
      detectorConfidence: 0.99,
      classifierCategory: "wallet",
      classifierConfidence: 0.99,
    });
    assert.equal(result.confirmed, false);
    assert.equal(result.state, "wallet_detected");
  }
  assert.equal(classifyVisionObjectLabel("calculator"), "calculator");
  assert.equal(classifyVisionObjectLabel("notebook"), "notebook");
  assert.equal(classifyVisionObjectLabel("id_card"), "id_card");
  assert.equal(classifyVisionObjectLabel("book"), "other");
});

test("phone detector and crop classifier must agree on PHONE", () => {
  const tracker = new PhoneDetectionTracker();
  for (let frame = 0; frame < 8; frame += 1) {
    const result = tracker.record({
      label: "cell phone",
      confidence: 0.99,
      detectorCategory: "phone",
      detectorConfidence: 0.99,
      classifierCategory: "wallet",
      classifierConfidence: 0.99,
    });
    assert.equal(result.confirmed, false);
    assert.equal(result.state, "uncertain");
  }
});

test("a disagreement clears prior phone verification votes", () => {
  const tracker = new PhoneDetectionTracker();
  const phone = {
    label: "PHONE",
    confidence: 0.95,
    detectorCategory: "phone" as const,
    detectorConfidence: 0.95,
    classifierCategory: "phone" as const,
    classifierConfidence: 0.95,
  };
  for (let frame = 0; frame < 4; frame += 1) tracker.record(phone);
  const disagreement = tracker.record({
    ...phone,
    classifierCategory: "wallet",
  });
  assert.equal(disagreement.confirmed, false);
  for (let frame = 0; frame < 4; frame += 1) {
    assert.equal(tracker.record(phone).confirmed, false);
  }
});

test("one custom model cannot label an object as a possible phone", () => {
  const tracker = new PhoneDetectionTracker();
  for (let frame = 0; frame < 8; frame += 1) {
    const result = tracker.record({
      label: "cell phone",
      confidence: 0.99,
      classifierCategory: "phone",
      classifierConfidence: 0.99,
    });
    assert.equal(result.confirmed, false);
    assert.equal(result.state, "uncertain");
  }
});

test("base detector phone guesses remain uncertain without trained model agreement", () => {
  const tracker = new PhoneDetectionTracker();
  const firstFrame = tracker.record({ label: "cell phone", confidence: 0.99 });
  assert.equal(firstFrame.state, "uncertain");
  assert.equal(firstFrame.confirmed, false);
  assert.equal(firstFrame.phoneDetections, 0);

  const repeatedGuess = tracker.record({ label: "cell phone", confidence: 0.99 });
  assert.equal(repeatedGuess.state, "uncertain");
  assert.equal(repeatedGuess.confirmed, false);
});

test("a trusted custom wallet classification is shown as a wallet, not a phone", () => {
  const result = new PhoneDetectionTracker().record({
    label: "wallet",
    confidence: 0.95,
    classifierCategory: "wallet",
    classifierConfidence: 0.99,
  });
  assert.equal(result.state, "wallet_detected");
  assert.equal(result.confirmed, false);
});

test("phone confirmation thresholds can be configured", () => {
  const tracker = new PhoneDetectionTracker({
    historyFrames: 4,
    minPhoneDetections: 3,
    minPhoneConfidence: 0.6,
    minObjectClassConfidence: 0.7,
    minClassifierConfidence: 0.9,
  });
  const candidate = {
    label: "cell phone",
    confidence: 0.8,
    detectorCategory: "phone" as const,
    detectorConfidence: 0.85,
    classifierCategory: "phone" as const,
    classifierConfidence: 0.95,
  };
  assert.equal(tracker.record(candidate).confirmed, false);
  assert.equal(tracker.record(candidate).confirmed, false);
  assert.equal(tracker.record(candidate).confirmed, true);
  assert.throws(
    () => new PhoneDetectionTracker({ historyFrames: 2, minPhoneDetections: 3 }),
    RangeError,
  );
});

test("low-confidence and target-changed detections do not carry confirmation history", () => {
  const tracker = new PhoneDetectionTracker();
  for (let frame = 0; frame < 4; frame += 1) {
    tracker.record({
      label: "cell phone",
      confidence: 0.9,
      detectorCategory: "phone",
      detectorConfidence: 0.9,
      classifierCategory: "phone",
      classifierConfidence: 0.9,
      center: { x: 0.2, y: 0.2 },
    });
  }
  assert.equal(
    tracker.record({
      label: "cell phone",
      confidence: 0.9,
      detectorCategory: "phone",
      detectorConfidence: 0.9,
      classifierCategory: "phone",
      classifierConfidence: 0.7,
      center: { x: 0.2, y: 0.2 },
    }).confirmed,
    false,
  );

  tracker.reset();
  for (let frame = 0; frame < 4; frame += 1) {
    tracker.record({
      label: "cell phone",
      confidence: 0.9,
      detectorCategory: "phone",
      detectorConfidence: 0.9,
      classifierCategory: "phone",
      classifierConfidence: 0.9,
      center: { x: 0.2, y: 0.2 },
    });
  }
  assert.equal(
    tracker.record({
      label: "cell phone",
      confidence: 0.9,
      detectorCategory: "phone",
      detectorConfidence: 0.9,
      classifierCategory: "phone",
      classifierConfidence: 0.9,
      center: { x: 0.9, y: 0.9 },
    }).confirmed,
    false,
  );
});

test("hand landmarks only report proximity and never independently confirm a phone", () => {
  assert.equal(
    isHandNearObject([[{ x: 0.5, y: 0.5 }]], {
      x: 0.45,
      y: 0.45,
      width: 0.1,
      height: 0.1,
    }),
    true,
  );
  const result = new PhoneDetectionTracker().record(null, true);
  assert.equal(result.confirmed, false);
  assert.equal(result.held, false);
});
