import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeModelCallTelemetry } from "./model-telemetry.ts";

test("telemetry persistence keeps operational fields and strips candidate content", () => {
  const telemetry = sanitizeModelCallTelemetry({
    operation: "answer_evaluation",
    provider: "provider-a",
    model: "model-a",
    durationMs: 120,
    attempts: 2,
    outcome: "success",
    answer: "candidate answer",
    prompt: "private prompt",
    rawMedia: "data:image/jpeg;base64,secret",
  });

  assert.deepEqual(telemetry, {
    operation: "answer_evaluation",
    provider: "provider-a",
    model: "model-a",
    durationMs: 120,
    attempts: 2,
    outcome: "success",
  });
  assert.equal("answer" in telemetry, false);
  assert.equal("prompt" in telemetry, false);
  assert.equal("rawMedia" in telemetry, false);
});

test("telemetry rejects unbounded operational metadata", () => {
  assert.throws(() =>
    sanitizeModelCallTelemetry({
      operation: "answer_evaluation",
      provider: "p".repeat(41),
      model: "model",
      durationMs: 1,
      attempts: 1,
      outcome: "success",
    }),
  );
});
