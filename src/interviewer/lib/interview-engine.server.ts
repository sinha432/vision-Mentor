import { z } from "zod";
import { runStructured } from "./ai-providers.server";
import { getCompany, getHiring } from "./companies";
import type { FlagSeverity, InterviewConfig, InterviewPhase, Turn } from "./interview-types";
import { deriveSeverity } from "./coach-priority";
import {
  gradeMcq,
  getBankQuestion,
  selectBankQuestion,
  type BankPhase,
  type BankQuestion,
} from "./question-bank";

/* ------------------------------------------------------------------ */
/* payload types                                                       */
/* ------------------------------------------------------------------ */

export interface TurnQuestion {
  kind: "text" | "mcq" | "coding" | "scenario";
  prompt: string;
  topic: string;
  difficulty: number;
  options: string[];
  language: "java" | "python" | "javascript" | "sql" | "none";
  starterCode: string;
  bankId: string | null;
}

export interface TurnEvaluationPayload {
  score: number;
  verdict: "strong" | "adequate" | "weak" | "none";
  note: string;
  matched: string[];
  missed: string[];
  verified: boolean;
}

export interface TurnPayload {
  say: string;
  mood: "neutral" | "smile" | "nod" | "thinking" | "curious";
  phase: InterviewPhase;
  evaluationOfPrevious: TurnEvaluationPayload | null;
  question: TurnQuestion | null;
  done: boolean;
}

export interface ReportPayload {
  overall: number;
  technical: number;
  communication: number;
  coding: number;
  resumeFit: number;
  confidence: number;
  companyReadiness: number;
  hiringProbability: number;
  grammar: number;
  bodyLanguage: number;
  eyeContact: number;
  professionalism: number;
  behaviour: number;
  subScoreNotes: { area: string; score: number; note: string }[];
  summary: string;
  strongTopics: string[];
  weakTopics: string[];
  skillGaps: string[];
  recommendedCourses: { title: string; why: string }[];
  recommendedQuestions: string[];
  recommendedProblems: string[];
}

export interface ResumePayload {
  name: string;
  headline: string;
  skills: string[];
  projects: { title: string; summary: string }[];
  experience: string[];
  education: string[];
  certifications: string[];
  strengths: string[];
  gaps: string[];
  atsScore: number;
}

/* ------------------------------------------------------------------ */
/* model plumbing                                                      */
/* ------------------------------------------------------------------ */

/**
 * One structured call, validated, with automatic provider failover. If no
 * provider produces a schema-valid reply we return the caller's safe default
 * instead of handing undefined fields to the UI.
 */
async function structured<T>(options: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  fallback: T;
  throwOnError?: boolean;
}): Promise<T> {
  const result = await runStructured({
    schema: options.schema,
    system: options.system,
    prompt: options.prompt,
    fallback: options.fallback,
  });

  if (options.throwOnError && result.error) {
    throw new Error(`${result.error.title}: ${result.error.fix}`);
  }

  return result.value;
}

/* ------------------------------------------------------------------ */
/* interview arc (deterministic — never left to the model)             */
/* ------------------------------------------------------------------ */

const PHASE_PLAN: InterviewPhase[] = [
  "greeting",
  "resume",
  "resume",
  "technical",
  "technical",
  "technical",
  "coding",
  "behavioral",
  "behavioral",
  "hr",
  "hr",
  "closing",
];

function averageScore(turns: Turn[]): number | null {
  const scores = turns
    .map((t) => t.evaluation?.score)
    .filter((s): s is number => typeof s === "number");
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function targetDifficulty(baseline: number, turns: Turn[]): number {
  const avg = averageScore(turns);
  if (avg == null) return Math.max(1, Math.min(5, baseline));
  const shift = avg >= 78 ? 1 : avg <= 45 ? -1 : 0;
  return Math.max(1, Math.min(5, baseline + shift));
}

/* ------------------------------------------------------------------ */
/* answer verification                                                 */
/* ------------------------------------------------------------------ */

const gradeSchema = z.object({
  score: z.number(),
  verdict: z.enum(["strong", "adequate", "weak"]),
  note: z.string(),
  matched: z.array(z.string()),
  missed: z.array(z.string()),
});

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function verifyAnswer(
  config: InterviewConfig,
  turn: Turn,
  answer: string,
): Promise<TurnEvaluationPayload> {
  const bank = getBankQuestion(turn.bankId);
  const question = turn.question;

  // Deterministic path: multiple choice is graded against the stored key.
  if (bank && bank.kind === "mcq") {
    const correct = gradeMcq(bank, answer);
    if (correct !== null) {
      return {
        score: correct ? 100 : 10,
        verdict: correct ? "strong" : "weak",
        note: correct
          ? `Correct — ${bank.referenceAnswer}`
          : `Incorrect. The right answer is "${bank.options?.[bank.correctOption ?? 0]}". ${bank.referenceAnswer}`,
        matched: correct ? bank.keyPoints : [],
        missed: correct ? [] : bank.keyPoints,
        verified: true,
      };
    }
  }

  const rubric = bank
    ? [
        `REFERENCE ANSWER (ground truth): ${bank.referenceAnswer}`,
        `KEY POINTS the answer must cover: ${bank.keyPoints.map((k, i) => `${i + 1}. ${k}`).join(" ")}`,
        bank.testCases?.length
          ? `EXPECTED BEHAVIOUR / TEST CASES: ${bank.testCases.map((t) => `${t.input} -> ${t.expected}`).join("; ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : `No stored reference answer exists. Grade against what a strong ${config.experience} ${config.role} candidate would say: correctness, specificity, depth and structure.`;

  const isCoding = question?.kind === "coding";
  const fallback: TurnEvaluationPayload = {
    score: 0,
    verdict: "weak",
    note: "This answer could not be verified automatically.",
    matched: [],
    missed: bank?.keyPoints ?? [],
    verified: false,
  };

  const graded = await structured({
    schema: gradeSchema,
    system: [
      `You are a strict, evidence-based interview grader. You never reward confident but incorrect answers.`,
      `Score 0-100. 0-40 weak, 41-70 adequate, 71-100 strong.`,
      isCoding
        ? `This is a coding answer: mentally execute the candidate's code against the expected behaviour. Wrong output on any case caps the score at 40, regardless of how clean the code looks. Also judge complexity and edge cases.`
        : `Judge only against the reference and key points; an eloquent answer that misses the key points is not strong.`,
      `"matched" lists the key points the candidate actually covered, "missed" the ones they did not. Quote or paraphrase only what they said.`,
      `Keep the note under 40 words and address the candidate in the second person.`,
    ].join("\n"),
    prompt: [
      `QUESTION (${question?.kind ?? "text"}, topic ${question?.topic ?? "general"}, difficulty ${question?.difficulty ?? 3}/5):`,
      question?.prompt ?? turn.say,
      ``,
      rubric,
      ``,
      `CANDIDATE ANSWER:`,
      answer,
    ].join("\n"),
    fallback: {
      score: fallback.score,
      verdict: "weak" as const,
      note: fallback.note,
      matched: fallback.matched,
      missed: fallback.missed,
    },
  });

  const known = bank?.keyPoints ?? [];
  const matched = known.length
    ? known.filter((k) => graded.matched.some((m) => similar(m, k)))
    : graded.matched.slice(0, 6);
  const missed = known.length
    ? known.filter((k) => !matched.includes(k))
    : graded.missed.slice(0, 6);

  // With a rubric, the score must track coverage — the model cannot inflate it.
  let score = clampScore(graded.score);
  if (known.length) {
    const coverage = (matched.length / known.length) * 100;
    score = clampScore(score * 0.5 + coverage * 0.5);
  }
  const verdict: "strong" | "adequate" | "weak" =
    score >= 71 ? "strong" : score >= 41 ? "adequate" : "weak";

  return {
    score,
    verdict,
    note: graded.note || "Evaluated against the reference answer.",
    matched,
    missed,
    verified: true,
  };
}

function similar(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  const wordsA = new Set(norm(a));
  const wordsB = norm(b).filter((w) => w.length > 3);
  if (wordsB.length === 0) return false;
  const hits = wordsB.filter((w) => wordsA.has(w)).length;
  return hits / wordsB.length >= 0.4;
}

/* ------------------------------------------------------------------ */
/* question selection                                                  */
/* ------------------------------------------------------------------ */

function bankToQuestion(bank: BankQuestion): TurnQuestion {
  return {
    kind: bank.kind,
    prompt: bank.prompt,
    topic: bank.topic,
    difficulty: bank.difficulty,
    options: bank.options ?? [],
    language: bank.language ?? "none",
    starterCode: bank.starterCode ?? "",
    bankId: bank.id,
  };
}

const generatedQuestionSchema = z.object({
  prompt: z.string(),
  topic: z.string(),
});

async function resumeQuestion(
  config: InterviewConfig,
  turns: Turn[],
  difficulty: number,
): Promise<TurnQuestion> {
  const resume = config.resume;
  const asked = turns
    .map((t) => t.question?.prompt)
    .filter(Boolean)
    .join(" | ");
  const fallbackPrompt = resume?.projects?.[0]
    ? `Tell me about ${resume.projects[0].title} — what was your specific contribution, and what was the hardest technical decision you made there?`
    : `Walk me through the project you are proudest of: what you built, your specific role, and the hardest trade-off you had to make.`;

  const fit = config.resumeFit;
  const company = getCompany(config.companyId);
  const generated = await structured({
    schema: generatedQuestionSchema,
    system: `You write one sharp resume-probing interview question for a ${config.experience} ${config.role} candidate interviewing at ${company.name} (${company.interviewStyle}). Ground the question in something actually written on their resume, and press on the gaps ${company.name} cares about. Interrogate a specific choice they made (algorithm, dataset, architecture, metric, trade-off). One question only, no preamble, no numbering.`,
    prompt: [
      resume
        ? `Resume — skills: ${resume.skills.join(", ") || "n/a"}; projects: ${(resume.projects ?? []).map((p) => `${p.title}: ${p.summary}`).join("; ") || "n/a"}; experience: ${resume.experience.join("; ") || "n/a"}.`
        : `No resume provided — ask about their background and projects without inventing details.`,
      fit
        ? `Company fit review — verdict: ${fit.verdict}; missing for ${company.name}: ${fit.missing.join(", ") || "n/a"}; strengths that land: ${fit.matched.join(", ") || "n/a"}. Probe one of the missing areas through their own resume content.`
        : ``,
      `${company.name} focus areas: ${company.focus.join(", ")}.`,
      asked ? `Already asked (do not repeat): ${asked}` : ``,
      `topic: a short label like "Project depth" or the technology involved.`,
    ].join("\n"),
    fallback: { prompt: fallbackPrompt, topic: "Project depth" },
  });

  return {
    kind: "text",
    prompt: generated.prompt.trim() || fallbackPrompt,
    topic: generated.topic.trim() || "Project depth",
    difficulty,
    options: [],
    language: "none",
    starterCode: "",
    bankId: null,
  };
}

function greetingQuestion(): TurnQuestion {
  return {
    kind: "text",
    prompt:
      "To start, could you introduce yourself — who you are, what you have been working on recently, and what you are looking for in this role?",
    topic: "Introduction",
    difficulty: 1,
    options: [],
    language: "none",
    starterCode: "",
    bankId: null,
  };
}

function closingQuestion(): TurnQuestion {
  return {
    kind: "text",
    prompt:
      "Before we wrap up — is there anything you would like to ask me about the team or the role?",
    topic: "Candidate questions",
    difficulty: 1,
    options: [],
    language: "none",
    starterCode: "",
    bankId: null,
  };
}

async function pickQuestion(
  config: InterviewConfig,
  turns: Turn[],
  phase: InterviewPhase,
  difficulty: number,
): Promise<TurnQuestion | null> {
  const usedIds = turns.map((t) => t.bankId).filter((id): id is string => Boolean(id));
  const company = getCompany(config.companyId);

  if (phase === "greeting") return greetingQuestion();
  if (phase === "resume") return resumeQuestion(config, turns, difficulty);
  if (phase === "closing") return closingQuestion();
  if (phase === "complete") return null;

  const bank = selectBankQuestion({
    role: config.role,
    phase: phase as BankPhase,
    difficulty,
    usedIds,
    focus: company.focus,
  });
  if (bank) return bankToQuestion(bank);

  // Bank exhausted for this slot — generate, and grade it without a reference.
  const hiring = getHiring(config.companyId);
  const generated = await structured({
    schema: generatedQuestionSchema,
    system: [
      `You are a senior ${company.name} interviewer writing ONE ${phase} question for a ${config.experience} ${config.role} candidate at difficulty ${difficulty}/5.`,
      `${company.name} context: ${hiring.about}`,
      `What ${company.name} screens for: ${hiring.screens.join("; ")}.`,
      `Why candidates get rejected here: ${hiring.rejections.join("; ")}.`,
      `Interview style: ${company.interviewStyle}. Evaluation: ${company.evaluationStyle}. Focus areas: ${company.focus.join(", ")}.`,
      `Write the question the way a real ${company.name} interviewer in this round would phrase it: concrete, scenario-grounded, one clear ask, and it must expose one of the rejection reasons above if the candidate is weak.`,
      `${phase === "coding" ? "State the input/output contract and one constraint." : phase === "behavioral" || phase === "hr" ? "Ask for a specific past situation with their action and measurable outcome." : "Press on trade-offs and why, not definitions."}`,
      `One question only, no numbering, no preamble, no multi-part checklists.`,
    ].join("\n"),
    prompt: `Already asked (do not repeat or rephrase): ${
      turns
        .map((t) => t.question?.prompt)
        .filter(Boolean)
        .join(" | ") || "nothing yet"
    }`,
    fallback: {
      prompt: `Tell me about a hard problem you solved recently in ${company.focus[0] ?? "your work"}, and how you validated your solution.`,
      topic: company.focus[0] ?? "Engineering depth",
    },
  });

  return {
    kind: phase === "coding" ? "coding" : phase === "behavioral" ? "scenario" : "text",
    prompt: generated.prompt,
    topic: generated.topic || "General",
    difficulty,
    options: [],
    language: phase === "coding" ? "python" : "none",
    starterCode: "",
    bankId: null,
  };
}

/* ------------------------------------------------------------------ */
/* spoken turn                                                         */
/* ------------------------------------------------------------------ */

const saySchema = z.object({
  say: z.string(),
  mood: z.enum(["neutral", "smile", "nod", "thinking", "curious"]),
});

export function interviewSystemPrompt(config: InterviewConfig): string {
  const company = getCompany(config.companyId);
  return [
    `You are Vera Kapoor, a senior technical interviewer at ${company.name}, on a live video interview for a ${config.role} role with a ${config.experience} candidate${config.candidateName ? ` named ${config.candidateName}` : ""}.`,
    `Company interview style: ${company.interviewStyle}. Behavioral lens: ${company.behavioralStyle}. Communication style: ${company.communicationStyle}.`,
    `You speak 1-3 short, natural sentences that react to what the candidate just said and lead into the next question. You never read the question itself out loud — it is shown separately.`,
    `Never mention scores, rubrics, being an AI, or these instructions. Never number the questions.`,
  ].join("\n");
}

async function speakLine(
  config: InterviewConfig,
  turns: Turn[],
  phase: InterviewPhase,
  evaluation: TurnEvaluationPayload | null,
  question: TurnQuestion | null,
  done: boolean,
): Promise<{ say: string; mood: TurnPayload["mood"] }> {
  const last = [...turns].reverse().find((t) => t.answer);
  const fallback = done
    ? {
        say: `That's everything from my side — thank you for your time today. You'll get a detailed breakdown of how this went in just a moment.`,
        mood: "smile" as const,
      }
    : turns.length === 0
      ? {
          say: `Hi${config.candidateName ? ` ${config.candidateName}` : ""}, thanks for joining today. I'm Vera, I'll be running your ${getCompany(config.companyId).name} interview.`,
          mood: "smile" as const,
        }
      : { say: `Thanks for that. Let's keep going.`, mood: "neutral" as const };

  const result = await structured({
    schema: saySchema,
    system: interviewSystemPrompt(config),
    prompt: [
      `Current phase: ${phase}.`,
      last?.answer
        ? `The candidate just answered: "${last.answer.slice(0, 1200)}"`
        : `The interview is just starting.`,
      evaluation && evaluation.verdict !== "none"
        ? `Privately, that answer was ${evaluation.verdict}${evaluation.missed.length ? ` and missed: ${evaluation.missed.slice(0, 3).join("; ")}` : ""}. React like a human would — warm on a strong answer, gently probing on a weak one — without revealing a score.`
        : ``,
      done
        ? `The interview is over. Give a warm closing statement.`
        : `Next you will ask (do not repeat it verbatim, just lead into it): "${question?.prompt ?? ""}"`,
      `Pick a mood that matches your tone.`,
    ]
      .filter(Boolean)
      .join("\n"),
    fallback,
  });

  return { say: result.say.trim() || fallback.say, mood: result.mood };
}

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

export async function generateTurn(config: InterviewConfig, turns: Turn[]): Promise<TurnPayload> {
  const company = getCompany(config.companyId);

  // 1. Verify the previous answer against the stored ground truth.
  const previous = turns[turns.length - 1];
  let evaluation: TurnEvaluationPayload | null = null;
  if (previous?.question && previous.answer?.trim()) {
    evaluation = await verifyAnswer(config, previous, previous.answer.trim());
  }

  const scoredTurns: Turn[] = evaluation
    ? turns.map((t, i) =>
        i === turns.length - 1
          ? {
              ...t,
              evaluation: {
                score: evaluation!.score,
                verdict: evaluation!.verdict === "none" ? "weak" : evaluation!.verdict,
                note: evaluation!.note,
              },
            }
          : t,
      )
    : turns;

  // 2. Deterministic arc: the model never decides when the interview ends.
  const index = turns.length;
  const done = index >= PHASE_PLAN.length;
  const phase: InterviewPhase = done ? "complete" : PHASE_PLAN[index];
  const difficulty = targetDifficulty(company.difficulty, scoredTurns);

  const question = done ? null : await pickQuestion(config, scoredTurns, phase, difficulty);
  const { say, mood } = await speakLine(config, scoredTurns, phase, evaluation, question, done);

  return { say, mood, phase, evaluationOfPrevious: evaluation, question, done };
}

const reportSchema = z.object({
  overall: z.number(),
  technical: z.number(),
  communication: z.number(),
  coding: z.number(),
  resumeFit: z.number(),
  confidence: z.number(),
  companyReadiness: z.number(),
  hiringProbability: z.number(),
  grammar: z.number(),
  professionalism: z.number(),
  grammarNote: z.string(),
  professionalismNote: z.string(),
  summary: z.string(),
  strongTopics: z.array(z.string()),
  weakTopics: z.array(z.string()),
  skillGaps: z.array(z.string()),
  recommendedCourses: z.array(z.object({ title: z.string(), why: z.string() })),
  recommendedQuestions: z.array(z.string()),
  recommendedProblems: z.array(z.string()),
});

type ReportRaw = z.infer<typeof reportSchema>;

export function transcriptFor(turns: Turn[]): string {
  if (turns.length === 0) return "No questions were answered.";
  return turns
    .map((t) => {
      const bank = getBankQuestion(t.bankId);
      const q = t.question
        ? `\nQUESTION (${t.question.kind}, ${t.question.topic}, difficulty ${t.question.difficulty}): ${t.question.prompt}`
        : "";
      const reference = bank ? `\nVERIFIED REFERENCE: ${bank.referenceAnswer}` : "";
      const a = `\nCANDIDATE ANSWER: ${t.answer?.trim() || "(no answer given)"}`;
      const e = t.evaluation
        ? `\nVERIFIED GRADE: ${t.evaluation.score}/100 (${t.evaluation.verdict}) — ${t.evaluation.note}`
        : "";
      return `INTERVIEWER SAID: ${t.say}${q}${reference}${a}${e}`;
    })
    .join("\n---\n");
}

export async function generateReport(
  config: InterviewConfig,
  turns: Turn[],
  vision: { eyeContact: number; attention: number; posture: number; enabled: boolean },
  voice: { wordsPerMinute: number; fillerWords: number; pauseCount: number; fluency: number },
  behaviour?: BehaviourInput,
): Promise<ReportPayload> {
  const company = getCompany(config.companyId);
  const graded = turns.filter((t) => t.question && t.evaluation);
  const avg = averageScore(turns);
  const verifiedAverage = avg == null ? 0 : Math.round(avg);
  const codingTurns = graded.filter((t) => t.question?.kind === "coding");
  const codingAverage = codingTurns.length
    ? Math.round(
        codingTurns.reduce((sum, t) => sum + (t.evaluation?.score ?? 0), 0) / codingTurns.length,
      )
    : 0;

  // Body language, eye contact and behaviour are measured, not guessed: they
  // come straight from the on-device detectors and the proctor feed.
  const measured = measuredSubScores(vision, voice, behaviour);
  const wordCount = turns.reduce((sum, t) => sum + (t.answer?.trim().split(/\s+/).length ?? 0), 0);
  const heuristicGrammar = clampScore(
    Math.max(0, 100 - voice.fillerWords * 3 - Math.max(0, 25 - wordCount / Math.max(1, graded.length))),
  );

  const fallback: ReportPayload = {
    overall: verifiedAverage,
    technical: verifiedAverage,
    communication: Math.round(voice.fluency),
    coding: codingAverage,
    resumeFit: verifiedAverage,
    confidence: vision.enabled
      ? Math.round((vision.eyeContact + vision.attention) / 2)
      : Math.round(voice.fluency),
    companyReadiness: verifiedAverage,
    hiringProbability: Math.max(0, verifiedAverage - 10),
    grammar: heuristicGrammar,
    bodyLanguage: measured.bodyLanguage,
    eyeContact: measured.eyeContact,
    professionalism: clampScore(Math.round((measured.behaviour + heuristicGrammar) / 2)),
    behaviour: measured.behaviour,
    subScoreNotes: [],
    summary:
      graded.length === 0
        ? "This session ended before any answers could be graded, so there is not enough evidence for a full evaluation. Run a complete interview to get a scored report."
        : `Across ${graded.length} graded answers the verified average was ${verifiedAverage}/100.`,
    strongTopics: graded
      .filter((t) => (t.evaluation?.score ?? 0) >= 71)
      .map((t) => t.question?.topic ?? "")
      .filter(Boolean),
    weakTopics: graded
      .filter((t) => (t.evaluation?.score ?? 0) < 50)
      .map((t) => t.question?.topic ?? "")
      .filter(Boolean),
    skillGaps: [],
    recommendedCourses: [],
    recommendedQuestions: [],
    recommendedProblems: [],
  };

  if (graded.length === 0) return fallback;

  const raw = await structured({
    schema: reportSchema,
    system: `You are an expert interview assessor writing a rigorous, honest report for a ${company.name} ${config.role} interview (${config.experience} level). Every score is an integer 0-100. Anchor your scores to the VERIFIED GRADES already computed per answer — do not contradict them. Cite what the candidate actually said. At most 6 items per list and 4 courses. "grammar" judges the spoken English of the answers (tense, agreement, sentence structure, vocabulary). "professionalism" judges tone, courtesy, structure and interview etiquette. grammarNote and professionalismNote are one specific sentence each, quoting evidence from the transcript. recommendedCourses, recommendedQuestions and recommendedProblems MUST be derived directly from the candidate's weakest graded answers, their weakTopics/skillGaps, and the measured behaviour/detection signals below — never generic filler, and never leave any of the three lists empty when at least one answer was graded.`,
    prompt: [
      `TRANSCRIPT WITH VERIFIED GRADES:`,
      transcriptFor(turns),
      ``,
      `The verified average across graded answers is ${verifiedAverage}/100 (coding average ${codingAverage}/100). "overall" must stay within 8 points of that average.`,
      vision.enabled
        ? `Camera signals: eye contact ${vision.eyeContact}, attention ${vision.attention}, posture ${vision.posture} (0-100).`
        : `Camera was disabled; base confidence on language only and say so in the summary.`,
      `Speech signals: ${voice.wordsPerMinute} words/min, ${voice.fillerWords} filler words, ${voice.pauseCount} long pauses, fluency ${voice.fluency}/100.`,
      behaviour ? `Measured behaviour: ${measured.behaviourEvidence}` : ``,
      `Score technical, communication, coding, resumeFit, confidence, companyReadiness and hiringProbability against ${company.name}'s bar (${company.evaluationStyle}).`,
    ].join("\n"),
    fallback: {
      ...fallback,
      grammarNote: "",
      professionalismNote: "",
    } satisfies ReportRaw,
  });

  const normalized = normalizeReport(raw, fallback, verifiedAverage, measured);
  return ensureRecommendationsPopulated(normalized, graded, measured, company.focus);
}

/**
 * Groq sometimes returns thin or empty recommendation lists. Since these
 * panels must never be empty when we actually graded answers, backfill them
 * deterministically from the candidate's weakest topics, skill gaps and the
 * measured behaviour/detection signals.
 */
function ensureRecommendationsPopulated(
  report: ReportPayload,
  graded: Turn[],
  measured: Measured,
  companyFocus: string[],
): ReportPayload {
  if (graded.length === 0) return report;

  const weakest = [...graded]
    .filter((t) => t.question)
    .sort((a, b) => (a.evaluation?.score ?? 0) - (b.evaluation?.score ?? 0))
    .slice(0, 4);
  const weakTopics = Array.from(
    new Set([...report.weakTopics, ...weakest.map((t) => t.question?.topic ?? "").filter(Boolean)]),
  );
  const gapTopics = Array.from(new Set([...report.skillGaps, ...weakTopics])).filter(Boolean);
  const focusTopics = companyFocus.length ? companyFocus : ["core fundamentals"];

  let recommendedCourses = report.recommendedCourses;
  if (recommendedCourses.length === 0) {
    const topics = gapTopics.length ? gapTopics : focusTopics;
    recommendedCourses = topics.slice(0, 4).map((topic) => ({
      title: `${topic} deep-dive`,
      why: `Your graded answers showed the weakest evidence on ${topic}${
        measured.behaviourNote ? ` — ${measured.behaviourNote}` : "."
      }`,
    }));
    if (recommendedCourses.length === 0) {
      recommendedCourses = [
        { title: "Structured interview answers (STAR method)", why: measured.behaviourNote },
      ];
    }
  }

  let recommendedQuestions = report.recommendedQuestions;
  if (recommendedQuestions.length === 0) {
    recommendedQuestions = weakest.length
      ? weakest.map(
          (t) =>
            `Re-attempt: "${t.question?.prompt ?? t.question?.topic}" — you scored ${
              t.evaluation?.score ?? 0
            }/100 here.`,
        )
      : focusTopics.slice(0, 4).map((topic) => `Practice a ${topic} interview question end to end.`);
  }

  let recommendedProblems = report.recommendedProblems;
  if (recommendedProblems.length === 0) {
    const codingWeak = weakest.filter((t) => t.question?.kind === "coding");
    const topics = codingWeak.length
      ? codingWeak.map((t) => t.question?.topic ?? "")
      : gapTopics.length
        ? gapTopics
        : focusTopics;
    recommendedProblems = topics
      .filter(Boolean)
      .slice(0, 4)
      .map((topic) => `Solve 2-3 ${topic} problems focused on the pattern you missed.`);
    if (recommendedProblems.length === 0) {
      recommendedProblems = ["Solve a mixed-difficulty problem set covering arrays, strings and hashing."];
    }
  }

  return { ...report, recommendedCourses, recommendedQuestions, recommendedProblems };
}

/** Everything the detectors and the proctor observed during the session. */
export interface BehaviourInput {
  detection?: {
    avgEyeContact: number;
    avgPosture: number;
    avgConfidence: number;
    avgNoise: number;
    noisySeconds: number;
    multiFaceSeconds: number;
    faceMissingSeconds: number;
    deviceSeconds: number;
    backgroundVoiceEvents: number;
    dominantEmotion: string;
    onDevice: boolean;
  } | null;
  proctor?: { kind: string; detail: string; severity?: string }[];
  warnings?: number;
  endedEarly?: boolean;
  appearance?: { dress: string; hair: string } | null;
}

interface Measured {
  bodyLanguage: number;
  eyeContact: number;
  behaviour: number;
  bodyNote: string;
  eyeNote: string;
  behaviourNote: string;
  behaviourEvidence: string;
}

function measuredSubScores(
  vision: { eyeContact: number; attention: number; posture: number; enabled: boolean },
  voice: { pauseCount: number; fillerWords: number; wordsPerMinute: number; fluency: number },
  behaviour?: BehaviourInput,
): Measured {
  const d = behaviour?.detection ?? null;
  const eye = d?.onDevice ? d.avgEyeContact : vision.enabled ? vision.eyeContact : 0;
  const posture = d?.onDevice ? d.avgPosture : vision.enabled ? vision.posture : 0;
  const movementPenalty = Math.max(0, 100 - (d?.avgConfidence ?? vision.attention)) * 0.15;
  const bodyLanguage = clampScore(Math.round(posture * 0.7 + (100 - movementPenalty * 2) * 0.3));

  const flags = behaviour?.proctor ?? [];
  const high = flags.filter((f) => f.severity === "high").length;
  const medium = flags.filter((f) => f.severity === "medium").length;
  const behaviourScore = clampScore(
    100 -
      high * 18 -
      medium * 8 -
      (behaviour?.warnings ?? 0) * 10 -
      (behaviour?.endedEarly ? 30 : 0) -
      Math.min(15, Math.round((d?.noisySeconds ?? 0) / 20)) -
      Math.min(20, Math.round((d?.deviceSeconds ?? 0) / 3)) -
      Math.min(20, Math.round((d?.multiFaceSeconds ?? 0) / 3)),
  );

  const evidence = d
    ? `eye contact ${d.avgEyeContact}/100, posture ${d.avgPosture}/100, dominant expression ${d.dominantEmotion}, ${d.noisySeconds}s of noisy room, ${d.multiFaceSeconds}s with more than one face, ${d.deviceSeconds}s with a device in frame, ${d.backgroundVoiceEvents} background-voice events, ${flags.length} integrity flags, ${behaviour?.warnings ?? 0} formal warnings.`
    : `${flags.length} integrity flags, ${behaviour?.warnings ?? 0} formal warnings.`;

  return {
    bodyLanguage,
    eyeContact: clampScore(Math.round(eye)),
    behaviour: behaviourScore,
    bodyNote: vision.enabled
      ? `Posture averaged ${posture}/100 across the session with ${d?.dominantEmotion ?? "neutral"} expression dominating.`
      : "The camera was off, so body language could not be measured.",
    eyeNote: vision.enabled
      ? `You held the camera ${Math.round(eye)}% of the time${
          (d?.faceMissingSeconds ?? 0) > 3 ? `, and your face was out of frame for ${d?.faceMissingSeconds}s` : ""
        }.`
      : "The camera was off, so eye contact could not be measured.",
    behaviourNote: flags.length
      ? `${flags.length} integrity flag(s) were raised: ${flags
          .slice(0, 3)
          .map((f) => f.detail)
          .join(" ")}`
      : "No integrity issues were detected — clean camera, single voice, tab in focus.",
    behaviourEvidence: evidence,
  };
}

function normalizeReport(
  raw: ReportRaw,
  fallback: ReportPayload,
  verifiedAverage: number,
  measured: Measured,
): ReportPayload {
  const list = (value: unknown, fb: string[]) =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, 6) : fb;
  const num = (value: unknown, fb: number) =>
    typeof value === "number" && Number.isFinite(value) ? clampScore(value) : fb;

  const overall = clampScore(
    Math.max(verifiedAverage - 8, Math.min(verifiedAverage + 8, num(raw.overall, verifiedAverage))),
  );
  const grammar = num(raw.grammar, fallback.grammar);
  const professionalism = num(raw.professionalism, fallback.professionalism);
  const rawNotes: { grammarNote?: string; professionalismNote?: string } = raw;
  const sentence = (value: string | undefined, fb: string) =>
    typeof value === "string" && value.trim().length > 8 ? value.trim() : fb;

  return {
    overall,
    technical: num(raw.technical, fallback.technical),
    communication: num(raw.communication, fallback.communication),
    coding: num(raw.coding, fallback.coding),
    resumeFit: num(raw.resumeFit, fallback.resumeFit),
    confidence: num(raw.confidence, fallback.confidence),
    companyReadiness: num(raw.companyReadiness, fallback.companyReadiness),
    hiringProbability: num(raw.hiringProbability, fallback.hiringProbability),
    grammar,
    bodyLanguage: measured.bodyLanguage,
    eyeContact: measured.eyeContact,
    professionalism,
    behaviour: measured.behaviour,
    subScoreNotes: [
      {
        area: "Grammar",
        score: grammar,
        note: sentence(
          rawNotes.grammarNote,
          "Scored from the spoken answers in the transcript — sentence structure, tense and word choice.",
        ),
      },
      { area: "Body language", score: measured.bodyLanguage, note: measured.bodyNote },
      { area: "Eye contact", score: measured.eyeContact, note: measured.eyeNote },
      {
        area: "Professionalism",
        score: professionalism,
        note: sentence(
          rawNotes.professionalismNote,
          "Scored from tone, courtesy and structure across your answers.",
        ),
      },
      { area: "Behaviour", score: measured.behaviour, note: measured.behaviourNote },
    ],
    summary: typeof raw.summary === "string" && raw.summary.trim() ? raw.summary : fallback.summary,
    strongTopics: list(raw.strongTopics, fallback.strongTopics),
    weakTopics: list(raw.weakTopics, fallback.weakTopics),
    skillGaps: list(raw.skillGaps, fallback.skillGaps),
    recommendedCourses: Array.isArray(raw.recommendedCourses)
      ? raw.recommendedCourses
          .filter((c) => c && typeof c.title === "string")
          .map((c) => ({ title: c.title, why: typeof c.why === "string" ? c.why : "" }))
          .slice(0, 4)
      : fallback.recommendedCourses,
    recommendedQuestions: list(raw.recommendedQuestions, fallback.recommendedQuestions),
    recommendedProblems: list(raw.recommendedProblems, fallback.recommendedProblems),
  };
}

const resumeSchema = z.object({
  name: z.string(),
  headline: z.string(),
  skills: z.array(z.string()),
  projects: z.array(z.object({ title: z.string(), summary: z.string() })),
  experience: z.array(z.string()),
  education: z.array(z.string()),
  certifications: z.array(z.string()),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  atsScore: z.number(),
});

export async function analyzeResumeText(text: string): Promise<ResumePayload> {
  const fallback: ResumePayload = {
    name: "",
    headline: "",
    skills: [],
    projects: [],
    experience: [],
    education: [],
    certifications: [],
    strengths: [],
    gaps: [],
    atsScore: 0,
  };

  const raw = await structured({
    schema: resumeSchema,
    system:
      "You extract structured data from resumes for an interview platform. Never invent facts that are not in the resume. atsScore is an integer 0-100 for how well-structured and keyword-ready the resume is. Keep each list to at most 10 items.",
    prompt: `Resume content:\n\n${text.slice(0, 24000)}`,
    fallback,
    throwOnError: true,
  });

  return {
    ...fallback,
    ...raw,
    skills: (raw.skills ?? []).slice(0, 10),
    projects: (raw.projects ?? []).slice(0, 10),
    experience: (raw.experience ?? []).slice(0, 10),
    education: (raw.education ?? []).slice(0, 10),
    certifications: (raw.certifications ?? []).slice(0, 10),
    strengths: (raw.strengths ?? []).slice(0, 10),
    gaps: (raw.gaps ?? []).slice(0, 10),
    atsScore: clampScore(raw.atsScore),
  };
}

/* ------------------------------------------------------------------ */
/* company-specific resume fit                                         */
/* ------------------------------------------------------------------ */

export interface ResumeFitPayload {
  companyId: string;
  score: number;
  verdict: "weak" | "borderline" | "strong";
  statement: string;
  matched: string[];
  missing: string[];
  actions: { title: string; detail: string }[];
  keywords: string[];
}

const resumeFitSchema = z.object({
  score: z.number(),
  statement: z.string(),
  matched: z.array(z.string()),
  missing: z.array(z.string()),
  actions: z.array(z.object({ title: z.string(), detail: z.string() })),
  keywords: z.array(z.string()),
});

/** Deterministic evidence check: how many of the company's focus areas the resume actually mentions. */
function focusCoverage(resume: ResumePayload, focus: string[]): number {
  const haystack = [
    resume.headline,
    ...resume.skills,
    ...resume.projects.flatMap((p) => [p.title, p.summary]),
    ...resume.experience,
    ...resume.certifications,
    ...resume.strengths,
  ]
    .join(" ")
    .toLowerCase();

  if (!haystack.trim() || focus.length === 0) return 0;
  const hits = focus.filter((area) =>
    area
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter((w) => w.length > 2)
      .some((word) => haystack.includes(word)),
  ).length;
  return Math.round((hits / focus.length) * 100);
}

export async function analyzeResumeFitForCompany(
  resume: ResumePayload,
  companyId: string,
  role: string,
  experience: string,
): Promise<ResumeFitPayload> {
  const company = getCompany(companyId);
  const coverage = focusCoverage(resume, company.focus);

  const fallback = {
    score: coverage,
    statement: `Your resume shows limited evidence of what ${company.name} screens for (${company.focus.join(", ")}).`,
    matched: [] as string[],
    missing: company.focus,
    actions: company.focus.slice(0, 4).map((area) => ({
      title: `Add proof of ${area}`,
      detail: `Add a bullet or project that shows ${area} work with a measurable outcome — ${company.name} evaluates on ${company.evaluationStyle}.`,
    })),
    keywords: company.focus,
  };

  const raw = await structured({
    schema: resumeFitSchema,
    system: [
      `You are a hiring-bar reviewer for ${company.name}. Judge whether this resume clears ${company.name}'s bar for a ${experience} ${role}.`,
      `${company.name} interview style: ${company.interviewStyle}. Evaluation: ${company.evaluationStyle}. Focus areas: ${company.focus.join(", ")}. Difficulty 1-5: ${company.difficulty}.`,
      `Be blunt and specific — never generic praise. Only cite evidence that appears in the resume; never invent facts.`,
      `score is 0-100 for fit with THIS company. matched = resume strengths that land with this company. missing = what this company expects but the resume does not prove. actions = 4-6 concrete rewrite steps (quantify X, add project doing Y, add skill Z with proof). keywords = ATS keywords this company's screens expect. statement = one sentence, second person, naming the company and the main weakness or strength. Max 6 items per list.`,
    ].join("\n"),
    prompt: [
      `Resume headline: ${resume.headline || "n/a"}`,
      `Skills: ${resume.skills.join(", ") || "none listed"}`,
      `Projects: ${resume.projects.map((p) => `${p.title}: ${p.summary}`).join("; ") || "none listed"}`,
      `Experience: ${resume.experience.join("; ") || "none listed"}`,
      `Education: ${resume.education.join("; ") || "none listed"}`,
      `Certifications: ${resume.certifications.join("; ") || "none listed"}`,
      `Resume-quality (ATS) score: ${resume.atsScore}/100`,
      `Deterministic focus-area evidence coverage: ${coverage}% of ${company.name}'s focus areas are mentioned anywhere in the resume.`,
    ].join("\n"),
    fallback,
  });

  // Blend the model's judgement with hard evidence so an empty resume can never read "strong".
  const score = clampScore(clampScore(raw.score) * 0.6 + coverage * 0.4);
  const verdict: ResumeFitPayload["verdict"] =
    score >= 72 ? "strong" : score >= 45 ? "borderline" : "weak";

  return {
    companyId: company.id,
    score,
    verdict,
    statement:
      raw.statement.trim() ||
      `Your resume is ${verdict === "strong" ? "well aligned with" : verdict === "borderline" ? "only partly aligned with" : "weak for"} ${company.name}.`,
    matched: (raw.matched ?? []).filter(Boolean).slice(0, 6),
    missing: ((raw.missing ?? []).filter(Boolean).length ? raw.missing : company.focus).slice(0, 6),
    actions: (raw.actions ?? []).filter((a) => a?.title).slice(0, 6),
    keywords: (raw.keywords ?? []).filter(Boolean).slice(0, 12),
  };
}

/* ------------------------------------------------------------------ */
/* appearance & grooming (report only)                                 */
/* ------------------------------------------------------------------ */

export interface AppearancePayload {
  assessed: boolean;
  dress: { verdict: "appropriate" | "acceptable" | "not_appropriate"; note: string };
  hair: { verdict: "neat" | "untidy"; note: string };
  fixes: string[];
  reason: string;
}

const appearanceSchema = z.object({
  assessed: z.boolean(),
  reason: z.string(),
  dressVerdict: z.enum(["appropriate", "acceptable", "not_appropriate"]),
  dressNote: z.string(),
  hairVerdict: z.enum(["neat", "untidy"]),
  hairNote: z.string(),
  fixes: z.array(z.string()),
});

/**
 * Grooming feedback from one webcam frame. Deliberately limited to clothing
 * and hair tidiness — nothing about the person's body or looks.
 */
export async function analyzeAppearance(
  dataUrl: string,
  companyId: string,
  role: string,
): Promise<AppearancePayload> {
  const company = getCompany(companyId);
  const notAssessed: AppearancePayload = {
    assessed: false,
    dress: { verdict: "acceptable", note: "" },
    hair: { verdict: "neat", note: "" },
    fixes: [],
    reason: "The camera frame was not clear enough to review your appearance.",
  };

  if (!dataUrl.startsWith("data:image/")) return notAssessed;

  const system = [
    `You review interview presentation for candidates interviewing at ${company.name} for a ${role} role.`,
    `Judge ONLY two things from the webcam frame: (1) clothing — formality for this company, fit, tidiness, wrinkles, collar, colour suitability on camera; (2) hair — whether it looks groomed and interview-ready, or grown out, uncombed, or falling over the face.`,
    `Never comment on the person's body, weight, skin, age, gender, ethnicity, attractiveness, or anything unrelated to clothing and hair grooming. Never guess identity.`,
    `${company.name}'s interview style is ${company.interviewStyle} — set the dress expectation accordingly (formal shirt for conservative firms, clean smart-casual for product companies).`,
    `Set assessed=false only when no person is visible at all, the image is completely blank, or the frame is unusable. Normal Mac webcam compression, mild blur, ordinary indoor lighting, or a partially visible outfit are still assessable; judge only what is visible and mention limitations in the notes.`,
    `dressNote and hairNote are one short second-person sentence each, concrete about what you see and what to change. fixes = 2-4 short actionable items for the next interview. If everything already looks right, say so plainly and keep fixes to light polish.`,
  ].join("\n");

  try {
    const { value: output } = await runStructured({
      schema: appearanceSchema,
      system,
      prompt: `Review this candidate's dress and hair for a ${company.name} ${role} interview.`,
      images: [dataUrl],
      vision: true,
      fallback: {
        assessed: false,
        reason: "The appearance service could not analyse this camera frame. Try reviewing the frame again.",
        dressVerdict: "acceptable",
        dressNote: "",
        hairVerdict: "neat",
        hairNote: "",
        fixes: [],
      },
    });
    const parsed = appearanceSchema.safeParse(output);
    if (!parsed.success) return notAssessed;
    const r = parsed.data;
    if (!r.assessed) return { ...notAssessed, reason: r.reason || notAssessed.reason };
    return {
      assessed: true,
      dress: { verdict: r.dressVerdict, note: r.dressNote.trim() },
      hair: { verdict: r.hairVerdict, note: r.hairNote.trim() },
      fixes: r.fixes.filter(Boolean).slice(0, 4),
      reason: "",
    };
  } catch {
    return notAssessed;
  }
}

/* ------------------------------------------------------------------ */
/* real-time presence coaching (during the interview)                  */
/* ------------------------------------------------------------------ */

export type CoachArea = "posture" | "eye_contact" | "hair" | "grooming" | "framing" | "delivery";

export interface CoachIntegrity {
  people: number;
  faceVisible: boolean;
  lookingAway: boolean;
  deviceVisible: boolean;
  /** 0-100 confidence that a phone / second screen is in frame. */
  deviceConfidence: number;
  /** What the detector saw for the device call. */
  deviceReason: string;
  peopleConfidence: number;
}

export interface CoachItem {
  area: CoachArea;
  instruction: string;
  /** 0-100 confidence in this detection. */
  confidence: number;
  /** What was observed that triggered it. */
  reason: string;
  /** low / medium / high — how urgently it needs fixing. */
  severity: FlagSeverity;
}

export interface CoachPayload {
  visible: boolean;
  items: CoachItem[];
  integrity: CoachIntegrity;
}

const coachSchema = z.object({
  visible: z.boolean(),
  posture: z.string(),
  postureReason: z.string(),
  postureConfidence: z.number(),
  eyeContact: z.string(),
  eyeContactReason: z.string(),
  eyeContactConfidence: z.number(),
  hair: z.string(),
  hairReason: z.string(),
  hairConfidence: z.number(),
  grooming: z.string(),
  groomingReason: z.string(),
  groomingConfidence: z.number(),
  framing: z.string(),
  framingReason: z.string(),
  framingConfidence: z.number(),
  people: z.number(),
  peopleConfidence: z.number(),
  faceVisible: z.boolean(),
  lookingAway: z.boolean(),
  deviceVisible: z.boolean(),
  deviceConfidence: z.number(),
  deviceReason: z.string(),
});

const NO_INTEGRITY: CoachIntegrity = {
  people: 1,
  faceVisible: true,
  lookingAway: false,
  deviceVisible: false,
  deviceConfidence: 0,
  deviceReason: "",
  peopleConfidence: 0,
};

export interface CoachSignals {
  eyeContact: number;
  attention: number;
  posture: number;
  wordsPerMinute: number;
  fillerWords: number;
}

/**
 * One live coaching pass on the current webcam frame. Returns short,
 * professional corrections only for things that are actually off — clothing,
 * hair, facial grooming, posture, gaze and framing. Never comments on the
 * person's body or looks.
 */
export async function coachPresence(
  dataUrl: string,
  companyId: string,
  role: string,
  signals: CoachSignals,
): Promise<CoachPayload> {
  const company = getCompany(companyId);
  const items: CoachItem[] = [];

  // Deterministic delivery coaching from the voice metrics — no model needed.
  if (signals.wordsPerMinute > 175) {
    items.push({
      area: "delivery",
      instruction: `You are speaking at ${Math.round(signals.wordsPerMinute)} wpm. Slow down and breathe at the end of each point.`,
      confidence: 95,
      reason: `Measured speaking pace ${Math.round(signals.wordsPerMinute)} wpm vs. the 120-160 wpm interview range.`,
      severity: deriveSeverity("delivery", 95),
    });
  } else if (signals.wordsPerMinute > 0 && signals.wordsPerMinute < 95) {
    items.push({
      area: "delivery",
      instruction: "Lift your pace and energy slightly — long gaps read as uncertainty.",
      confidence: 90,
      reason: `Measured speaking pace ${Math.round(signals.wordsPerMinute)} wpm, below the 120 wpm floor.`,
      severity: deriveSeverity("delivery", 90),
    });
  }
  if (signals.fillerWords >= 6) {
    items.push({
      area: "delivery",
      instruction: 'Cut the filler words — pause silently instead of saying "um" or "like".',
      confidence: 98,
      reason: `${signals.fillerWords} filler words counted across your answers so far.`,
      severity: deriveSeverity("delivery", 98),
    });
  }

  if (!dataUrl.startsWith("data:image/")) return { visible: false, items, integrity: NO_INTEGRITY };

  const system = [
    `You are a live interview presentation coach for a candidate interviewing at ${company.name} for a ${role} role.`,
    `Look at the webcam frame and judge ONLY: posture (slouching, leaning into the lens, sideways body), gaze/eye contact (looking away from the camera, down at notes), hair (grown out, uncombed, falling over the face), facial grooming (unkempt beard/stubble, needs a trim), and framing/lighting (too close, too low, backlit, cut off).`,
    `Never comment on the person's body, weight, skin, age, gender, ethnicity, attractiveness, clothing brand, or anything unrelated to those five areas. Never guess identity.`,
    `${company.name}'s interview style is ${company.interviewStyle}; keep the bar professional for that.`,
    `Assess every area on every frame. If it already looks correct, return an EMPTY STRING for the instruction and 0 for the confidence. Only write an instruction when there is something to fix.`,
    `When you do write an instruction, use one short second-person sentence in professional language, max 16 words, e.g. "Sit back and square your shoulders to the camera."`,
    `Each <area>Reason must state the visual evidence you actually saw, max 18 words, e.g. "Shoulders rolled forward and head about 20cm from the lens."`,
    `Each <area>Confidence is an integer 0-100: how certain you are the problem is really present. Use below 55 only when unsure.`,
    `Set visible=false with all instructions empty if the frame is too dark, too blurry, or no person is visible.`,
    `Also report interview integrity, factually: people = how many distinct people are visible in the frame (peopleConfidence 0-100); faceVisible = whether the candidate's face is clearly in frame; lookingAway = whether they are clearly reading something off-camera; deviceVisible = whether a mobile phone, tablet, smartwatch screen, printed notes or a second screen is visible in their hands or frame, with deviceConfidence 0-100 and deviceReason describing exactly what you saw.`,
  ].join("\n");

  try {
    const { value: output } = await runStructured({
      schema: coachSchema,
      system,
      prompt: `Live check. Heuristic signals: framing/eye-contact ${signals.eyeContact}%, stillness/attention ${signals.attention}%, posture ${signals.posture}%. Give corrections only where needed.`,
      images: [dataUrl],
    });

    const parsed = coachSchema.safeParse(output);
    if (!parsed.success) return { visible: false, items, integrity: NO_INTEGRITY };
    const r = parsed.data;
    const pct = (value: number) =>
      Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
    const integrity: CoachIntegrity = {
      people: Number.isFinite(r.people) ? Math.max(0, Math.round(r.people)) : 1,
      faceVisible: r.faceVisible !== false,
      lookingAway: r.lookingAway === true,
      deviceVisible: r.deviceVisible === true,
      deviceConfidence: pct(r.deviceConfidence),
      deviceReason: r.deviceReason.trim(),
      peopleConfidence: pct(r.peopleConfidence),
    };
    if (!r.visible) return { visible: false, items, integrity };

    const map: [CoachArea, string, string, number][] = [
      ["posture", r.posture, r.postureReason, r.postureConfidence],
      ["eye_contact", r.eyeContact, r.eyeContactReason, r.eyeContactConfidence],
      ["hair", r.hair, r.hairReason, r.hairConfidence],
      ["grooming", r.grooming, r.groomingReason, r.groomingConfidence],
      ["framing", r.framing, r.framingReason, r.framingConfidence],
    ];
    for (const [area, text, reason, confidence] of map) {
      const instruction = text.trim();
      // Ignore low-confidence guesses so the candidate only sees real issues.
      if (!instruction || pct(confidence) < 45) continue;
      items.push({
        area,
        instruction,
        confidence: pct(confidence),
        reason: reason.trim(),
        severity: deriveSeverity(area, pct(confidence)),
      });
    }
    return { visible: true, items, integrity };
  } catch {
    return { visible: false, items, integrity: NO_INTEGRITY };
  }
}

/* ------------------------------------------------------------------ */
/* resume file sanity check                                           */
/* ------------------------------------------------------------------ */

const RESUME_SIGNALS = [
  "experience",
  "education",
  "skills",
  "project",
  "internship",
  "university",
  "college",
  "b.tech",
  "bachelor",
  "master",
  "engineer",
  "developer",
  "certification",
  "achievement",
  "summary",
  "objective",
  "employment",
  "responsibilities",
  "curriculum vitae",
  "resume",
  "linkedin",
  "github",
];

export type ResumeDocVerdict = "resume" | "unreadable" | "not_resume";

/**
 * Deterministic guard so a random invoice, certificate or scanned image never
 * reaches the resume analyser. Cheap, offline, and explainable to the user.
 */
export function classifyResumeDocument(text: string): {
  verdict: ResumeDocVerdict;
  reason: string;
} {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 120) {
    return {
      verdict: "unreadable",
      reason:
        "We could not read any text from that file. If it is a scan or an image, upload a text-based PDF, DOCX or TXT resume.",
    };
  }
  const lower = clean.toLowerCase();
  const hits = RESUME_SIGNALS.filter((signal) => lower.includes(signal)).length;
  const hasContact = /(@[a-z0-9.-]+\.[a-z]{2,})|(\+?\d[\d ()-]{7,})/i.test(clean);
  if (hits >= 3 || (hits >= 2 && hasContact)) return { verdict: "resume", reason: "" };
  return {
    verdict: "not_resume",
    reason:
      "This doesn't look like a resume. Please upload the correct file — a PDF, DOCX or TXT resume with your skills, experience and education.",
  };
}

/* ------------------------------------------------------------------ */
/* resume corrections review (Apply all corrections)                   */
/* ------------------------------------------------------------------ */

export interface ResumeCorrectionPayload {
  id: string;
  section: "summary" | "experience" | "skills" | "education" | "projects" | "other";
  original: string;
  corrected: string;
  rationale: string;
}

export interface ResumeAutoCorrectPayload {
  /** Fully rewritten, ATS-optimised resume text a candidate can paste back in wholesale. */
  fullText: string;
  /** Discrete, reviewable line-level changes backing the rewrite. */
  corrections: ResumeCorrectionPayload[];
}

const correctionsSchema = z.object({
  fullText: z.string(),
  corrections: z.array(
    z.object({
      section: z.enum(["summary", "experience", "skills", "education", "projects", "other"]),
      original: z.string(),
      corrected: z.string(),
      rationale: z.string(),
    }),
  ),
});

/**
 * Groq rewrites the whole resume for a target company/role, aiming for a
 * 100/100 ATS score, and also returns discrete line-level changes so the
 * candidate can review and accept/reject each one before applying.
 */
export async function generateResumeCorrections(
  resumeText: string,
  companyId: string,
  role: string,
): Promise<ResumeAutoCorrectPayload> {
  const company = getCompany(companyId);
  const text = resumeText.trim();
  if (text.length < 40) return { fullText: text, corrections: [] };

  const raw = await structured({
    schema: correctionsSchema,
    system: [
      `You are an expert resume editor preparing a candidate for a ${company.name} ${role} interview, targeting a perfect 100/100 applicant-tracking-system (ATS) score.`,
      `First, rewrite the ENTIRE resume as "fullText": keep every real fact, employer, project, degree and date the candidate provided, but tighten wording, add strong action verbs, quantify impact where the original already implies a metric, add a clearly labelled Skills/Experience/Projects/Education section structure, and naturally weave in ${company.name}-relevant keywords (${company.focus.join(", ")}) and general ATS keywords for a ${role}. Never invent employers, dates, degrees or numbers that are not implied by the original resume — use a bracket placeholder like [X%] only where a metric is clearly implied but not stated. Preserve the candidate's name and contact details verbatim. Plain text only, no markdown tables.`,
      `Then list the concrete line-level changes as "corrections". Each "original" MUST be copied verbatim (exact substring) from the ORIGINAL resume text so it can be found and replaced individually if the candidate rejects the full rewrite. Only include changes that materially improve the line — skip lines that are already strong. Return at most 15 corrections, ordered by impact.`,
    ].join("\n"),
    prompt: `Resume:\n\n${text.slice(0, 20000)}`,
    fallback: { fullText: text, corrections: [] },
  });

  const corrections = (raw.corrections ?? [])
    .filter((c) => c.original && text.includes(c.original) && c.corrected && c.corrected !== c.original)
    .slice(0, 15)
    .map((c, i) => ({
      id: `corr_${i}_${c.original.slice(0, 12).replace(/\W+/g, "")}`,
      section: c.section,
      original: c.original,
      corrected: c.corrected,
      rationale: c.rationale || "Improves clarity and keyword match.",
    }));

  const fullText = typeof raw.fullText === "string" && raw.fullText.trim().length > 40 ? raw.fullText.trim() : text;

  return { fullText, corrections };
}

/* ------------------------------------------------------------------ */
/* shortlist-likelihood analysis                                       */
/* ------------------------------------------------------------------ */

export interface LikelihoodSectionPayload {
  section: "summary" | "experience" | "skills" | "education" | "projects";
  score: number;
  explanation: string;
  improvements: string[];
}

export interface ShortlistLikelihoodPayload {
  overall: number;
  overallExplanation: string;
  sections: LikelihoodSectionPayload[];
}

const likelihoodSchema = z.object({
  overall: z.number(),
  overallExplanation: z.string(),
  sections: z.array(
    z.object({
      section: z.enum(["summary", "experience", "skills", "education", "projects"]),
      score: z.number(),
      explanation: z.string(),
      improvements: z.array(z.string()),
    }),
  ),
});

const LIKELIHOOD_SECTIONS: LikelihoodSectionPayload["section"][] = [
  "summary",
  "experience",
  "skills",
  "education",
  "projects",
];

/**
 * Whole-resume and per-section shortlist likelihood for a specific company
 * and role, each with a plain-English reason and concrete improvements.
 */
export async function analyzeShortlistLikelihood(
  resumeText: string,
  companyId: string,
  role: string,
  experience: string,
): Promise<ShortlistLikelihoodPayload> {
  const company = getCompany(companyId);
  const text = resumeText.trim();

  const fallback: ShortlistLikelihoodPayload = {
    overall: 0,
    overallExplanation: "Paste or upload your resume to get a shortlist-likelihood score.",
    sections: LIKELIHOOD_SECTIONS.map((section) => ({
      section,
      score: 0,
      explanation: "Not enough resume text to assess this section yet.",
      improvements: [],
    })),
  };

  if (text.length < 60) return fallback;

  const raw = await structured({
    schema: likelihoodSchema,
    system: [
      `You are a recruiter screening resumes for a ${experience} ${role} role at ${company.name}.`,
      `Estimate the likelihood (0-100) that this resume gets shortlisted for a first-round interview, both overall and for each section: summary, experience, skills, education, projects.`,
      `${company.name} looks for: ${company.focus.join(", ")}. Evaluation style: ${company.evaluationStyle}.`,
      `Every explanation must be plain English, specific, and reference what is (or is not) actually on the resume. "improvements" are concrete, actionable rewrites — not generic advice. If a section is entirely absent, score it low and say so.`,
      `Max 4 improvements per section.`,
    ].join("\n"),
    prompt: `Resume:\n\n${text.slice(0, 20000)}`,
    fallback,
  });

  const sections = LIKELIHOOD_SECTIONS.map((section) => {
    const found = raw.sections?.find((s) => s.section === section);
    return {
      section,
      score: clampScore(found?.score ?? 0),
      explanation: found?.explanation?.trim() || "This section could not be assessed.",
      improvements: (found?.improvements ?? []).filter(Boolean).slice(0, 4),
    };
  });

  return {
    overall: clampScore(raw.overall),
    overallExplanation: raw.overallExplanation?.trim() || fallback.overallExplanation,
    sections,
  };
}

/* ------------------------------------------------------------------ */
/* "how to score 100/100" answer coaching                               */
/* ------------------------------------------------------------------ */

export interface AnswerCoachingPayload {
  turnId: string;
  idealShape: string;
  mustHit: string[];
  modelAnswer: string;
  whyItLostPoints: string;
}

const answerCoachingSchema = z.object({
  items: z.array(
    z.object({
      turnId: z.string(),
      idealShape: z.string(),
      mustHit: z.array(z.string()),
      modelAnswer: z.string(),
      whyItLostPoints: z.string(),
    }),
  ),
});

/**
 * For every graded question, produce the shape of a 100/100 answer, the
 * specific points it must hit, a model answer written against the
 * candidate's own resume, and why their actual answer lost points.
 */
export async function generateAnswerCoaching(
  config: InterviewConfig,
  turns: Turn[],
): Promise<AnswerCoachingPayload[]> {
  const company = getCompany(config.companyId);
  const graded = turns.filter((t) => t.question && t.answer && t.answer.trim().length > 0);
  if (graded.length === 0) return [];

  const resume = config.resume;
  const resumeContext = resume
    ? [
        `Headline: ${resume.headline}`,
        `Skills: ${resume.skills.join(", ")}`,
        `Projects: ${resume.projects.map((p) => `${p.title}: ${p.summary}`).join("; ")}`,
        `Experience: ${resume.experience.join("; ")}`,
      ].join("\n")
    : "No resume was provided — write model answers from strong generic best practice instead.";

  const fallback: { items: AnswerCoachingPayload[] } = { items: [] };

  const raw = await structured({
    schema: answerCoachingSchema,
    system: [
      `You are an interview coach for a ${company.name} ${config.role} interview (${config.experience}).`,
      `For each question below, write: idealShape (1-2 sentences on the structure a perfect answer takes, e.g. STAR, or approach-then-code), mustHit (3-5 specific points a top answer must cover for THIS question), modelAnswer (a strong, concrete answer written in first person using the CANDIDATE'S OWN RESUME details where relevant — never invent facts not in the resume, keep it 60-140 words), and whyItLostPoints (one specific sentence citing what the candidate's actual answer missed or got wrong compared to the model answer; if they scored well, say what they did right and the one thing that would make it perfect).`,
      `Return one item per turnId given, using the exact turnId values provided.`,
    ].join("\n"),
    prompt: [
      `Candidate resume:\n${resumeContext}`,
      ``,
      `Questions and answers:`,
      graded
        .map(
          (t) =>
            `turnId: ${t.id}\nQuestion (${t.question?.topic}, difficulty ${t.question?.difficulty}/5): ${t.question?.prompt}\nCandidate answer: ${t.answer}\nVerified score: ${t.evaluation?.score ?? "n/a"}/100 (${t.evaluation?.verdict ?? "ungraded"})`,
        )
        .join("\n\n"),
    ].join("\n"),
    fallback,
  });

  return graded.map((t) => {
    const found = raw.items?.find((i) => i.turnId === t.id);
    return {
      turnId: t.id,
      idealShape: found?.idealShape?.trim() || "Structure: context, action taken, concrete result.",
      mustHit: (found?.mustHit ?? []).filter(Boolean).slice(0, 5),
      modelAnswer: found?.modelAnswer?.trim() || "",
      whyItLostPoints: found?.whyItLostPoints?.trim() || t.evaluation?.note || "",
    };
  });
}

/* ------------------------------------------------------------------ */
/* replay forensics (post-interview frame analysis)                    */
/* ------------------------------------------------------------------ */

export interface ForensicsFramePayload {
  t: number;
  dataUrl: string;
}

export interface ForensicsFindingPayload {
  t: number;
  kind:
    | "multiple_people"
    | "phone_use"
    | "background_voice"
    | "second_speaker"
    | "grooming"
    | "appearance";
  detail: string;
  confidence: number;
  severity: FlagSeverity;
}

export interface ForensicsReportPayload {
  assessed: boolean;
  findings: ForensicsFindingPayload[];
  groomingSummary: string;
}

const forensicsFindingSchema = z.object({
  t: z.number(),
  kind: z.enum([
    "multiple_people",
    "phone_use",
    "background_voice",
    "second_speaker",
    "grooming",
    "appearance",
  ]),
  detail: z.string(),
  confidence: z.number(),
  severity: z.enum(["low", "medium", "high"]),
});

const forensicsSchema = z.object({
  findings: z.array(forensicsFindingSchema),
  groomingSummary: z.string(),
});

const NO_FORENSICS: ForensicsReportPayload = {
  assessed: false,
  findings: [],
  groomingSummary: "",
};

/**
 * Post-interview forensics pass over a handful of frames sampled from the
 * locally recorded webcam clip (chosen around live proctor flags plus an
 * even spread across the session). Confirms or refines integrity events —
 * a second person, phone/device use, a second speaker glimpsed on camera —
 * and gives one grooming/appearance read, every finding pinned to the
 * timestamp of the frame it came from so the report can seek the replay.
 */
export async function generateReplayForensics(
  frames: ForensicsFramePayload[],
  companyId: string,
  role: string,
): Promise<ForensicsReportPayload> {
  const company = getCompany(companyId);
  const valid = frames
    .filter((f) => f.dataUrl.startsWith("data:image/") && Number.isFinite(f.t))
    .slice(0, 8);
  if (valid.length === 0) return NO_FORENSICS;

  const timestamps = valid.map((f) => f.t);

  const system = [
    `You are a proctoring and presentation reviewer auditing a recorded interview for a ${company.name} ${role} role, after the fact, from a handful of sampled webcam frames.`,
    `You are given ${valid.length} frames, in chronological order, timestamped in seconds from the start of the recording: ${timestamps.join(", ")}.`,
    `For each frame that shows an integrity concern, add one finding using EXACTLY one of the given timestamps: "multiple_people" (a second person visible), "phone_use" (a phone or second screen visible), "background_voice" or "second_speaker" ONLY if something in the frame itself suggests it (someone else visible or gesturing as if speaking) — never guess sound you cannot see.`,
    `Always add exactly one "grooming" finding and, only if dress is notably off for this company's interview style (${company.interviewStyle}), one "appearance" finding — each using the timestamp of whichever frame shows the candidate most clearly.`,
    `If a frame is empty, too dark, or shows nothing notable, do not invent a finding for it — findings should only cover real observations.`,
    `Never comment on body, weight, skin, age, gender, ethnicity or attractiveness — clothing and grooming (hair, tidiness) only.`,
    `detail is one short, concrete, second-person sentence. confidence is 0-100 for how sure you are. severity is low/medium/high for integrity findings; use "low" for grooming/appearance reads.`,
    `groomingSummary is one or two plain sentences summarising overall grooming and appearance across all frames, written for a recruiter reading this after the interview.`,
    `If nothing at all is notable across every frame, return an empty findings array and a short reassuring groomingSummary, but never fabricate an issue to fill the list.`,
  ].join("\n");

  try {
    const { value } = await runStructured({
      schema: forensicsSchema,
      system,
      prompt: "Review the attached frames and report findings per the schema.",
      images: valid.map((f) => f.dataUrl),
    });
    const parsed = forensicsSchema.safeParse(value);
    if (!parsed.success) return NO_FORENSICS;
    const nearestT = (t: number) =>
      timestamps.reduce((best, cur) => (Math.abs(cur - t) < Math.abs(best - t) ? cur : best), timestamps[0]);
    return {
      assessed: true,
      findings: parsed.data.findings
        .map((f) => ({ ...f, t: nearestT(f.t) }))
        .slice(0, 16),
      groomingSummary: parsed.data.groomingSummary.trim(),
    };
  } catch {
    return NO_FORENSICS;
  }
}
