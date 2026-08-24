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

function cleanString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanCount(value: unknown): number {
  const count = Number(value);

  if (!Number.isFinite(count)) return 5;

  return Math.min(Math.max(Math.floor(count), 1), 20);
}

function parseQuestions(text: string): GeneratedQuestion[] {
  try {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed: unknown = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object",
      )
      .map((item, index) => ({
        id:
          typeof item.id === "string" && item.id.trim()
            ? item.id
            : `ai-question-${Date.now()}-${index}`,
        type:
          item.type === "mcq" || item.type === "code"
            ? item.type
            : "text",
        text:
          typeof item.text === "string" && item.text.trim()
            ? item.text.trim()
            : `Question ${index + 1}`,
        weight:
          typeof item.weight === "number" && Number.isFinite(item.weight)
            ? Math.max(1, Math.min(100, item.weight))
            : 10,
        keywords: Array.isArray(item.keywords)
          ? item.keywords.filter(
              (keyword): keyword is string => typeof keyword === "string",
            )
          : [],
      }));
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/api/company-generate-questions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as GenerateQuestionRequest;

          const role = cleanString(body.role, "Software Developer");
          const topic = cleanString(body.topic, "General Programming");
          const difficulty = cleanString(body.difficulty, "Medium");
          const count = cleanCount(body.count);

          const key =
            process.env["OPENAI_API_KEY"]?.trim() ||
            process.env["GROQ_API_KEY"]?.trim();

          if (!key) {
            return Response.json(
              {
                error: "Missing OPENAI_API_KEY or GROQ_API_KEY",
              },
              { status: 500 },
            );
          }

          const baseURL =
            process.env["OPENAI_BASE_URL"]?.trim() ||
            process.env["GROQ_BASE_URL"]?.trim() ||
            "https://api.groq.com/openai/v1";

          const modelId =
            process.env["AI_MODEL"]?.trim() ||
            process.env["GROQ_MODEL"]?.trim() ||
            "openai/gpt-oss-120b";

          const runId = getAiGatewayRunId(request);

          const gateway = createAiGatewayProvider(
            key,
            runId,
            undefined,
            baseURL,
          );

          const result = await generateText({
            model: gateway(modelId),
            system: `
You are Nova, an AI hiring copilot for Vision Mentor X.

Generate high-quality assessment questions for recruiters.

Requirements:
- Match the requested role.
- Match the requested topic.
- Match the requested difficulty.
- Avoid duplicate questions.
- Questions must be clear and practical.
- Do not include answers.
- Do not include explanations outside the JSON.
- Return ONLY valid JSON.
- Return exactly the requested number of questions.

Use this JSON format:

[
  {
    "id": "question-1",
    "type": "text",
    "text": "Question text",
    "weight": 10,
    "keywords": ["keyword1", "keyword2"]
  }
]

Allowed type values:
"text", "mcq", "code"

Use "code" only when the question requires the candidate to write code.
Use "mcq" only when the question is naturally multiple choice.
Otherwise use "text".
`,
            prompt: `
Role: ${role}
Topic: ${topic}
Difficulty: ${difficulty}
Number of questions: ${count}

Generate the assessment questions now.
`,
          });

          const questions = parseQuestions(result.text);

          if (!questions.length) {
            return Response.json(
              {
                error: "AI returned an invalid question format.",
              },
              { status: 502 },
            );
          }

          return Response.json({
            questions: questions.slice(0, count),
            role,
            topic,
            difficulty,
          });
        } catch (error) {
          console.error("Company question generation failed:", error);

          return Response.json(
            {
              error: "Unable to generate questions right now.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});