export interface NovaTurn {
  role: "user" | "assistant";
  text: string;
}

export interface StreamNovaReplyOptions {
  history: NovaTurn[];
  interviewerMode: boolean;
  onChunk: (fullText: string, chunk: string) => void;
  signal?: AbortSignal;
}

/**
 * Streams a Nova reply as plain text from the app's AI route.
 * Used by the cockpit conversation, which renders its own bubbles.
 */
export async function streamNovaReply({
  history,
  interviewerMode,
  onChunk,
  signal,
}: StreamNovaReplyOptions): Promise<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      plain: true,
      interviewerMode,
      messages: history.map((turn, index) => ({
        id: `${turn.role}-${index}`,
        role: turn.role,
        parts: [{ type: "text", text: turn.text }],
      })),
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(
      response.status === 429
        ? "Nova is rate limited — try again in a moment."
        : response.status === 402
          ? "AI credits are exhausted. Add credits to keep chatting."
          : "Nova could not answer right now.",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (!chunk) continue;
    full += chunk;
    onChunk(full, chunk);
  }
  return full.trim();
}
