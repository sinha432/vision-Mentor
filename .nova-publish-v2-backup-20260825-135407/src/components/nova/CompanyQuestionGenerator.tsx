import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  CheckCircle2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createAssessment } from "@/lib/assessments.functions";

export interface GeneratedQuestion {
  id: string;
  type: "text" | "mcq" | "code";
  text: string;
  weight: number;
  keywords: string[];
}

export interface CompanyQuestionGeneratorConfig {
  role?: string;
  topic?: string;
  difficulty?: "Easy" | "Medium" | "Hard" | "Mixed";
  count?: number;
}

export interface CompanyQuestionGeneratorProps {
  companyUserId: string;
  onClose?: () => void;
  onSaveDraft?: (questions: GeneratedQuestion[]) => void;

  /**
   * Called immediately after AI questions are generated.
   *
   * NovaConsole uses this to keep the generated questions
   * available for a later "publish it" command without
   * requiring the company user to click Save Draft first.
   */
  onQuestionsGenerated?: (
    questions: GeneratedQuestion[],
  ) => void;

  initialConfig?: CompanyQuestionGeneratorConfig;
}

export function CompanyQuestionGenerator({
  companyUserId,
  onClose,
  onSaveDraft,
  onQuestionsGenerated,
  initialConfig,
}: CompanyQuestionGeneratorProps) {
  const navigate = useNavigate();

  const [role, setRole] = useState(
    initialConfig?.role || "Software Developer",
  );

  const [topic, setTopic] = useState(
    initialConfig?.topic || "Programming",
  );

  const [difficulty, setDifficulty] = useState<
    "Easy" | "Medium" | "Hard" | "Mixed"
  >(initialConfig?.difficulty || "Medium");

  const [count, setCount] = useState(
    String(initialConfig?.count || 5),
  );

  const [questions, setQuestions] = useState<
    GeneratedQuestion[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [showPublishConfirmation, setShowPublishConfirmation] =
    useState(false);

  const [title, setTitle] = useState("");

  /*
   * Update generator fields whenever Nova sends
   * a new configuration.
   */
  useEffect(() => {
    if (!initialConfig) return;

    if (initialConfig.role) {
      setRole(initialConfig.role);
    }

    if (initialConfig.topic) {
      setTopic(initialConfig.topic);
    }

    if (initialConfig.difficulty) {
      setDifficulty(initialConfig.difficulty);
    }

    if (initialConfig.count) {
      setCount(String(initialConfig.count));
    }
  }, [initialConfig]);
  /*
   * Automatically create a useful assessment title.
   */
  useEffect(() => {
    if (!title.trim()) {
      const generatedTitle =
        `${role} - ${topic} Assessment`;

      setTitle(generatedTitle);
    }
  }, [role, topic, title]);

  /*
   * Generate questions from Nova's AI route.
   *
   * IMPORTANT:
   * Once generation succeeds, the questions are immediately
   * sent to NovaConsole through onQuestionsGenerated().
   *
   * This allows:
   *
   *   "Generate React questions"
   *          ↓
   *   questions generated
   *          ↓
   *   "publish it"
   *
   * without requiring Save Draft.
   */
  const generateQuestions = async () => {
    const questionCount = Math.max(
      1,
      Math.min(20, Number(count) || 5),
    );

    setLoading(true);

    try {
      const response = await fetch(
        "/api/company-generate-questions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: role.trim(),
            topic: topic.trim(),
            difficulty,
            count: questionCount,
          }),
        },
      );

      const data: {
        questions?: GeneratedQuestion[];
        error?: string;
      } = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Question generation failed.",
        );
      }

      const generated =
        Array.isArray(data.questions)
          ? data.questions
          : [];

      if (!generated.length) {
        throw new Error(
          "Nova did not generate any questions.",
        );
      }

      /*
       * Store them locally in the generator UI.
       */
      setQuestions(generated);

      /*
       * IMPORTANT:
       * Immediately expose them to NovaConsole.
       *
       * This is what allows the conversational publish
       * workflow to use the generated questions.
       */
      onQuestionsGenerated?.(generated);

      toast.success(
        `${generated.length} questions generated`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to generate questions.";

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  /*
   * Automatically generate questions when Nova sends
   * a command configuration.
   *
   * The ref prevents the same Nova command from triggering
   * generation more than once.
   */
  const autoGeneratedConfigRef = useRef<string>("");

  useEffect(() => {
    if (!initialConfig) return;

    const hasCommandConfig = Boolean(
      initialConfig.role ||
        initialConfig.topic ||
        initialConfig.count ||
        initialConfig.difficulty,
    );

    if (!hasCommandConfig) return;

    const configKey = JSON.stringify({
      role: initialConfig.role ?? "",
      topic: initialConfig.topic ?? "",
      difficulty: initialConfig.difficulty ?? "Medium",
      count: initialConfig.count ?? 5,
    });

    if (autoGeneratedConfigRef.current === configKey) {
      return;
    }

    autoGeneratedConfigRef.current = configKey;

    const timer = window.setTimeout(() => {
      void generateQuestions();
    }, 100);

    return () => window.clearTimeout(timer);
  }, [initialConfig]);

  /*
   * Update an individual generated question.
   */
  const updateQuestion = (
    id: string,
    text: string,
  ) => {
    setQuestions((current) => {
      const updated = current.map((question) =>
        question.id === id
          ? {
              ...question,
              text,
            }
          : question,
      );

      /*
       * Keep NovaConsole synchronized when the company
       * edits a question manually.
       */
      onQuestionsGenerated?.(updated);

      return updated;
    });
  };

  /*
   * Delete a question.
   */
  const deleteQuestion = (id: string) => {
    setQuestions((current) => {
      const updated = current.filter(
        (question) => question.id !== id,
      );

      /*
       * Keep NovaConsole synchronized.
       */
      onQuestionsGenerated?.(updated);

      return updated;
    });
  };

  /*
   * Add a manual question.
   */
  const addQuestion = () => {
    setQuestions((current) => {
      const updated = [
        ...current,
        {
          id: `manual-${Date.now()}`,
          type: "text" as const,
          text: "Write your question here...",
          weight: 10,
          keywords: [],
        },
      ];

      /*
       * Make the new question immediately available
       * to Nova's publish workflow.
       */
      onQuestionsGenerated?.(updated);

      return updated;
    });
  };

  /*
   * Save draft through the existing callback.
   */
  const saveDraft = () => {
    if (!questions.length) {
      toast.error(
        "Generate or add at least one question.",
      );
      return;
    }

    onSaveDraft?.(questions);

    toast.success(
      "Assessment questions saved as draft.",
    );
  };

  /*
   * Validate before publishing.
   */
  const validateQuestions = () => {
    if (!companyUserId.trim()) {
      toast.error(
        "Company account could not be identified.",
      );
      return false;
    }

    if (!title.trim()) {
      toast.error(
        "Enter an assessment title.",
      );
      return false;
    }

    if (!questions.length) {
      toast.error(
        "Generate or add at least one question.",
      );
      return false;
    }

    const invalidQuestion = questions.find(
      (question) =>
        !question.text.trim() ||
        question.text.trim().length < 3,
    );

    if (invalidQuestion) {
      toast.error(
        "Every question must contain valid question text.",
      );
      return false;
    }

    return true;
  };

  /*
   * Open final publish confirmation.
   */
  const requestPublish = () => {
    if (!validateQuestions()) return;

    setShowPublishConfirmation(true);
  };

  /*
   * Publish directly into the company's assessment
   * collection using the existing createAssessment()
   * implementation.
   */
  const publishAssessment = async () => {
    if (!validateQuestions()) {
      setShowPublishConfirmation(false);
      return;
    }

    setPublishing(true);

    try {
      const cleanedQuestions = questions.map(
        (question) => ({
          type: question.type,
          text: question.text.trim(),
          weight:
            Number.isFinite(question.weight) &&
            question.weight > 0
              ? question.weight
              : 10,
          keywords: Array.isArray(
            question.keywords,
          )
            ? question.keywords
            : [],
        }),
      );

      const assessment =
        await createAssessment({
          data: {
            companyUserId,
            title: title.trim(),
            questions: cleanedQuestions,
          },
        });

      toast.success(
        `Assessment published successfully. Code: ${assessment.code}`,
      );

      /*
       * Keep the existing draft callback behavior.
       */
      onSaveDraft?.(questions);

      setShowPublishConfirmation(false);

      /*
       * Move directly to the assessment section.
       */
      await navigate({
        to: "/dashboard/assessments",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not publish assessment.";

      toast.error(message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-cyber" />

            <h2 className="text-lg font-semibold">
              Nova Question Generator
            </h2>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Generate, review, edit and publish
            AI-powered assessment questions.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Close
          </button>
        )}
      </div>

      {/* =====================================================
          ASSESSMENT DETAILS
          ===================================================== */}

      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">
            Assessment title
          </span>

          <input
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cyber"
            placeholder="Frontend Developer Assessment"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">
              Job role
            </span>

            <input
              value={role}
              onChange={(event) =>
                setRole(event.target.value)
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cyber"
              placeholder="Frontend Developer"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">
              Topic
            </span>

            <input
              value={topic}
              onChange={(event) =>
                setTopic(event.target.value)
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cyber"
              placeholder="React"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">
              Difficulty
            </span>

            <select
              value={difficulty}
              onChange={(event) =>
                setDifficulty(
                  event.target.value as
                    | "Easy"
                    | "Medium"
                    | "Hard"
                    | "Mixed",
                )
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cyber"
            >
              <option value="Easy">
                Easy
              </option>

              <option value="Medium">
                Medium
              </option>

              <option value="Hard">
                Hard
              </option>

              <option value="Mixed">
                Mixed
              </option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">
              Number of questions
            </span>

            <select
              value={count}
              onChange={(event) =>
                setCount(event.target.value)
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cyber"
            >
              {[5, 10, 15, 20].map(
                (value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {value}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
      </div>

      {/* =====================================================
          GENERATE
          ===================================================== */}

      <button
        type="button"
        onClick={generateQuestions}
        disabled={loading || publishing}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
          "bg-cyber text-primary-foreground hover:opacity-90",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Nova is generating...
          </>
        ) : (
          <>
            <Sparkles className="size-4" />
            Generate Questions
          </>
        )}
      </button>

      {/* =====================================================
          GENERATED QUESTIONS
          ===================================================== */}

      {questions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Generated Questions
            </h3>

            <span className="text-xs text-muted-foreground">
              {questions.length} questions
            </span>
          </div>

          {questions.map(
            (question, index) => (
              <div
                key={question.id}
                className="rounded-xl border border-border/60 bg-background/50 p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-cyber">
                    Question {index + 1}
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-cyber/10 px-2 py-1 text-[10px] text-cyber">
                      {question.type}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        deleteQuestion(
                          question.id,
                        )
                      }
                      disabled={publishing}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                      title="Delete question"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                <textarea
                  value={question.text}
                  onChange={(event) =>
                    updateQuestion(
                      question.id,
                      event.target.value,
                    )
                  }
                  disabled={publishing}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cyber disabled:cursor-not-allowed disabled:opacity-70"
                />

                {question.keywords.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {question.keywords.map(
                      (keyword) => (
                        <span
                          key={keyword}
                          className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground"
                        >
                          {keyword}
                        </span>
                      ),
                    )}
                  </div>
                )}
              </div>
            ),
          )}

          {/* =================================================
              ACTIONS
              ================================================= */}

          <div className="grid gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={generateQuestions}
              disabled={
                loading || publishing
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs transition-colors hover:border-cyber disabled:opacity-50"
            >
              <RefreshCw className="size-3.5" />
              Regenerate
            </button>

            <button
              type="button"
              onClick={addQuestion}
              disabled={publishing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs transition-colors hover:border-cyber disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              Add Question
            </button>

            <button
              type="button"
              onClick={saveDraft}
              disabled={publishing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs transition-colors hover:border-cyber disabled:opacity-50"
            >
              Save Draft
            </button>

            <button
              type="button"
              onClick={requestPublish}
              disabled={
                publishing ||
                loading ||
                !questions.length
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="size-3.5" />
              Publish
            </button>
          </div>
        </div>
      )}

      {/* =====================================================
          PUBLISH CONFIRMATION
          ===================================================== */}

      {showPublishConfirmation && (
        <div className="rounded-xl border border-cyber/30 bg-cyber/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cyber/10 text-cyber">
              <CheckCircle2 className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-foreground">
                Publish this assessment?
              </h3>

              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Nova has prepared{" "}
                <span className="font-medium text-foreground">
                  {questions.length}
                </span>{" "}
                questions for{" "}
                <span className="font-medium text-foreground">
                  {role}
                </span>
                . After publishing, the assessment
                will appear in your company assessment
                section and can be shared with candidates.
              </p>

              <div className="mt-3 rounded-lg border border-border/60 bg-background/50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Assessment
                </p>

                <p className="mt-1 text-sm font-medium text-foreground">
                  {title}
                </p>

                <p className="mt-1 text-[10px] text-muted-foreground">
                  {difficulty} · {topic} ·{" "}
                  {questions.length} questions
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setShowPublishConfirmation(
                      false,
                    )
                  }
                  disabled={publishing}
                  className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  Review Again
                </button>

                <button
                  type="button"
                  onClick={publishAssessment}
                  disabled={publishing}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyber px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      Confirm & Publish
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          COMPANY ID STATUS
          ===================================================== */}

      {!companyUserId && (
        <p className="text-[11px] text-destructive">
          Company account information is unavailable.
        </p>
      )}
    </div>
  );
}