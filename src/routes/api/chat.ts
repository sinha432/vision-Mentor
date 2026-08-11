import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  generateText,
  streamText,
  type TextStreamPart,
  type ToolSet,
  type UIMessage,
} from "ai";
import {
  createAiGatewayProvider,
  getAiGatewayResponseHeaders,
  getAiGatewayRunId,
  withAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";
import { novaSystemPrompt } from "@/lib/nova/app-knowledge";

type ChatRequestBody = {
  messages?: unknown;
  interviewerMode?: unknown;
  plain?: unknown;
};

type ChatTextPart = { type: "text"; text: string };

function normalizeMessages(raw: unknown): UIMessage[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const normalized = raw.map((message): UIMessage | null => {
    if (!message || typeof message !== "object") {
      return null;
    }

    const candidate = message as Record<string, unknown>;
    const role = typeof candidate.role === "string" ? candidate.role : undefined;

    if (role !== "user" && role !== "assistant" && role !== "system") {
      return null;
    }

    const directText = typeof candidate.text === "string" ? candidate.text : undefined;
    const directContent = typeof candidate.content === "string" ? candidate.content : undefined;

    const rawParts = Array.isArray(candidate.parts) ? candidate.parts : [];
    const textParts: ChatTextPart[] = [];

    for (const part of rawParts) {
      if (!part || typeof part !== "object") {
        continue;
      }

      const item = part as Record<string, unknown>;
      if (item.type === "text" && typeof item.text === "string") {
        textParts.push({ type: "text", text: item.text });
      }
    }

    const partsText = textParts.map((part) => part.text).join("");
    const text = (directText ?? directContent ?? partsText)?.trim();

    if (!text) {
      return null;
    }

    const normalizedMessage: UIMessage = {
      id: String(candidate.id ?? `${role}-${Math.random().toString(36).slice(2, 10)}`),
      role: role as UIMessage["role"],
      parts: [{ type: "text", text }],
    };

    return normalizedMessage;
  });

  return normalized.filter((value): value is UIMessage => value !== null);
}

function extractTextFromMessage(message: UIMessage): string {
  const parts = Array.isArray(message.parts) ? message.parts : [];
  const textParts: string[] = [];

  for (const part of parts) {
    if (part && typeof part === "object" && (part as { type?: unknown }).type === "text") {
      const maybeText = (part as { text?: unknown }).text;
      if (typeof maybeText === "string") {
        textParts.push(maybeText);
      }
    }
  }

  return textParts.join("").trim();
}

function cleanNovaOutputText(value: string): string {
  const lines = value.split(/\r?\n/);
  const cleanedLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const first = line[0];
    if (first === "#" || first === "*" || first === "+" || first === "-" || first === "/") {
      continue;
    }

    cleanedLines.push(line);
  }

  const joined = cleanedLines.join("\n");
  const chars: string[] = [];
  for (const char of joined) {
    if (char === "#" || char === "*" || char === "/") {
      continue;
    }
    chars.push(char);
  }

  return chars.join("").trim();
}

const novaOutputStreamTransform =
  <TOOLS extends ToolSet>() =>
  () =>
    new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(chunk, controller) {
        if (chunk.type === "text-delta") {
          const cleanText = cleanNovaOutputText(chunk.text);
          controller.enqueue({ ...chunk, text: cleanText });
        } else {
          controller.enqueue(chunk);
        }
      },
    });

function extractTextValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractTextValue(item);
      if (nested) return nested;
    }
  }

  if (value && typeof value === "object") {
    for (const key of ["text", "output", "correctedText", "corrected", "result", "message", "content"]) {
      const candidate = (value as Record<string, unknown>)[key];
      const extracted = extractTextValue(candidate);
      if (extracted) return extracted;
    }
  }

  return null;
}

async function tryQuillBotGrammarFix(text: string): Promise<string | null> {
  const endpoint = process.env["QUILLBOT_API_URL"]?.trim();
  const apiKey = process.env["QUILLBOT_API_KEY"]?.trim();

  if (!endpoint || !apiKey) {
    return null;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, mode: "grammar", tone: "natural" }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const corrected = extractTextValue(payload);
    return corrected && corrected.trim() ? corrected.trim() : null;
  } catch {
    return null;
  }
}

async function correctGrammarForChat(
  text: string,
  gateway: ReturnType<typeof createAiGatewayProvider>,
  modelId: string,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;

  const quillBotText = await tryQuillBotGrammarFix(trimmed);
  if (quillBotText) return quillBotText;

  const result = await generateText({
    model: gateway(modelId),
    system:
      "Correct the grammar, punctuation, capitalization, and awkward phrasing in the user's message while preserving the original intent, meaning, and tone. Return only the corrected sentence or paragraph. No explanations.",
    prompt: trimmed,
  });

  return result.text.trim() || trimmed;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatRequestBody;
        const normalizedMessages = normalizeMessages(body.messages);

        if (!normalizedMessages.length) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env["OPENAI_API_KEY"]?.trim() || process.env["GROQ_API_KEY"]?.trim();
        if (!key) {
          return new Response("Missing OPENAI_API_KEY or GROQ_API_KEY", { status: 500 });
        }

        const baseURL =
          process.env["OPENAI_BASE_URL"]?.trim() ||
          process.env["GROQ_BASE_URL"]?.trim() ||
          "https://api.groq.com/openai/v1";

        const modelId =
          process.env["AI_MODEL"]?.trim() || process.env["GROQ_MODEL"]?.trim() || "openai/gpt-oss-120b";

        const initialRunId = getAiGatewayRunId(request);
        const gateway = createAiGatewayProvider(key, initialRunId, undefined, baseURL);

        const correctedMessages = await Promise.all(
          normalizedMessages.map(async (message) => {
            if (message.role !== "user") return message;

            const text = extractTextFromMessage(message);
            const nextText = await correctGrammarForChat(text, gateway, modelId);

            return {
              ...message,
              parts: [{ type: "text", text: nextText }],
            } as UIMessage;
          }),
        );

        const result = streamText({
          model: gateway(modelId),
          system: novaSystemPrompt(body.interviewerMode === true),
          messages: await convertToModelMessages(correctedMessages),
          temperature: 0.8,
          experimental_transform: novaOutputStreamTransform(),
        });

        const headers = getAiGatewayResponseHeaders(undefined, {
          ...(initialRunId ? { "X-AI-Run-ID": initialRunId } : {}),
        });

        const response =
          body.plain === true
            ? result.toTextStreamResponse({ headers })
            : result.toUIMessageStreamResponse({
                originalMessages: correctedMessages,
                headers,
              });

        return withAiGatewayRunIdHeader(response, gateway);
      },
    },
  },
});
