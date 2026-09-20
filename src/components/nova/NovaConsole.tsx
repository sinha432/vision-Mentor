import { useCallback, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Companion } from "@/components/nova/Companion";
import { NovaDemoPanel } from "@/components/nova/NovaDemoPanel";

import {
  NovaConversationPanel,
  type NovaConversationHandle,
  type NovaConversationStatus,
} from "@/components/nova/NovaConversationPanel";

import { NovaVoiceControl } from "@/components/nova/NovaVoiceControl";
import { CompanyNovaActions } from "@/components/nova/CompanyNovaActions";

import {
  CompanyQuestionGenerator,
  type CompanyQuestionGeneratorConfig,
} from "@/components/nova/CompanyQuestionGenerator";

import type { CompanyNovaCommand } from "@/lib/nova/company-command";

import { createAssessment } from "@/lib/assessments.functions";

import { useNovaSenses } from "@/hooks/use-nova-senses";

import {
  expressionLabel,
  stateLabel,
} from "@/lib/nova/expression";

import {
  useNovaVoice,
  voiceLabel,
} from "@/lib/nova/nova-voice";

import {
  Mic2,
  Radio,
  Camera,
  CalendarDays,
  Clock3,
  Mail,
  UserRound,
  BriefcaseBusiness,
  CheckCircle2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface GeneratedQuestion {
  id: string;
  type: "text" | "mcq" | "code";
  text: string;
  weight: number;
  keywords: string[];
  maxLength?: number | null;

  choices?: {
    id: string;
    text: string;
  }[];

  correctChoiceId?: string;

  starterCode?: string;

  testCases?: {
    input: string;
    expectedStdout: string;
  }[];
}

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

const SCHEDULED_INTERVIEWS_KEY_PREFIX =
  "vmx_company_scheduled_interviews";

export function NovaConsole({
  className,
  companyUserId,
}: {
  className?: string;
  companyUserId: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [status, setStatus] =
    useState<NovaConversationStatus>({
      state: "idle",
      expression: "neutral",
      pulse: 0,
    });

  const [listening, setListening] =
    useState(false);

  const [micSupported, setMicSupported] =
    useState(false);

  const [showQuestionGenerator, setShowQuestionGenerator] =
    useState(false);

  const [questionGeneratorConfig, setQuestionGeneratorConfig] =
    useState<CompanyQuestionGeneratorConfig>({});

  /*
   * Every new Nova generation command gets
   * a fresh generator instance.
   */
  const [generatorInstanceKey, setGeneratorInstanceKey] =
    useState(0);

  const [generationStatus, setGenerationStatus] =
    useState<
      "idle" |
      "generating" |
      "ready" |
      "error"
    >("idle");

  const [generatedQuestions, setGeneratedQuestions] =
    useState<GeneratedQuestion[]>([]);

  const [assessmentTitle, setAssessmentTitle] =
    useState("Nova AI Interview Assessment");

  const [publishing, setPublishing] =
    useState(false);

  /*
   * Company HR interview scheduling state.
   *
   * The current project does not expose a calendar/interview
   * persistence function, so scheduled interviews are kept in
   * localStorage for now. This makes the HR workflow functional
   * immediately without pretending a calendar backend exists.
   */
  const [showSchedulePanel, setShowSchedulePanel] =
    useState(false);

  const [scheduledInterviews, setScheduledInterviews] =
    useState<ScheduledInterview[]>(() => {
      if (typeof window === "undefined") {
        return [];
      }

      try {
        const storageKey =
          `${SCHEDULED_INTERVIEWS_KEY_PREFIX}:${companyUserId.trim()}`;

        const stored = window.localStorage.getItem(
          storageKey,
        );

        if (!stored) {
          return [];
        }

        const parsed = JSON.parse(stored);

        return Array.isArray(parsed)
          ? parsed
          : [];
      } catch {
        return [];
      }
    });

  const [candidateName, setCandidateName] =
    useState("");

  const [candidateEmail, setCandidateEmail] =
    useState("");

  const [interviewRole, setInterviewRole] =
    useState("");

  const [interviewDate, setInterviewDate] =
    useState("");

  const [interviewTime, setInterviewTime] =
    useState("");

  const [interviewDuration, setInterviewDuration] =
    useState("30");

  const [interviewNotes, setInterviewNotes] =
    useState("");

  const conversationRef =
    useRef<NovaConversationHandle>(null);

  const senses = useNovaSenses();

  const { status: visionStatus } =
    senses;

  const {
    voices: novaVoices,
    active: activeVoice,
    fellBack,
    setVoice,
  } = useNovaVoice();

  const sensing =
    senses.cameraOn ||
    senses.micOn;

  const handleTapToTalk =
    useCallback(() => {
      conversationRef.current?.toggleMic();
    }, []);

  /*
   * ---------------------------------------------------------
   * PUBLISH GENERATED ASSESSMENT
   * ---------------------------------------------------------
   *
   * This function does NOT generate questions.
   *
   * It takes the questions already generated by Nova,
   * validates them and creates the real assessment.
   */
  const publishGeneratedAssessment =
    useCallback(
      async (): Promise<string> => {
        if (publishing) {
          return "Publishing is already in progress.";
        }

        if (!companyUserId?.trim()) {
          const message =
            "Company account could not be identified.";

          toast.error(message);

          return message;
        }

        if (!generatedQuestions.length) {
          const message =
            "No generated questions are ready. Generate the assessment questions first.";

          toast.error(message);

          setShowQuestionGenerator(true);

          return message;
        }

        setPublishing(true);

        try {
          /*
           * Convert generator questions into the exact
           * structure expected by createAssessment().
           */
          const questions =
            generatedQuestions
              .filter(
                (question) =>
                  typeof question.text ===
                    "string" &&
                  question.text
                    .trim()
                    .length >= 3,
              )
              .map((question) => ({
                type: question.type,

                text:
                  question.text.trim(),

                weight:
                  Number.isFinite(
                    question.weight,
                  ) &&
                  question.weight > 0
                    ? question.weight
                    : 10,

                keywords:
                  Array.isArray(
                    question.keywords,
                  )
                    ? question.keywords
                    : [],

                maxLength:
                  question.maxLength ??
                  null,

                choices:
                  question.choices,

                correctChoiceId:
                  question.correctChoiceId,

                starterCode:
                  question.starterCode,

                testCases:
                  question.testCases,
              }));

          if (!questions.length) {
            throw new Error(
              "The generated assessment contains no valid questions.",
            );
          }

          /*
           * REAL DATABASE CREATION
           */
          const assessment =
            await createAssessment({
              data: {
                companyUserId:
                  companyUserId.trim(),

                title:
                  assessmentTitle.trim() ||
                  "Nova AI Interview Assessment",

                questions,
              },
            });

          console.log(
            "NOVA ASSESSMENT PUBLISHED",
            {
              id: assessment._id,
              code: assessment.code,
              companyUserId:
                assessment.companyUserId,
              title: assessment.title,
              questionCount:
                assessment.questions.length,
            },
          );

          /*
           * Refresh the exact query used by
           * the company Assessments page.
           */
          await queryClient.invalidateQueries({
            queryKey: [
              "company-assessments",
            ],
          });

          await queryClient.refetchQueries({
            queryKey: [
              "company-assessments",
            ],
            type: "all",
          });

          const successMessage =
            `Assessment published successfully. ` +
            `${questions.length} question${
              questions.length === 1
                ? ""
                : "s"
            } are now in Assessments. ` +
            `Code: ${assessment.code}.`;

          /*
           * Tell Nova about the successful
           * publication.
           */
          conversationRef.current?.appendAssistantMessage(
            successMessage,
            true,
          );

          /*
           * Clear the temporary generator state.
           */
          setGeneratedQuestions([]);

          setGenerationStatus(
            "idle",
          );

          setShowQuestionGenerator(
            false,
          );

          toast.success(
            `Assessment published successfully. Code: ${assessment.code}`,
          );

          /*
           * Go to the actual company assessment list.
           */
          await navigate({
            to: "/dashboard/assessments",
          });

          return successMessage;
        } catch (error) {
          console.error(
            "NOVA ASSESSMENT PUBLISH FAILED",
            error,
          );

          const message =
            error instanceof Error
              ? error.message
              : "Failed to publish assessment.";

          toast.error(message);

          setGenerationStatus(
            "error",
          );

          const failureMessage =
            `I could not publish the assessment: ${message}`;

          conversationRef.current?.appendAssistantMessage(
            failureMessage,
            true,
          );

          return failureMessage;
        } finally {
          setPublishing(false);
        }
      },
      [
        companyUserId,
        generatedQuestions,
        assessmentTitle,
        publishing,
        queryClient,
        navigate,
      ],
    );

  /*
   * ---------------------------------------------------------
   * COMPANY HR INTERVIEW SCHEDULER
   * ---------------------------------------------------------
   */
  const handleScheduleInterview = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const name = candidateName.trim();
      const email = candidateEmail.trim();
      const role = interviewRole.trim();

      if (!name) {
        toast.error("Candidate name is required.");
        return;
      }

      if (!email) {
        toast.error("Candidate email is required.");
        return;
      }

      if (!role) {
        toast.error("Job role is required.");
        return;
      }

      if (!interviewDate || !interviewTime) {
        toast.error(
          "Select the interview date and time.",
        );
        return;
      }

      const interview: ScheduledInterview = {
        id: `interview-${Date.now()}`,
        candidateName: name,
        candidateEmail: email,
        role,
        date: interviewDate,
        time: interviewTime,
        duration: interviewDuration,
        notes: interviewNotes.trim(),
        createdAt: Date.now(),
      };

      const next = [
        interview,
        ...scheduledInterviews,
      ];

      setScheduledInterviews(next);

      try {
        const storageKey =
          `${SCHEDULED_INTERVIEWS_KEY_PREFIX}:${companyUserId.trim()}`;

        window.localStorage.setItem(
          storageKey,
          JSON.stringify(next),
        );
      } catch (error) {
        console.warn(
          "Could not persist scheduled interview locally.",
          error,
        );
      }

      toast.success(
        `Interview scheduled for ${name}.`,
      );

      conversationRef.current?.appendAssistantMessage(
        `Interview scheduled for ${name} (${role}) on ${interviewDate} at ${interviewTime}.`,
        true,
      );

      setCandidateName("");
      setCandidateEmail("");
      setInterviewRole("");
      setInterviewDate("");
      setInterviewTime("");
      setInterviewDuration("30");
      setInterviewNotes("");
      setShowSchedulePanel(false);
    },
    [
      candidateName,
      candidateEmail,
      interviewRole,
      interviewDate,
      interviewTime,
      interviewDuration,
      interviewNotes,
      scheduledInterviews,
    ],
  );

  const openSchedulePanel = useCallback(async () => {
  setShowQuestionGenerator(false);
  setShowSchedulePanel(false);

  conversationRef.current?.appendAssistantMessage(
    "Opening the company interview scheduler.",
    true,
  );

  await navigate({
    to: "/dashboard/schedule",
  });
}, [navigate]);

  /*
   * ---------------------------------------------------------
   * COMPANY NOVA COMMAND HANDLER
   * ---------------------------------------------------------
   */
  const handleCompanyCommand =
    useCallback(
      async (
        command: CompanyNovaCommand,
      ): Promise<string | void> => {
        console.log(
          "Nova company command:",
          command,
        );

        /*
         * ---------------------------------------------------
         * GENERATE / CREATE ASSESSMENT
         * ---------------------------------------------------
         */
        if (
          command.type ===
            "generate_questions" ||
          command.type ===
            "create_assessment"
        ) {
          /*
           * Always provide safe defaults.
           *
           * This prevents an incomplete voice/text
           * command from producing an empty generator.
           */
          const role =
            command.role?.trim() ||
            "Software Developer";

          const topic =
            command.topic?.trim() ||
            "Programming";

          const difficulty =
            command.difficulty ??
            "Medium";

          const count = Math.max(
            1,
            Math.min(
              20,
              Number(command.count) ||
                5,
            ),
          );

          const config:
            CompanyQuestionGeneratorConfig =
            {
              role,
              topic,
              difficulty,
              count,
            };

          /*
           * Remove previous questions so
           * an old assessment cannot accidentally
           * be published.
           */
          setGeneratedQuestions([]);

          setGenerationStatus(
            "generating",
          );

          setQuestionGeneratorConfig(
            config,
          );

          /*
           * Force CompanyQuestionGenerator
           * to mount again.
           *
           * This is important when Nova receives
           * multiple commands during the same session.
           */
          setGeneratorInstanceKey(
            (current) =>
              current + 1,
          );

          /*
           * Generate a useful assessment title.
           */
          if (role && topic) {
            setAssessmentTitle(
              `${role} — ${topic} AI Assessment`,
            );
          } else if (role) {
            setAssessmentTitle(
              `${role} AI Interview Assessment`,
            );
          } else if (topic) {
            setAssessmentTitle(
              `${topic} AI Interview Assessment`,
            );
          } else {
            setAssessmentTitle(
              "Nova AI Interview Assessment",
            );
          }

          /*
           * Display the generator.
           */
          setShowQuestionGenerator(
            true,
          );

          console.log(
            "NOVA GENERATION REQUEST",
            {
              role,
              topic,
              difficulty,
              count,
            },
          );

          const message =
            `I'm generating ${count} ${role} question${
              count === 1
                ? ""
                : "s"
            } on ${topic}. ` +
            `I'll show you when they're ready.`;

          /*
           * IMPORTANT:
           * Put Nova's command acknowledgement
           * into the actual conversation.
           */
          conversationRef.current?.appendAssistantMessage(
            message,
            true,
          );

          return message;
        }

        /*
         * ---------------------------------------------------
         * PUBLISH ASSESSMENT
         * ---------------------------------------------------
         *
         * First:
         *
         *   "publish it"
         *
         * gives a confirmation request.
         *
         * Then:
         *
         *   "yes publish it"
         *
         * actually creates the database assessment.
         */
        if (
          command.type ===
          "publish_assessment"
        ) {
          /*
           * Do not allow publishing while
           * generation is still running.
           */
          if (
            generationStatus ===
              "generating" &&
            !generatedQuestions.length
          ) {
            const message =
              "The assessment questions are still being generated. Please wait until Nova says they are ready, then say \"publish it\".";

            toast.info(message);

            conversationRef.current?.appendAssistantMessage(
              message,
              true,
            );

            return message;
          }

          /*
           * No questions available.
           */
          if (
            !generatedQuestions.length
          ) {
            const message =
              "I don't have generated questions ready yet. Ask me to generate the assessment questions first.";

            toast.info(message);

            setShowQuestionGenerator(
              true,
            );

            conversationRef.current?.appendAssistantMessage(
              message,
              true,
            );

            return message;
          }

          /*
           * CONFIRMED publish.
           *
           * Only this branch calls createAssessment().
           */
          if (
            command.confirmed
          ) {
            const result =
              await publishGeneratedAssessment();

            return result;
          }

          /*
           * UNCONFIRMED publish.
           */
          const confirmationMessage =
            `I have ${generatedQuestions.length} ` +
            `question${
              generatedQuestions.length ===
              1
                ? ""
                : "s"
            } ready. ` +
            `Say "yes, publish it" to publish the assessment.`;

          toast.info(
            confirmationMessage,
          );

          conversationRef.current?.appendAssistantMessage(
            confirmationMessage,
            true,
          );

          return confirmationMessage;
        }

        /*
         * ---------------------------------------------------
         * COMPANY HR WORKFLOWS
         * ---------------------------------------------------
         */
        if (
          command.type ===
          "schedule_interview"
        ) {
          openSchedulePanel();

          return "Opening the company interview scheduler.";
        }

        if (
          command.type ===
          "analyze_candidates"
        ) {
          const message =
            "Opening the company candidate pipeline so you can review candidate performance, scores and attempt history.";

          toast.info(message);

          conversationRef.current?.appendAssistantMessage(
            message,
            true,
          );

          await navigate({
            to: "/dashboard/candidates",
          });

          return message;
        }

       if (command.type === "hiring_analytics") {
  const message =
    "Opening hiring analytics. The company dashboard will show assessment volume, candidates tested and average scores.";

  toast.info(message);

  conversationRef.current?.appendAssistantMessage(
    message,
    true,
  );

  await navigate({
    to: "/dashboard/analytics",
  });

  return message;
}

        return;
      },
      [
        generatedQuestions,
        generationStatus,
        publishGeneratedAssessment,
        openSchedulePanel,
        navigate,
      ],
    );

  /*
   * ---------------------------------------------------------
   * RIGHT-SIDE COMPANY ACTION BUTTONS
   * ---------------------------------------------------------
   */
  const handleCompanyAction =
    useCallback(
      (action: {
        type: string;
        label: string;
        description: string;
      }) => {
        console.log("NOVA COMPANY ACTION", action.type);

        if (
          action.type === "generate_questions" ||
          action.type === "create_assessment"
        ) {
          // Close other company tools first.
          setShowSchedulePanel(false);

          // Always start with a clean generator.
          setGeneratedQuestions([]);
          setGenerationStatus("idle");

          const config: CompanyQuestionGeneratorConfig = {
            role: "Software Developer",
            topic: "Programming",
            difficulty: "Medium",
            count: 5,
          };

          setQuestionGeneratorConfig(config);
          setAssessmentTitle(
            action.type === "create_assessment"
              ? "Software Developer — Programming AI Assessment"
              : "Nova AI Interview Assessment",
          );

          // A new key guarantees that the generator's auto-generation
          // effect runs again, even if the user previously opened it.
          setGeneratorInstanceKey((current) => current + 1);
          setShowQuestionGenerator(true);

          conversationRef.current?.appendAssistantMessage(
            action.type === "create_assessment"
              ? "Opening the assessment builder. Nova will prepare 5 questions for a Software Developer role on Programming. You can review, edit and publish them."
              : "Opening the AI question generator. Nova will prepare 5 Software Developer questions on Programming for you to review.",
            true,
          );

          return;
        }

        if (action.type === "analyze_candidates") {
          setShowQuestionGenerator(false);
          setShowSchedulePanel(false);

          void navigate({
            to: "/dashboard/candidates",
          });

          return;
        }

        if (action.type === "schedule_interview") {
          openSchedulePanel();
          return;
        }

        if (action.type === "hiring_analytics") {
          setShowQuestionGenerator(false);
          setShowSchedulePanel(false);

          const message =
            "Opening hiring analytics. The company dashboard will show assessment volume, candidates tested and average scores.";

          conversationRef.current?.appendAssistantMessage(
            message,
            true,
          );

          void navigate({
            to: "/dashboard/analytics",
          });

          return;
        }

        console.warn(
          "Unknown Nova company action:",
          action,
        );
      },
      [navigate, openSchedulePanel],
    );

  /*
   * ---------------------------------------------------------
   * GENERATOR → NOVA CONSOLE STATE BRIDGE
   * ---------------------------------------------------------
   *
   * CompanyQuestionGenerator calls this after
   * successful AI generation.
   */
  const handleSaveDraft =
    useCallback(
      (questions: unknown) => {
        if (
          !Array.isArray(
            questions,
          )
        ) {
          toast.error(
            "Invalid assessment questions.",
          );

          setGenerationStatus(
            "error",
          );

          return;
        }

        const normalized =
          questions.filter(
            (
              question,
            ): question is GeneratedQuestion =>
              typeof question ===
                "object" &&
              question !== null &&
              "text" in question &&
              typeof (
                question as {
                  text?: unknown;
                }
              ).text ===
                "string",
          );

        if (!normalized.length) {
          toast.error(
            "No valid questions were generated.",
          );

          setGenerationStatus(
            "error",
          );

          return;
        }

        /*
         * Store the generated questions.
         *
         * These are the questions that will
         * eventually be sent to createAssessment().
         */
        setGeneratedQuestions(
          normalized,
        );

        setGenerationStatus(
          "ready",
        );

        console.log(
          "NOVA GENERATED QUESTIONS READY",
          {
            count:
              normalized.length,
            questions:
              normalized,
          },
        );

        const readyMessage =
          `${normalized.length} assessment question${
            normalized.length ===
            1
              ? ""
              : "s"
          } are ready. ` +
          `Review them in the generator, then say "publish it" when you're ready.`;

        toast.success(
          `${normalized.length} question${
            normalized.length ===
            1
              ? ""
              : "s"
          } ready for publishing.`,
        );

        /*
         * IMPORTANT:
         * Show the generation result in Nova's
         * actual conversation.
         */
        conversationRef.current?.appendAssistantMessage(
          readyMessage,
          true,
        );
      },
      [],
    );

  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 grid-cols-1 gap-5",
        "lg:grid-cols-[19rem_minmax(0,1fr)_19rem]",
        className,
      )}
    >
      {/* =====================================================
          LEFT — NOVA
          ===================================================== */}
      <div className="card-3d flex flex-col items-center gap-5 rounded-2xl p-5">
        <div className="w-full max-w-[14rem]">
          <Companion
            expression={
              status.expression
            }
            talking={
              status.state ===
              "speaking"
            }
            pulse={
              status.pulse
            }
          />
        </div>

        <div className="text-center">
          <h1 className="font-display text-2xl tracking-[0.2em] text-gradient">
            NOVA
          </h1>

          <p className="mt-1 text-[10px] tracking-[0.22em] text-muted-foreground uppercase sm:text-xs">
            Vision Mentor X · AI
            interview companion
          </p>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-cyber/30 bg-surface/60 px-3 py-1 text-[10px] tracking-[0.22em] uppercase backdrop-blur-md">
          <span className="size-1.5 rounded-full bg-cyber" />

          <span className="text-cyber">
            {stateLabel(
              status.state,
            )}
          </span>

          <span className="text-muted-foreground">
            ·{" "}
            {expressionLabel(
              status.expression,
            )}
          </span>
        </span>

        {novaVoices.length >
          0 && (
          <div className="w-full space-y-1">
            <label
              htmlFor="nova-console-voice-select"
              className="flex items-center gap-1.5 text-[9px] tracking-[0.18em] text-muted-foreground uppercase"
            >
              <Mic2 className="size-3" />

              Nova's voice
            </label>

            <select
              id="nova-console-voice-select"
              value={
                activeVoice
                  ?.voiceURI ??
                ""
              }
              onChange={(event) =>
                setVoice(
                  event.target.value,
                )
              }
              className="w-full rounded-lg border border-cyber/25 bg-surface/60 px-2.5 py-1.5 text-[11px] text-foreground backdrop-blur-md focus:border-cyber focus:outline-none"
            >
              {novaVoices.map(
                (voice) => (
                  <option
                    key={
                      voice.voiceURI
                    }
                    value={
                      voice.voiceURI
                    }
                  >
                    {voiceLabel(
                      voice,
                    )}
                  </option>
                ),
              )}
            </select>

            {fellBack && (
              <p className="text-[10px] text-muted-foreground">
                Preferred voice
                unavailable —
                using{" "}
                {activeVoice
                  ? voiceLabel(
                      activeVoice,
                    )
                  : "the browser default"}
                .
              </p>
            )}
          </div>
        )}

        <div className="grid w-full grid-cols-2 gap-2">
          <div className="chip-3d flex flex-col items-center gap-1 rounded-xl p-2.5">
            <Radio className="size-4 text-cyber" />

            <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
              Voice
            </span>

            <span className="text-[10px] text-muted-foreground">
              {senses.micOn ? "Connected" : "Not connected"}
            </span>
          </div>

          <div className="chip-3d flex flex-col items-center gap-1 rounded-xl p-2.5">
            <Camera className="size-4 text-cyber" />

            <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
              Vision
            </span>

            <span className="text-center text-[10px] leading-tight text-muted-foreground">
              {senses.cameraOn
                ? visionStatus
                    .posture
                    .text
                : "OFFLINE"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            sensing
              ? senses.disable()
              : void senses.enable()
          }
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all",
            sensing
              ? "chip-3d text-muted-foreground"
              : "btn-3d text-primary-foreground",
          )}
        >
          <Camera className="size-3.5" />

          {sensing
            ? "Stop seeing & hearing me"
            : "Let Nova see & hear me"}
        </button>

        {senses.error && (
          <p className="text-[11px] text-destructive">
            {senses.error}
          </p>
        )}

        <NovaDemoPanel />
      </div>

      {/* =====================================================
          CENTRE — NOVA CONVERSATION
          ===================================================== */}
      <div className="card-3d flex min-h-[28rem] flex-col rounded-2xl p-5 lg:min-h-0">
        <NovaConversationPanel
          ref={conversationRef}
          onStatusChange={
            setStatus
          }
          onListeningChange={
            setListening
          }
          onMicSupportedChange={
            setMicSupported
          }
          onCompanyCommand={
            handleCompanyCommand
          }
        />
      </div>

      {/* =====================================================
          RIGHT — COMPANY HIRING COPILOT
          ===================================================== */}
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto pr-1">
        <NovaVoiceControl
          state={status.state}
          listening={listening}
          micSupported={micSupported}
          micLevel={senses.micLevel}
          onTapToTalk={handleTapToTalk}
        />

        {/*
         * The generator is intentionally rendered BEFORE the action cards.
         * This prevents the Generate Questions / Create Assessment result
         * from appearing below the fold and looking like the button failed.
         */}
        {showQuestionGenerator && (
          <div className="card-3d rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.14em] text-foreground uppercase">
                  AI Assessment Generator
                </p>

                <p className="mt-1 text-[10px] text-muted-foreground">
                  {generationStatus === "generating"
                    ? "Nova is generating questions..."
                    : generationStatus === "ready"
                      ? `${generatedQuestions.length} questions ready`
                      : generationStatus === "error"
                        ? "Generation needs attention"
                        : "Configure and generate an assessment"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowQuestionGenerator(false)}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-cyber/10 hover:text-foreground"
                aria-label="Close AI assessment generator"
              >
                <X className="size-4" />
              </button>
            </div>

            <CompanyQuestionGenerator
              key={generatorInstanceKey}
              companyUserId={companyUserId}
              initialConfig={questionGeneratorConfig}
              onClose={() => setShowQuestionGenerator(false)}
              onSaveDraft={handleSaveDraft}
              onQuestionsGenerated={handleSaveDraft}
            />

            {generatedQuestions.length > 0 && (
              <div className="mt-4 rounded-xl border border-cyber/30 bg-cyber/5 p-3">
                <p className="text-xs font-medium text-foreground">
                  {generatedQuestions.length} questions ready
                </p>

                <p className="mt-1 text-[10px] text-muted-foreground">
                  Review the questions above, then publish when ready.
                </p>

                <button
                  type="button"
                  disabled={publishing}
                  onClick={() => void publishGeneratedAssessment()}
                  className="mt-3 w-full rounded-lg bg-cyber px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {publishing ? "Publishing..." : "Publish Assessment"}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="card-3d rounded-2xl p-4">
          <CompanyNovaActions
            onAction={handleCompanyAction}
          />
        </div>

        {showSchedulePanel && (
          <div className="card-3d rounded-2xl p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-cyber" />
                  <p className="text-xs font-semibold tracking-[0.14em] text-foreground uppercase">
                    Interview Scheduler
                  </p>
                </div>

                <p className="mt-1 text-[10px] text-muted-foreground">
                  Schedule and keep track of candidate interviews from the HR workspace.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowSchedulePanel(false)
                }
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-cyber/10 hover:text-foreground"
                aria-label="Close interview scheduler"
              >
                <X className="size-4" />
              </button>
            </div>

            <form
              onSubmit={handleScheduleInterview}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="flex items-center gap-1 text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
                    <UserRound className="size-3" />
                    Candidate
                  </span>

                  <input
                    value={candidateName}
                    onChange={(event) =>
                      setCandidateName(
                        event.target.value,
                      )
                    }
                    placeholder="Candidate name"
                    className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs outline-none transition-colors focus:border-cyber/60"
                  />
                </label>

                <label className="space-y-1">
                  <span className="flex items-center gap-1 text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
                    <Mail className="size-3" />
                    Email
                  </span>

                  <input
                    type="email"
                    value={candidateEmail}
                    onChange={(event) =>
                      setCandidateEmail(
                        event.target.value,
                      )
                    }
                    placeholder="candidate@company.com"
                    className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs outline-none transition-colors focus:border-cyber/60"
                  />
                </label>
              </div>

              <label className="space-y-1">
                <span className="flex items-center gap-1 text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
                  <BriefcaseBusiness className="size-3" />
                  Role
                </span>

                <input
                  value={interviewRole}
                  onChange={(event) =>
                    setInterviewRole(
                      event.target.value,
                    )
                  }
                  placeholder="Frontend Developer"
                  className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs outline-none transition-colors focus:border-cyber/60"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
                    Date
                  </span>

                  <input
                    type="date"
                    value={interviewDate}
                    onChange={(event) =>
                      setInterviewDate(
                        event.target.value,
                      )
                    }
                    className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs outline-none transition-colors focus:border-cyber/60"
                  />
                </label>

                <label className="space-y-1">
                  <span className="flex items-center gap-1 text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
                    <Clock3 className="size-3" />
                    Time
                  </span>

                  <input
                    type="time"
                    value={interviewTime}
                    onChange={(event) =>
                      setInterviewTime(
                        event.target.value,
                      )
                    }
                    className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs outline-none transition-colors focus:border-cyber/60"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
                    Duration
                  </span>

                  <select
                    value={interviewDuration}
                    onChange={(event) =>
                      setInterviewDuration(
                        event.target.value,
                      )
                    }
                    className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs outline-none transition-colors focus:border-cyber/60"
                  >
                    <option value="15">
                      15 min
                    </option>
                    <option value="30">
                      30 min
                    </option>
                    <option value="45">
                      45 min
                    </option>
                    <option value="60">
                      60 min
                    </option>
                    <option value="90">
                      90 min
                    </option>
                  </select>
                </label>
              </div>

              <label className="space-y-1">
                <span className="text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
                  Interview notes
                </span>

                <textarea
                  value={interviewNotes}
                  onChange={(event) =>
                    setInterviewNotes(
                      event.target.value,
                    )
                  }
                  rows={3}
                  placeholder="Panel members, interview focus, notes..."
                  className="w-full resize-none rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs outline-none transition-colors focus:border-cyber/60"
                />
              </label>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyber px-3 py-2.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <CalendarDays className="size-3.5" />
                Schedule Interview
              </button>
            </form>

            {scheduledInterviews.length >
              0 && (
              <div className="mt-4 border-t border-border/60 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-foreground uppercase">
                    Scheduled
                  </p>

                  <span className="rounded-full bg-cyber/10 px-2 py-0.5 text-[9px] text-cyber">
                    {scheduledInterviews.length}
                  </span>
                </div>

                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {scheduledInterviews.map(
                    (interview) => (
                      <div
                        key={interview.id}
                        className="rounded-lg border border-border/60 bg-background/40 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">
                              {
                                interview.candidateName
                              }
                            </p>

                            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                              {interview.role}
                            </p>
                          </div>

                          <CheckCircle2 className="size-3.5 shrink-0 text-emerald" />
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-cyber/10 px-2 py-0.5 text-[9px] text-cyber">
                            {interview.date}
                          </span>

                          <span className="rounded-full bg-cyber/10 px-2 py-0.5 text-[9px] text-cyber">
                            {interview.time}
                          </span>

                          <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground">
                            {interview.duration} min
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}