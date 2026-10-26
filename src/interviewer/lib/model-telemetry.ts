import { z } from "zod";

export const modelCallTelemetrySchema = z.object({
  operation: z.enum([
    "answer_evaluation",
    "question_generation",
    "resume_question_generation",
    "narration",
  ]),
  provider: z.string().max(40).nullable(),
  model: z.string().max(120).nullable(),
  durationMs: z.number().int().nonnegative().max(120_000),
  attempts: z.number().int().nonnegative().max(8),
  outcome: z.enum(["success", "fallback", "error"]),
  errorCode: z.string().max(40).optional(),
});

export function sanitizeModelCallTelemetry(value: unknown) {
  return modelCallTelemetrySchema.parse(value);
}
