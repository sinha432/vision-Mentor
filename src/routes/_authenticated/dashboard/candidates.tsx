import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Loader2, AlertCircle, FileText, Trash2, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
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
import { deleteCompanyCandidate, listCompanyCandidates } from "@/lib/assessments.functions";
import { useDemoAuth } from "@/contexts/DemoAuthContext";

export const Route = createFileRoute("/_authenticated/dashboard/candidates")({
  head: () => ({
    meta: [
      { title: "Candidates — Vision Mentor X Company Dashboard" },
      {
        name: "description",
        content: "A unified view of every candidate across your assessments, with scores and attempt history.",
      },
      { property: "og:title", content: "Candidates — Vision Mentor X" },
      {
        property: "og:description",
        content: "Every candidate across all of your assessments in one list.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CandidatesPage,
});

type Candidate = Awaited<ReturnType<typeof listCompanyCandidates>>[number];

function CandidatesPage() {
  const { user } = useDemoAuth();
  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<Candidate | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setError(null);
    listCompanyCandidates({ data: { companyUserId: user.id } })
      .then((r) => alive && setRows(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Could not load candidates"));
    return () => {
      alive = false;
    };
  }, [user]);

  const allSelected = Boolean(rows?.length) && selectedIds.size === rows?.length;

  const toggleCandidate = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(rows?.map((row) => row.individualUserId) ?? []));
  };

  const deleteCandidates = async (candidates: Candidate[]) => {
    if (!user || !candidates.length) return;
    setDeleting(true);
    try {
      await Promise.all(
        candidates.map((candidate) =>
          deleteCompanyCandidate({
            data: {
              companyUserId: user.id,
              individualUserId: candidate.individualUserId,
            },
          }),
        ),
      );
      const deletedIds = new Set(candidates.map((candidate) => candidate.individualUserId));
      setRows((current) => current?.filter((candidate) => !deletedIds.has(candidate.individualUserId)) ?? current);
      setSelectedIds(new Set());
      setPendingDelete(null);
      setBulkDeleteOpen(false);
      toast.success(`${candidates.length} candidate${candidates.length === 1 ? "" : "s"} deleted`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete candidates");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-violet/15 text-violet">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold">Candidates</h1>
          <p className="text-sm text-muted-foreground">
            Everyone who has attempted one of your assessments.
          </p>
        </div>
      </header>

      {error && (
        <div className="glass flex items-start gap-2 rounded-2xl p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!error && rows === null && (
        <div className="glass grid place-items-center rounded-2xl p-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!error && rows?.length === 0 && (
        <div className="glass animate-fade-in rounded-2xl p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No candidates yet. Share an assessment code and submissions will show up here.
          </p>
        </div>
      )}

      {!error && rows && rows.length > 0 && (
        <div className="grid gap-3 animate-fade-in">
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
          {rows.map((c) => (
            <article
              key={c.individualUserId}
              className="glass card-3d flex flex-wrap items-center gap-4 rounded-2xl p-5"
            >
              <button
                type="button"
                onClick={() => toggleCandidate(c.individualUserId)}
                aria-label={`${selectedIds.has(c.individualUserId) ? "Deselect" : "Select"} ${c.candidateName}`}
                className="text-muted-foreground hover:text-primary"
              >
                {selectedIds.has(c.individualUserId) ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5" />}
              </button>
              <div className="min-w-[180px] flex-1">
                <h2 className="font-display text-sm font-bold">{c.candidateName}</h2>
                <p className="text-xs text-muted-foreground">{c.candidateEmail || "—"}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {c.assessments.join(" · ")}
                </p>
              </div>
              <Metric label="Attempts" value={String(c.attemptCount)} />
              <Metric label="Avg" value={c.avgScore === null ? "—" : `${c.avgScore}%`} />
              <Metric label="Best" value={c.bestScore === null ? "—" : `${c.bestScore}%`} />
              <Metric
                label="Last"
                value={c.lastSubmittedAt ? new Date(c.lastSubmittedAt).toLocaleDateString() : "—"}
              />
              {c.latestReportId && (
                <Link
                  to="/report/$id"
                  params={{ id: c.latestReportId }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs transition-colors hover:text-primary"
                >
                  <FileText className="h-3.5 w-3.5" /> Report
                </Link>
              )}
              <button
                type="button"
                onClick={() => setPendingDelete(c)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-xs text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </article>
          ))}
        </div>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.candidateName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the candidate&apos;s attempts and reports from this company&apos;s workspace and MongoDB data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={() => pendingDelete && void deleteCandidates([pendingDelete])}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete candidate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} candidate{selectedIds.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected candidates&apos; attempts and reports from this company&apos;s workspace and MongoDB data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={() => void deleteCandidates(rows?.filter((row) => selectedIds.has(row.individualUserId)) ?? [])}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[64px]">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-sm font-bold">{value}</div>
    </div>
  );
}
