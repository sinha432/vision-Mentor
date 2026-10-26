import { createFileRoute } from "@tanstack/react-router";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

interface GenerateRequest {
  role?: string;
  topic?: string;
  difficulty?: "Easy" | "Medium" | "Hard" | "Mixed";
  count?: number;
  questionType?: "mixed" | "algorithm" | "sql";
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
  language?: "java" | "javascript" | "python" | "sql";
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
          const questionType =
            body.questionType === "algorithm" || body.questionType === "sql"
              ? body.questionType
              : "mixed";

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

          const generationRules =
            questionType === "sql"
              ? `- Generate only original SQL query challenges as "code" questions.
- Set every code question language to "sql" and provide a short SQL starter query.
- Include the required table schema in the question text.
- Every test case input must create and seed an independent SQLite database using CREATE TABLE and INSERT statements.
- Every expectedStdout must be a canonical result table: column names joined by " | ", followed by one row per line with values joined by " | ". Represent SQL NULL as NULL.
- Include examples and edge cases in the test data. Use SQLite-compatible SQL.`
              : questionType === "algorithm"
                ? `- Generate only original algorithm/programming challenges as "code" questions; do not return text or MCQ questions.
- Use common interview patterns such as arrays, strings, hash maps, sorting, two pointers, trees, graphs, dynamic programming, or binary search as relevant to the topic.
- Write a new problem statement. Do not reproduce or paraphrase a known LeetCode title, statement, examples, or test cases.
- State input/output behavior, constraints, and at least one worked example in the problem text.
- Provide complete runnable Java, JavaScript, or Python starter code and multiple meaningful tests, including a boundary case.`
                : `- Mix question types appropriately for the requested role and topic.
- For coding questions, write original LeetCode-style interview problems. Do not reproduce or paraphrase known LeetCode titles, statements, examples, or test cases.
- Coding problems must specify input/output behavior, constraints, and a worked example, and include multiple meaningful tests with a boundary case.`;

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
Question style: ${questionType}

Return ONLY valid JSON.

Required format:

{
  "questions": [
    {
      "id": "q1",
      "type": "text",
      "text": "Question text",
      "weight": 10,
      "keywords": ["keyword1", "keyword2"],
      "choices": [{"id": "a", "text": "Option A"}, {"id": "b", "text": "Option B"}],
      "correctChoiceId": "a",
      "language": "java",
      "starterCode": "complete runnable scaffold or SQL query starter",
      "testCases": [{"input": "stdin or SQL schema/data setup", "expectedStdout": "stdout or canonical SQL result table"}]
    }
  ]
}

Rules:

- ${generationRules}
- Generate exactly ${count} questions.
- Use "text" for normal interview/assessment questions.
- Use "mcq" only when appropriate.
- For every "mcq", provide 2-8 useful choices and set correctChoiceId to one choice id.
- For every "code" question, provide a supported language, starterCode, and at least one test case.
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
                (question, index) => {
                  const choices = Array.isArray(question.choices)
                    ? question.choices
                        .filter(
                          (choice) =>
                            typeof choice?.text === "string" && choice.text.trim(),
                        )
                        .slice(0, 8)
                        .map((choice, choiceIndex) => ({
                          id:
                            typeof choice.id === "string" && choice.id.trim()
                              ? choice.id.trim()
                              : `q-${index}-choice-${choiceIndex}`,
                          text: choice.text.trim(),
                        }))
                    : [];
                  const correctChoiceId = choices.some(
                    (choice) => choice.id === question.correctChoiceId,
                  )
                    ? question.correctChoiceId
                    : choices[0]?.id;

                  return {
                  id:
                    typeof question.id ===
                      "string" &&
                    question.id.trim()
                      ? question.id
                      : `q-${Date.now()}-${index}`,

                  type:
                    questionType !== "mixed"
                      ? "code"
                      : question.type === "mcq" || question.type === "code"
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

                  choices: choices.length ? choices : undefined,

                  correctChoiceId,

                  language:
                    questionType === "sql"
                      ? "sql"
                      : question.language === "javascript" ||
                          question.language === "python" ||
                          (questionType === "mixed" && question.language === "sql")
                        ? question.language
                        : "java",

                  starterCode:
                    questionType === "sql"
                      ? question.starterCode?.trim() || "-- Write your SQL query here.\nSELECT 1;"
                      : question.starterCode,

                  testCases: Array.isArray(question.testCases)
                    ? question.testCases
                        .filter(
                          (testCase) =>
                            typeof testCase?.input === "string" &&
                            typeof testCase?.expectedStdout === "string",
                        )
                        .slice(0, 10)
                    : undefined,
                };
                },
              )
              .filter(
                (question) =>
                  question.text.length >= 3,
              );

          if (
            questionType !== "mixed" &&
            questions.some(
              (question) =>
                question.type !== "code" ||
                !question.starterCode?.trim() ||
                !question.testCases?.length,
            )
          ) {
            return Response.json(
              {
                error:
                  "The AI response was missing runnable code or test cases. Please regenerate the questions.",
              },
              { status: 502 },
            );
          }

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