import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Building2, Plus, Copy, ExternalLink, ArrowLeft, LogOut, Loader2, Ban, PlayCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useDemoAuth } from "@/contexts/DemoAuthContext";
import { listCompanyAssessments, setAssessmentStatus, deleteAssessment } from "@/lib/assessments.functions";

export const Route = createFileRoute("/_authenticated/company/")({ component: CompanyDashboard });

type Row = Awaited<ReturnType<typeof listCompanyAssessments>>[number];

function CompanyDashboard() {
  const { user, signOut } = useDemoAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "company") { navigate({ to: "/" }); return; }
    listCompanyAssessments({ data: { companyUserId: user.id } })
      .then(setRows)
      .catch((e) => toast.error(e?.message ?? "Failed to load"));
  }, [user, navigate]);

  const shareLink = (code: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/a/${code}` : `/a/${code}`;

  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(shareLink(code)); toast.success("Link copied"); }
    catch { toast.error("Could not copy"); }
  };

  const toggleStatus = async (r: Row) => {
    if (!user) return;
    const next = r.status === "active" ? "closed" : "active";
    try {
      await setAssessmentStatus({ data: { assessmentId: r._id, companyUserId: user.id, status: next } });
      setRows((prev) => prev?.map((x) => (x._id === r._id ? { ...x, status: next } : x)) ?? prev);
      toast.success(next === "closed" ? "Assessment ended" : "Assessment reopened");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update");
    }
  };

  const remove = async (r: Row) => {
    if (!user) return;
    try {
      await deleteAssessment({ data: { assessmentId: r._id, companyUserId: user.id } });
      setRows((prev) => prev?.filter((x) => x._id !== r._id) ?? prev);
      toast.success("Assessment deleted");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not delete");
    }
  };

  return (
    <Shell title="Company Dashboard" user={user?.name ?? ""} onSignOut={() => { signOut(); navigate({ to: "/auth" }); }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-cyber" />
          <div>
            <h1 className="font-display text-xl text-gradient">Your Assessments</h1>
            <p className="text-xs text-muted-foreground">Publish an assessment and share the link with candidates.</p>
          </div>
        </div>
        <Link to="/company/new" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white glow-primary" style={{ background: "var(--gradient-aurora)" }}>
          <Plus className="w-4 h-4" /> New assessment
        </Link>
      </div>

      {rows === null ? (
        <div className="glass-strong rounded-2xl p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCard label="Assessments Created" value={rows.length} />
            <StatCard label="Candidates Tested" value={rows.reduce((s, r) => s + r.attemptCount, 0)} />
            <StatCard
              label="Avg Score"
              value={(() => {
                const withScores = rows.filter((r) => r.avgScore != null);
                if (!withScores.length) return "—";
                const overall = Math.round(withScores.reduce((s, r) => s + (r.avgScore ?? 0), 0) / withScores.length);
                return `${overall}%`;
              })()}
            />
          </div>

          {rows.length === 0 ? (
            <div className="glass-strong rounded-2xl p-8 text-center text-sm text-muted-foreground">
              No assessments yet. Create your first one.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r._id} className="glass-strong rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-display text-sm">{r.title}</div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wide ${
                        r.status === "active" ? "bg-cyber/10 text-cyber" : "bg-muted text-muted-foreground"
                      }`}>
                        {r.status === "active" ? "Active" : "Closed"}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {r.questions.length} question{r.questions.length === 1 ? "" : "s"} · {r.attemptCount} attempt{r.attemptCount === 1 ? "" : "s"}
                      {r.avgScore != null && <> · avg score <span className="text-foreground">{r.avgScore}%</span></>}
                      {" "}· code <span className="font-mono text-foreground">{r.code}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] font-mono text-primary/90 truncate">
                      {shareLink(r.code)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => copy(r.code)} className="glass px-3 py-1.5 rounded-md text-xs inline-flex items-center gap-1 hover:glow-cyber">
                      <Copy className="w-3 h-3" /> Copy link
                    </button>
                    <a href={`/a/${r.code}`} target="_blank" rel="noreferrer" className="glass px-3 py-1.5 rounded-md text-xs inline-flex items-center gap-1 hover:glow-cyber">
                      <ExternalLink className="w-3 h-3" /> Preview
                    </a>
                    <Link to="/company/assessment/$id" params={{ id: r._id }} className="glass px-3 py-1.5 rounded-md text-xs hover:glow-cyber">
                      View attempts
                    </Link>
                    <button onClick={() => toggleStatus(r)} className="glass px-3 py-1.5 rounded-md text-xs inline-flex items-center gap-1 hover:glow-cyber">
                      {r.status === "active" ? <><Ban className="w-3 h-3" /> End test</> : <><PlayCircle className="w-3 h-3" /> Reopen</>}
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="glass px-3 py-1.5 rounded-md text-xs inline-flex items-center gap-1 text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{r.title}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes the assessment and its share link. Candidates who already submitted keep
                            access to their own report — only the assessment itself (and this listing) is removed.
                            This can't be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(r)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Shell>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-strong rounded-2xl p-4 text-center">
      <div className="font-display text-2xl text-gradient">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export function Shell({ title, user, onSignOut, children }: { title: string; user: string; onSignOut: () => void; children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen px-4 py-6 text-foreground">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at top, var(--gradient-glow), transparent 70%)" }} />
        <div className="absolute inset-0 grid-bg opacity-40" />
      </div>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> {title}
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{user}</span>
            <button onClick={onSignOut} className="p-2 rounded-md glass hover:glow-cyber" aria-label="Sign out" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        {children}
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
