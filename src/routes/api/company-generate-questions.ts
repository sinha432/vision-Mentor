import { createFileRoute } from "@tanstack/react-router";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

interface GenerateRequest {
  role?: string;
  topic?: string;
  difficulty?: "Easy" | "Medium" | "Hard" | "Mixed";
  count?: number;
}

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

function cleanJson(text: string) {
  const trimmed = text.trim();

  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return withoutFence;
}

export const Route = createFileRoute(
  "/api/company-generate-questions",
)({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body =
            (await request.json()) as GenerateRequest;

          const role =
            body.role?.trim() ||
            "Software Developer";

          const topic =
            body.topic?.trim() ||
            "Programming";

          const difficulty =
            body.difficulty || "Medium";

          const count = Math.max(
            1,
            Math.min(
              20,
              Number(body.count) || 5,
            ),
          );

          const apiKey =
            process.env.GROQ_API_KEY?.trim();

          if (!apiKey) {
            return Response.json(
              {
                error:
                  "GROQ_API_KEY is missing from the server environment.",
              },
              { status: 500 },
            );
          }

          const baseURL =
            process.env.GROQ_BASE_URL?.trim() ||
            "https://api.groq.com/openai/v1";

          const model =
            process.env.GROQ_MODEL?.trim() ||
            "openai/gpt-oss-120b";

          const groq =
            createOpenAICompatible({
              name: "groq",
              apiKey,
              baseURL,
            });

          const prompt = `
Generate exactly ${count} professional assessment questions.

Role: ${role}
Topic: ${topic}
Difficulty: ${difficulty}

Return ONLY valid JSON.

Required format:

{
  "questions": [
    {
      "id": "q1",
      "type": "text",
      "text": "Question text",
      "weight": 10,
      "keywords": ["keyword1", "keyword2"]
    }
  ]
}

Rules:

- Generate exactly ${count} questions.
- Use "text" for normal interview/assessment questions.
- Use "mcq" only when appropriate.
- Use "code" only for programming/code questions.
- Every question must have meaningful text.
- Every question must have weight 10.
- keywords must always be an array.
- IDs must be unique.
- Do not include markdown.
- Do not include explanations.
- Do not wrap the JSON in markdown fences.
`;

          const result = await generateText({
            model: groq(model),
            prompt,
            temperature: 0.7,
          });

          const jsonText = cleanJson(
            result.text,
          );

          let parsed: {
            questions?: GeneratedQuestion[];
          };

          try {
            parsed = JSON.parse(jsonText);
          } catch {
            console.error(
              "GROQ INVALID JSON:",
              result.text,
            );

            return Response.json(
              {
                error:
                  "Groq returned invalid question JSON.",
              },
              { status: 502 },
            );
          }

          if (
            !Array.isArray(
              parsed.questions,
            )
          ) {
            return Response.json(
              {
                error:
                  "Groq response did not contain a questions array.",
              },
              { status: 502 },
            );
          }

          const questions =
            parsed.questions
              .slice(0, count)
              .map(
                (question, index) => ({
                  id:
                    typeof question.id ===
                      "string" &&
                    question.id.trim()
                      ? question.id
                      : `q-${Date.now()}-${index}`,

                  type:
                    question.type === "mcq" ||
                    question.type === "code"
                      ? question.type
                      : "text",

                  text:
                    typeof question.text ===
                    "string"
                      ? question.text.trim()
                      : "",

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
                          .filter(
                            (
                              keyword,
                            ) =>
                              typeof keyword ===
                              "string",
                          )
                          .map(
                            (keyword) =>
                              keyword.trim(),
                          )
                          .filter(Boolean)
                      : [],

                  maxLength:
                    question.maxLength ??
                    null,

                  choices:
                    Array.isArray(
                      question.choices,
                    )
                      ? question.choices
                      : undefined,

                  correctChoiceId:
                    question.correctChoiceId,

                  starterCode:
                    question.starterCode,

                  testCases:
                    Array.isArray(
                      question.testCases,
                    )
                      ? question.testCases
                      : undefined,
                }),
              )
              .filter(
                (question) =>
                  question.text.length >= 3,
              );

          if (!questions.length) {
            return Response.json(
              {
                error:
                  "Groq generated no valid questions.",
              },
              { status: 502 },
            );
          }

          return Response.json({
            questions,
          });
        } catch (error) {
          console.error(
            "COMPANY QUESTION GENERATION ERROR:",
            error,
          );

          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Question generation failed.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});