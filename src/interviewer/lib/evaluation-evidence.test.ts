import assert from "node:assert/strict";
import test from "node:test";
import {
  evidenceCoverage,
  summarizeBenchmark,
  validateEvidence,
} from "./evaluation-evidence.ts";

test("only exact answer spans are accepted as evidence", () => {
  const evidence = validateEvidence("I used a composite index for the filter and sort.", [
    { criterion: "Composite index", quote: "composite index" },
    { criterion: "Keyset pagination", quote: "I used keyset pagination" },
  ]);

  assert.deepEqual(evidence, [
    {
      criterion: "Composite index",
      quote: "composite index",
      start: 9,
      end: 24,
    },
  ]);
});

test("evidence validation bounds output and removes duplicate criteria", () => {
  const evidence = validateEvidence("the same phrase", [
    { criterion: "Repeated", quote: "same phrase" },
    { criterion: "repeated", quote: "the same phrase" },
  ]);

  assert.equal(evidence.length, 1);
});

test("evidence coverage is bounded and handles empty rubrics", () => {
  assert.equal(evidenceCoverage(2, 4), 50);
  assert.equal(evidenceCoverage(8, 4), 100);
  assert.equal(evidenceCoverage(1, 0), 0);
});

test("benchmark summary reports bounded MAE and tolerance rate", () => {
  assert.deepEqual(
    summarizeBenchmark([
      { expected: 80, actual: 85 },
      { expected: 50, actual: 30 },
      { expected: 120, actual: 100 },
    ]),
    { count: 3, meanAbsoluteError: 8.33, withinTenPoints: 67 },
  );
});
