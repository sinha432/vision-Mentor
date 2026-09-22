import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Loader2,
  Mic,
  MicOff,
  ShieldAlert,
  UserRound,
  Video,
  VideoOff,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDemoAuth } from "@/contexts/DemoAuthContext";
import {
  hasIndividualAttempt,
  getAssessmentByCode,
  submitAttempt,
} from "@/lib/assessments.functions";
import { newId } from "@/lib/assessment-types";

import {
  useDetectionEngine,
  type DetectionEvent,
} from "@/interviewer/hooks/useDetectionEngine";

import type {
  DetectionSummary,
  DetectionSignals,
} from "@/interviewer/lib/detection-types";
import { runJavaCode } from "@/lib/code-runner.functions";
import type { CodeLanguage, RunResult } from "@/lib/assessment-types";

export const Route = createFileRoute("/a/$code")({
  component: AssessmentPage,
});

type AnswerValue = {
  type: "text" | "mcq" | "code";
  textAnswer?: string;
  choiceId?: string;
  code?: string;
  runResults?: RunResult | null;
};

type AssessmentQuestion = {
  id: string;
  type?: "text" | "mcq" | "code";
  text: string;
  weight?: number;
  keywords?: string[];
  maxLength?: number | null;
  choices?: {
    id: string;
    text: string;
  }[];
  correctChoiceId?: string;
  language?: CodeLanguage;
  starterCode?: string;
  testCases?: {
    input: string;
    expectedStdout: string;
  }[];
};

type AssessmentData = {
  _id: string;
  code: string;
  title: string;
  status: "active" | "closed";
  requireMedia?: boolean;
  timeLimitSeconds?: number;
  questions: AssessmentQuestion[];
};

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function AssessmentPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const { user, signIn } = useDemoAuth();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const elapsedRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const submittingRef = useRef(false);
  const endedRef = useRef(false);
  const terminationReasonRef = useRef<string | null>(null);
  const signalsRef = useRef<DetectionSignals | null>(null);
  const phoneSeenRef = useRef(false);

  // submitAssessment is declared later in this component. The ref lets
  // integrity handlers invoke the latest submit function safely.
  const submitAssessmentRef =
    useRef<((force?: boolean) => Promise<void>) | null>(null);

  const [assessment, setAssessment] =
    useState<AssessmentData | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<{ id: string; name: string; email: string } | null>(null);
  const [entryName, setEntryName] = useState("");
  const [entryEmail, setEntryEmail] = useState("");
  const [entryPassword, setEntryPassword] = useState("");
  const [entryBusy, setEntryBusy] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  const [answers, setAnswers] =
    useState<Record<string, AnswerValue>>({});

  const [currentIndex, setCurrentIndex] = useState(0);

  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [signals, setSignals] =
    useState<DetectionSignals | null>(null);

  const [warnings, setWarnings] = useState<string[]>([]);
  const [warningCount, setWarningCount] = useState(0);

  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedReportId, setSubmittedReportId] =
    useState<string | null>(null);

  const [terminationReason, setTerminationReason] =
    useState<string | null>(null);

  const [elapsed, setElapsed] = useState(0);

  const [integrityEvents, setIntegrityEvents] =
    useState<DetectionEvent[]>([]);

  const [runningCode, setRunningCode] = useState(false);
  const [codeRunError, setCodeRunError] = useState<string | null>(null);

  const [leftPageWarning, setLeftPageWarning] =
    useState(false);

  /*
   * ---------------------------------------------------------
   * LOAD ASSESSMENT
   * ---------------------------------------------------------
   */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);

      try {
        const result = await getAssessmentByCode({
          data: { code },
        });

        if (cancelled) return;

        if (!result) {
          setLoadError(
            `Assessment not found for code ${code}.`,
          );
          return;
        }

        setAssessment(result as AssessmentData);

        if (result.status === "closed") {
          setLoadError(
            "This assessment is closed and no longer accepting submissions.",
          );
        }
      } catch (error) {
        console.error(
          "Assessment loading failed:",
          error,
        );

        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load this assessment.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [code]);

  /*
   * ---------------------------------------------------------
   * TIMER
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!assessment || assessment.status === "closed" || !candidate) {
      return;
    }

    if (!startedAtRef.current) startedAtRef.current = Date.now();
    const limit = Math.max(60, assessment.timeLimitSeconds ?? 1_800);

    const timer = window.setInterval(() => {
      if (!startedAtRef.current) return;

      const seconds = Math.floor(
        (Date.now() - startedAtRef.current) / 1000,
      );

      elapsedRef.current = seconds;
      setElapsed(seconds);
      if (seconds >= limit && !endedRef.current && !submittingRef.current) {
        endedRef.current = true;
        const reason = "Time limit reached. Your answered questions were submitted automatically.";
        terminationReasonRef.current = reason;
        setTerminationReason(reason);
        setFinished(true);
        toast.warning("Time limit reached. Submitting your answers.");
        void submitAssessmentRef.current?.(true);
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [assessment, candidate]);

  /*
   * ---------------------------------------------------------
   * CAMERA + MICROPHONE
   * ---------------------------------------------------------
   *
   * This is deliberately one MediaStream.
   * The same stream is supplied to the detection engine,
   * allowing both camera and microphone monitoring.
   */

  const startMedia = useCallback(async () => {
    if (streamRef.current) {
      return;
    }

    try {
      setMediaError(null);

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: {
              ideal: 1280,
            },
            height: {
              ideal: 720,
            },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        await videoRef.current.play().catch(() => {
          // Browser may require a user gesture.
        });
      }

      setCameraOn(
        stream.getVideoTracks().some(
          (track) => track.readyState === "live",
        ),
      );

      setMicOn(
        stream.getAudioTracks().some(
          (track) => track.readyState === "live",
        ),
      );
    } catch (error) {
      console.error(
        "Camera/microphone permission failed:",
        error,
      );

      setMediaError(
        "Camera and microphone access is required for the monitored assessment.",
      );

      setCameraOn(false);
      setMicOn(false);
    }
  }, []);

  const verifyCandidate = async (event: React.FormEvent) => {
    event.preventDefault();
    setEntryBusy(true);
    setEntryError(null);
    try {
      const authenticated = await signIn(entryEmail, entryPassword, "individual");
      if (authenticated.name.trim().toLowerCase() !== entryName.trim().toLowerCase()) {
        throw new Error("The name must exactly match your registered individual account.");
      }
      const alreadyAttempted = await hasIndividualAttempt({
        data: { assessmentId: assessment?._id, individualUserId: authenticated.id },
      });
      if (alreadyAttempted) {
        throw new Error("You have already submitted this assessment. Open your reports to view the result.");
      }
      setCandidate({ id: authenticated.id, name: authenticated.name, email: authenticated.email });
    } catch (error) {
      setEntryError(error instanceof Error ? error.message : "Could not verify this account.");
    } finally {
      setEntryBusy(false);
    }
  };

  useEffect(() => {
    if (!assessment || assessment.status === "closed" || !candidate) {
      return;
    }

    void startMedia();

    return () => {
      const stream = streamRef.current;

      stream?.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    };
  }, [assessment, candidate, startMedia]);

  /*
   * ---------------------------------------------------------
   * DETECTION EVENTS
   * ---------------------------------------------------------
   */

  const handleDetectionEvent = useCallback(
    (event: DetectionEvent) => {
      console.log(
        "Assessment integrity event:",
        event,
      );

      if (event.kind === "device_visible") {
        phoneSeenRef.current = true;

        if ((signalsRef.current?.noiseLevel ?? 0) >= 75) {
          const reason = "Assessment ended because a phone was detected while the environment was too noisy.";
          terminationReasonRef.current = reason;
          setTerminationReason(reason);
          setFinished(true);
          toast.error(reason);
          void submitAssessmentRef.current?.(true);
          return;
        }
      }

      setSignals((previous) => previous);

      setIntegrityEvents((previous) =>
        [...previous, event].slice(-30),
      );

      const serious =
        event.kind === "multiple_people" ||
        event.kind === "device_visible" ||
        event.kind === "background_voice";

      if (!serious) {
        setWarnings((previous) => [...previous, event.detail].slice(-5));
        return;
      }

      setWarnings((previous) =>
        [...previous, event.detail].slice(-5),
      );

      setWarningCount((previous) => {
        const next = previous + 1;

        /*
         * Warning 1:
         * notify candidate.
         *
         * Warning 2:
         * notify again.
         *
         * Warning 3:
         * terminate.
         *
         * This prevents one accidental detection from
         * immediately destroying the assessment.
         */
        if (next === 1) {
          toast.warning(
            "Integrity warning: " +
              event.detail,
          );
        } else if (next === 2) {
          toast.warning(
            "Final warning: " +
              event.detail,
          );
        }

        return next;
      });
    },
    [],
  );

  /*
   * ---------------------------------------------------------
   * ON-DEVICE PROCTORING
   * ---------------------------------------------------------
   */

  const detection = useDetectionEngine({
    videoRef,
    stream: streamRef.current,
    active:
      Boolean(assessment) &&
      !finished &&
      cameraOn,
    getElapsed: () => elapsedRef.current,
    onEvent: handleDetectionEvent,
  });

  /*
   * Keep displayed detection state synchronized.
   */

  useEffect(() => {
    signalsRef.current = detection.signals;
    setSignals(detection.signals);

    if (
      !finished &&
      !submitting &&
      phoneSeenRef.current &&
      (detection.signals?.noiseLevel ?? 0) >= 75
    ) {
      const reason = "Assessment ended because a phone was detected while the environment was too noisy.";
      terminationReasonRef.current = reason;
      setTerminationReason(reason);
      setFinished(true);
      toast.error(reason);
      void submitAssessmentRef.current?.(true);
    }
  }, [detection.signals, finished, submitting]);

  /*
   * ---------------------------------------------------------
   * TAB / WINDOW INTEGRITY
   * ---------------------------------------------------------
   *
  * Leaving the assessment immediately locks and submits it.
   */

  const registerPageLeave = useCallback(
    (reason: string) => {
      if (
        finished ||
        submittingRef.current ||
        endedRef.current
      ) {
        return;
      }

      endedRef.current = true;
      terminationReasonRef.current = reason;
      setTerminationReason(reason);
      setFinished(true);
      setLeftPageWarning(true);
      setWarnings((previous) => [...previous, reason].slice(-5));
      setWarningCount((previous) => previous + 1);
      toast.error("Assessment terminated because the page was left.");
      void submitAssessmentRef.current?.(true);
    },
    [finished],
  );

  useEffect(() => {
    if (!assessment || finished) {
      return;
    }

    const handleVisibility = () => {
      if (
        document.visibilityState === "hidden"
      ) {
        registerPageLeave(
          "The assessment page was left or hidden.",
        );
      } else {
        setLeftPageWarning(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.shiftKey &&
        event.key === "Tab"
      ) {
        event.preventDefault();
        event.stopPropagation();

        if (
          endedRef.current ||
          submittingRef.current
        ) {
          return;
        }

        registerPageLeave("The assessment page was left using keyboard navigation.");
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibility,
    );

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );
    const handleBlur = () => {
      if (document.visibilityState === "hidden") {
        registerPageLeave("The assessment window lost focus.");
      }
    };
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
      window.removeEventListener("blur", handleBlur);
    };
  }, [assessment, finished, registerPageLeave]);

  /*
   * ---------------------------------------------------------
   * ANSWERS
   * ---------------------------------------------------------
   */

  const currentQuestion =
    assessment?.questions[currentIndex] ?? null;
  const answer = currentQuestion ? answers[currentQuestion.id] : undefined;

  const setTextAnswer = useCallback(
    (questionId: string, value: string) => {
      setAnswers((previous) => ({
        ...previous,
        [questionId]: {
          type:
            currentQuestion?.type === "code"
              ? "code"
              : "text",
          ...(currentQuestion?.type === "code"
            ? {
                code: value,
              }
            : {
                textAnswer: value,
              }),
        },
      }));
    },
    [currentQuestion?.type],
  );

  const runCurrentCode = useCallback(async () => {
    if (!currentQuestion || currentQuestion.type !== "code") return;

    const sourceCode =
      answer?.code?.trim() || currentQuestion.starterCode?.trim() || "";

    if (!sourceCode) {
      setCodeRunError("Add code before running the tests.");
      return;
    }

    setRunningCode(true);
    setCodeRunError(null);

    try {
      const result = await runJavaCode({
        data: {
          sourceCode,
          language: currentQuestion.language ?? "java",
          cases: currentQuestion.testCases ?? [],
        },
      });

      const runResults: RunResult = {
        passed: result.passed,
        total: result.total,
        cases: result.cases,
      };

      setAnswers((previous) => ({
        ...previous,
        [currentQuestion.id]: {
          type: "code",
          code: sourceCode,
          runResults,
        },
      }));
    } catch (error) {
      setCodeRunError(
        error instanceof Error ? error.message : "Code execution failed.",
      );
    } finally {
      setRunningCode(false);
    }
  }, [answer?.code, currentQuestion]);

  const setChoiceAnswer = useCallback(
    (
      questionId: string,
      choiceId: string,
    ) => {
      setAnswers((previous) => ({
        ...previous,
        [questionId]: {
          type: "mcq",
          choiceId,
        },
      }));
    },
    [],
  );

  /*
   * ---------------------------------------------------------
   * PROCTORING SUMMARY
   * ---------------------------------------------------------
   */

  const buildVisionSummary = useCallback(() => {
    const summary: DetectionSummary =
      detection.summarize();

    return {
      avgEye: clamp(
        summary.avgEyeContact / 100,
      ),
      avgPosture: clamp(
        summary.avgPosture / 100,
      ),
      avgVoice: null,
      samples: summary.samples.length,
    };
  }, [detection]);

  /*
   * ---------------------------------------------------------
   * SUBMIT
   * ---------------------------------------------------------
   */

  const submitAssessment = useCallback(
    async (force = false) => {
      if (
        !assessment ||
        submittingRef.current ||
        (finished && !force)
      ) {
        return;
      }

      submittingRef.current = true;
      setSubmitting(true);

      try {
        /*
         * Use the authenticated individual when available.
         * Demo fallback keeps public assessment links
         * usable during local testing.
         */
        const individualUserId = candidate?.id;
        if (!individualUserId) {
          throw new Error("Your individual account could not be verified for this assessment.");
        }

        if (user && candidate.email.toLowerCase() !== user.email.toLowerCase()) {
          throw new Error("This assessment is locked to the verified individual account you used to enter it.");
        }

        const vision = buildVisionSummary();

        const result = await submitAttempt({
          data: {
            code: assessment.code,
            individualUserId,
            candidateEmail: candidate.email,
            answers,
            vision,
            terminationReason: terminationReasonRef.current ?? terminationReason,
            integrityEvents: integrityEvents.map((event) => ({
              kind: event.kind,
              detail: event.detail,
              confidence: event.confidence,
              t: elapsedRef.current,
            })),
          },
        });

        console.log(
          "Assessment submitted:",
          result,
        );

        setSubmittedReportId(
          result.reportId,
        );

        setFinished(true);

        if (terminationReason) {
          toast.error(
            "Assessment terminated and submitted.",
          );
        } else {
          toast.success(
            "Assessment submitted successfully.",
          );
        }

        const stream = streamRef.current;

        stream?.getTracks().forEach((track) => {
          track.stop();
        });

        streamRef.current = null;

        setCameraOn(false);
        setMicOn(false);
      } catch (error) {
        console.error(
          "Assessment submission failed:",
          error,
        );

        toast.error(
          terminationReason
            ? "Assessment was terminated, but submission could not be completed. Please contact the recruiter."
            : error instanceof Error
              ? error.message
              : "Failed to submit assessment.",
        );

        /*
         * Never unlock the candidate after a hard termination.
         */
        if (!terminationReason) {
          submittingRef.current = false;
        }
      } finally {
        setSubmitting(false);
      }
    },
    [
      assessment,
      answers,
      buildVisionSummary,
      finished,
      integrityEvents,
      candidate,
      terminationReason,
      user,
    ],
  );

  // Keep the integrity keyboard handler connected to the latest
  // submit function without placing submitAssessment in an earlier
  // hook dependency array.
  useEffect(() => {
    submitAssessmentRef.current = submitAssessment;

    return () => {
      submitAssessmentRef.current = null;
    };
  }, [submitAssessment]);

  /*
   * ---------------------------------------------------------
   * END ASSESSMENT AFTER SERIOUS REPEATED VIOLATIONS
   * ---------------------------------------------------------
   */


  /*
   * ---------------------------------------------------------
   * FORMAT TIMER
   * ---------------------------------------------------------
   */

  const formattedTime = useMemo(() => {
    const remaining = Math.max(
      0,
      (assessment?.timeLimitSeconds ?? 1_800) - elapsed,
    );
    const minutes = Math.floor(
      remaining / 60,
    )
      .toString()
      .padStart(2, "0");

    const seconds = (remaining % 60)
      .toString()
      .padStart(2, "0");

    return `${minutes}:${seconds}`;
  }, [elapsed]);

  /*
   * ---------------------------------------------------------
   * LOADING
   * ---------------------------------------------------------
   */

  if (loading) {
    return (
      <div className="min-h-screen bg-background grid place-items-center p-6">
        <div className="glass rounded-2xl p-8 text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />

          <h1 className="font-display text-xl font-semibold">
            Loading assessment
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Preparing your secure interview environment...
          </p>
        </div>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * ERROR
   * ---------------------------------------------------------
   */

  if (loadError || !assessment) {
    return (
      <div className="min-h-screen bg-background grid place-items-center p-6">
        <div className="glass w-full max-w-xl rounded-2xl p-8 text-center">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-destructive" />

          <h1 className="font-display text-xl font-semibold">
            Assessment unavailable
          </h1>

          <p className="mt-3 text-sm text-muted-foreground">
            {loadError ??
              "This assessment could not be loaded."}
          </p>

          <Button
            className="mt-6"
            onClick={() =>
              navigate({
                to: "/",
              })
            }
          >
            Return to Vision Mentor X
          </Button>
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="min-h-screen bg-background grid place-items-center p-6">
        <form onSubmit={verifyCandidate} className="glass w-full max-w-md rounded-3xl p-8">
          <div className="mb-6 text-center">
            <UserRound className="mx-auto mb-3 h-10 w-10 text-primary" />
            <h1 className="font-display text-2xl font-bold">Verify your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in with your registered individual Vision Mentor account before entering this assessment.
            </p>
          </div>
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1.5 block text-muted-foreground">Registered name</span>
              <input
                required
                value={entryName}
                onChange={(event) => setEntryName(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                autoComplete="name"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-muted-foreground">Email</span>
              <input
                required
                type="email"
                value={entryEmail}
                onChange={(event) => setEntryEmail(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                autoComplete="email"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-muted-foreground">Password</span>
              <input
                required
                type="password"
                value={entryPassword}
                onChange={(event) => setEntryPassword(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
                autoComplete="current-password"
              />
            </label>
          </div>
          {entryError && <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{entryError}</p>}
          <Button type="submit" disabled={entryBusy} className="mt-6 w-full">
            {entryBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {entryBusy ? "Verifying…" : "Verify and enter assessment"}
          </Button>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            New individual candidate?{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() =>
                navigate({
                  to: "/auth",
                  search: { redirect: `/a/${code}` },
                })
              }
            >
              Create your account and continue
            </button>
          </div>
        </form>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * SUBMITTED
   * ---------------------------------------------------------
   */

  if (
    finished &&
    (submittedReportId || terminationReason || submitting)
  ) {
    const wasTerminated =
      Boolean(terminationReason) || endedRef.current;

    return (
      <div className="min-h-screen bg-background grid place-items-center p-6">
        <div className="glass w-full max-w-xl rounded-3xl p-10 text-center">
          <div
            className={
              "mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full " +
              (wasTerminated
                ? "bg-destructive/10"
                : "bg-emerald-500/10")
            }
          >
            {wasTerminated ? (
              <ShieldAlert className="h-10 w-10 text-destructive" />
            ) : (
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            )}
          </div>

          <h1 className="font-display text-2xl font-bold">
            {wasTerminated
              ? "Assessment Terminated"
              : "Assessment Submitted"}
          </h1>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {wasTerminated
              ? submittedReportId
                ? "The assessment was automatically terminated because an integrity violation was detected. Your answers and available integrity data were submitted."
                : "The assessment was automatically terminated because an integrity violation was detected. Your answers are being submitted and the assessment is locked."
              : "Your answers and interview integrity data have been submitted successfully."}
          </p>

          {wasTerminated && (
            <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-left">
              <div className="text-xs uppercase tracking-widest text-destructive">
                Termination reason
              </div>

              <div className="mt-2 text-sm font-medium">
                {terminationReason}
              </div>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-border/60 bg-background/40 p-4 text-left">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Assessment
            </div>

            <div className="mt-1 font-semibold">
              {assessment.title}
            </div>

            {submittedReportId && (
              <>
                <div className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">
                  Submission ID
                </div>

                <div className="mt-1 font-mono text-xs">
                  {submittedReportId}
                </div>
              </>
            )}
          </div>
          {submittedReportId && candidate && (
            <Link
              to="/reports"
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              View my detailed report
            </Link>
          )}
        </div>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * MAIN ASSESSMENT
   * ---------------------------------------------------------
   */

  const progress =
    assessment.questions.length > 0
      ? Math.round(
          ((currentIndex + 1) /
            assessment.questions.length) *
            100,
        )
      : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* TOP BAR */}

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <div className="font-display text-sm font-bold tracking-[0.18em] text-gradient">
              VISION MENTOR X
            </div>

            <div className="truncate text-xs text-muted-foreground">
              {assessment.title}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-border/60 px-3 py-2 text-xs sm:flex">
              <Clock className="h-4 w-4 text-primary" />
              {formattedTime}
            </div>

            <div
              className={
                "flex items-center gap-2 rounded-full border px-3 py-2 text-xs " +
                (cameraOn
                  ? "border-emerald-500/40 text-emerald-400"
                  : "border-destructive/40 text-destructive")
              }
            >
              {cameraOn ? (
                <Camera className="h-4 w-4" />
              ) : (
                <CameraOff className="h-4 w-4" />
              )}

              <span className="hidden sm:inline">
                Camera
              </span>
            </div>

            <div
              className={
                "flex items-center gap-2 rounded-full border px-3 py-2 text-xs " +
                (micOn
                  ? "border-emerald-500/40 text-emerald-400"
                  : "border-destructive/40 text-destructive")
              }
            >
              {micOn ? (
                <Mic className="h-4 w-4" />
              ) : (
                <MicOff className="h-4 w-4" />
              )}

              <span className="hidden sm:inline">
                Mic
              </span>
            </div>
          </div>
        </div>

        <div className="h-1 bg-border/30">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </header>

      {/* WARNINGS */}

      {(mediaError ||
        leftPageWarning ||
        warnings.length > 0) && (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />

              <div className="min-w-0">
                <div className="font-semibold text-amber-300">
                  Assessment integrity monitoring
                </div>

                {mediaError && (
                  <p className="mt-1 text-sm text-amber-200/80">
                    {mediaError}
                  </p>
                )}

                {leftPageWarning && (
                  <p className="mt-1 text-sm text-amber-200/80">
                    This assessment was locked because the page or window was left.
                  </p>
                )}

                {warnings.length > 0 && (
                  <p className="mt-1 text-sm text-amber-200/80">
                    Integrity warnings:{" "}
                    {warningCount}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN */}

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* QUESTION */}

        <section className="min-w-0">
          <div className="glass rounded-3xl p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Question{" "}
                  {currentIndex + 1} of{" "}
                  {assessment.questions.length}
                </div>

                <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-border/50">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>
              </div>

              <div className="rounded-full border border-border/60 px-3 py-1.5 text-xs">
                {currentQuestion?.type ===
                "mcq"
                  ? "Multiple Choice"
                  : currentQuestion?.type ===
                      "code"
                    ? "Coding"
                    : "Written Answer"}
              </div>
            </div>

            <h1 className="mt-8 whitespace-pre-wrap text-lg font-semibold leading-8 sm:text-xl">
              {currentQuestion?.text}
            </h1>

            {/* TEXT */}

            {currentQuestion?.type !==
              "mcq" &&
              currentQuestion?.type !==
                "code" && (
                <Textarea
                  disabled={finished || submitting}
                  className="mt-8 min-h-52 resize-y"
                  placeholder="Type your answer here..."
                  value={
                    answer?.textAnswer ?? ""
                  }
               onChange={(event) => {
  if (!currentQuestion) return;

  setTextAnswer(
    currentQuestion.id,
    event.target.value,
  );
}}
                />
              )}

            {/* CODE */}

            {currentQuestion?.type ===
              "code" && (
              <div className="mt-8">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    Code editor
                  </span>

                  <span className="rounded-md border border-border/60 px-2 py-1 text-xs">
                    {currentQuestion.language ?? "Java"}
                  </span>
                </div>

                <Textarea
                  disabled={finished || submitting}
                  className="min-h-80 resize-y font-mono text-sm"
                  placeholder={
                    currentQuestion.starterCode ??
                    "Write your solution here..."
                  }
                  value={answer?.code ?? currentQuestion.starterCode ?? ""}
                 onChange={(event) => {
  if (!currentQuestion) return;

  setTextAnswer(
    currentQuestion.id,
    event.target.value,
  );
}}
                />
                <div className="mt-4 rounded-xl border border-border/60 bg-background/30 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Test cases
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {currentQuestion.testCases?.length ?? 0} case{currentQuestion.testCases?.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {(currentQuestion.testCases ?? []).map((testCase, index) => {
                      const result = answer?.runResults?.cases[index];
                      return (
                        <div
                          key={index}
                          className="rounded-lg border border-border/60 bg-background/40 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                            <span className="font-medium">Case {index + 1}</span>
                            {result ? (
                              <span
                                className={
                                  result.ok
                                    ? "font-semibold text-emerald-400"
                                    : "font-semibold text-destructive"
                                }
                              >
                                {result.ok ? "Passed" : "Failed"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Not run</span>
                            )}
                          </div>
                          <div className="grid gap-2 text-xs sm:grid-cols-2">
                            <div>
                              <div className="mb-1 text-muted-foreground">Input</div>
                              <pre className="min-h-8 whitespace-pre-wrap rounded-md bg-background p-2 font-mono">
                                {testCase.input || "(empty)"}
                              </pre>
                            </div>
                            <div>
                              <div className="mb-1 text-muted-foreground">Expected output</div>
                              <pre className="min-h-8 whitespace-pre-wrap rounded-md bg-background p-2 font-mono">
                                {testCase.expectedStdout || "(empty)"}
                              </pre>
                            </div>
                          </div>
                          {result && !result.ok && (
                            <div className="mt-2 text-xs text-destructive">
                              {result.stderr || `Received: ${result.actual || "(empty)"}`}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    disabled={finished || submitting || runningCode}
                    onClick={() => void runCurrentCode()}
                  >
                    {runningCode ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {runningCode ? "Running tests" : "Run tests"}
                  </Button>
                  {codeRunError && (
                    <span className="text-sm text-destructive">{codeRunError}</span>
                  )}
                  {answer?.runResults && (
                    <span
                      className={
                        answer.runResults.total > 0 &&
                        answer.runResults.passed === answer.runResults.total
                          ? "text-sm font-semibold text-emerald-400"
                          : "text-sm text-muted-foreground"
                      }
                    >
                      {answer.runResults.total > 0 &&
                      answer.runResults.passed === answer.runResults.total
                        ? `All ${answer.runResults.total} tests passed`
                        : `Passed ${answer.runResults.passed}/${answer.runResults.total} tests`}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* MCQ */}

            {currentQuestion?.type ===
              "mcq" && (
              <div className="mt-8 space-y-3">
                {currentQuestion.choices?.map(
                  (choice) => {
                    const selected =
                      answer?.choiceId ===
                      choice.id;

                    return (
                      <button
                        key={choice.id}
                        type="button"
                     onClick={() => {
  if (!currentQuestion) return;

  setChoiceAnswer(
    currentQuestion.id,
    choice.id,
  );
}}
                        className={
                          "w-full rounded-2xl border p-4 text-left transition " +
                          (selected
                            ? "border-primary bg-primary/10"
                            : "border-border/60 hover:border-primary/50 hover:bg-primary/5")
                        }
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={
                              "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs " +
                              (selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border")
                            }
                          >
                            {selected
                              ? "✓"
                              : ""}
                          </div>

                          <span className="text-sm leading-6">
                            {choice.text}
                          </span>
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            )}

            {/* NAVIGATION */}

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-border/50 pt-5">
              <Button
                variant="outline"
                disabled={
                  currentIndex === 0 ||
                  submitting ||
                  finished
                }
                onClick={() => {
                  if (finished || submitting) return;

                  setCurrentIndex(
                    (value) =>
                      Math.max(
                        0,
                        value - 1,
                      ),
                  );
                }}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>

              {currentIndex <
              assessment.questions.length -
                1 ? (
                <Button
                  disabled={finished || submitting}
                  onClick={() => {
                    if (finished || submitting) return;

                    setCurrentIndex(
                      (value) =>
                        Math.min(
                          assessment.questions
                            .length - 1,
                          value + 1,
                        ),
                    );
                  }}
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  disabled={submitting || finished}
                  onClick={() => {
                    if (finished || submitting) return;

                    const confirmed =
                      window.confirm(
                        "Submit your assessment now? You will not be able to change your answers afterward.",
                      );

                    if (confirmed) {
                      void submitAssessment();
                    }
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit Assessment
                      <CheckCircle2 className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT SIDE */}

        <aside className="space-y-5">
          {/* CAMERA */}

          <div className="glass overflow-hidden rounded-3xl">
            <div className="relative aspect-video bg-black">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />

              {!cameraOn && (
                <div className="absolute inset-0 grid place-items-center bg-black/80 p-5 text-center">
                  <div>
                    <VideoOff className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />

                    <p className="text-sm text-muted-foreground">
                      Camera is not active
                    </p>

                    <Button
                      size="sm"
                      className="mt-4"
                      onClick={() =>
                        void startMedia()
                      }
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Enable Camera
                    </Button>
                  </div>
                </div>
              )}

              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs">
                <span
                  className={
                    "h-2 w-2 rounded-full " +
                    (cameraOn
                      ? "bg-emerald-400"
                      : "bg-red-400")
                  }
                />

                {cameraOn
                  ? "LIVE MONITORING"
                  : "CAMERA OFF"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3">
              <div className="rounded-xl border border-border/50 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Eye className="h-4 w-4" />
                  Eye contact
                </div>

                <div className="mt-1 text-lg font-semibold">
                  {signals?.eyeContact ??
                    0}
                  %
                </div>
              </div>

              <div className="rounded-xl border border-border/50 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <UserRound className="h-4 w-4" />
                  People
                </div>

                <div
                  className={
                    "mt-1 text-lg font-semibold " +
                    ((signals?.faces ?? 0) >
                    1
                      ? "text-destructive"
                      : "")
                  }
                >
                  {signals?.faces ?? 0}
                </div>
              </div>

              <div className="rounded-xl border border-border/50 p-3">
                <div className="text-xs text-muted-foreground">
                  Posture
                </div>

                <div className="mt-1 text-lg font-semibold">
                  {signals?.posture ??
                    0}
                  %
                </div>
              </div>

              <div className="rounded-xl border border-border/50 p-3">
                <div className="text-xs text-muted-foreground">
                  Integrity
                </div>

                <div className="mt-1 text-lg font-semibold">
                  {warningCount}
                </div>
              </div>
            </div>
          </div>

          {/* SECURITY STATUS */}

          <div className="glass rounded-3xl p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />

              <h2 className="font-semibold">
                Secure Assessment
              </h2>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <StatusRow
                label="Camera"
                active={cameraOn}
              />

              <StatusRow
                label="Microphone"
                active={micOn}
              />

              <StatusRow
                label="Face detection"
                active={
                  Boolean(
                    signals?.ready,
                  ) ||
                  Boolean(
                    signals &&
                      !signals.degraded,
                  )
                }
              />

              <StatusRow
                label="Single-person check"
                active={
                  (signals?.faces ?? 0) <= 1
                }
              />

              <StatusRow
                label="Background voice"
                active={
                  !signals?.backgroundVoice
                }
                inverse
              />

              <StatusRow
                label="Page focus"
                active={!leftPageWarning && !finished}
              />
            </div>
          </div>

          {/* QUESTION NAVIGATION */}

          <div className="glass rounded-3xl p-5">
            <h2 className="text-sm font-semibold">
              Questions
            </h2>

            <div className="mt-4 grid grid-cols-5 gap-2">
              {assessment.questions.map(
                (question, index) => {
                  const answered =
                    Boolean(
                      answers[question.id],
                    );

                  return (
                    <button
                      key={question.id}
                      type="button"
                      disabled={finished || submitting}
                      onClick={() => {
                        if (finished || submitting) return;
                        setCurrentIndex(index);
                      }}
                      className={
                        "h-9 rounded-lg border text-xs transition " +
                        (index ===
                        currentIndex
                          ? "border-primary bg-primary text-primary-foreground"
                          : answered
                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                            : "border-border/60 hover:border-primary/50")
                      }
                    >
                      {index + 1}
                    </button>
                  );
                },
              )}
            </div>
          </div>

          {/* RECENT INTEGRITY EVENTS */}

          {integrityEvents.length >
            0 && (
            <div className="glass rounded-3xl p-5">
              <h2 className="text-sm font-semibold">
                Integrity monitor
              </h2>

              <div className="mt-3 space-y-2">
                {integrityEvents
                  .slice(-4)
                  .reverse()
                  .map(
                    (event, index) => (
                      <div
                        key={`${event.kind}-${index}`}
                        className="rounded-xl border border-border/50 bg-background/30 p-3"
                      >
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                          {event.kind}
                        </div>

                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {event.detail}
                        </p>
                      </div>
                    ),
                  )}
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
              
function StatusRow({
  label,
  active,
  inverse = false,
}: {
  label: string;
  active: boolean;
  inverse?: boolean;
}) {
  const ok = inverse ? active : active;

  return (
    <div className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2.5">
      <span className="text-muted-foreground">
        {label}
      </span>

      <span
        className={
          "flex items-center gap-1.5 " +
          (ok
            ? "text-emerald-400"
            : "text-destructive")
        }
      >
        <span
          className={
            "h-1.5 w-1.5 rounded-full " +
            (ok
              ? "bg-emerald-400"
              : "bg-destructive")
          }
        />

        {ok ? "OK" : "Alert"}
      </span>
    </div>
  );
}