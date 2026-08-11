// Data access for assessments, attempts and reports.
//
// The app runs without a database: these are plain async functions backed by
// this browser's localStorage (see local-db.ts). They keep the `{ data: ... }`
// call shape the screens already use. The one thing that still runs on the
// server is AI grading, because the model key must stay server-side.

import { z } from "zod";
import { newId, type StoredReport } from "./assessment-types";
import {
  deleteAssessmentLocal,
  findUserById,
  insertAssessment,
  insertAttempt,
  insertReport,
  readAssessments,
  readAttempts,
  readReports,
  setAssessmentStatusLocal,
  updateReportLocal,
} from "./local-db";
import { gradeTextAnswers } from "./grading.functions";
import { scoreAnswerTyped, weightedOverall } from "./scoring";

const choiceSchema = z.object({ id: z.string().min(1), text: z.string().trim().min(1).max(300) });
const testCaseSchema = z.object({
  input: z.string().max(10000).default(""),
  expectedStdout: z.string().max(10000).default(""),
});

const questionInput = z.object({
  type: z.enum(["text", "mcq", "code"]).default("text"),
  text: z.string().trim().min(3).max(2000),
  weight: z.number().min(0.1).max(100).default(1),
  keywords: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  maxLength: z.number().int().min(20).max(5000).nullable().default(null),
  choices: z.array(choiceSchema).max(8).optional(),
  correctChoiceId: z.string().optional(),
  starterCode: z.string().max(20000).optional(),
  testCases: z.array(testCaseSchema).max(10).optional(),
});

const createSchema = z.object({
  companyUserId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  questions: z.array(questionInput).min(1).max(30),
});

const runResultSchema = z
  .object({
    passed: z.number().int().min(0),
    total: z.number().int().min(0),
    cases: z
      .array(
        z.object({
          ok: z.boolean(),
          actual: z.string().max(20000),
          stderr: z.string().max(20000).optional(),
        }),
      )
      .max(20),
  })
  .nullable();

const typedAnswerSchema = z.object({
  type: z.enum(["text", "mcq", "code"]),
  textAnswer: z.string().max(20000).optional(),
  choiceId: z.string().max(100).optional(),
  code: z.string().max(50000).optional(),
  runResults: runResultSchema.optional(),
});

const visionSchema = z
  .object({
    avgEye: z.number().min(0).max(1),
    avgPosture: z.number().min(0).max(1),
    avgVoice: z.number().min(0).max(1).nullable().optional(),
    samples: z.number().int().min(0),
  })
  .nullable();

function identityFor(userId: string): { name: string; email: string } {
  if (userId === "demo") return { name: "Demo User", email: "demo@visionmentor.ai" };
  if (userId === "demo-company") return { name: "Demo Company", email: "company@visionmentor.ai" };
  const u = findUserById(userId);
  return u ? { name: u.name, email: u.email } : { name: "Unknown candidate", email: "" };
}

export async function createAssessment({ data }: { data: unknown }) {
  const input = createSchema.parse(data);
  return insertAssessment({
    companyUserId: input.companyUserId,
    title: input.title,
    questions: input.questions.map((q) => ({ id: newId(), ...q })),
  });
}

export async function listCompanyAssessments({ data }: { data: unknown }) {
  const { companyUserId } = z.object({ companyUserId: z.string().min(1) }).parse(data);
  const mine = readAssessments().filter((a) => a.companyUserId === companyUserId);
  const attempts = readAttempts();
  const reports = readReports();
  return mine.map((a) => {
    const mineAttempts = attempts.filter((t) => t.assessmentId === a._id);
    const scores = mineAttempts
      .map((t) => reports.find((r) => r.attemptId === t._id)?.overallScore)
      .filter((s): s is number => typeof s === "number");
    const avgScore = scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : null;
    return { ...a, attemptCount: mineAttempts.length, avgScore };
  });
}

export async function getAssessmentByCode({ data }: { data: unknown }) {
  const { code } = z.object({ code: z.string().trim().min(1) }).parse(data);
  return readAssessments().find((a) => a.code.toUpperCase() === code.toUpperCase()) ?? null;
}

export async function setAssessmentStatus({ data }: { data: unknown }) {
  const input = z
    .object({
      assessmentId: z.string().min(1),
      companyUserId: z.string().min(1),
      status: z.enum(["active", "closed"]),
    })
    .parse(data);
  const a = readAssessments().find((x) => x._id === input.assessmentId);
  if (!a || a.companyUserId !== input.companyUserId) throw new Error("Not authorized");
  return setAssessmentStatusLocal(input.assessmentId, input.status);
}

export async function deleteAssessment({ data }: { data: unknown }) {
  const input = z
    .object({ assessmentId: z.string().min(1), companyUserId: z.string().min(1) })
    .parse(data);
  const a = readAssessments().find((x) => x._id === input.assessmentId);
  if (!a || a.companyUserId !== input.companyUserId) throw new Error("Not authorized");
  deleteAssessmentLocal(input.assessmentId);
  return { ok: true };
}

export async function submitAttempt({ data }: { data: unknown }) {
  const input = z
    .object({
      code: z.string().trim().min(1),
      individualUserId: z.string().min(1),
      answers: z.record(z.string(), typedAnswerSchema),
      vision: visionSchema.default(null),
    })
    .parse(data);

  const assessment = readAssessments().find((a) => a.code.toUpperCase() === input.code.toUpperCase());
  if (!assessment) throw new Error("Assessment not found");
  if (assessment.status === "closed") {
    throw new Error("This assessment is closed and no longer accepting submissions.");
  }

  const attempt = insertAttempt({
    assessmentId: assessment._id,
    individualUserId: input.individualUserId,
    answers: input.answers,
    vision: input.vision,
  });

  const textQuestions = assessment.questions.filter((q) => (q.type ?? "text") === "text");
  const aiScores = textQuestions.length
    ? await gradeTextAnswers({
        data: {
          items: textQuestions.map((q) => ({
            question: {
              id: q.id,
              type: q.type ?? "text",
              text: q.text,
              weight: q.weight ?? 1,
              keywords: q.keywords ?? [],
              maxLength: q.maxLength ?? null,
            },
            answer: input.answers[q.id]?.textAnswer ?? "",
          })),
        },
      }).catch(() => [])
    : [];

  const per: StoredReport["perQuestionFeedback"] = assessment.questions.map((q) => {
    const type = q.type ?? "text";
    if (type === "text") {
      const graded = aiScores.find((g) => g.questionId === q.id);
      if (graded) {
        return { questionId: q.id, type, weight: q.weight ?? 1, score: graded.score, notes: graded.notes };
      }
    }
    const { score, notes } = scoreAnswerTyped(input.answers[q.id], q);
    return { questionId: q.id, type, weight: q.weight ?? 1, score, notes };
  });

  const report = insertReport({
    attemptId: attempt._id,
    perQuestionFeedback: per,
    overallScore: weightedOverall(per.map((p) => ({ score: p.score, weight: p.weight }))),
    vision: input.vision,
  });

  return { attemptId: attempt._id, reportId: report._id };
}

export async function rescoreAssessmentAttempts({ data }: { data: unknown }) {
  const input = z
    .object({ assessmentId: z.string().min(1), companyUserId: z.string().min(1) })
    .parse(data);

  const assessment = readAssessments().find((a) => a._id === input.assessmentId);
  if (!assessment || assessment.companyUserId !== input.companyUserId) throw new Error("Not authorized");

  const attempts = readAttempts().filter((t) => t.assessmentId === assessment._id);
  const reports = readReports();
  const results: { attemptId: string; reportId: string; before: number; after: number }[] = [];

  for (const attempt of attempts) {
    const report = reports.find((r) => r.attemptId === attempt._id);
    if (!report) continue;
    const before = report.overallScore;

    const textQuestions = assessment.questions.filter((q) => (q.type ?? "text") === "text");
    const aiScores = textQuestions.length
      ? await gradeTextAnswers({
          data: {
            items: textQuestions.map((q) => ({
              question: {
                id: q.id,
                type: q.type ?? "text",
                text: q.text,
                weight: q.weight ?? 1,
                keywords: q.keywords ?? [],
                maxLength: q.maxLength ?? null,
              },
              answer: attempt.answers[q.id]?.textAnswer ?? "",
            })),
          },
        }).catch(() => [])
      : [];

    const per: StoredReport["perQuestionFeedback"] = assessment.questions.map((q) => {
      const existing = report.perQuestionFeedback.find((p) => p.questionId === q.id);
      const type = q.type ?? "text";
      if (type !== "text") {
        return existing ?? { questionId: q.id, type, weight: q.weight ?? 1, score: 0, notes: "" };
      }
      const graded = aiScores.find((g) => g.questionId === q.id);
      if (graded) {
        return { questionId: q.id, type, weight: q.weight ?? 1, score: graded.score, notes: graded.notes };
      }
      const { score, notes } = scoreAnswerTyped(attempt.answers[q.id], q);
      return { questionId: q.id, type, weight: q.weight ?? 1, score, notes };
    });

    const after = weightedOverall(per.map((p) => ({ score: p.score, weight: p.weight })));
    updateReportLocal(report._id, { perQuestionFeedback: per, overallScore: after });
    results.push({ attemptId: attempt._id, reportId: report._id, before, after });
  }

  return { rescored: results.length, results };
}

export async function listIndividualReports({ data }: { data: unknown }) {
  const { individualUserId } = z.object({ individualUserId: z.string().min(1) }).parse(data);
  const assessments = readAssessments();
  const reports = readReports();
  return readAttempts()
    .filter((t) => t.individualUserId === individualUserId)
    .map((t) => {
      const a = assessments.find((x) => x._id === t.assessmentId);
      const r = reports.find((x) => x.attemptId === t._id);
      return {
        attemptId: t._id,
        submittedAt: t.submittedAt,
        assessmentTitle: a?.title ?? "Unknown",
        assessmentCode: a?.code ?? "",
        reportId: r?._id ?? null,
        overallScore: r?.overallScore ?? 0,
      };
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function listAssessmentAttempts({ data }: { data: unknown }) {
  const input = z
    .object({ assessmentId: z.string().min(1), companyUserId: z.string().min(1) })
    .parse(data);
  const a = readAssessments().find((x) => x._id === input.assessmentId);
  if (!a || a.companyUserId !== input.companyUserId) throw new Error("Not authorized");
  const reports = readReports();
  const attempts = readAttempts()
    .filter((t) => t.assessmentId === a._id)
    .map((t) => {
      const r = reports.find((x) => x.attemptId === t._id);
      const candidate = identityFor(t.individualUserId);
      return {
        attemptId: t._id,
        individualUserId: t.individualUserId,
        candidateName: candidate.name,
        candidateEmail: candidate.email,
        submittedAt: t.submittedAt,
        reportId: r?._id ?? null,
        overallScore: r?.overallScore ?? 0,
      };
    })
    .sort((x, y) => y.submittedAt.localeCompare(x.submittedAt));
  return { assessment: a, attempts };
}

export async function listCompanyCandidates({ data }: { data: unknown }) {
  const { companyUserId } = z.object({ companyUserId: z.string().min(1) }).parse(data);
  const mine = readAssessments().filter((a) => a.companyUserId === companyUserId);
  const mineIds = new Set(mine.map((a) => a._id));
  const reports = readReports();
  const relevant = readAttempts().filter((t) => mineIds.has(t.assessmentId));

  const byCandidate = new Map<string, typeof relevant>();
  for (const t of relevant) {
    const list = byCandidate.get(t.individualUserId) ?? [];
    list.push(t);
    byCandidate.set(t.individualUserId, list);
  }

  return [...byCandidate.entries()]
    .map(([userId, list]) => {
      const identity = identityFor(userId);
      const scores = list
        .map((t) => reports.find((r) => r.attemptId === t._id)?.overallScore)
        .filter((s): s is number => typeof s === "number");
      const sorted = [...list].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      return {
        individualUserId: userId,
        candidateName: identity.name,
        candidateEmail: identity.email,
        attemptCount: list.length,
        avgScore: scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : null,
        bestScore: scores.length ? Math.max(...scores) : null,
        lastSubmittedAt: sorted[0]?.submittedAt ?? "",
        assessments: [
          ...new Set(sorted.map((t) => mine.find((a) => a._id === t.assessmentId)?.title ?? "Untitled")),
        ],
        latestReportId:
          sorted.map((t) => reports.find((r) => r.attemptId === t._id)?._id ?? null).find((id): id is string => Boolean(id)) ??
          null,
      };
    })
    .sort((a, b) => b.lastSubmittedAt.localeCompare(a.lastSubmittedAt));
}

export async function getReport({ data }: { data: unknown }) {
  const input = z.object({ reportId: z.string().min(1), userId: z.string().min(1) }).parse(data);
  const report = readReports().find((r) => r._id === input.reportId);
  if (!report) throw new Error("Report not found");
  const attempt = readAttempts().find((t) => t._id === report.attemptId);
  if (!attempt) throw new Error("Attempt not found");
  const assessment = readAssessments().find((a) => a._id === attempt.assessmentId);
  if (!assessment) throw new Error("Assessment not found");
  if (attempt.individualUserId !== input.userId && assessment.companyUserId !== input.userId) {
    throw new Error("Not authorized to view this report");
  }
  return { report, attempt, assessment };
}
