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
import { detectCompanyCommand } from "@/lib/nova/company-command";
import type { CompanyNovaCommand } from "@/lib/nova/company-command";
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
  onStatusChange?: (status: NovaConversationStatus) => void;
  onListeningChange?: (listening: boolean) => void;
  onMicSupportedChange?: (supported: boolean) => void;
  onCompanyCommand?: (
    command: CompanyNovaCommand,
  ) => void | string | Promise<void | string>;
  className?: string;
}

function formatTime(at: number) {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const [messages, setMessages] = useState<NovaConsoleMessage[]>(
    () => [
      {
        id: nextId(),
        role: "assistant",
        text:
          "Hi, I'm Nova — your AI interview companion. Ask me anything about Vision Mentor X, or press the mic to talk.",
        at: Date.now(),
      },
    ],
  );

  const [input, setInput] = useState("");
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const pulse = useRef(0);

  const { active: novaVoice } = useNovaVoice();

  useEffect(() => {
    const el = listRef.current;

    if (!el) return;

    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

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

  async function send(raw: string) {
    const text = raw.trim();

    if (!text || busy) return;

    setInput("");

    /*
     * Detect company hiring commands before sending
     * the message to Nova's normal AI conversation.
     *
     * Normal conversation is NOT interrupted.
     */
    const companyCommand = detectCompanyCommand(text);

    if (companyCommand.type !== "unknown") {
      setMessages((previous) => [
        ...previous,
        {
          id: nextId(),
          role: "user",
          text,
          at: Date.now(),
        },
      ]);

      const commandResponse = await onCompanyCommand?.(
        companyCommand,
      );

      if (typeof commandResponse === "string" && commandResponse.trim()) {
        setMessages((previous) => [
          ...previous,
          {
            id: nextId(),
            role: "assistant",
            text: commandResponse,
            at: Date.now(),
          },
        ]);
      }

      return;
    }

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
    report("thinking", "thinking");

    const replyId = nextId();
    let started = false;

    try {
      const full = await streamNovaReply({
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

            report("speaking", "happy");
          } else {
            setMessages((previous) =>
              previous.map((message) =>
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

      const expression = analyzeExpression(
        full,
        "neutral",
      );

      if (!muted && full) {
        report("speaking", "happy");

        speakWithVoice(
          speechText(full),
          novaVoice,
          {
            onBoundary: () =>
              report("speaking", "happy"),

            onEnd: () =>
              report("idle", expression),
          },
        );
      } else {
        report("idle", expression);
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

      report("idle", "confused");
    } finally {
      setBusy(false);
    }
  }

  const {
    supported: micSupported,
    listening,
    start: startListening,
    cancel: cancelListening,
  } = useSpeechRecognition({
    onResult: (transcript) =>
      void send(transcript),

    onInterim: setInput,

    lang: novaVoice?.lang || "en-GB",
  });

  useEffect(() => {
    onListeningChange?.(listening);

    if (listening) {
      report("listening", "neutral");
    }
  }, [listening]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onMicSupportedChange?.(micSupported);
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

    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }

    setInput("");
    startListening();
  }

  useImperativeHandle(ref, () => ({
    toggleMic,
  }));

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
        {messages.map((message) => (
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
              {formatTime(message.at)}
            </span>
          </div>
        ))}

        {busy &&
          messages[messages.length - 1]?.role ===
            "user" && (
            <div className="flex items-start">
              <div className="chip-3d flex items-center gap-1 rounded-2xl px-4 py-2.5 text-sm text-muted-foreground">
                <span className="animate-companion-think inline-block size-1.5 rounded-full bg-cyber" />

                <span className="animate-companion-think inline-block size-1.5 rounded-full bg-cyber [animation-delay:0.15s]" />

                <span className="animate-companion-think inline-block size-1.5 rounded-full bg-cyber [animation-delay:0.3s]" />
              </div>
            </div>
          )}
      </div>

      {/* Chat input */}
      <form
        onSubmit={handleSubmit}
        className="mt-3 flex items-center gap-2 rounded-2xl border border-cyber/25 bg-surface/60 p-2 shadow-[0_18px_40px_-24px_var(--cyber)] backdrop-blur-md"
      >
        {/* Mute */}
        <button
          type="button"
          onClick={() =>
            setMuted((value) => !value)
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
            setInput(event.currentTarget.value)
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
          disabled={!input.trim() || busy}
          className="btn-3d inline-flex size-9 shrink-0 items-center justify-center rounded-full text-primary-foreground disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
});