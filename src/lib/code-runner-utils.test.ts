import assert from "node:assert/strict";
import test from "node:test";
import { judge0ErrorMessage, normalizeCodeOutput } from "./code-runner-utils.ts";

test("program output normalizes CRLF and outer whitespace", () => {
  assert.equal(normalizeCodeOutput(" \r\nHello\r\nworld \r\n"), "Hello\nworld");
});

test("Judge0 HTTP failures include the response message", () => {
  assert.equal(
    judge0ErrorMessage({ message: "Rate limit exceeded" }, { ok: false, status: 429 }),
    "Code runner request failed (HTTP 429): Rate limit exceeded",
  );
});

test("Judge0 compile and runtime failures include diagnostics", () => {
  assert.equal(
    judge0ErrorMessage(
      {
        status: { id: 6, description: "Compilation Error" },
        compile_output: "missing semicolon",
      },
      { ok: true, status: 200 },
    ),
    "Compilation Error\nmissing semicolon",
  );
  assert.equal(
    judge0ErrorMessage(
      { status: { id: 7, description: "Runtime Error" }, stderr: "division by zero" },
      { ok: true, status: 200 },
    ),
    "Runtime Error\ndivision by zero",
  );
});

test("a wrong answer remains a test mismatch rather than a runner error", () => {
  assert.equal(
    judge0ErrorMessage(
      { status: { id: 4, description: "Wrong Answer" } },
      { ok: true, status: 200 },
    ),
    undefined,
  );
});
