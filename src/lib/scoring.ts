// Type-aware scoring with weights.
import type { StoredQuestion, TypedAnswer } from "./assessment-types";

export function scoreText(answer: string, q: StoredQuestion): { score: number; notes: string } {
  const a = (answer ?? "").trim();
  if (!a) return { score: 0, notes: "No answer provided." };

  const target = q.maxLength && q.maxLength > 0 ? q.maxLength : 200;
  const completeness = Math.min(1, a.length / Math.max(40, target * 0.5));

  const keywords = (q.keywords ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean);
  let matched = 0;
  const lower = a.toLowerCase();
  for (const k of keywords) {
    const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) matched++;
  }
  const keywordScore = keywords.length ? matched / keywords.length : null;
  const blended = keywordScore === null ? completeness : 0.5 * completeness + 0.5 * keywordScore;
  const score = Math.round(blended * 100);

  const parts: string[] = [];
  if (keywords.length) parts.push(`Covered ${matched}/${keywords.length} keywords`);
  parts.push(a.length < 60 ? "very brief" : a.length < 200 ? "concise" : "detailed");
  if (q.maxLength && a.length > q.maxLength) parts.push("over max length");
  return { score, notes: parts.join(" · ") };
}

export function scoreMcq(choiceId: string | undefined, q: StoredQuestion): { score: number; notes: string } {
  if (!choiceId) return { score: 0, notes: "No option selected." };
  const ok = choiceId === q.correctChoiceId;
  const chosen = q.choices?.find((c) => c.id === choiceId)?.text ?? "(unknown)";
  return { score: ok ? 100 : 0, notes: ok ? `Correct — chose "${chosen}"` : `Incorrect — chose "${chosen}"` };
}

export function scoreCode(run: { passed: number; total: number } | null | undefined): { score: number; notes: string } {
  if (!run || !run.total) return { score: 0, notes: "Code not run against tests." };
  const score = Math.round((run.passed / run.total) * 100);
  return { score, notes: `Passed ${run.passed}/${run.total} test case${run.total === 1 ? "" : "s"}` };
}

export function scoreAnswerTyped(ans: TypedAnswer | undefined, q: StoredQuestion): { score: number; notes: string } {
  const t = q.type ?? "text";
  if (t === "mcq") return scoreMcq(ans?.choiceId, q);
  if (t === "code") return scoreCode(ans?.runResults ?? null);
  return scoreText(ans?.textAnswer ?? "", q);
}

export function weightedOverall(items: { score: number; weight: number }[]): number {
  if (!items.length) return 0;
  const totalW = items.reduce((s, i) => s + (i.weight || 1), 0);
  if (!totalW) return 0;
  return Math.round(items.reduce((s, i) => s + i.score * (i.weight || 1), 0) / totalW);
}
