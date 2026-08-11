import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDemoAuth } from "@/contexts/DemoAuthContext";
import { listAssessmentAttempts } from "@/lib/assessments.functions";
import { Shell } from "../index";

export const Route = createFileRoute("/_authenticated/company/assessment/$id")({ component: AttemptsPage });

type Data = Awaited<ReturnType<typeof listAssessmentAttempts>>;

function AttemptsPage() {
  const { id } = Route.useParams();
  const { user, signOut } = useDemoAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "company") { navigate({ to: "/" }); return; }
    listAssessmentAttempts({ data: { assessmentId: id, companyUserId: user.id } })
      .then(setData)
      .catch((e) => toast.error(e?.message ?? "Failed to load"));
  }, [id, user, navigate]);

  return (
    <Shell title="Attempts" user={user?.name ?? ""} onSignOut={() => { signOut(); navigate({ to: "/auth" }); }}>
      {!data ? (
        <div className="glass-strong rounded-2xl p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-4">
          <div>
            <h1 className="font-display text-xl text-gradient">{data.assessment.title}</h1>
            <div className="text-xs text-muted-foreground mt-1">Code <span className="font-mono text-foreground">{data.assessment.code}</span> · {data.attempts.length} attempt{data.attempts.length === 1 ? "" : "s"}</div>
          </div>
          {data.attempts.length === 0 ? (
            <div className="glass-strong rounded-2xl p-8 text-center text-sm text-muted-foreground">No submissions yet.</div>
          ) : (
            <>
              <ScoreChart attempts={data.attempts} />
              <div className="space-y-2">
                {data.attempts.map((a) => (
                  <div key={a.attemptId} className="glass-strong rounded-xl p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{a.candidateName}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{a.candidateEmail}</div>
                      <div className="text-[11px] text-muted-foreground">{new Date(a.submittedAt).toLocaleString()}</div>
                    </div>
                    <ScorePill score={a.overallScore} />
                    {a.reportId && (
                      <Link to="/report/$id" params={{ id: a.reportId }} className="glass px-3 py-1.5 rounded-md text-xs hover:glow-cyber">
                        View report
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Shell>
  );
}

function ScoreChart({ attempts }: { attempts: Data["attempts"] }) {
  const chartData = attempts
    .slice()
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    .map((a, i) => ({
      name: a.candidateName.length > 12 ? `${a.candidateName.slice(0, 12)}…` : a.candidateName || `#${i + 1}`,
      score: a.overallScore,
    }));

  return (
    <div className="glass-strong rounded-2xl p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Scores by candidate</div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
            <Tooltip
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              formatter={(value: number) => [`${value}%`, "Score"]}
            />
            <Bar dataKey="score" fill="var(--cyber)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 75 ? "var(--cyber)" : score >= 50 ? "oklch(0.75 0.18 75)" : "var(--destructive)";
  return (
    <div className="glass rounded-full px-3 py-1 text-xs font-display" style={{ color }}>
      {score}%
    </div>
  );
}
