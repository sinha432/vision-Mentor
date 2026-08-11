import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { NovaExpression, NovaState } from "@/lib/nova/expression";
import { speakWithVoice, useNovaVoice } from "@/lib/nova/nova-voice";
import { cn } from "@/lib/utils";

export interface NovaChatStatus {
  state: NovaState;
  expression: NovaExpression;
  pulse: number;
}

export interface NovaChatProps {
  interviewerMode?: boolean;
  /** reports Nova's live state so an avatar elsewhere can react */
  onStatusChange?: (status: NovaChatStatus) => void;
  suggestions?: string[];
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

function messageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

export function NovaChat({
  interviewerMode = false,
  onStatusChange,
  suggestions = [
    "What can this app do?",
    "How does the vision feed work?",
    "Give me a mock interview question",
  ],
  className,
  emptyTitle = "Ask Nova anything",
  emptyDescription = "App questions, interview coaching, or general knowledge.",
}: NovaChatProps) {
  const [text, setText] = useState("");
  const [muted, setMuted] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pulse = useRef(0);
  const spokenId = useRef<string | null>(null);
  const { active: novaVoice } = useNovaVoice();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ interviewerMode }),
      }),
    [interviewerMode],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    onError: (error) => toast.error(error.message || "Nova could not answer right now."),
  });

  const {
    supported: micSupported,
    listening,
    start: startListening,
    stop: stopListening,
    cancel: cancelListening,
  } = useSpeechRecognition({
    onResult: (transcript) => setText((current) => (current.trim() ? `${current.trim()} ${transcript}` : transcript)),
    onInterim: (transcript) => setText(transcript),
    lang: novaVoice?.lang || "en-US",
  });

  const busy = status === "submitted" || status === "streaming";
  const last = messages[messages.length - 1];
  const streamingLength = last?.role === "assistant" ? messageText(last).length : 0;

  // speak Nova's finished reply aloud with the selected voice, once per message
  useEffect(() => {
    if (muted || status !== "ready" || !last || last.role !== "assistant") return;
    if (spokenId.current === last.id) return;
    const text = messageText(last);
    if (!text) return;
    spokenId.current = last.id;
    speakWithVoice(text, novaVoice);
  }, [status, last, muted, novaVoice]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  // keep the composer focused during normal chat use
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  // drive the 3D companion
  useEffect(() => {
    if (!onStatusChange) return;
    pulse.current += 1;
    const state: NovaState =
      status === "submitted" ? "thinking" : status === "streaming" ? "speaking" : "idle";
    const expression: NovaExpression =
      status === "submitted" ? "thinking" : status === "streaming" ? "happy" : "neutral";
    onStatusChange({ state, expression, pulse: pulse.current });
  }, [status, streamingLength, onStatusChange]);

  const submit = (message: PromptInputMessage) => {
    const value = (message.text ?? text).trim();
    if (!value || busy) return;
    setText("");
    stopListening();
    void sendMessage({ text: value });
  };

  const toggleVoiceInput = () => {
    if (!micSupported) return;
    if (listening) {
      cancelListening();
      return;
    }
    setText("");
    startListening();
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <ConversationEmptyState title={emptyTitle} description={emptyDescription} />
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void sendMessage({ text: s })}
                    className="rounded-full border border-cyber/30 bg-surface/60 px-3 py-1.5 text-xs text-cyber transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-6px_var(--cyber)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent
                  className={cn(
                    message.role === "assistant" && "bg-transparent p-0 text-foreground",
                    message.role === "user" && "bg-primary text-primary-foreground",
                  )}
                >
                  <MessageResponse>{messageText(message)}</MessageResponse>
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && <Shimmer className="text-sm">Nova is thinking…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput
        onSubmit={submit}
        className="mt-3 border-cyber/25 shadow-[0_18px_40px_-24px_var(--cyber)]"
      >
        <PromptInputTextarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          placeholder={interviewerMode ? "Answer Nova's question…" : "Ask Nova anything…"}
        />
        <PromptInputFooter className="justify-between gap-2">
          <div className="flex items-center gap-2">
            {micSupported && (
              <button
                type="button"
                onClick={toggleVoiceInput}
                aria-label={listening ? "Stop listening" : "Speak to Nova"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] transition-colors",
                  listening
                    ? "bg-destructive text-destructive-foreground animate-pulse"
                    : "text-muted-foreground hover:text-cyber",
                )}
                title={listening ? "Stop listening" : "Speak to Nova"}
              >
                {listening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
                {listening ? "Listening" : "Mic"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setMuted((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-cyber"
              aria-pressed={muted}
              title={muted ? "Unmute Nova's voice" : "Mute Nova's voice"}
            >
              {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
              {muted ? "Muted" : "Voice on"}
            </button>
          </div>
          <PromptInputSubmit status={status} disabled={!text.trim() && !busy} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
