import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import {
  createAiGatewayProvider,
  getAiGatewayRunId,
} from "@/lib/ai-gateway.server";

interface GenerateQuestionRequest {
  role?: unknown;
  topic?: unknown;
  difficulty?: unknown;
  count?: unknown;
}

interface GeneratedQuestion {
  id: string;
  type: "text" | "mcq" | "code";
  text: string;
  weight: number;
  keywords: string[];
}

function cleanString(
  value: unknown,
  fallback: string,
): string {
  return typeof value === "string" &&
    value.trim()
    ? value.trim()
    : fallback;
}

function cleanCount(
  value: unknown,
): number {
  const count = Number(value);

  if (!Number.isFinite(count)) {
    return 5;
  }

  return Math.min(
    Math.max(Math.floor(count), 1),
    20,
  );
}

function parseQuestions(
  text: string,
): GeneratedQuestion[] {
  try {
    let cleaned = text.trim();

    /*
     * Remove markdown fences if the model
     * accidentally adds them.
     */
    cleaned = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    /*
     * If the model adds text before/after
     * the JSON array, extract the array.
     */
    const firstBracket =
      cleaned.indexOf("[");

    const lastBracket =
      cleaned.lastIndexOf("]");

    if (
      firstBracket >= 0 &&
      lastBracket > firstBracket
    ) {
      cleaned = cleaned.slice(
        firstBracket,
        lastBracket + 1,
      );
    }

    const parsed: unknown =
      JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (
          item,
        ): item is Record<
          string,
          unknown
        > =>
          Boolean(item) &&
          typeof item === "object",
      )
      .map(
        (
          item,
          index,
        ) => {
          const textValue =
            typeof item.text ===
              "string" &&
            item.text.trim()
              ? item.text.trim()
              : "";

         const type: GeneratedQuestion["type"] =
  item.type === "mcq"
    ? "mcq"
    : item.type === "code"
      ? "code"
      : "text";
          const weight =
            typeof item.weight ===
              "number" &&
            Number.isFinite(
              item.weight,
            )
              ? Math.max(
                  1,
                  Math.min(
                    100,
                    item.weight,
                  ),
                )
              : 10;

          const keywords =
            Array.isArray(
              item.keywords,
            )
              ? item.keywords.filter(
                  (
                    keyword,
                  ): keyword is string =>
                    typeof keyword ===
                    "string",
                )
              : [];

          return {
            id:
              typeof item.id ===
                "string" &&
              item.id.trim()
                ? item.id
                : `ai-question-${Date.now()}-${index}`,

            type,

            text:
              textValue ||
              `Question ${
                index + 1
              }`,

            weight,

            keywords,
          };
        },
      )
      .filter(
        (question) =>
          question.text.length >= 3,
      );
  } catch {
    return [];
  }
}

export const Route = createFileRoute(
  "/api/company-generate-questions",
)({
  server: {
    handlers: {
      POST: async ({
        request,
      }) => {
        const startedAt =
          Date.now();

        try {
          const body =
            (await request.json()) as GenerateQuestionRequest;

          const role = cleanString(
            body.role,
            "Software Developer",
          );

          const topic = cleanString(
            body.topic,
            "General Programming",
          );

          const difficulty =
            cleanString(
              body.difficulty,
              "Medium",
            );

          const count =
            cleanCount(body.count);

          /*
           * Keep company assessment generation
           * deliberately small and fast.
           */
          const key =
            process.env[
              "OPENAI_API_KEY"
            ]?.trim() ||
            process.env[
              "GROQ_API_KEY"
            ]?.trim();

          if (!key) {
            return Response.json(
              {
                error:
                  "Missing OPENAI_API_KEY or GROQ_API_KEY",
              },
              {
                status: 500,
              },
            );
          }

          const baseURL =
            process.env[
              "OPENAI_BASE_URL"
            ]?.trim() ||
            process.env[
              "GROQ_BASE_URL"
            ]?.trim() ||
            "https://api.groq.com/openai/v1";

          /*
           * IMPORTANT:
           *
           * Use an environment override when one
           * exists.
           *
           * Otherwise use a smaller/faster model
           * instead of the previous 120B default.
           *
           * You can change AI_FAST_MODEL in .env
           * without touching this file.
           */
          const modelId =
            process.env[
              "AI_FAST_MODEL"
            ]?.trim() ||
            process.env[
              "GROQ_FAST_MODEL"
            ]?.trim() ||
            "llama-3.1-8b-instant";

          const runId =
            getAiGatewayRunId(
              request,
            );

          const gateway =
            createAiGatewayProvider(
              key,
              runId,
              undefined,
              baseURL,
            );

          /*
           * Keep the prompt intentionally short.
           *
           * Long system prompts increase latency
           * and token usage without helping this
           * structured generation task much.
           */
          const result =
            await generateText({
              model:
                gateway(modelId),

              system:
                "You are Nova, an AI hiring copilot. Generate practical interview assessment questions. Return ONLY a valid JSON array. No markdown. No explanations. No answers.",

              prompt: [
                `Role: ${role}`,
                `Topic: ${topic}`,
                `Difficulty: ${difficulty}`,
                `Count: ${count}`,
                "",
                "Return exactly this structure:",
                "[",
                '  {"id":"question-1","type":"text","text":"Question","weight":10,"keywords":["keyword"]}',
                "]",
                "",
                'Allowed type values: "text", "mcq", "code".',
                "Use code only for coding tasks.",
                "Use mcq only when multiple choice is appropriate.",
                "Otherwise use text.",
                "Do not include answers.",
                "Do not include explanations.",
                "Do not duplicate questions.",
              ].join("\n"),

              /*
               * Prevent the model from generating
               * unnecessarily long output.
               */
              maxOutputTokens:
                Math.max(
                  500,
                  count * 100,
                ),
            });

          const questions =
            parseQuestions(
              result.text,
            ).slice(0, count);

          if (!questions.length) {
            console.error(
              "Nova returned invalid questions:",
              result.text,
            );

            return Response.json(
              {
                error:
                  "AI returned an invalid question format.",
              },
              {
                status: 502,
              },
            );
          }

          /*
           * Do not fail just because the model
           * returned slightly fewer questions.
           *
           * The frontend can still display the
           * valid questions immediately.
           */
          console.log(
            `Nova generated ${questions.length}/${count} questions in ${
              Date.now() -
              startedAt
            }ms using ${modelId}`,
          );

          return Response.json(
            {
              questions,
              role,
              topic,
              difficulty,

              /*
               * Useful for debugging performance.
               */
              generationTimeMs:
                Date.now() -
                startedAt,

              model:
                modelId,
            },
            {
              status: 200,
              headers: {
                "Content-Type":
                  "application/json",

                /*
                 * Do not cache generated
                 * assessment questions.
                 */
                "Cache-Control":
                  "no-store",
              },
            },
          );
        } catch (error) {
          console.error(
            "Company question generation failed:",
            error,
          );

          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to generate questions right now.",
            },
            {
              status: 500,
            },
          );
        }
      },
    },
  },
});