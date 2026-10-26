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

  /**
   * Allows NovaConsole to inject an assistant message
   * directly into the Nova conversation.
   *
   * Used for:
   * - generated assessment questions
   * - generation status
   * - publish status
   * - company assessment results
   */
  appendAssistantMessage: (
    text: string,
    speak?: boolean,
  ) => void;
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
   * Keep the conversation scrolled to
   * the newest message.
   */
  useEffect(() => {
    const el = listRef.current;

    if (!el) return;

    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  /*
   * Stop any Nova speech when this
   * component is unmounted.
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

  /**
   * Add an assistant message directly
   * into Nova's visible conversation.
   *
   * This is the bridge used by NovaConsole:
   *
   * AI Assessment Generator
   *          ↓
   * generatedQuestions
   *          ↓
   * appendAssistantMessage()
   *          ↓
   * Nova conversation
   */
  function appendAssistantMessage(
    text: string,
    speak = true,
  ) {
    const clean = text.trim();

    if (!clean) return;

    /*
     * First add the message to the visible
     * Nova conversation.
     */
    setMessages((previous) => [
      ...previous,
      {
        id: nextId(),
        role: "assistant",
        text: clean,
        at: Date.now(),
      },
    ]);

    /*
     * Determine Nova's expression from
     * the message content.
     */
    const expression =
      analyzeExpression(
        clean,
        "neutral",
      );

    /*
     * Respect the mute setting and make sure
     * browser APIs are available.
     */
    const shouldSpeak =
      speak &&
      !muted &&
      typeof window !== "undefined";

    if (!shouldSpeak) {
      report(
        "idle",
        expression,
      );

      return;
    }

    /*
     * Stop any previous speech before
     * Nova speaks the new message.
     *
     * This prevents overlapping voice output
     * when generation/publishing messages arrive
     * quickly.
     */
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    report(
      "speaking",
      "happy",
    );

    /*
     * Speak the assistant message using
     * Nova's configured voice.
     */
    speakWithVoice(
      speechText(clean),
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
  }

  /**
   * Expose the microphone controller and
   * assistant-message injection API to
   * NovaConsole.
   */
  useImperativeHandle(
    ref,
    () => ({
      toggleMic,
      appendAssistantMessage,
    }),
  );

  /**
   * Send a message to Nova.
   */
  async function send(raw: string) {
    const text = raw.trim();

    if (!text || busy) {
      return;
    }

    /*
     * -------------------------------------------------------
     * COMPANY COMMAND DETECTION
     * -------------------------------------------------------
     *
     * Examples:
     *
     * Generate 5 React questions
     * Create a frontend assessment
     * Publish it
     * Yes publish it
     *
     * These commands are handled by NovaConsole.
     */
    const companyCommand =
      detectCompanyCommand(text);

    if (
      companyCommand.type !==
      "unknown"
    ) {
      setInput("");

      /*
       * Show the user's company command
       * inside the Nova conversation.
       */
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
       * Pass the command to NovaConsole.
       *
       * NovaConsole is responsible for:
       *
       * command
       *    ↓
       * assessment generator
       *    ↓
       * generated questions
       *    ↓
       * publish
       */
      onCompanyCommand?.(
        companyCommand,
      );

      /*
       * Company commands must NOT be sent
       * through the normal Nova AI endpoint.
       */
      return;
    }

    /*
     * -------------------------------------------------------
     * NORMAL NOVA CHAT
     * -------------------------------------------------------
     */

    setInput("");

    /*
     * Build the conversation history for
     * the normal Nova AI response.
     */
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

    /*
     * Immediately display the user's message.
     */
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
      /*
       * Stream the normal Nova response.
       */
      const full =
        await streamNovaReply({
          history,
          interviewerMode: false,

          onChunk: (fullText) => {
            /*
             * First chunk creates the assistant
             * message.
             */
            if (!started) {
              started = true;

              setMessages(
                (previous) => [
                  ...previous,
                  {
                    id: replyId,
                    role: "assistant",
                    text: fullText,
                    at: Date.now(),
                  },
                ],
              );

              report(
                "speaking",
                "happy",
              );
            } else {
              /*
               * Following chunks update the
               * existing assistant message.
               */
              setMessages(
                (previous) =>
                  previous.map(
                    (message) =>
                      message.id ===
                      replyId
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

      /*
       * Analyze Nova's final expression.
       */
      const expression =
        analyzeExpression(
          full,
          "neutral",
        );

      /*
       * Speak the normal Nova response.
       */
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
      /*
       * Display normal Nova errors
       * inside the conversation.
       */
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
   * Speech recognition / microphone.
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

  /*
   * Report microphone listening state
   * to NovaConsole.
   */
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
  }, [listening]);

  /*
   * Report microphone support state
   * to NovaConsole.
   */
  useEffect(() => {
    onMicSupportedChange?.(
      micSupported,
    );
  }, [
    micSupported,
    onMicSupportedChange,
  ]);

  /*
   * Toggle microphone.
   */
  function toggleMic() {
    if (listening) {
      cancelListening();
      setInput("");

      return;
    }

    /*
     * Stop current Nova speech before
     * starting microphone input.
     */
    if (
      typeof window !== "undefined"
    ) {
      window.speechSynthesis?.cancel();
    }

    setInput("");

    startListening();
  }

  /*
   * Submit text input.
   */
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
      {/* Conversation header */}
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

        {/* Normal Nova thinking indicator */}
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
          onClick={() => {
            const nextMuted = !muted;
            setMuted(nextMuted);

            if (
              typeof window === "undefined" ||
              !("speechSynthesis" in window)
            ) {
              return;
            }

            const synthesis = window.speechSynthesis;

            if (nextMuted && (synthesis.speaking || synthesis.pending)) {
              synthesis.pause();
              report("idle", "neutral");
            } else if (!nextMuted && synthesis.paused) {
              synthesis.resume();
              report("speaking", "happy");
            }
          }}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-cyber"
          aria-pressed={muted}
          aria-label={muted ? "Unmute Nova's voice" : "Mute Nova's voice"}
          title={muted ? "Unmute Nova's voice" : "Mute Nova's voice"}
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
            aria-pressed={
              listening
            }
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