import assert from "node:assert/strict";
import test from "node:test";
import {
  describeEmailJsFailure,
  missingAssessmentEmailSettings,
  type AssessmentEmailSettings,
} from "./assessment-email.ts";

test("assessment email settings report missing names without exposing values", () => {
  const settings: AssessmentEmailSettings = {
    EMAILJS_ASSESSMENT_SERVICE_ID: "configured-service",
    EMAILJS_ASSESSMENT_TEMPLATE_ID: "",
    EMAILJS_ASSESSMENT_PUBLIC_KEY: "configured-public",
    EMAILJS_ASSESSMENT_PRIVATE_KEY: undefined,
  };
  assert.deepEqual(missingAssessmentEmailSettings(settings), [
    "EMAILJS_ASSESSMENT_TEMPLATE_ID",
    "EMAILJS_ASSESSMENT_PRIVATE_KEY",
  ]);
});

test("EmailJS failures explain server access, templates, throttling, and outages", () => {
  assert.match(
    describeEmailJsFailure(403, "non-browser environments are disabled"),
    /server-side API access is disabled/,
  );
  assert.match(describeEmailJsFailure(400, "bad request"), /template parameters/);
  assert.match(describeEmailJsFailure(429, "too many"), /rate limit/);
  assert.match(describeEmailJsFailure(503, "unavailable"), /temporarily unavailable/);
});
