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
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { useDemoAuth } from "@/contexts/DemoAuthContext";
import { createAssessment } from "@/lib/assessments.functions";
import { getCompanyProfile } from "@/lib/assessments-data";
import { Shell } from "./index";

export const Route = createFileRoute("/_authenticated/company/new")({ component: NewAssessment });

type QType = "text" | "mcq" | "code";
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
  starterCode: string;
  testCases: TC[];
};

type QuestionIssue = {
  question: number;
  message: string;
};

const newCid = () => Math.random().toString(36).slice(2, 8);

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
  starterCode: `public class Main {\n    public static void main(String[] args) {\n        // read input, print output\n    }\n}\n`,
  testCases: [{ input: "", expectedStdout: "" }],
});

function NewAssessment() {
  const { user, signOut } = useDemoAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Q[]>([blankQ()]);
  const [requireMedia, setRequireMedia] = useState(false);
  const [defaultWeight, setDefaultWeight] = useState(1);
  const [busy, setBusy] = useState(false);
  const [openAdvanced, setOpenAdvanced] = useState<number | null>(null);

  const questionIssues = useMemo<QuestionIssue[]>(() => {
    const issues: QuestionIssue[] = [];

    questions.forEach((question, index) => {
      if (question.text.trim().length < 3) {
        issues.push({ question: index, message: "Add a question prompt." });
      }

      if (
        question.type === "mcq" &&
        (question.choices.filter((choice) => choice.text.trim()).length < 2 ||
          !question.correctChoiceId)
      ) {
        issues.push({
          question: index,
          message: "Complete the choices and correct answer.",
        });
      }

      if (
        question.type === "code" &&
        question.testCases.every(
          (testCase) => !testCase.input.trim() && !testCase.expectedStdout.trim(),
        )
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

  if (user && user.role !== "company") {
    navigate({ to: "/" });
    return null;
  }

  const addQ = () => setQuestions((qs) => [...qs, { ...blankQ(), weight: String(defaultWeight) }]);
  const rmQ = (i: number) => setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  const setQ = (i: number, patch: Partial<Q>) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
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
        return { ...base, starterCode: q.starterCode, testCases, keywords: [], maxLength: null };
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
      if (q.type === "code" && (!q.testCases || q.testCases.length === 0))
        return toast.error("Coding question needs at least 1 test case");
    }
    if (!cleaned.length) return toast.error("Add at least one question");

    setBusy(true);
    try {
      const rec = await createAssessment({
        data: { companyUserId: user.id, title: title.trim(), requireMedia, questions: cleaned },
      });
      const link = `${window.location.origin}/a/${rec.code}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      toast.success(`Created · link copied: ${link}`);
      navigate({ to: "/dashboard/assessments" });
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
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                      Starter code (Java)
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
            disabled={busy || !readyToPublish}
            className="min-w-44 glow-primary"
            style={{ background: "var(--gradient-aurora)" }}
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
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
