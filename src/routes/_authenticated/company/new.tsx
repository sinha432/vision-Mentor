import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  FileQuestion,
  Loader2,
  Plus,
  Search,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useDemoAuth } from "@/contexts/DemoAuthContext";
import { createAssessmentWithPersistence } from "@/lib/assessments.functions";
import { getCompanyProfile } from "@/lib/assessments-data";
import { Shell } from "./index";

export const Route = createFileRoute("/_authenticated/company/new")({ component: NewAssessment });

type QType = "text" | "mcq" | "code";
type CodeLanguage = "java" | "javascript" | "python";
type Choice = { id: string; text: string };
type TC = { input: string; expectedStdout: string };
type Q = {
  type: QType;
  text: string;
  weight: string;
  // text
  keywords: string;
  maxLength: string;
  // mcq
  choices: Choice[];
  correctChoiceId: string;
  // code
  language: CodeLanguage;
  starterCode: string;
  testCases: TC[];
};

type QuestionIssue = {
  question: number;
  message: string;
};

type CandidateOption = {
  id: string;
  name: string;
  email: string;
};

type InvitationResult = {
  candidateId: string;
  name: string;
  email: string;
  success: boolean;
  error?: string;
};

type CreatedAssessment = {
  code: string;
  link: string;
  persisted: boolean;
};

const newCid = () => Math.random().toString(36).slice(2, 8);

const starterTemplates: Record<CodeLanguage, string> = {
  java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        // Read input, implement the solution, and print the result.
    }
}`,
  javascript: `const fs = require("fs");
const input = fs.readFileSync(0, "utf8").trim();

// Parse input, implement the solution, and print the result.
console.log(input);`,
  python: `import sys

def solve(input_text: str) -> str:
    # Parse input, implement the solution, and return the result.
    return input_text.strip()

print(solve(sys.stdin.read()))`,
};

const blankQ = (): Q => ({
  type: "text",
  text: "",
  weight: "1",
  keywords: "",
  maxLength: "",
  choices: [
    { id: newCid(), text: "" },
    { id: newCid(), text: "" },
  ],
  correctChoiceId: "",
  language: "java",
  starterCode: starterTemplates.java,
  testCases: [{ input: "", expectedStdout: "" }],
});

function NewAssessment() {
  const { user, signOut } = useDemoAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Q[]>([blankQ()]);
  const [requireMedia, setRequireMedia] = useState(false);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30);
  const [defaultWeight, setDefaultWeight] = useState(1);
  const [busy, setBusy] = useState(false);
  const [openAdvanced, setOpenAdvanced] = useState<number | null>(null);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidateOptions, setCandidateOptions] = useState<CandidateOption[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<CandidateOption[]>([]);
  const [searchingCandidates, setSearchingCandidates] = useState(false);
  const [candidateSearchError, setCandidateSearchError] = useState("");
  const [createdAssessment, setCreatedAssessment] = useState<CreatedAssessment | null>(null);
  const [invitationResults, setInvitationResults] = useState<InvitationResult[]>([]);
  const [retryingInvitations, setRetryingInvitations] = useState(false);

  const questionIssues = useMemo<QuestionIssue[]>(() => {
    const issues: QuestionIssue[] = [];

    const completedQuestions = questions.filter((question) => question.text.trim().length >= 3);

    if (completedQuestions.length === 0) {
      issues.push({ question: 0, message: "Add at least one question prompt." });
      return issues;
    }

    questions.forEach((question, index) => {
      if (question.text.trim().length < 3) return;

      if (
        question.type === "mcq" &&
        question.choices.filter((choice) => choice.text.trim()).length < 2
      ) {
        issues.push({
          question: index,
          message: "Add at least two answer choices.",
        });
      } else if (
        question.type === "mcq" &&
        (!question.correctChoiceId ||
          !question.choices.some(
            (choice) => choice.id === question.correctChoiceId && choice.text.trim(),
          ))
      ) {
        issues.push({
          question: index,
          message: "Select the correct answer using the radio button.",
        });
      }

      if (
        question.type === "code" &&
        (!question.language ||
          !question.starterCode.trim() ||
          question.testCases.every(
            (testCase) => !testCase.input.trim() && !testCase.expectedStdout.trim(),
          ))
      ) {
        issues.push({ question: index, message: "Add at least one test case." });
      }
    });

    return issues;
  }, [questions]);

  const questionTypeCounts = useMemo(
    () =>
      questions.reduce(
        (counts, question) => ({
          ...counts,
          [question.type]: counts[question.type] + 1,
        }),
        { text: 0, mcq: 0, code: 0 },
      ),
    [questions],
  );

  const estimatedMinutes = Math.max(
    5,
    questions.reduce((total, question) => total + (question.type === "code" ? 12 : 5), 0),
  );

  const readyToPublish = title.trim().length >= 2 && questionIssues.length === 0;

  useEffect(() => {
    void getCompanyProfile().then((profile) => {
      const weight = profile.preferences.assessmentDefaults.questionWeight;
      setDefaultWeight(weight);
      setRequireMedia(profile.preferences.assessmentDefaults.requireMedia);
      setQuestions((current) =>
        current.map((question) =>
          question.text ? question : { ...question, weight: String(weight) },
        ),
      );
    });
  }, []);

  useEffect(() => {
    const query = candidateQuery.trim();
    if (query.length < 2) {
      setCandidateOptions([]);
      setCandidateSearchError("");
      setSearchingCandidates(false);
      return;
    }

    let active = true;
    const timeout = window.setTimeout(() => {
      setSearchingCandidates(true);
      setCandidateSearchError("");
      void fetch(`/api/company/candidates?q=${encodeURIComponent(query)}`)
        .then(async (response) => {
          const result = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(result.error ?? "Candidate search failed");
          }
          return result as { candidates?: CandidateOption[] };
        })
        .then((result) => {
          if (active) setCandidateOptions(result.candidates ?? []);
        })
        .catch((error: unknown) => {
          if (!active) return;
          setCandidateOptions([]);
          setCandidateSearchError(
            error instanceof Error ? error.message : "Candidate search failed",
          );
        })
        .finally(() => {
          if (active) setSearchingCandidates(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [candidateQuery]);

  if (user && user.role !== "company") {
    navigate({ to: "/" });
    return null;
  }

  const addQ = () => setQuestions((qs) => [...qs, { ...blankQ(), weight: String(defaultWeight) }]);
  const rmQ = (i: number) => setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  const setQ = (i: number, patch: Partial<Q>) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  const sendInvitations = async (code: string, candidateIds: string[]) => {
    const response = await fetch("/api/company/assessment-invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, candidateIds }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(result.results)) {
      throw new Error(result.error ?? "Could not send assessment invitations");
    }
    return result as { results: InvitationResult[]; testLink?: string };
  };

  const failedInvitationResults = (error: string): InvitationResult[] =>
    selectedCandidates.map((candidate) => ({
      candidateId: candidate.id,
      name: candidate.name,
      email: candidate.email,
      success: false,
      error,
    }));

  const retryFailedInvitations = async () => {
    if (!createdAssessment?.persisted) return;
    const failedIds = invitationResults
      .filter((result) => !result.success)
      .map((result) => result.candidateId);
    if (failedIds.length === 0) return;

    setRetryingInvitations(true);
    try {
      const response = await sendInvitations(createdAssessment.code, failedIds);
      if (response.testLink) {
        setCreatedAssessment((current) =>
          current ? { ...current, link: response.testLink! } : current,
        );
      }
      const updatedById = new Map(response.results.map((result) => [result.candidateId, result]));
      setInvitationResults((current) =>
        current.map((result) => updatedById.get(result.candidateId) ?? result),
      );
      const resent = response.results.filter((result) => result.success).length;
      toast.success(
        resent > 0
          ? `Sent ${resent} retried invitation${resent === 1 ? "" : "s"}.`
          : "No failed invitations were sent.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not retry invitations");
    } finally {
      setRetryingInvitations(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (selectedCandidates.length === 0) {
      toast.error("Select at least one candidate to receive the assessment link.");
      return;
    }
    if (!readyToPublish) {
      const firstIssue = questionIssues[0]?.message;
      toast.error(
        title.trim().length < 2
          ? "Add an assessment title before publishing."
          : (firstIssue ?? "Complete the assessment before publishing."),
      );
      return;
    }
    const cleaned = questions
      .map((q) => {
        const base = {
          type: q.type,
          text: q.text.trim(),
          weight: Number(q.weight) > 0 ? Number(q.weight) : 1,
        };
        if (q.type === "text") {
          return {
            ...base,
            keywords: q.keywords
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            maxLength: q.maxLength.trim() ? Number(q.maxLength) : null,
          };
        }
        if (q.type === "mcq") {
          const choices = q.choices
            .map((c) => ({ id: c.id, text: c.text.trim() }))
            .filter((c) => c.text);
          return {
            ...base,
            choices,
            correctChoiceId: q.correctChoiceId,
            keywords: [],
            maxLength: null,
          };
        }
        // code
        const testCases = q.testCases.filter(
          (t) => t.expectedStdout.trim() !== "" || t.input.trim() !== "",
        );
        return {
          ...base,
          language: q.language,
          starterCode: q.starterCode.trim(),
          testCases,
          keywords: [],
          maxLength: null,
        };
      })
      .filter((q) => q.text.length >= 3);

    // validate
    for (const q of cleaned as any[]) {
      if (q.type === "mcq") {
        if (!q.choices || q.choices.length < 2) return toast.error("MCQ needs at least 2 choices");
        if (
          !q.correctChoiceId ||
          !q.choices.some((c: { id: string }) => c.id === q.correctChoiceId)
        )
          return toast.error("Pick the correct MCQ option");
      }
      if (
        q.type === "code" &&
        (!q.language || !q.starterCode || !q.testCases || q.testCases.length === 0)
      )
        return toast.error(
          "Coding question needs a language, starter code, and at least 1 test case",
        );
    }
    if (!cleaned.length) return toast.error("Add at least one question");

    setBusy(true);
    try {
      const { assessment: rec, persisted } = await createAssessmentWithPersistence({
        data: {
          companyUserId: user.id,
          title: title.trim(),
          requireMedia,
          timeLimitSeconds: timeLimitMinutes * 60,
          questions: cleaned,
        },
      });
      const link = `${window.location.origin}/a/${rec.code}`;
      setCreatedAssessment({ code: rec.code, link, persisted });
      if (!persisted) {
        const message = "Not sent because the assessment could not be saved to the company server.";
        setInvitationResults(failedInvitationResults(message));
        toast.error("Assessment saved only in this browser; invitations were not sent.");
        return;
      }

      try {
        const response = await sendInvitations(
          rec.code,
          selectedCandidates.map((candidate) => candidate.id),
        );
        const canonicalLink = response.testLink ?? link;
        setCreatedAssessment({ code: rec.code, link: canonicalLink, persisted: true });
        await navigator.clipboard.writeText(canonicalLink).catch(() => {});
        setInvitationResults(response.results);
        const sent = response.results.filter((result) => result.success).length;
        const failed = response.results.length - sent;
        if (failed === 0) {
          toast.success(
            `Assessment published and sent to ${sent} candidate${sent === 1 ? "" : "s"}.`,
          );
        } else {
          toast.error(
            `${sent} invitation${sent === 1 ? "" : "s"} sent; ${failed} failed. You can retry failed invitations.`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not send invitations";
        setInvitationResults(failedInvitationResults(message));
        toast.error("Assessment published, but invitations could not be sent.");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Could not create");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="New Assessment"
      user={user?.name ?? ""}
      onSignOut={() => {
        signOut();
        navigate({ to: "/auth" });
      }}
    >
      <form onSubmit={onSubmit} className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate({ to: "/company" })}
              className="mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Assessments
            </button>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyber/15 text-cyber ring-1 ring-cyber/30">
                <FileQuestion className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-2xl text-gradient sm:text-3xl">
                  Build an assessment
                </h1>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Create a focused candidate experience with the right mix of questions.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            <span
              className={`h-2 w-2 rounded-full ${readyToPublish ? "bg-emerald" : "bg-amber"}`}
            />
            {readyToPublish ? "Ready to publish" : "Draft in progress"}
          </div>
        </header>

        <section className="glass-strong rounded-2xl p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyber">
                <Sparkles className="h-3.5 w-3.5" /> Step 1 · Assessment setup
              </div>
              <h2 className="font-display text-lg">Set the candidate context</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Give candidates a clear first impression before they answer anything.
              </p>
            </div>
            <span className="hidden rounded-full bg-cyber/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyber sm:inline-flex">
              Essential
            </span>
          </div>

          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Time limit</span>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={timeLimitMinutes}
                  onChange={(event) =>
                    setTimeLimitMinutes(Math.max(1, Number(event.target.value) || 1))
                  }
                  className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <span className="text-sm text-muted-foreground">
                  minutes before automatic submission
                </span>
              </div>
            </label>
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Assessment title
              </span>
              <input
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Frontend engineer screen"
                className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-cyber focus:ring-2 focus:ring-cyber/15"
              />
              <span className="block text-xs text-muted-foreground">
                Use a role and stage so your team can recognize it later.
              </span>
            </label>

            <label className="flex items-center justify-between gap-4 rounded-xl border border-cyber/20 bg-cyber/5 p-4 text-sm">
              <span>
                <span className="flex items-center gap-2 font-medium">
                  <ShieldCheck className="h-4 w-4 text-cyber" /> Require camera and microphone
                </span>
                <span className="mt-1 block max-w-xl text-xs text-muted-foreground">
                  Candidates must grant media access before starting this monitored assessment.
                </span>
              </span>
              <input
                type="checkbox"
                checked={requireMedia}
                onChange={(event) => setRequireMedia(event.target.checked)}
                className="h-5 w-5 shrink-0 accent-cyber"
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet">
              <FileQuestion className="h-3.5 w-3.5" /> Step 2 · Question library
            </div>
            <h2 className="font-display text-lg">Write the questions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Mix practical prompts, multiple choice, and coding exercises.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="space-y-4">
          {questions.map((q, i) => (
            <div
              key={i}
              className={`glass-strong space-y-3 rounded-2xl p-4 sm:p-5 ${
                questionIssues.some((issue) => issue.question === i) ? "border-amber/50" : ""
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-cyber/15 text-xs font-bold text-cyber">
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Question {i + 1}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {q.type === "text"
                        ? "Written response"
                        : q.type === "mcq"
                          ? "Multiple choice"
                          : "Coding exercise"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={q.type}
                    onChange={(e) => setQ(i, { type: e.target.value as QType })}
                    className="rounded-lg border border-border bg-background/70 px-2.5 py-2 text-xs outline-none focus:border-cyber"
                  >
                    <option value="text">Text</option>
                    <option value="mcq">MCQ</option>
                    <option value="code">Code (Java)</option>
                  </select>
                  <label className="text-[10px] text-muted-foreground">Weight</label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={q.weight}
                    onChange={(e) => setQ(i, { weight: e.target.value })}
                    className="w-16 rounded-lg border border-border bg-background/70 px-2 py-2 text-xs outline-none focus:border-cyber"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setQuestions((current) => [
                        ...current.slice(0, i + 1),
                        {
                          ...q,
                          choices: q.choices.map((choice) => ({
                            ...choice,
                            id: newCid(),
                          })),
                        },
                        ...current.slice(i + 1),
                      ])
                    }
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-cyber/10 hover:text-cyber"
                    aria-label={`Duplicate question ${i + 1}`}
                    title="Duplicate question"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => rmQ(i)}
                      className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove question ${i + 1}`}
                      title="Remove question"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <textarea
                required
                minLength={3}
                maxLength={2000}
                value={q.text}
                onChange={(e) => setQ(i, { text: e.target.value })}
                placeholder={
                  q.type === "code"
                    ? "Problem statement — e.g. Read an integer N and print N*N."
                    : "Question text"
                }
                className="mt-1 min-h-[100px] w-full resize-y rounded-xl border border-border bg-background/40 p-3 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-cyber focus:ring-2 focus:ring-cyber/15"
              />

              {questionIssues.find((issue) => issue.question === i) && (
                <p className="text-xs text-amber">
                  {questionIssues.find((issue) => issue.question === i)?.message}
                </p>
              )}

              {q.type === "text" && (
                <div>
                  <button
                    type="button"
                    onClick={() => setOpenAdvanced(openAdvanced === i ? null : i)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    Advanced options
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition ${openAdvanced === i ? "rotate-180" : ""}`}
                    />
                  </button>
                  {openAdvanced === i && (
                    <div className="mt-3 grid gap-3 rounded-xl border border-border bg-background/30 p-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Keywords
                        </span>
                        <input
                          value={q.keywords}
                          onChange={(e) => setQ(i, { keywords: e.target.value })}
                          placeholder="react, testing, performance"
                          className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-xs outline-none focus:border-cyber"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Max response length
                        </span>
                        <input
                          type="number"
                          min={20}
                          max={5000}
                          value={q.maxLength}
                          onChange={(e) => setQ(i, { maxLength: e.target.value })}
                          placeholder="300 characters"
                          className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-xs outline-none focus:border-cyber"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {q.type === "mcq" && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Choices (pick the correct one)
                  </div>
                  {q.choices.map((c, ci) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${i}`}
                        checked={q.correctChoiceId === c.id}
                        onChange={() => setQ(i, { correctChoiceId: c.id })}
                        className="accent-primary"
                      />
                      <input
                        value={c.text}
                        onChange={(e) =>
                          setQ(i, {
                            choices: q.choices.map((x, xi) =>
                              xi === ci ? { ...x, text: e.target.value } : x,
                            ),
                          })
                        }
                        placeholder={`Option ${ci + 1}`}
                        className="flex-1 glass rounded-md px-3 py-2 bg-transparent outline-none text-sm"
                      />
                      {q.choices.length > 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setQ(i, { choices: q.choices.filter((_, xi) => xi !== ci) })
                          }
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {q.choices.length < 8 && (
                    <button
                      type="button"
                      onClick={() =>
                        setQ(i, { choices: [...q.choices, { id: newCid(), text: "" }] })
                      }
                      className="text-xs text-primary inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add choice
                    </button>
                  )}
                </div>
              )}

              {q.type === "code" && (
                <div className="space-y-2">
                  <label className="block space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Language
                    </span>
                    <select
                      value={q.language}
                      onChange={(e) => {
                        const language = e.target.value as CodeLanguage;
                        setQ(i, { language, starterCode: starterTemplates[language] });
                      }}
                      className="w-full glass rounded-md px-3 py-2 bg-transparent outline-none text-sm"
                    >
                      <option value="java">Java</option>
                      <option value="javascript">JavaScript</option>
                      <option value="python">Python</option>
                    </select>
                  </label>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                      Complete starter scaffold
                    </div>
                    <textarea
                      value={q.starterCode}
                      onChange={(e) => setQ(i, { starterCode: e.target.value })}
                      className="w-full glass rounded-md p-2 bg-transparent outline-none text-xs font-mono resize-y min-h-[140px]"
                    />
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Test cases (stdin → expected stdout)
                  </div>
                  {q.testCases.map((t, ti) => (
                    <div key={ti} className="grid md:grid-cols-2 gap-2 items-start">
                      <textarea
                        value={t.input}
                        onChange={(e) =>
                          setQ(i, {
                            testCases: q.testCases.map((x, xi) =>
                              xi === ti ? { ...x, input: e.target.value } : x,
                            ),
                          })
                        }
                        placeholder="stdin"
                        className="glass rounded-md p-2 bg-transparent outline-none text-xs font-mono resize-y min-h-[64px]"
                      />
                      <div className="flex gap-1 items-start">
                        <textarea
                          value={t.expectedStdout}
                          onChange={(e) =>
                            setQ(i, {
                              testCases: q.testCases.map((x, xi) =>
                                xi === ti ? { ...x, expectedStdout: e.target.value } : x,
                              ),
                            })
                          }
                          placeholder="expected stdout"
                          className="flex-1 glass rounded-md p-2 bg-transparent outline-none text-xs font-mono resize-y min-h-[64px]"
                        />
                        {q.testCases.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setQ(i, { testCases: q.testCases.filter((_, xi) => xi !== ti) })
                            }
                            className="text-muted-foreground hover:text-destructive mt-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {q.testCases.length < 10 && (
                    <button
                      type="button"
                      onClick={() =>
                        setQ(i, { testCases: [...q.testCases, { input: "", expectedStdout: "" }] })
                      }
                      className="text-xs text-primary inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add test case
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addQ}
            className="glass rounded-lg w-full py-3 text-xs inline-flex items-center justify-center gap-2 hover:glow-cyber"
          >
            <Plus className="w-4 h-4" /> Add question
          </button>
        </div>

        <section className="glass-strong space-y-4 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyber">
                <UserRound className="h-3.5 w-3.5" /> Candidate invitations
              </div>
              <h2 className="font-display text-lg">Choose who receives the test</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select at least one registered candidate. The assessment link will be emailed to
                their account address.
              </p>
            </div>
            <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
              {selectedCandidates.length} selected · max 25
            </span>
          </div>

          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={candidateQuery}
              onChange={(event) => setCandidateQuery(event.target.value)}
              placeholder="Search by candidate name or email"
              aria-label="Search registered candidates"
              className="pl-9"
            />
          </label>

          {selectedCandidates.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Selected candidates">
              {selectedCandidates.map((candidate) => (
                <li
                  key={candidate.id}
                  className="flex max-w-full items-center gap-2 rounded-md border border-cyber/25 bg-cyber/5 px-2.5 py-1.5 text-xs"
                >
                  <span className="min-w-0 truncate">
                    {candidate.name} · {candidate.email}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCandidates((current) =>
                        current.filter((item) => item.id !== candidate.id),
                      )
                    }
                    aria-label={`Remove ${candidate.name}`}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {candidateSearchError && (
            <p role="alert" className="text-sm text-destructive">
              {candidateSearchError}
            </p>
          )}
          {candidateQuery.trim().length < 2 ? (
            <p className="text-xs text-muted-foreground">
              Enter at least two characters to search.
            </p>
          ) : searchingCandidates ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching candidates
            </p>
          ) : !candidateSearchError && candidateOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No matching candidates found.</p>
          ) : (
            <ul
              className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border"
              aria-label="Candidate search results"
            >
              {candidateOptions.map((candidate) => {
                const isSelected = selectedCandidates.some((item) => item.id === candidate.id);
                return (
                  <li key={candidate.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-accent/40">
                      <Checkbox
                        checked={isSelected}
                        disabled={!isSelected && selectedCandidates.length >= 25}
                        onCheckedChange={(checked) => {
                          if (checked && !isSelected && selectedCandidates.length >= 25) {
                            toast.error("You can send up to 25 invitations at a time.");
                            return;
                          }
                          setSelectedCandidates((current) => {
                            if (checked && !current.some((item) => item.id === candidate.id)) {
                              return [...current, candidate];
                            }
                            return checked
                              ? current
                              : current.filter((item) => item.id !== candidate.id);
                          });
                        }}
                        aria-label={`Select ${candidate.name}`}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{candidate.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {candidate.email}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {createdAssessment && (
          <section
            className="rounded-2xl border border-border bg-background/40 p-4 sm:p-5"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-display text-lg">
                  {createdAssessment.persisted
                    ? "Assessment published"
                    : "Assessment saved locally"}
                </h2>
                {!createdAssessment.persisted && (
                  <p className="mt-2 text-sm text-destructive">
                    This assessment is only saved in this browser and is not available to candidates
                    yet.
                  </p>
                )}
                {createdAssessment.persisted && (
                  <p className="mt-1 break-all font-mono text-xs text-primary">
                    {createdAssessment.link}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {createdAssessment.persisted && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(createdAssessment.link)
                        .then(() => toast.success("Assessment link copied."))
                        .catch(() => toast.error("Could not copy assessment link."));
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" /> Copy link
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => navigate({ to: "/dashboard/assessments" })}
                >
                  Assessments
                </Button>
              </div>
            </div>
            {createdAssessment.persisted && (
              <>
                {invitationResults.length === 0 ? (
                  <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending invitations
                  </p>
                ) : (
                  <>
                    <p className="mt-4 text-sm">
                      {invitationResults.filter((result) => result.success).length} sent ·{" "}
                      {invitationResults.filter((result) => !result.success).length} failed
                    </p>
                    <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                      {invitationResults.map((result) => (
                        <li
                          key={result.candidateId}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{result.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {result.email || "Email unavailable"}
                            </span>
                          </span>
                          <span className={result.success ? "text-emerald" : "text-destructive"}>
                            {result.success ? "Sent" : (result.error ?? "Not sent")}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {invitationResults.some((result) => !result.success) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        disabled={retryingInvitations}
                        onClick={() => void retryFailedInvitations()}
                      >
                        {retryingInvitations && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Retry failed invitations
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        )}

        <section className="grid gap-4 rounded-2xl border border-border bg-background/30 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
              <span>Assessment overview</span>
              <span className="text-xs text-muted-foreground">
                {questions.length} question{questions.length === 1 ? "" : "s"} · about{" "}
                {estimatedMinutes} min
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full bg-cyber/10 px-2 py-1 text-cyber">
                {questionTypeCounts.text} written
              </span>
              <span className="rounded-full bg-violet/10 px-2 py-1 text-violet">
                {questionTypeCounts.mcq} multiple choice
              </span>
              <span className="rounded-full bg-amber/10 px-2 py-1 text-amber">
                {questionTypeCounts.code} coding
              </span>
              <span className="rounded-full bg-emerald/10 px-2 py-1 text-emerald">
                {requireMedia ? "Media required" : "Media optional"}
              </span>
            </div>
            {!readyToPublish && (
              <p className="mt-2 text-xs text-amber">
                {title.trim().length < 2 ? "Add an assessment title. " : ""}
                {questionIssues.length} question{questionIssues.length === 1 ? " needs" : "s need"}{" "}
                attention.
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={busy || selectedCandidates.length === 0 || createdAssessment !== null}
            className="min-w-44 glow-primary"
            style={{ background: "var(--gradient-aurora)" }}
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : createdAssessment ? (
              "Assessment published"
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" /> Publish assessment
              </>
            )}
          </Button>
        </section>
      </form>
      <Toaster position="top-right" />
    </Shell>
  );
}
