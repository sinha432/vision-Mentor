import assert from "node:assert/strict";
import test from "node:test";
import { retrieveGroundedSources, validateSourceCitations } from "./job-grounding.ts";

test("retrieval ranks relevant resume and job-description evidence", () => {
  const sources = retrieveGroundedSources(
    "We need a React engineer with accessibility experience.",
    "Built accessible React components and improved keyboard navigation.",
    "React accessibility",
  );

  assert.equal(sources.length, 2);
  assert.ok(sources.some((source) => source.source === "job_description"));
  assert.ok(sources.some((source) => source.source === "resume"));
});

test("source citations must quote retrieved source text exactly", () => {
  const sources = retrieveGroundedSources(
    "Experience with Python distributed systems required.",
    "Built a Python worker service.",
    "Python distributed systems",
  );
  const citations = validateSourceCitations(
    [
      { sourceId: "jd-1", quote: "Python distributed systems" },
      { sourceId: "jd-1", quote: "Led a team of engineers" },
      { sourceId: "unknown", quote: "Python" },
    ],
    sources,
  );

  assert.deepEqual(citations, [{ sourceId: "jd-1", quote: "Python distributed systems" }]);
});

test("retrieval is empty when there is no lexical evidence overlap", () => {
  assert.deepEqual(
    retrieveGroundedSources("Kubernetes and Go", "Visual design and CSS", "React accessibility"),
    [],
  );
});

test("retrieval uses a deterministic source and line order for equal relevance", () => {
  const sources = retrieveGroundedSources(
    "React accessibility\nReact accessibility",
    "React accessibility\nReact accessibility",
    "React accessibility",
  );

  assert.deepEqual(
    sources.map((source) => source.id),
    ["jd-1", "jd-2", "resume-1", "resume-2"],
  );
});
