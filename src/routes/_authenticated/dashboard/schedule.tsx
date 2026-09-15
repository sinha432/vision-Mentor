import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  Trash2,
  UserRound,
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
  timeZone?: string;
  createdAt: number;
  notified?: boolean;
}

const STORAGE_PREFIX =
  "vmx_company_scheduled_interviews";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

function getCompanyStorageKey(): string {
  if (typeof window === "undefined") {
    return STORAGE_PREFIX;
  }

  try {
    const raw =
      localStorage.getItem("vmx_user") ||
      localStorage.getItem("vmx_demo_user");

    if (!raw) {
      return STORAGE_PREFIX;
    }

    const user = JSON.parse(raw) as {
      id?: string;
      email?: string;
      role?: string;
    };

    const companyId =
      user.id ||
      user.email ||
      "default-company";

    return `${STORAGE_PREFIX}:${companyId}`;
  } catch {
    return STORAGE_PREFIX;
  }
}

function readInterviews(): ScheduledInterview[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(
      getCompanyStorageKey(),
    );

    if (!raw) {
      return [];
    }

    const parsed: unknown =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (
        item,
      ): item is ScheduledInterview =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (
          item as ScheduledInterview
        ).id === "string",
    );
  } catch {
    return [];
  }
}

function saveInterviews(
  interviews: ScheduledInterview[],
) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(
    getCompanyStorageKey(),
    JSON.stringify(interviews),
  );
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateKey(
  year: number,
  month: number,
  day: number,
): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseDateKey(
  value: string,
): {
  year: number;
  month: number;
  day: number;
} | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value,
    );

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}

function dateTimeToTimestamp(
  date: string,
  time: string,
): number {
  return new Date(
    `${date}T${time}:00`,
  ).getTime();
}

function formatDisplayDate(
  date: string,
): string {
  const parsed = parseDateKey(date);

  if (!parsed) {
    return date;
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(
    new Date(
      parsed.year,
      parsed.month,
      parsed.day,
    ),
  );
}

function formatDisplayTime(
  time: string,
): string {
  const [hours, minutes] =
    time.split(":").map(Number);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return time;
  }

  const suffix =
    hours >= 12 ? "PM" : "AM";

  const displayHour =
    hours % 12 || 12;

  return `${displayHour}:${pad(
    minutes,
  )} ${suffix}`;
}

function createTimeOptions(): string[] {
  const options: string[] = [];

  for (
    let minutes = 0;
    minutes < 24 * 60;
    minutes += 15
  ) {
    const hours =
      Math.floor(minutes / 60);

    const mins = minutes % 60;

    options.push(
      `${pad(hours)}:${pad(mins)}`,
    );
  }

  return options;
}

function startOfToday(): Date {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
}

function isSameDay(
  first: Date,
  second: Date,
): boolean {
  return (
    first.getFullYear() ===
      second.getFullYear() &&
    first.getMonth() ===
      second.getMonth() &&
    first.getDate() ===
      second.getDate()
  );
}

function isDateInPast(
  year: number,
  month: number,
  day: number,
): boolean {
  return (
    new Date(
      year,
      month,
      day,
    ).getTime() <
    startOfToday().getTime()
  );
}

function getDaysInMonth(
  year: number,
  month: number,
): number {
  return new Date(
    year,
    month + 1,
    0,
  ).getDate();
}

function getFirstWeekday(
  year: number,
  month: number,
): number {
  return new Date(
    year,
    month,
    1,
  ).getDay();
}

function isTimeInPast(
  date: string,
  time: string,
): boolean {
  const timestamp =
    dateTimeToTimestamp(
      date,
      time,
    );

  return timestamp <= Date.now();
}

function requestBrowserNotificationPermission() {
  if (
    typeof window === "undefined" ||
    !("Notification" in window)
  ) {
    return;
  }

  if (
    Notification.permission ===
    "default"
  ) {
    void Notification.requestPermission();
  }
}

function notifyInterview(
  interview: ScheduledInterview,
) {
  const message =
    `${interview.candidateName} interview is scheduled now. ` +
    `Role: ${interview.role}.`;

  toast.info(message, {
    duration: 10000,
  });

  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission ===
      "granted"
  ) {
    new Notification(
      "Nova — Interview Reminder",
      {
        body: message,
        icon: "/favicon.ico",
      },
    );
  }
}

function ScheduleInterviewPage() {
  const now = new Date();

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

  const [isSending, setIsSending] =
    useState(false);

  const [scheduled, setScheduled] =
    useState<ScheduledInterview[]>(
      [],
    );

  const [calendarYear, setCalendarYear] =
    useState(now.getFullYear());

  const [calendarMonth, setCalendarMonth] =
    useState(now.getMonth());

  const [notificationTick, setNotificationTick] =
    useState(0);

  const timeOptions = useMemo(
    () => createTimeOptions(),
    [],
  );

  const years = useMemo(() => {
    const currentYear =
      new Date().getFullYear();

    const result: number[] = [];

    for (
      let year = currentYear;
      year <= 2050;
      year++
    ) {
      result.push(year);
    }

    return result;
  }, []);

  useEffect(() => {
    const loaded =
      readInterviews();

    setScheduled(loaded);

    requestBrowserNotificationPermission();
  }, []);

  /*
   * Check scheduled interviews every
   * 30 seconds while the company dashboard
   * is open.
   */
  useEffect(() => {
    const checkDueInterviews =
      () => {
        const current =
          readInterviews();

        let changed = false;

        const updated =
          current.map(
            (interview) => {
              if (
                interview.notified
              ) {
                return interview;
              }

              const scheduledTime =
                dateTimeToTimestamp(
                  interview.date,
                  interview.time,
                );

              if (
                scheduledTime <=
                Date.now()
              ) {
                changed = true;

                notifyInterview(
                  interview,
                );

                return {
                  ...interview,
                  notified: true,
                };
              }

              return interview;
            },
          );

        if (changed) {
          saveInterviews(updated);
          setScheduled(updated);
          setNotificationTick(
            (value) => value + 1,
          );
        }
      };

    checkDueInterviews();

    const interval =
      window.setInterval(
        checkDueInterviews,
        30_000,
      );

    return () =>
      window.clearInterval(
        interval,
      );
  }, [notificationTick]);

  /*
   * When the selected date changes,
   * keep the calendar on that month.
   */
  useEffect(() => {
    const parsed =
      parseDateKey(date);

    if (!parsed) {
      return;
    }

    setCalendarYear(
      parsed.year,
    );

    setCalendarMonth(
      parsed.month,
    );
  }, [date]);

  const daysInMonth =
    getDaysInMonth(
      calendarYear,
      calendarMonth,
    );

  const firstWeekday =
    getFirstWeekday(
      calendarYear,
      calendarMonth,
    );

  const calendarCells = useMemo(
    () => {
      const cells: (
        | number
        | null
      )[] = [];

      for (
        let index = 0;
        index < firstWeekday;
        index++
      ) {
        cells.push(null);
      }

      for (
        let day = 1;
        day <= daysInMonth;
        day++
      ) {
        cells.push(day);
      }

      return cells;
    },
    [
      firstWeekday,
      daysInMonth,
    ],
  );

  function selectDate(
    day: number,
  ) {
    if (
      isDateInPast(
        calendarYear,
        calendarMonth,
        day,
      )
    ) {
      return;
    }

    const nextDate =
      formatDateKey(
        calendarYear,
        calendarMonth,
        day,
      );

    setDate(nextDate);

    /*
     * If today's date is selected,
     * clear an already-past time.
     */
    if (
      time &&
      isTimeInPast(
        nextDate,
        time,
      )
    ) {
      setTime("");
    }
  }

  function goPreviousMonth() {
    const minimumYear =
      new Date().getFullYear();

    if (
      calendarYear ===
        minimumYear &&
      calendarMonth === 0
    ) {
      return;
    }

    if (calendarMonth === 0) {
      setCalendarYear(
        (value) => value - 1,
      );
      setCalendarMonth(11);
    } else {
      setCalendarMonth(
        (value) => value - 1,
      );
    }
  }

  function goNextMonth() {
    if (
      calendarYear === 2050 &&
      calendarMonth === 11
    ) {
      return;
    }

    if (calendarMonth === 11) {
      setCalendarYear(
        (value) => value + 1,
      );
      setCalendarMonth(0);
    } else {
      setCalendarMonth(
        (value) => value + 1,
      );
    }
  }

  function handleYearChange(
    value: string,
  ) {
    const year =
      Number(value);

    if (
      !Number.isFinite(year)
    ) {
      return;
    }

    setCalendarYear(year);

    /*
     * If the current month/day would
     * become invalid for today's
     * minimum date, clear selection.
     */
    if (date) {
      const parsed =
        parseDateKey(date);

      if (
        parsed &&
        parsed.year !== year
      ) {
        const selectedDay =
          Math.min(
            parsed.day,
            getDaysInMonth(
              year,
              calendarMonth,
            ),
          );

        const candidateDate =
          formatDateKey(
            year,
            calendarMonth,
            selectedDay,
          );

        if (
          !isDateInPast(
            year,
            calendarMonth,
            selectedDay,
          )
        ) {
          setDate(
            candidateDate,
          );
        } else {
          setDate("");
          setTime("");
        }
      }
    }
  }

  function handleMonthChange(
    value: string,
  ) {
    const month =
      Number(value);

    if (
      !Number.isFinite(month)
    ) {
      return;
    }

    setCalendarMonth(month);

    if (date) {
      const parsed =
        parseDateKey(date);

      if (
        parsed &&
        parsed.month !== month
      ) {
        const selectedDay =
          Math.min(
            parsed.day,
            getDaysInMonth(
              calendarYear,
              month,
            ),
          );

        if (
          !isDateInPast(
            calendarYear,
            month,
            selectedDay,
          )
        ) {
          setDate(
            formatDateKey(
              calendarYear,
              month,
              selectedDay,
            ),
          );
        } else {
          setDate("");
          setTime("");
        }
      }
    }
  }

  function handleTimeChange(
    value: string,
  ) {
    if (!date) {
      toast.info(
        "Select the interview date first.",
      );
      return;
    }

    if (
      isTimeInPast(
        date,
        value,
      )
    ) {
      toast.error(
        "Please select a future time.",
      );
      return;
    }

    setTime(value);
  }

  async function scheduleInterview(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !candidateName.trim()
    ) {
      toast.error(
        "Candidate name is required.",
      );
      return;
    }

    if (
      !candidateEmail.trim()
    ) {
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

    if (!date) {
      toast.error(
        "Please select an interview date.",
      );
      return;
    }

    if (!time) {
      toast.error(
        "Please select an interview time.",
      );
      return;
    }

    if (
      isTimeInPast(
        date,
        time,
      )
    ) {
      toast.error(
        "The selected interview time has already passed.",
      );
      return;
    }

    const interview: ScheduledInterview =
      {
        id: `interview-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        candidateName:
          candidateName.trim(),
        candidateEmail:
          candidateEmail.trim(),
        role: role.trim(),
        date,
        time,
        duration,
        notes:
          notes.trim(),
        timeZone:
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          "UTC",
        createdAt:
          Date.now(),
        notified: false,
      };

    const updated = [
      ...scheduled,
      interview,
    ].sort(
      (a, b) =>
        dateTimeToTimestamp(
          a.date,
          a.time,
        ) -
        dateTimeToTimestamp(
          b.date,
          b.time,
        ),
    );

    saveInterviews(updated);
    setScheduled(updated);

    requestBrowserNotificationPermission();

    toast.success(
      `Interview scheduled for ${formatDisplayDate(
        date,
      )} at ${formatDisplayTime(
        time,
      )}.`,
      {
        duration: 7000,
      },
    );

    setIsSending(true);

    try {
      const response = await fetch(
        "/api/company-schedule/notify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(interview),
        },
      );

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(
          result?.error ||
            "The confirmation email could not be sent.",
        );
      }

      toast.success(
        `Confirmation email sent to ${interview.candidateEmail}.`,
        { duration: 7000 },
      );
    } catch (error) {
      toast.warning(
        error instanceof Error
          ? error.message
          : "The interview was saved, but the confirmation email could not be sent.",
        { duration: 9000 },
      );
    } finally {
      setIsSending(false);
    }

    setCandidateName("");
    setCandidateEmail("");
    setRole("");
    setDate("");
    setTime("");
    setDuration("30");
    setNotes("");

    /*
     * Reset calendar to the selected
     * interview month for consistency.
     */
    const parsed =
      parseDateKey(date);

    if (parsed) {
      setCalendarYear(
        parsed.year,
      );
      setCalendarMonth(
        parsed.month,
      );
    }
  }

  const removeInterview =
    useCallback(
      (id: string) => {
        const updated =
          scheduled.filter(
            (interview) =>
              interview.id !== id,
          );

        saveInterviews(updated);
        setScheduled(updated);

        toast.success(
          "Interview removed.",
        );
      },
      [scheduled],
    );

  const selectedDate =
    parseDateKey(date);

  const today =
    new Date();

  const isSelectedDay = (
    day: number,
  ) =>
    selectedDate?.year ===
      calendarYear &&
    selectedDate?.month ===
      calendarMonth &&
    selectedDate?.day === day;

  const isToday = (
    day: number,
  ) =>
    today.getFullYear() ===
      calendarYear &&
    today.getMonth() ===
      calendarMonth &&
    today.getDate() === day;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <div className="glass-strong grid size-11 shrink-0 place-items-center rounded-xl">
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

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <form
          onSubmit={
            scheduleInterview
          }
          className="glass space-y-6 rounded-2xl p-5 sm:p-7"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Candidate name
              </span>

              <div className="relative">
                <UserRound className="absolute left-3 top-3 size-4 text-muted-foreground" />

                <input
                  value={
                    candidateName
                  }
                  onChange={(
                    event,
                  ) =>
                    setCandidateName(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Candidate name"
                  className="w-full rounded-lg border border-border bg-background px-10 py-2.5 text-sm outline-none transition focus:border-cyber"
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
                  value={
                    candidateEmail
                  }
                  onChange={(
                    event,
                  ) =>
                    setCandidateEmail(
                      event.target
                        .value,
                    )
                  }
                  placeholder="candidate@email.com"
                  className="w-full rounded-lg border border-border bg-background px-10 py-2.5 text-sm outline-none transition focus:border-cyber"
                />
              </div>
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Job role
            </span>

            <div className="relative">
              <BriefcaseBusiness className="absolute left-3 top-3 size-4 text-muted-foreground" />

              <input
                value={role}
                onChange={(event) =>
                  setRole(
                    event.target
                      .value,
                  )
                }
                placeholder="Frontend Developer"
                className="w-full rounded-lg border border-border bg-background px-10 py-2.5 text-sm outline-none transition focus:border-cyber"
              />
            </div>
          </label>

          {/* DATE + TIME */}
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Interview date
                </span>

                {date && (
                  <button
                    type="button"
                    onClick={() => {
                      setDate("");
                      setTime("");
                    }}
                    className="text-[11px] text-muted-foreground transition hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="rounded-xl border border-border bg-background/60 p-3">
                {/* MONTH + YEAR */}
                <div className="mb-4 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={
                      goPreviousMonth
                    }
                    className="grid size-9 shrink-0 place-items-center rounded-lg border border-border transition hover:border-cyber hover:text-cyber"
                  >
                    <ChevronLeft className="size-4" />
                  </button>

                  <select
                    value={
                      calendarMonth
                    }
                    onChange={(
                      event,
                    ) =>
                      handleMonthChange(
                        event.target
                          .value,
                      )
                    }
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-2 text-sm font-medium outline-none focus:border-cyber"
                  >
                    {MONTHS.map(
                      (
                        month,
                        index,
                      ) => (
                        <option
                          key={
                            month
                          }
                          value={
                            index
                          }
                        >
                          {month}
                        </option>
                      ),
                    )}
                  </select>

                  <select
                    value={
                      calendarYear
                    }
                    onChange={(
                      event,
                    ) =>
                      handleYearChange(
                        event.target
                          .value,
                      )
                    }
                    className="w-24 rounded-lg border border-border bg-background px-2 py-2 text-sm font-medium outline-none focus:border-cyber"
                  >
                    {years.map(
                      (year) => (
                        <option
                          key={
                            year
                          }
                          value={
                            year
                          }
                        >
                          {year}
                        </option>
                      ),
                    )}
                  </select>

                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={
                      goNextMonth
                    }
                    className="grid size-9 shrink-0 place-items-center rounded-lg border border-border transition hover:border-cyber hover:text-cyber"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                {/* WEEKDAYS */}
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS.map(
                    (weekday) => (
                      <div
                        key={
                          weekday
                        }
                        className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {
                          weekday
                        }
                      </div>
                    ),
                  )}

                  {/* DAYS */}
                  {calendarCells.map(
                    (
                      day,
                      index,
                    ) => {
                      if (
                        day ===
                        null
                      ) {
                        return (
                          <div
                            key={`empty-${index}`}
                            className="aspect-square"
                          />
                        );
                      }

                      const past =
                        isDateInPast(
                          calendarYear,
                          calendarMonth,
                          day,
                        );

                      const selected =
                        isSelectedDay(
                          day,
                        );

                      const todayDay =
                        isToday(
                          day,
                        );

                      return (
                        <button
                          key={
                            day
                          }
                          type="button"
                          disabled={
                            past
                          }
                          onClick={() =>
                            selectDate(
                              day,
                            )
                          }
                          className={[
                            "aspect-square rounded-lg text-xs font-medium transition",
                            past
                              ? "cursor-not-allowed text-muted-foreground/30"
                              : "hover:bg-cyber/10 hover:text-cyber",
                            selected
                              ? "bg-cyber text-primary-foreground hover:bg-cyber hover:text-primary-foreground"
                              : "",
                            todayDay &&
                            !selected
                              ? "ring-1 ring-cyber/60"
                              : "",
                          ].join(
                            " ",
                          )}
                        >
                          {
                            day
                          }
                        </button>
                      );
                    },
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    Past dates are disabled
                  </span>

                  <span>
                    Available through 2050
                  </span>
                </div>
              </div>

              {date && (
                <div className="flex items-center gap-2 rounded-lg border border-cyber/20 bg-cyber/5 px-3 py-2 text-xs">
                  <CalendarDays className="size-3.5 text-cyber" />

                  <span>
                    {formatDisplayDate(
                      date,
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* TIME */}
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Interview time
              </span>

              <div className="rounded-xl border border-border bg-background/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="size-4 text-cyber" />

                  <span className="text-sm font-medium">
                    Select time
                  </span>
                </div>

                <select
                  value={time}
                  disabled={!date}
                  onChange={(
                    event,
                  ) =>
                    handleTimeChange(
                      event.target
                        .value,
                    )
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none transition focus:border-cyber disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    {date
                      ? "Choose a time"
                      : "Select date first"}
                  </option>

                  {timeOptions.map(
                    (
                      option,
                    ) => {
                      const disabled =
                        date
                          ? isTimeInPast(
                              date,
                              option,
                            )
                          : false;

                      return (
                        <option
                          key={
                            option
                          }
                          value={
                            option
                          }
                          disabled={
                            disabled
                          }
                        >
                          {formatDisplayTime(
                            option,
                          )}
                        </option>
                      );
                    },
                  )}
                </select>

                {time && (
                  <div className="mt-3 rounded-lg border border-cyber/20 bg-cyber/5 px-3 py-2 text-xs text-cyber">
                    Interview at{" "}
                    {formatDisplayTime(
                      time,
                    )}
                  </div>
                )}

                <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                  Times are available in
                  15-minute intervals.
                  Past times cannot be
                  selected.
                </p>
              </div>
            </div>
          </div>

          {/* DURATION */}
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Duration
            </span>

            <select
              value={duration}
              onChange={(event) =>
                setDuration(
                  event.target
                    .value,
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

              <option value="120">
                120 minutes
              </option>
            </select>
          </label>

          {/* NOTES */}
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Interview notes
            </span>

            <textarea
              rows={4}
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target
                    .value,
                )
              }
              placeholder="Add interview notes, panel members, topics..."
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-cyber"
            />
          </label>

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={isSending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyber px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <CalendarDays className="size-4" />
            {isSending ? "Sending confirmation..." : "Schedule Interview"}
          </button>

          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
            <Bell className="size-3" />

            <span>
              Nova will remind you when the
              interview time arrives.
            </span>
          </div>
        </form>

        {/* UPCOMING INTERVIEWS */}
        <section className="glass rounded-2xl p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold">
                Upcoming Interviews
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Company interview schedule
              </p>
            </div>

            <span className="rounded-full bg-cyber/10 px-3 py-1 text-xs font-semibold text-cyber">
              {
                scheduled.filter(
                  (interview) =>
                    dateTimeToTimestamp(
                      interview.date,
                      interview.time,
                    ) >
                    Date.now(),
                ).length
              }
            </span>
          </div>

          {scheduled.length ===
          0 ? (
            <div className="rounded-xl border border-border/60 bg-background/40 p-8 text-center">
              <CalendarDays className="mx-auto size-9 text-muted-foreground" />

              <p className="mt-3 text-sm font-medium">
                No interviews scheduled
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Schedule your first candidate
                interview.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduled.map(
                (interview) => {
                  const timestamp =
                    dateTimeToTimestamp(
                      interview.date,
                      interview.time,
                    );

                  const isPast =
                    timestamp <=
                    Date.now();

                  return (
                    <div
                      key={
                        interview.id
                      }
                      className={[
                        "rounded-xl border p-4 transition",
                        isPast
                          ? "border-border/50 bg-background/30 opacity-70"
                          : "border-cyber/20 bg-cyber/5",
                      ].join(
                        " ",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {
                              interview.candidateName
                            }
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {
                              interview.role
                            }
                          </p>

                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="size-3" />

                            {
                              interview.candidateEmail
                            }
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <CheckCircle2
                            className={[
                              "size-4",
                              isPast
                                ? "text-muted-foreground"
                                : "text-emerald",
                            ].join(
                              " ",
                            )}
                          />

                          <button
                            type="button"
                            title="Remove interview"
                            onClick={() =>
                              removeInterview(
                                interview.id,
                              )
                            }
                            className="grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-background/70 px-2 py-2">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                            Date
                          </p>

                          <p className="mt-1 text-[11px] font-medium">
                            {formatDisplayDate(
                              interview.date,
                            )}
                          </p>
                        </div>

                        <div className="rounded-lg bg-background/70 px-2 py-2">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                            Time
                          </p>

                          <p className="mt-1 text-[11px] font-medium">
                            {formatDisplayTime(
                              interview.time,
                            )}
                          </p>
                        </div>

                        <div className="rounded-lg bg-background/70 px-2 py-2">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                            Duration
                          </p>

                          <p className="mt-1 text-[11px] font-medium">
                            {
                              interview.duration
                            }{" "}
                            min
                          </p>
                        </div>
                      </div>

                      {interview.notes && (
                        <div className="mt-3 rounded-lg border border-border/50 bg-background/40 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Notes
                          </p>

                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {
                              interview.notes
                            }
                          </p>
                        </div>
                      )}

                      {isPast ? (
                        <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground">
                          This interview time has
                          arrived or passed.
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center gap-2 rounded-lg bg-cyber/10 px-3 py-2 text-[10px] text-cyber">
                          <Bell className="size-3" />

                          Reminder scheduled for{" "}
                          {formatDisplayDate(
                            interview.date,
                          )}{" "}
                          at{" "}
                          {formatDisplayTime(
                            interview.time,
                          )}
                        </div>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          )}

          <p className="mt-5 text-center text-[10px] leading-relaxed text-muted-foreground">
            Interview schedules are saved for this
            company account in this browser.
            Browser notifications require notification
            permission.
          </p>
        </section>
      </div>
    </div>
  );
}