import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useDemoAuth } from "@/contexts/DemoAuthContext";
import { listIndividualReports } from "@/lib/assessments.functions";
import { Shell } from "./company/index";

export const Route = createFileRoute("/_authenticated/reports")({ component: MyReports });

type Row = Awaited<ReturnType<typeof listIndividualReports>>[number];

function MyReports() {
  const { user, signOut } = useDemoAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!user) return;
    listIndividualReports({ data: { individualUserId: user.id } })
      .then(setRows)
      .catch((e) => toast.error(e?.message ?? "Failed to load"));
  }, [user]);

  return (
    <Shell title="My Reports" user={user?.name ?? ""} onSignOut={() => { signOut(); navigate({ to: "/auth" }); }}>
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList className="w-5 h-5 text-cyber" />
        <div>
          <h1 className="font-display text-xl text-gradient">Your Assessment Reports</h1>
          <p className="text-xs text-muted-foreground">Submissions made against company assessments.</p>
        </div>
      </div>

      {rows === null ? (
        <div className="glass-strong rounded-2xl p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="glass-strong rounded-2xl p-8 text-center text-sm text-muted-foreground">
          No submissions yet. Open a share link to take an assessment.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.attemptId} className="glass-strong rounded-xl p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{r.assessmentTitle}</div>
                <div className="text-[11px] text-muted-foreground">
                  Code <span className="font-mono">{r.assessmentCode}</span> · {new Date(r.submittedAt).toLocaleString()}
                </div>
              </div>
              <div className="glass rounded-full px-3 py-1 text-xs font-display" style={{ color: r.overallScore >= 75 ? "var(--cyber)" : r.overallScore >= 50 ? "oklch(0.75 0.18 75)" : "var(--destructive)" }}>
                {r.overallScore}%
              </div>
              {r.reportId && (
                <Link to="/report/$id" params={{ id: r.reportId }} className="glass px-3 py-1.5 rounded-md text-xs hover:glow-cyber">
                  Open
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
