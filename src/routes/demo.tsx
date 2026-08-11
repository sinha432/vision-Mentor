import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ArrowLeft, Loader2, CheckCircle2, XCircle, LogIn } from "lucide-react";
import { getAssessmentByCode } from "@/lib/assessments.functions";

export const Route = createFileRoute("/demo")({
  ssr: false,
  component: DemoPage,
});

// The demo/testing page reuses the actual seeded sample assessment rather
// than a hand-built mock — same questions, same shape, real proof the
// question-taking flow works, before anyone signs up.
const DEMO_CODE = "DEMO2024";

type Assessment = Awaited<ReturnType<typeof getAssessmentByCode>>;

function DemoPage() {
  const [assessment, setAssessment] = useState<Assessment | undefined | null>(undefined);
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [mcqChoice, setMcqChoice] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getAssessmentByCode({ data: { code: DEMO_CODE } })
      .then(setAssessment)
      .catch(() => setAssessment(null));
  }, []);

  return (
    <div className="relative min-h-screen px-4 py-8 text-foreground">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at top, var(--gradient-glow), transparent 70%)" }} />
        <div className="absolute inset-0 grid-bg opacity-40" />
      </div>

      <div className="max-w-2xl mx-auto">
        <Link to="/welcome" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-cyber" />
          <h1 className="font-display text-xl text-gradient">Try a live demo</h1>
        </div>
        <p className="text-xs text-muted-foreground mb-6">
          This is a real sample assessment from the platform. Answer it however you like — nothing here is
          saved, scored for real, or sent to any company. It's just to show you how the actual flow works.
        </p>

        {assessment === undefined ? (
          <div className="glass-strong rounded-2xl p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : assessment === null ? (
          <div className="glass-strong rounded-2xl p-8 text-center text-sm text-muted-foreground">
            The demo assessment isn't available right now.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="glass-strong rounded-2xl p-4">
              <div className="font-display text-base text-gradient">{assessment.title}</div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {assessment.questions.length} question{assessment.questions.length === 1 ? "" : "s"} · demo preview
              </p>
            </div>

            {assessment.questions.map((q, i) => (
              <div key={q.id} className="glass-strong rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Q{i + 1}</div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">{q.type}</span>
                </div>
                <div className="text-sm whitespace-pre-wrap">{q.text}</div>

                {q.type === "text" && (
                  <>
                    <textarea
                      value={textAnswers[q.id] ?? ""}
                      onChange={(e) => setTextAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      placeholder="Type your answer…"
                      className="w-full glass rounded-lg p-3 bg-transparent outline-none text-sm resize-y min-h-[88px]"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      In a real assessment, this is scored against keyword coverage and length — not marked
                      right or wrong here.
                    </p>
                  </>
                )}

                {q.type === "mcq" && (
                  <div className="space-y-1">
                    {(q.choices ?? []).map((c) => {
                      const isChosen = mcqChoice[q.id] === c.id;
                      const showResult = checked[q.id];
                      const isCorrect = c.id === q.correctChoiceId;
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2 glass rounded-md px-3 py-2 text-sm cursor-pointer ${
                            showResult && isCorrect ? "ring-1 ring-cyber/60" : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name={`demo-q-${q.id}`}
                            checked={isChosen}
                            onChange={() => setMcqChoice((a) => ({ ...a, [q.id]: c.id }))}
                            className="accent-primary"
                          />
                          <span className="flex-1">{c.text}</span>
                          {showResult && isChosen && (
                            isCorrect
                              ? <CheckCircle2 className="w-4 h-4 text-cyber" />
                              : <XCircle className="w-4 h-4 text-destructive" />
                          )}
                        </label>
                      );
                    })}
                    <button
                      type="button"
                      disabled={!mcqChoice[q.id]}
                      onClick={() => setChecked((c) => ({ ...c, [q.id]: true }))}
                      className="text-xs text-primary hover:underline disabled:opacity-40 disabled:hover:no-underline mt-1"
                    >
                      Check answer
                    </button>
                  </div>
                )}

                {q.type === "code" && (
                  <p className="text-[11px] text-muted-foreground italic">
                    Coding questions are interactive in the real assessment (with a live code editor and test
                    runner) — preview only here.
                  </p>
                )}
              </div>
            ))}

            <div className="glass-strong rounded-2xl p-5 text-center space-y-3">
              <p className="text-sm">Ready to try it for real, or create your own assessment?</p>
              <Link
                to="/auth"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white glow-primary"
                style={{ background: "var(--gradient-aurora)" }}
              >
                <LogIn className="w-4 h-4" /> Sign in / Sign up
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
