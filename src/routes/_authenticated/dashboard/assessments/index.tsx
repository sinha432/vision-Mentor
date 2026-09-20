import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ClipboardList,
  Users,
  Gauge,
  Plus,
  MoreVertical,
  Copy,
  ExternalLink,
  Ban,
  RotateCcw,
  Trash2,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  deleteAssessment,
  listCompanyAssessments,
  setAssessmentStatus,
  shareLink,
  type CompanyAssessment,
} from "@/lib/assessments-data";

export const Route = createFileRoute("/_authenticated/dashboard/assessments/")({
  head: () => ({
    meta: [
      { title: "Assessments — Company Dashboard" },
      {
        name: "description",
        content:
          "Publish assessments, share candidate links and review attempt scores.",
      },
    ],
  }),
  component: AssessmentsPage,
});

function scoreClass(score: number) {
  if (score >= 70) return "text-emerald";
  if (score >= 40) return "text-amber";
  return "text-destructive";
}

function scoreBarClass(score: number) {
  if (score >= 70) return "bg-emerald";
  if (score >= 40) return "bg-amber";
  return "bg-destructive";
}

function AssessmentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "closed">("all");
  const [pendingDelete, setPendingDelete] = useState<CompanyAssessment | null>(
    null,
  );

  const { data: assessments = [] } = useQuery({
    queryKey: ["company-assessments"],
    queryFn: () => listCompanyAssessments(),
    refetchOnMount: "always",
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["company-assessments"] });

  const statusMutation = useMutation({
    mutationFn: setAssessmentStatus,
    onSuccess: (_data, variables) => {
      toast.success(
        variables.status === "closed" ? "Test ended." : "Test reopened.",
      );
      void invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAssessment,
    onSuccess: () => {
      toast.success("Assessment deleted.");
      setPendingDelete(null);
      void invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not delete"),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assessments.filter((a) => {
      const matchesQuery =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q);
      const matchesStatus = status === "all" || a.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [assessments, query, status]);

  const created = assessments.length;
  const tested = assessments.reduce((sum, a) => sum + a.attemptCount, 0);
  const avg = tested
    ? Math.round(
        assessments.reduce((sum, a) => sum + a.avgScore * a.attemptCount, 0) /
          tested,
      )
    : 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header className="animate-fade-in grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <h1 className="text-aurora font-display text-2xl font-bold sm:text-3xl">
            Your Assessments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Publish an assessment and share the link with candidates.
          </p>
        </div>
        <Button
          className="gradient-aurora hover-glow shrink-0 rounded-full font-semibold text-primary-foreground"
          onClick={() => void navigate({ to: "/company/new" })}
        >
          <Plus className="mr-1 h-4 w-4" /> New assessment
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Assessments created"
          value={created}
          icon={ClipboardList}
          accent="cyber"
        />
        <StatCard
          label="Candidates tested"
          value={tested}
          icon={Users}
          accent="violet"
        />
        <StatCard
          label="Avg score"
          value={`${avg}%`}
          icon={Gauge}
          accent={avg >= 60 ? "emerald" : "amber"}
        />
      </div>

      <section className="glass animate-fade-in rounded-2xl p-4 sm:p-5">
        <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
          <div className="relative min-w-0 sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title or code"
              className="pl-9"
              aria-label="Search assessments"
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) =>
              setStatus(value as "all" | "active" | "closed")
            }
          >
            <SelectTrigger className="sm:w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Questions</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead>Avg score</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id} className="hover:bg-accent/40">
                  <TableCell className="max-w-[16rem]">
                    <p className="truncate font-medium">{a.title}</p>
                    <p className="truncate font-mono text-xs text-primary">
                      {shareLink(a.code)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        a.status === "active"
                          ? "border-emerald/40 bg-emerald/10 text-emerald"
                          : "border-border bg-muted text-muted-foreground"
                      }
                    >
                      {a.status === "active" ? "Active" : "Closed"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {a.questionCount}
                  </TableCell>
                  <TableCell className="text-right">{a.attemptCount}</TableCell>
                  <TableCell>
                    <span
                      className={`font-display text-sm font-semibold ${scoreClass(a.avgScore)}`}
                    >
                      {a.avgScore}%
                    </span>
                    <span className="mt-1 block h-1 w-16 overflow-hidden rounded-full bg-muted">
                      <span
                        className={`block h-full rounded-full ${scoreBarClass(a.avgScore)}`}
                        style={{ width: `${Math.min(100, a.avgScore)}%` }}
                      />
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{a.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        className="hover-glow"
                        onClick={() =>
                          void navigate({
                            to: "/dashboard/assessments/$code",
                            params: { code: a.code },
                          })
                        }
                      >
                        View attempts
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`More actions for ${a.title}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              void navigator.clipboard.writeText(
                                shareLink(a.code),
                              );
                              toast.success("Link copied.");
                            }}
                          >
                            <Copy className="mr-2 h-4 w-4" /> Copy link
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a
                              href={`/a/${a.code}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="mr-2 h-4 w-4" /> Preview
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              statusMutation.mutate({
                                id: a.id,
                                status:
                                  a.status === "active" ? "closed" : "active",
                              })
                            }
                          >
                            {a.status === "active" ? (
                              <>
                                <Ban className="mr-2 h-4 w-4" /> End test
                              </>
                            ) : (
                              <>
                                <RotateCcw className="mr-2 h-4 w-4" /> Reopen
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setPendingDelete(a)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <p className="font-display text-sm">
                      {assessments.length === 0
                        ? "No assessments yet"
                        : "No assessments match your filters"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {assessments.length === 0
                        ? "Publish an assessment to start testing candidates."
                        : "Try a different search or status filter."}
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent className="glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.title} will be removed. Candidates who already
              submitted keep access to their own report. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) {
                  deleteMutation.mutate({ id: pendingDelete.id });
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
