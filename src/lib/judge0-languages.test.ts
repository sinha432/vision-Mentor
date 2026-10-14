import assert from "node:assert/strict";
import test from "node:test";
import { JUDGE0_LANGUAGE_IDS } from "./judge0-languages.ts";

test("Judge0 language IDs cover every assessment code language", () => {
  assert.deepEqual(JUDGE0_LANGUAGE_IDS, {
    java: 62,
    javascript: 63,
    python: 71,
    c: 50,
    cpp: 54,
  });
});
