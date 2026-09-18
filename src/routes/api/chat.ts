import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
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

function normalizeMessages(raw: unknown): UIMessage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((message) => {
      if (!message || typeof message !== "object") {
        return null;
      }

      const candidate = message as Record<string, unknown>;

      const role = candidate.role;

      if (
        role !== "user" &&
        role !== "assistant" &&
        role !== "system"
      ) {
        return null;
      }

      const directText =
        typeof candidate.text === "string"
          ? candidate.text
          : undefined;

      const directContent =
        typeof candidate.content === "string"
          ? candidate.content
          : undefined;

      /*
       * Convert all valid text parts into strings.
       * Invalid/null parts are removed before parts.join().
       */
      const parts: string[] = Array.isArray(candidate.parts)
        ? candidate.parts
            .map((part): string | null => {
              if (!part || typeof part !== "object") {
                return null;
              }

              const item = part as Record<string, unknown>;

              if (
                item.type === "text" &&
                typeof item.text === "string"
              ) {
                return item.text;
              }

              return null;
            })
            .filter(
              (part): part is string =>
                typeof part === "string",
            )
        : [];

      const text = (
        directText ??
        directContent ??
        parts.join("")
      ).trim();

      if (!text) {
        return null;
      }

      const normalized: UIMessage = {
        id: String(
          candidate.id ??
            `${role}-${Math.random()
              .toString(36)
              .slice(2, 10)}`,
        ),

        role: role as UIMessage["role"],

        parts: [
          {
            type: "text",
            text,
          },
        ],
      };

      return normalized;
    })
    .filter(
      (value): value is UIMessage =>
        Boolean(value),
    );
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body =
          (await request.json()) as ChatRequestBody;

        const normalizedMessages =
          normalizeMessages(body.messages);

        if (!normalizedMessages.length) {
          return new Response(
            "Messages are required",
            {
              status: 400,
            },
          );
        }

        const key =
          process.env["OPENAI_API_KEY"]?.trim() ||
          process.env["GROQ_API_KEY"]?.trim();

        if (!key) {
          return new Response(
            "Missing OPENAI_API_KEY or GROQ_API_KEY",
            {
              status: 500,
            },
          );
        }

        const baseURL =
          process.env["OPENAI_BASE_URL"]?.trim() ||
          process.env["GROQ_BASE_URL"]?.trim() ||
          "https://api.groq.com/openai/v1";

        const modelId =
          process.env["CHAT_MODEL"]?.trim() ||
          process.env["AI_MODEL"]?.trim() ||
          process.env["GROQ_MODEL"]?.trim() ||
          "groq/compound-mini";

        const initialRunId =
          getAiGatewayRunId(request);

        const gateway =
          createAiGatewayProvider(
            key,
            initialRunId,
            undefined,
            baseURL,
          );

        const result = streamText({
          model: gateway(modelId),

          system: novaSystemPrompt(
            body.interviewerMode === true,
          ),

          messages:
            await convertToModelMessages(
              normalizedMessages,
            ),

          temperature: 0.7,
        });

        const headers =
          getAiGatewayResponseHeaders(
            undefined,
            {
              ...(initialRunId
                ? {
                    "X-AI-Run-ID":
                      initialRunId,
                  }
                : {}),
            },
          );

        const response =
          body.plain === true
            ? result.toTextStreamResponse({
                headers,
              })
            : result.toUIMessageStreamResponse({
                originalMessages:
                  normalizedMessages,
                headers,
              });

        return withAiGatewayRunIdHeader(
          response,
          gateway,
        );
      },
    },
  },
});