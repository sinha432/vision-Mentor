import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const questionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["text", "mcq", "code"]).default("text"),
  text: z.string().min(1).max(4000),
  weight: z.number().default(1),
  keywords: z.array(z.string()).max(30).default([]),
  maxLength: z.number().nullable().default(null),
});

const gradeSchema = z.object({
  items: z
    .array(z.object({ question: questionSchema, answer: z.string().max(20000).default("") }))
    .min(1)
    .max(30),
});

/** Grades free-text answers with Groq on the server (falls back to a heuristic). */
export const gradeTextAnswers = createServerFn({ method: "POST" })
  .inputValidator((d) => gradeSchema.parse(d))
  .handler(async ({ data }) => {
    const { gradeTextAnswer } = await import("./ai-grading.server");
    return Promise.all(
      data.items.map(async (item) => {
        const { score, notes, source } = await gradeTextAnswer(item.answer, item.question as any);
        return { questionId: item.question.id, score, notes, source };
      }),
    );
  });
