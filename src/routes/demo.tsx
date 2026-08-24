import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleHelp,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/demo")({ ssr: false, component: DemoPage });

type Question = {
  id: string;
  type: "choice" | "text";
  prompt: string;
  choices?: string[];
  answer: string;
  explanation: string;
  keywords?: string[];
};

const QUESTIONS: Question[] = [
  {
    id: "html",
    type: "choice",
    prompt: "Which HTML element is the most appropriate for the primary heading of a page?",
    choices: ["<div>", "<h1>", "<header>", "<title>"],
    answer: "<h1>",
    explanation:
      "The h1 communicates the page's main heading to users, search engines, and assistive technology.",
  },
  {
    id: "performance",
    type: "text",
    prompt:
      "You need to improve a slow web page. Name one useful first step and what you would measure.",
    answer: "Profile the page and measure a metric such as LCP, bundle size, or network time.",
    keywords: ["profile", "measure", "lcp", "bundle", "network", "performance", "lighthouse"],
    explanation:
      "Strong answers start with evidence: profile the page, identify the bottleneck, and measure a concrete metric before changing code.",
  },
  {
    id: "javascript",
    type: "choice",
    prompt: "Which array method creates a new array by transforming every item?",
    choices: ["forEach", "filter", "map", "find"],
    answer: "map",
    explanation:
      "map returns a new array containing the transformed result for each original item.",
  },
  {
    id: "accessibility",
    type: "text",
    prompt:
      "A button contains only an icon. What should you add so its purpose is clear to screen readers?",
    answer: "An accessible name, such as an aria-label or visible text.",
    keywords: ["aria-label", "accessible name", "screen reader", "label", "text"],
    explanation:
      "Icon-only controls need an accessible name. Use visible text where possible, or aria-label when the icon is the visual label.",
  },
  {
    id: "debugging",
    type: "choice",
    prompt: "What is the most reliable first move when a production request suddenly becomes slow?",
    choices: [
      "Rewrite the endpoint",
      "Add random caching",
      "Inspect traces and recent metrics",
      "Increase every timeout",
    ],
    answer: "Inspect traces and recent metrics",
    explanation:
      "Observability gives you a defensible hypothesis before you change the system or hide the symptom.",
  },
];

type Result = { correct: boolean; answer: string; explanation: string };

function DemoPage() {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const question = QUESTIONS[index]!;
  const progress = ((index + (result ? 1 : 0)) / QUESTIONS.length) * 100;

  function checkAnswer() {
    if (!answer.trim() || result) return;
    const value = answer.trim().toLowerCase();
    const correct =
      question.type === "choice"
        ? value === question.answer.toLowerCase()
        : (question.keywords ?? []).some((keyword) => value.includes(keyword));
    if (correct) setScore((current) => current + 1);
    setResult({ correct, answer: question.answer, explanation: question.explanation });
  }

  function next() {
    if (index === QUESTIONS.length - 1) setFinished(true);
    else {
      setIndex((current) => current + 1);
      setAnswer("");
      setResult(null);
    }
  }

  function restart() {
    setIndex(0);
    setAnswer("");
    setResult(null);
    setScore(0);
    setFinished(false);
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 text-foreground sm:px-6">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--gradient-glow),transparent_70%)]" />
        <div className="absolute inset-0 grid-bg opacity-40" />
      </div>
      <div className="mx-auto max-w-3xl">
        <Link
          to="/welcome"
          className="mb-8 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </Link>
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <span className="mb-3 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-cyber">
              <Sparkles className="size-3.5" /> Nova practice lab
            </span>
            <h1 className="font-display text-2xl tracking-wide text-gradient sm:text-3xl">
              Practice. Answer. Improve.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Work through five interview-style questions. Every answer gets an immediate
              explanation.
            </p>
          </div>
          <div className="rounded-xl border border-cyber/20 bg-surface/60 px-4 py-3 text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Score</div>
            <div className="font-display text-xl text-cyber">
              {score} / {QUESTIONS.length}
            </div>
          </div>
        </header>
        {finished ? (
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-3xl p-8 text-center sm:p-12"
          >
            <Trophy className="mx-auto size-12 text-cyber" />
            <p className="mt-5 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Session complete
            </p>
            <h2 className="mt-2 font-display text-4xl text-gradient">
              {score} / {QUESTIONS.length}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              Review your reasoning, then run the session again to sharpen weak spots.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={restart}
                className="btn-3d inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-primary-foreground"
              >
                <RotateCcw className="size-4" /> Try again
              </button>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-xl border border-cyber/30 px-4 py-2.5 text-sm text-cyber hover:bg-cyber/10"
              >
                Continue to full practice <ArrowRight className="size-4" />
              </Link>
            </div>
          </motion.section>
        ) : (
          <section>
            <div className="mb-4 flex justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <span>
                Question {index + 1} of {QUESTIONS.length}
              </span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <div className="mb-6 h-1 overflow-hidden rounded-full bg-foreground/10">
              <motion.div
                className="h-full rounded-full bg-cyber"
                animate={{ width: `${Math.max(progress, 8)}%` }}
              />
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={question.id}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                className="glass-strong rounded-3xl p-5 sm:p-8"
              >
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyber">
                  <CircleHelp className="size-4" />{" "}
                  {question.type === "choice" ? "Choose one" : "Short answer"}
                </div>
                <h2 className="mt-5 text-xl leading-relaxed sm:text-2xl">{question.prompt}</h2>
                {question.type === "choice" ? (
                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {question.choices?.map((choice, choiceIndex) => (
                      <button
                        key={choice}
                        type="button"
                        disabled={Boolean(result)}
                        onClick={() => setAnswer(choice)}
                        className={`rounded-2xl border p-4 text-left text-sm transition-all ${answer === choice ? "border-cyber bg-cyber/10 text-foreground" : "border-border/60 bg-background/20 text-muted-foreground hover:border-cyber/50 hover:text-foreground"}`}
                      >
                        <span className="mr-3 inline-flex size-6 items-center justify-center rounded-full border border-current text-[10px] text-cyber">
                          {String.fromCharCode(65 + choiceIndex)}
                        </span>
                        {choice}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={answer}
                    disabled={Boolean(result)}
                    onChange={(event) => setAnswer(event.currentTarget.value)}
                    placeholder="Explain your thinking in one or two sentences..."
                    className="mt-8 min-h-36 w-full resize-y rounded-2xl border border-border/60 bg-background/20 p-4 text-sm leading-relaxed outline-none focus:border-cyber/60 disabled:opacity-70"
                  />
                )}
                <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-5">
                  <span className="text-xs text-muted-foreground">
                    {result ? "Review the explanation below." : "Take your best shot."}
                  </span>
                  <button
                    type="button"
                    onClick={result ? next : checkAnswer}
                    disabled={!answer.trim()}
                    className="btn-3d inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm text-primary-foreground disabled:opacity-40"
                  >
                    {result
                      ? index === QUESTIONS.length - 1
                        ? "See results"
                        : "Next question"
                      : "Check answer"}
                    {result ? <ArrowRight className="size-4" /> : <Check className="size-4" />}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className={`mt-4 rounded-2xl border p-5 ${result.correct ? "border-cyber/40 bg-cyber/10" : "border-destructive/40 bg-destructive/10"}`}
                >
                  <div className="flex items-start gap-3">
                    {result.correct ? (
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-cyber" />
                    ) : (
                      <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                    )}
                    <div>
                      <h3
                        className={`font-display text-sm uppercase tracking-widest ${result.correct ? "text-cyber" : "text-destructive"}`}
                      >
                        {result.correct ? "Correct answer" : "Not quite yet"}
                      </h3>
                      {!result.correct && (
                        <p className="mt-2 text-sm">
                          <span className="font-medium">Strong answer:</span> {result.answer}
                        </p>
                      )}
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {result.explanation}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}
      </div>
    </main>
  );
}
