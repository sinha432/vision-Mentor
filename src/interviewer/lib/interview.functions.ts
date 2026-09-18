import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const questionSchema = z.object({
  kind: z.enum(["text", "mcq", "coding", "scenario"]),
  prompt: z.string(),
  topic: z.string(),
  difficulty: z.number(),
  options: z.array(z.string()),
  language: z.enum(["java", "python", "javascript", "sql", "none"]),
  starterCode: z.string(),
});

const turnSchema = z.object({
  id: z.string(),
  phase: z.enum([
    "greeting",
    "resume",
    "technical",
    "coding",
    "behavioral",
    "hr",
    "closing",
    "complete",
  ]),
  say: z.string(),
  mood: z.enum(["neutral", "smile", "nod", "thinking", "curious"]),
  question: questionSchema.nullable(),
  bankId: z.string().nullable().optional(),
  answer: z.string().optional(),
  evaluation: z
    .object({
      score: z.number(),
      verdict: z.enum(["strong", "adequate", "weak"]),
      note: z.string(),
      matched: z.array(z.string()).optional(),
      missed: z.array(z.string()).optional(),
      verified: z.boolean().optional(),
    })
    .optional(),
  askedAt: z.number(),
});

const resumeSchema = z.object({
  name: z.string(),
  headline: z.string(),
  skills: z.array(z.string()),
  projects: z.array(z.object({ title: z.string(), summary: z.string() })),
  experience: z.array(z.string()),
  education: z.array(z.string()),
  certifications: z.array(z.string()),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  atsScore: z.number(),
});

const configSchema = z.object({
  companyId: z.string(),
  role: z.string(),
  experience: z.string(),
  candidateName: z.string(),
  resume: resumeSchema.nullable(),
  resumeFit: z
    .object({
      companyId: z.string(),
      score: z.number(),
      verdict: z.enum(["weak", "borderline", "strong"]),
      statement: z.string(),
      matched: z.array(z.string()),
      missing: z.array(z.string()),
      actions: z.array(z.object({ title: z.string(), detail: z.string() })),
      keywords: z.array(z.string()),
    })
    .nullable()
    .optional(),
});

export const nextInterviewTurn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ config: configSchema, turns: z.array(turnSchema) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { generateTurn } = await import("./interview-engine.server");
    return generateTurn(data.config, data.turns as never);
  });

export const buildInterviewReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        config: configSchema,
        turns: z.array(turnSchema),
        vision: z.object({
          eyeContact: z.number(),
          attention: z.number(),
          posture: z.number(),
          enabled: z.boolean(),
        }),
        voice: z.object({
          wordsPerMinute: z.number(),
          fillerWords: z.number(),
          pauseCount: z.number(),
          fluency: z.number(),
        }),
        behaviour: z
          .object({
            detection: z
              .object({
                avgEyeContact: z.number(),
                avgPosture: z.number(),
                avgConfidence: z.number(),
                avgNoise: z.number(),
                noisySeconds: z.number(),
                multiFaceSeconds: z.number(),
                faceMissingSeconds: z.number(),
                deviceSeconds: z.number(),
                backgroundVoiceEvents: z.number(),
                dominantEmotion: z.string(),
                onDevice: z.boolean(),
              })
              .nullable()
              .optional(),
            proctor: z
              .array(
                z.object({
                  kind: z.string(),
                  detail: z.string(),
                  severity: z.string().optional(),
                }),
              )
              .optional(),
            warnings: z.number().optional(),
            endedEarly: z.boolean().optional(),
          })
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { generateReport } = await import("./interview-engine.server");
    return generateReport(
      data.config,
      data.turns as never,
      data.vision,
      data.voice,
      data.behaviour,
    );
  });

export const analyzeResume = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        text: z.string().optional(),
        fileName: z.string().optional(),
        mimeType: z.string().optional(),
        dataUrl: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { extractResumeContent } = await import("./resume.server");
    const text = data.text?.trim()
      ? data.text
      : await extractResumeContent(data.dataUrl ?? "", data.mimeType ?? "", data.fileName ?? "");
    if (text.trim().length < 60) {
      throw new Error("We could not extract enough readable text from this resume. Paste the resume text instead.");
    }
    const { analyzeResumeText, classifyResumeDocument } = await import("./interview-engine.server");
    const check = classifyResumeDocument(text ?? "");
    if (check.verdict !== "resume") throw new Error(check.reason);
    const insights = await analyzeResumeText(text);
    return { ...insights, resumeText: text };
  });

export const analyzeResumeFit = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        resume: resumeSchema,
        companyId: z.string(),
        role: z.string(),
        experience: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { analyzeResumeFitForCompany } = await import("./interview-engine.server");
    return analyzeResumeFitForCompany(data.resume, data.companyId, data.role, data.experience);
  });

export const reviewAppearance = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        dataUrl: z.string().min(32),
        companyId: z.string(),
        role: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { analyzeAppearance } = await import("./interview-engine.server");
    return analyzeAppearance(data.dataUrl, data.companyId, data.role);
  });

export const coachPresenceNow = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        dataUrl: z.string().min(32),
        companyId: z.string(),
        role: z.string(),
        signals: z.object({
          eyeContact: z.number(),
          attention: z.number(),
          posture: z.number(),
          wordsPerMinute: z.number(),
          fillerWords: z.number(),
        }),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { coachPresence } = await import("./interview-engine.server");
    return coachPresence(data.dataUrl, data.companyId, data.role, data.signals);
  });

/** Reports whether any AI provider is usable, so the UI can show a setup notice. */
export const getAiStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { hasAnyProvider, activeProviders, modelFor } = await import("./ai-providers.server");
  const active = activeProviders();
  return {
    configured: hasAnyProvider(),
    model: active.length ? modelFor(active[0], false) : "",
    provider: active.length ? active[0].label : "",
    fallbacks: active.slice(1).map((spec) => spec.label),
  };
});

export const generateResumeCorrections = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ resumeText: z.string(), companyId: z.string(), role: z.string() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { generateResumeCorrections } = await import("./interview-engine.server");
    return generateResumeCorrections(data.resumeText, data.companyId, data.role);
  });

export const analyzeShortlistLikelihood = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        resumeText: z.string(),
        companyId: z.string(),
        role: z.string(),
        experience: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { analyzeShortlistLikelihood } = await import("./interview-engine.server");
    return analyzeShortlistLikelihood(data.resumeText, data.companyId, data.role, data.experience);
  });

export const buildAnswerCoaching = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ config: configSchema, turns: z.array(turnSchema) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { generateAnswerCoaching } = await import("./interview-engine.server");
    return generateAnswerCoaching(data.config, data.turns as never);
  });

export const analyzeReplayForensics = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        frames: z.array(z.object({ t: z.number(), dataUrl: z.string().min(16) })).max(8),
        companyId: z.string(),
        role: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { generateReplayForensics } = await import("./interview-engine.server");
    return generateReplayForensics(data.frames, data.companyId, data.role);
  });
