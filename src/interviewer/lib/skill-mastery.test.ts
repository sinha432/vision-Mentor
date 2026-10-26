import assert from "node:assert/strict";
import test from "node:test";
import { buildSkillMastery, recommendPractice } from "./skill-mastery.ts";

test("weak answers lower estimated mastery and raise practice priority", () => {
  const profiles = buildSkillMastery([
    { sessionId: "s1", topic: "React rendering", score: 35, evidenceCoverage: 0 },
  ]);

  assert.equal(profiles.length, 1);
  assert.ok(profiles[0].mastery < 20);
  assert.ok(profiles[0].priority > 100);
});

test("strong evidence raises estimated mastery and reports evidence volume", () => {
  const profiles = buildSkillMastery([
    { sessionId: "s1", topic: "React rendering", score: 90, evidenceCoverage: 100 },
    { sessionId: "s2", topic: "React rendering", score: 88, evidenceCoverage: 80 },
  ]);

  assert.ok(profiles[0].mastery > 50);
  assert.equal(profiles[0].observations, 2);
  assert.equal(profiles[0].evidenceCoverage, 90);
});

test("duplicate session observations are counted once", () => {
  const profiles = buildSkillMastery([
    { sessionId: "s1", topic: "React rendering", score: 80, evidenceCoverage: 100 },
    { sessionId: "s1", topic: "React rendering", score: 20, evidenceCoverage: 0 },
  ]);

  assert.equal(profiles[0].observations, 1);
});

test("practice suggestions use a known matching question and explain their ranking", () => {
  const profiles = buildSkillMastery([
    { sessionId: "s1", topic: "React rendering", score: 30, evidenceCoverage: 0 },
  ]);
  const suggestion = recommendPractice(profiles);

  assert.ok(suggestion);
  assert.equal(suggestion.skill, "React rendering");
  assert.match(suggestion.reason, /1 scored response/);
});
