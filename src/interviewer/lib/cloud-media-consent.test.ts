import assert from "node:assert/strict";
import test from "node:test";
import { shouldSendCloudMedia } from "./cloud-media-consent.ts";

test("cloud media is sent only with consent, ready interview, and available media", () => {
  assert.equal(
    shouldSendCloudMedia({ consent: false, mediaAvailable: true, interviewReady: true }),
    false,
  );
  assert.equal(
    shouldSendCloudMedia({ consent: true, mediaAvailable: false, interviewReady: true }),
    false,
  );
  assert.equal(
    shouldSendCloudMedia({ consent: true, mediaAvailable: true, interviewReady: false }),
    false,
  );
  assert.equal(
    shouldSendCloudMedia({ consent: true, mediaAvailable: true, interviewReady: true }),
    true,
  );
});
