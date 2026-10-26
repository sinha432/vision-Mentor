import assert from "node:assert/strict";
import test from "node:test";
import {
  interviewOwnerFilter,
  interviewRecordFilter,
  isInterviewOwnedBy,
} from "./interview-access.ts";

const owner = { id: "user-1", email: "owner@example.com" };

test("interview ownership matches the authenticated user id", () => {
  assert.equal(isInterviewOwnedBy({ userId: owner.id, email: "other@example.com" }, owner), true);
});

test("legacy interview ownership requires matching email when user id is absent", () => {
  assert.equal(isInterviewOwnedBy({ email: owner.email }, owner), true);
  assert.equal(isInterviewOwnedBy({ email: "other@example.com" }, owner), false);
});

test("a mismatched user id cannot claim a legacy matching-email record", () => {
  assert.equal(isInterviewOwnedBy({ userId: "other-user", email: owner.email }, owner), false);
});

test("Mongo owner filter scopes legacy records to their matching email", () => {
  assert.deepEqual(interviewOwnerFilter(owner), {
    $or: [{ userId: "user-1" }, { userId: { $exists: false }, email: "owner@example.com" }],
  });
});

test("interview deletion query always includes both session id and owner scope", () => {
  assert.deepEqual(interviewRecordFilter("session-1", owner), {
    sessionId: "session-1",
    $or: [{ userId: "user-1" }, { userId: { $exists: false }, email: "owner@example.com" }],
  });
});
