import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from "react";
import {
  MessageSquareText,
  Mic,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";

import {
  streamNovaReply,
  type NovaTurn,
} from "@/lib/nova/stream-reply";

import {
  analyzeExpression,
  type NovaExpression,
  type NovaState,
} from "@/lib/nova/expression";

import {
  speakWithVoice,
  speechText,
  useNovaVoice,
} from "@/lib/nova/nova-voice";

import { useSpeechRecognition } from "@/hooks/use-speech-recognition";

import {
  detectCompanyCommand,
  type CompanyNovaCommand,
} from "@/lib/nova/company-command";

import { cn } from "@/lib/utils";

export interface NovaConsoleMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
}

export interface NovaConversationStatus {
  state: NovaState;
  expression: NovaExpression;
  pulse: number;
}

export interface NovaConversationHandle {
  toggleMic: () => void;
}

export interface NovaConversationPanelProps {
  onStatusChange?: (
    status: NovaConversationStatus,
  ) => void;

  onListeningChange?: (
    listening: boolean,
  ) => void;

  onMicSupportedChange?: (
    supported: boolean,
  ) => void;

  onCompanyCommand?: (
    command: CompanyNovaCommand,
  ) => void;

  className?: string;
}

function formatTime(at: number) {
  return new Date(at).toLocaleTimeString(
    undefined,
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

let msgCounter = 0;

const nextId = () =>
  `nova-msg-${Date.now()}-${msgCounter++}`;

export const NovaConversationPanel = forwardRef<
  NovaConversationHandle,
  NovaConversationPanelProps
>(function NovaConversationPanel(
  {
    onStatusChange,
    onListeningChange,
    onMicSupportedChange,
    onCompanyCommand,
    className,
  },
  ref,
) {
  const [messages, setMessages] =
    useState<NovaConsoleMessage[]>(() => [
      {
        id: nextId(),
        role: "assistant",
        text:
          "Hi, I'm Nova — your AI interview companion. Ask me anything about Vision Mentor X, or press the mic to talk.",
        at: Date.now(),
      },
    ]);

  const [input, setInput] = useState("");
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);

  const listRef =
    useRef<HTMLDivElement>(null);

  const pulse = useRef(0);

  const { active: novaVoice } =
    useNovaVoice();

  /*
   * Automatically keep the newest message visible.
   */
  useEffect(() => {
    const element = listRef.current;

    if (!element) return;

    element.scrollTop = element.scrollHeight;
  }, [messages, busy]);

  /*
   * Stop Nova speech when the component unmounts.
   */
  useEffect(() => {
    return () => {
      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function report(
    state: NovaState,
    expression: NovaExpression,
  ) {
    pulse.current += 1;

    onStatusChange?.({
      state,
      expression,
      pulse: pulse.current,
    });
  }

  /*
   * ============================================================
   * SEND MESSAGE
   * ============================================================
   *
   * There are two paths:
   *
   * 1. Company command
   *    "generate 5 React questions"
   *    "create assessment"
   *    "publish it"
   *
   *    These are intercepted locally and sent to NovaConsole.
   *
   * 2. Normal conversation
   *    Everything else goes to /api/chat.
   */
  async function send(raw: string) {
    const text = raw.trim();

    if (!text || busy) {
      return;
    }

    /*
     * ----------------------------------------------------------
     * COMPANY COMMAND
     * ----------------------------------------------------------
     */
    const companyCommand =
      detectCompanyCommand(text);

    if (companyCommand.type !== "unknown") {
      /*
       * Show the command in the conversation immediately.
       */
      setInput("");

      setMessages((previous) => [
        ...previous,
        {
          id: nextId(),
          role: "user",
          text,
          at: Date.now(),
        },
      ]);

      /*
       * Send command to NovaConsole.
       */
      onCompanyCommand?.(
        companyCommand,
      );

      /*
       * Give Nova a small local acknowledgement.
       *
       * This avoids making another AI request just to say
       * "I'll do that".
       */
      const acknowledgement =
        getCommandAcknowledgement(
          companyCommand,
        );

      if (acknowledgement) {
        const replyId = nextId();

        setMessages((previous) => [
          ...previous,
          {
            id: replyId,
            role: "assistant",
            text: acknowledgement,
            at: Date.now(),
          },
        ]);

        if (!muted) {
          report(
            "speaking",
            "happy",
          );

          speakWithVoice(
            speechText(acknowledgement),
            novaVoice,
            {
              onBoundary: () =>
                report(
                  "speaking",
                  "happy",
                ),

              onEnd: () =>
                report(
                  "idle",
                  "happy",
                ),
            },
          );
        } else {
          report(
            "idle",
            "happy",
          );
        }
      }

      /*
       * IMPORTANT:
       * Do not send company commands to /api/chat.
       */
      return;
    }

    /*
     * ----------------------------------------------------------
     * NORMAL NOVA CHAT
     * ----------------------------------------------------------
     */

    setInput("");

    const history: NovaTurn[] = [
      ...messages.map((message) => ({
        role: message.role,
        text: message.text,
      })),
      {
        role: "user",
        text,
      },
    ];

    setMessages((previous) => [
      ...previous,
      {
        id: nextId(),
        role: "user",
        text,
        at: Date.now(),
      },
    ]);

    setBusy(true);

    report(
      "thinking",
      "thinking",
    );

    const replyId = nextId();

    let started = false;

    try {
      const full =
        await streamNovaReply({
          history,
          interviewerMode: false,

          onChunk: (fullText) => {
            if (!started) {
              started = true;

              setMessages((previous) => [
                ...previous,
                {
                  id: replyId,
                  role: "assistant",
                  text: fullText,
                  at: Date.now(),
                },
              ]);

              report(
                "speaking",
                "happy",
              );
            } else {
              setMessages((previous) =>
                previous.map(
                  (message) =>
                    message.id === replyId
                      ? {
                          ...message,
                          text: fullText,
                        }
                      : message,
                ),
              );
            }
          },
        });

      const expression =
        analyzeExpression(
          full,
          "neutral",
        );

      if (!muted && full) {
        report(
          "speaking",
          "happy",
        );

        speakWithVoice(
          speechText(full),
          novaVoice,
          {
            onBoundary: () =>
              report(
                "speaking",
                "happy",
              ),

            onEnd: () =>
              report(
                "idle",
                expression,
              ),
          },
        );
      } else {
        report(
          "idle",
          expression,
        );
      }
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          id: nextId(),
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "Nova could not answer right now.",
          at: Date.now(),
        },
      ]);

      report(
        "idle",
        "confused",
      );
    } finally {
      setBusy(false);
    }
  }

  /*
   * Speech recognition.
   */
  const {
    supported: micSupported,
    listening,
    start: startListening,
    cancel: cancelListening,
  } = useSpeechRecognition({
    onResult: (transcript) =>
      void send(transcript),

    onInterim: setInput,

    lang:
      novaVoice?.lang ||
      "en-GB",
  });

  useEffect(() => {
    onListeningChange?.(
      listening,
    );

    if (listening) {
      report(
        "listening",
        "neutral",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  useEffect(() => {
    onMicSupportedChange?.(
      micSupported,
    );
  }, [
    micSupported,
    onMicSupportedChange,
  ]);

  function toggleMic() {
    if (listening) {
      cancelListening();
      setInput("");
      return;
    }

    if (
      typeof window !== "undefined"
    ) {
      window.speechSynthesis?.cancel();
    }

    setInput("");

    startListening();
  }

  useImperativeHandle(
    ref,
    () => ({
      toggleMic,
    }),
  );

  function handleSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    void send(input);
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        className,
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2 border-b border-border/60 pb-3">
        <MessageSquareText className="size-4 text-cyber" />

        <h2 className="font-display text-sm tracking-[0.24em] uppercase">
          Conversation
        </h2>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2"
      >
        {messages.map(
          (message) => (
            <div
              key={message.id}
              className={cn(
                "flex flex-col gap-1",
                message.role === "user"
                  ? "items-end"
                  : "items-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "chip-3d text-foreground",
                )}
              >
                {message.text}
              </div>

              <span className="px-1 text-[10px] text-muted-foreground">
                {formatTime(
                  message.at,
                )}
              </span>
            </div>
          ),
        )}

        {/* AI thinking indicator */}
        {busy &&
          messages[
            messages.length - 1
          ]?.role === "user" && (
            <div className="flex items-start">
              <div className="chip-3d flex items-center gap-1 rounded-2xl px-4 py-2.5 text-sm text-muted-foreground">
                <span className="animate-companion-think inline-block size-1.5 rounded-full bg-cyber" />

                <span className="animate-companion-think inline-block size-1.5 rounded-full bg-cyber [animation-delay:0.15s]" />

                <span className="animate-companion-think inline-block size-1.5 rounded-full bg-cyber [animation-delay:0.3s]" />
              </div>
            </div>
          )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="mt-3 flex items-center gap-2 rounded-2xl border border-cyber/25 bg-surface/60 p-2 shadow-[0_18px_40px_-24px_var(--cyber)] backdrop-blur-md"
      >
        {/* Voice mute */}
        <button
          type="button"
          onClick={() =>
            setMuted(
              (value) => !value,
            )
          }
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-cyber"
          aria-pressed={muted}
          title={
            muted
              ? "Unmute Nova's voice"
              : "Mute Nova's voice"
          }
        >
          {muted ? (
            <VolumeX className="size-4" />
          ) : (
            <Volume2 className="size-4" />
          )}
        </button>

        {/* Text input */}
        <input
          value={input}
          onChange={(event) =>
            setInput(
              event.currentTarget.value,
            )
          }
          placeholder="Ask anything or press the mic to talk…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />

        {/* Microphone */}
        {micSupported && (
          <button
            type="button"
            onClick={toggleMic}
            aria-pressed={listening}
            title={
              listening
                ? "Stop listening"
                : "Talk to Nova"
            }
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-all",
              listening
                ? "bg-destructive text-destructive-foreground animate-pulse"
                : "chip-3d text-cyber",
            )}
          >
            <Mic className="size-4" />
          </button>
        )}

        {/* Send */}
        <button
          type="submit"
          disabled={
            !input.trim() ||
            busy
          }
          className="btn-3d inline-flex size-9 shrink-0 items-center justify-center rounded-full text-primary-foreground disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
});

/*
 * ============================================================
 * LOCAL COMPANY COMMAND ACKNOWLEDGEMENTS
 * ============================================================
 *
 * These do NOT call the AI API.
 * They make command execution feel immediate.
 */
function getCommandAcknowledgement(
  command: CompanyNovaCommand,
): string {
  switch (command.type) {
    case "generate_questions":
      return "Got it. I'm preparing the assessment questions.";

    case "create_assessment":
      return "Got it. I'm preparing the assessment.";

    case "publish_assessment":
      return "Confirmed. I'm publishing the assessment now.";

    case "schedule_interview":
      return "Got it. I'll prepare the interview scheduling action.";

    case "analyze_candidates":
      return "Got it. I'll prepare the candidate analysis.";

    case "hiring_analytics":
      return "Got it. I'll prepare the hiring analytics.";

    default:
      return "";
  }
}