import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Eye, User, Mic, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useDemoAuth } from "@/contexts/DemoAuthContext";
import { getReport } from "@/lib/assessments.functions";
import { Shell } from "../company/index";

export const Route = createFileRoute("/_authenticated/report/$id")({ component: ReportPage });

type Data = Awaited<ReturnType<typeof getReport>>;

function ReportPage() {
  const { id } = Route.useParams();
  const { user, signOut } = useDemoAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    if (!user) return;
    getReport({ data: { reportId: id, userId: user.id } })
      .then(setData)
      .catch((e) => { toast.error(e?.message ?? "Failed"); navigate({ to: "/" }); });
  }, [id, user, navigate]);

  return (
    <Shell title="Report" user={user?.name ?? ""} onSignOut={() => { signOut(); navigate({ to: "/auth" }); }}>
      {!data ? (
        <div className="glass-strong rounded-2xl p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-4">
          <div className="glass-strong rounded-2xl p-6 flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl text-gradient">{data.assessment.title}</h1>
              <div className="text-xs text-muted-foreground mt-1">Submitted {new Date(data.attempt.submittedAt).toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Overall</div>
              <div className="font-display text-4xl text-gradient">{data.report.overallScore}%</div>
            </div>
          </div>

          {data.report.vision && (
            <div className="glass-strong rounded-2xl p-4 flex items-center gap-6 text-sm flex-wrap">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Session integrity</div>
              <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-cyber" /> Eye contact <span className="font-display">{Math.round(data.report.vision.avgEye * 100)}%</span></div>
              <div className="flex items-center gap-2"><User className="w-4 h-4 text-cyber" /> Posture <span className="font-display">{Math.round(data.report.vision.avgPosture * 100)}%</span></div>
              {data.report.vision.avgVoice != null && (
                <div className="flex items-center gap-2"><Mic className="w-4 h-4 text-cyber" /> Voice activity <span className="font-display">{Math.round(data.report.vision.avgVoice * 100)}%</span></div>
              )}
              <div className="text-[11px] text-muted-foreground ml-auto">{data.report.vision.samples} samples</div>
            </div>
          )}

          <div className="space-y-3">
            {data.assessment.questions.map((q, i) => {
              const fb = data.report.perQuestionFeedback.find((p) => p.questionId === q.id);
              const ans = data.attempt.answers[q.id];
              const score = fb?.score ?? 0;
              const color = score >= 75 ? "var(--cyber)" : score >= 50 ? "oklch(0.75 0.18 75)" : "var(--destructive)";
              const qType = q.type ?? "text";
              return (
                <div key={q.id} className="glass-strong rounded-2xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        Q{i + 1} <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary">{qType}</span> <span>weight {q.weight ?? 1}</span>
                      </div>
                      <div className="text-sm mt-0.5 whitespace-pre-wrap">{q.text}</div>
                    </div>
                    <div className="glass rounded-full px-3 py-1 text-xs font-display shrink-0" style={{ color }}>{score}%</div>
                  </div>

                  {qType === "text" && (
                    <>
                      <div className="glass rounded-lg p-3 text-sm whitespace-pre-wrap">
                        {ans?.textAnswer || <span className="text-muted-foreground italic">No answer</span>}
                      </div>
                      {(q.keywords ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(q.keywords ?? []).map((k) => (
                            <span key={k} className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary">{k}</span>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {qType === "mcq" && (
                    <div className="space-y-1">
                      {(q.choices ?? []).map((c) => {
                        const isChosen = ans?.choiceId === c.id;
                        const isCorrect = q.correctChoiceId === c.id;
                        return (
                          <div key={c.id} className={`glass rounded-md px-3 py-2 text-sm flex items-center gap-2 ${isCorrect ? "ring-1 ring-cyber/60" : ""}`}>
                            {isCorrect ? <CheckCircle2 className="w-4 h-4 text-cyber" /> : isChosen ? <XCircle className="w-4 h-4 text-destructive" /> : <span className="w-4 h-4" />}
                            <span>{c.text}</span>
                            {isChosen && <span className="ml-auto text-[10px] text-muted-foreground">chosen</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {qType === "code" && (
                    <>
                      <details className="glass rounded-lg p-3 text-xs">
                        <summary className="cursor-pointer text-muted-foreground">View submitted code</summary>
                        <pre className="mt-2 font-mono whitespace-pre-wrap text-[11px]">{ans?.code || "(no code)"}</pre>
                      </details>
                      {ans?.runResults && ans.runResults.cases.length > 0 && (
                        <div className="space-y-1">
                          {ans.runResults.cases.map((c, ci) => (
                            <div key={ci} className="glass rounded-md px-3 py-1.5 text-[11px] flex items-start gap-2">
                              {c.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-cyber shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />}
                              <div className="flex-1 min-w-0">
                                <div>Test {ci + 1}: {c.ok ? "Pass" : "Fail"}</div>
                                {!c.ok && <div className="font-mono text-muted-foreground truncate">got: {c.actual || "(empty)"}{c.stderr ? ` · ${c.stderr.split("\n")[0]}` : ""}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {fb && <div className="text-[11px] text-muted-foreground">{fb.notes}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Shell>
  );
}
