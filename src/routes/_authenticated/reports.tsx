import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, ClipboardList, Trash2, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { useDemoAuth } from "@/contexts/DemoAuthContext";
import { deleteIndividualReports, listIndividualReports } from "@/lib/assessments.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shell } from "./company/index";

export const Route = createFileRoute("/_authenticated/reports")({ component: MyReports });

type Row = Awaited<ReturnType<typeof listIndividualReports>>[number];

function MyReports() {
  const { user, signOut } = useDemoAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    listIndividualReports({ data: { individualUserId: user.id } })
      .then(setRows)
      .catch((e) => toast.error(e?.message ?? "Failed to load"));
  }, [user]);

  const allSelected = Boolean(rows?.length) && selectedIds.size === rows?.length;

  const toggleReport = (attemptId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(attemptId)) next.delete(attemptId);
      else next.add(attemptId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(rows?.map((row) => row.attemptId) ?? []));
  };

  const removeReports = async (reports: Row[]) => {
    if (!user || !reports.length) return;
    setDeleting(true);
    try {
      await deleteIndividualReports({
        data: {
          individualUserId: user.id,
          attemptIds: reports.map((report) => report.attemptId),
        },
      });
      const removed = new Set(reports.map((report) => report.attemptId));
      setRows((current) => current?.filter((report) => !removed.has(report.attemptId)) ?? current);
      setSelectedIds(new Set());
      setPendingDelete(null);
      setBulkDeleteOpen(false);
      toast.success(`${reports.length} report${reports.length === 1 ? "" : "s"} deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete reports");
    } finally {
      setDeleting(false);
    }
  };

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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/30 px-3 py-2">
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex items-center gap-2 text-xs font-medium hover:text-primary"
            >
              {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {allSelected ? "Deselect all" : "Select all"}
            </button>
            <div className="flex items-center gap-3">
              {selectedIds.size > 0 && (
                <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
              )}
              <button
                type="button"
                disabled={selectedIds.size === 0 || deleting}
                onClick={() => setBulkDeleteOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete selected
              </button>
            </div>
          </div>
          {rows.map((r) => (
            <div key={r.attemptId} className="glass-strong rounded-xl p-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleReport(r.attemptId)}
                aria-label={`${selectedIds.has(r.attemptId) ? "Deselect" : "Select"} ${r.assessmentTitle}`}
                className="text-muted-foreground hover:text-primary"
              >
                {selectedIds.has(r.attemptId) ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5" />}
              </button>
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
              <button
                type="button"
                onClick={() => setPendingDelete(r)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the report and its submitted assessment data from your account and MongoDB. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={() => pendingDelete && void removeReports([pendingDelete])}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} report{selectedIds.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected reports and submitted assessment data from your account and MongoDB. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={() => void removeReports(rows?.filter((row) => selectedIds.has(row.attemptId)) ?? [])}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}
