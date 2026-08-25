import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  CalendarDays,
  Clock,
  Mail,
  UserRound,
  BriefcaseBusiness,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_authenticated/dashboard/schedule",
)({
  head: () => ({
    meta: [
      {
        title: "Schedule Interview — Company Dashboard",
      },
      {
        name: "description",
        content:
          "Schedule and manage candidate interviews.",
      },
    ],
  }),
  component: ScheduleInterviewPage,
});

interface ScheduledInterview {
  id: string;
  candidateName: string;
  candidateEmail: string;
  role: string;
  date: string;
  time: string;
  duration: string;
  notes: string;
  createdAt: number;
}

const STORAGE_KEY =
  "vmx_company_scheduled_interviews";

function readInterviews(): ScheduledInterview[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw =
      localStorage.getItem(
        STORAGE_KEY,
      );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function ScheduleInterviewPage() {
  const [candidateName, setCandidateName] =
    useState("");

  const [candidateEmail, setCandidateEmail] =
    useState("");

  const [role, setRole] =
    useState("");

  const [date, setDate] =
    useState("");

  const [time, setTime] =
    useState("");

  const [duration, setDuration] =
    useState("30");

  const [notes, setNotes] =
    useState("");

  const [scheduled, setScheduled] =
    useState<ScheduledInterview[]>(
      readInterviews,
    );

  function scheduleInterview(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (!candidateName.trim()) {
      toast.error(
        "Candidate name is required.",
      );
      return;
    }

    if (!candidateEmail.trim()) {
      toast.error(
        "Candidate email is required.",
      );
      return;
    }

    if (!role.trim()) {
      toast.error(
        "Job role is required.",
      );
      return;
    }

    if (!date || !time) {
      toast.error(
        "Select interview date and time.",
      );
      return;
    }

    const interview: ScheduledInterview = {
      id: `interview-${Date.now()}`,
      candidateName:
        candidateName.trim(),
      candidateEmail:
        candidateEmail.trim(),
      role: role.trim(),
      date,
      time,
      duration,
      notes: notes.trim(),
      createdAt: Date.now(),
    };

    const updated = [
      interview,
      ...scheduled,
    ];

    setScheduled(updated);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updated),
    );

    toast.success(
      "Interview scheduled successfully.",
    );

    setCandidateName("");
    setCandidateEmail("");
    setRole("");
    setDate("");
    setTime("");
    setDuration("30");
    setNotes("");
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <div className="glass-strong grid size-11 place-items-center rounded-xl">
            <CalendarDays className="size-5 text-primary" />
          </div>

          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">
              Schedule Interview
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Schedule candidate interviews from your company HR workspace.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <form
          onSubmit={scheduleInterview}
          className="glass space-y-5 rounded-2xl p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Candidate name
              </span>

              <div className="relative">
                <UserRound className="absolute left-3 top-3 size-4 text-muted-foreground" />

                <input
                  value={candidateName}
                  onChange={(event) =>
                    setCandidateName(
                      event.target.value,
                    )
                  }
                  placeholder="Candidate name"
                  className="w-full rounded-lg border border-border bg-background px-10 py-2.5 text-sm outline-none focus:border-cyber"
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Candidate email
              </span>

              <div className="relative">
                <Mail className="absolute left-3 top-3 size-4 text-muted-foreground" />

                <input
                  type="email"
                  value={candidateEmail}
                  onChange={(event) =>
                    setCandidateEmail(
                      event.target.value,
                    )
                  }
                  placeholder="candidate@email.com"
                  className="w-full rounded-lg border border-border bg-background px-10 py-2.5 text-sm outline-none focus:border-cyber"
                />
              </div>
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Job role
            </span>

            <div className="relative">
              <BriefcaseBusiness className="absolute left-3 top-3 size-4 text-muted-foreground" />

              <input
                value={role}
                onChange={(event) =>
                  setRole(
                    event.target.value,
                  )
                }
                placeholder="Frontend Developer"
                className="w-full rounded-lg border border-border bg-background px-10 py-2.5 text-sm outline-none focus:border-cyber"
              />
            </div>
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Date
              </span>

              <input
                type="date"
                value={date}
                onChange={(event) =>
                  setDate(
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-cyber"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Time
              </span>

              <div className="relative">
                <Clock className="absolute left-3 top-3 size-4 text-muted-foreground" />

                <input
                  type="time"
                  value={time}
                  onChange={(event) =>
                    setTime(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-lg border border-border bg-background px-10 py-2.5 text-sm outline-none focus:border-cyber"
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Duration
              </span>

              <select
                value={duration}
                onChange={(event) =>
                  setDuration(
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-cyber"
              >
                <option value="15">
                  15 minutes
                </option>

                <option value="30">
                  30 minutes
                </option>

                <option value="45">
                  45 minutes
                </option>

                <option value="60">
                  60 minutes
                </option>

                <option value="90">
                  90 minutes
                </option>
              </select>
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Interview notes
            </span>

            <textarea
              rows={4}
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value,
                )
              }
              placeholder="Add interview notes, panel members, topics..."
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-cyber"
            />
          </label>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyber px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <CalendarDays className="size-4" />
            Schedule Interview
          </button>

          <p className="text-center text-[11px] text-muted-foreground">
            Scheduled interviews are currently saved to this company browser.
          </p>
        </form>

        <section className="glass rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">
                Upcoming Interviews
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Company interview schedule
              </p>
            </div>

            <span className="rounded-full bg-cyber/10 px-3 py-1 text-xs text-cyber">
              {scheduled.length}
            </span>
          </div>

          {scheduled.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-background/40 p-5 text-center">
              <CalendarDays className="mx-auto size-8 text-muted-foreground" />

              <p className="mt-3 text-sm font-medium">
                No interviews scheduled
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Schedule your first candidate interview.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduled.map(
                (interview) => (
                  <div
                    key={
                      interview.id
                    }
                    className="rounded-xl border border-border/60 bg-background/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          {
                            interview.candidateName
                          }
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {interview.role}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {
                            interview.candidateEmail
                          }
                        </p>
                      </div>

                      <CheckCircle2 className="size-4 text-emerald" />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full bg-cyber/10 px-2 py-1 text-cyber">
                        {interview.date}
                      </span>

                      <span className="rounded-full bg-cyber/10 px-2 py-1 text-cyber">
                        {interview.time}
                      </span>

                      <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                        {interview.duration} min
                      </span>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}