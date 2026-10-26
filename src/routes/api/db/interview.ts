import { createFileRoute } from "@tanstack/react-router";
import {
  saveInterview,
  getInterview,
  getUserInterviews,
  deleteInterview,
  type StoredInterview,
} from "@/lib/mongodb.server";
import { getAuthSession } from "@/lib/auth-session.server";
import { modelCallTelemetrySchema } from "@/interviewer/lib/model-telemetry";
import { z } from "zod";

const interviewSchema = z.object({
  sessionId: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/),
  assessmentCode: z.string().max(100).optional(),
  config: z.object({
    companyId: z.string().max(100).optional(),
    companyName: z.string().max(160).optional(),
    role: z.string().max(160).optional(),
    experience: z.string().max(80).optional(),
    level: z.string().max(80).optional(),
    candidateName: z.string().max(100).optional(),
    cloudMediaAnalysisConsent: z.boolean().optional(),
  }),
  phases: z.array(z.string().max(40)).max(40),
  turns: z
    .array(
      z.object({
        questionId: z.string().max(100).nullable().optional(),
        question: z.string().max(4000).nullable().optional(),
        topic: z.string().max(160).nullable().optional(),
        phase: z.string().max(40).nullable().optional(),
        sourceCitations: z
          .array(
            z.object({
              sourceId: z.string().max(30),
              quote: z.string().max(500),
            }),
          )
          .max(4)
          .optional(),
        modelTelemetry: z.array(modelCallTelemetrySchema).max(8).optional(),
        answer: z.string().max(12_000).nullable().optional(),
        code: z.string().max(30_000).nullable().optional(),
        language: z.string().max(30).nullable().optional(),
        score: z.number().min(0).max(100).nullable().optional(),
        evaluation: z
          .object({
            matched: z.array(z.string().max(300)).max(12).optional(),
            missed: z.array(z.string().max(300)).max(12).optional(),
            evidence: z
              .array(
                z.object({
                  criterion: z.string().max(240),
                  quote: z.string().max(500),
                  start: z.number().int().nonnegative(),
                  end: z.number().int().nonnegative(),
                }),
              )
              .max(12)
              .optional(),
            evidenceCoverage: z.number().min(0).max(100).optional(),
            evaluatorVersion: z.string().max(40).optional(),
            feedback: z.enum(["helpful", "needs_review"]).nullable().optional(),
            verified: z.boolean().optional(),
          })
          .optional(),
      }),
    )
    .max(40),
  startedAt: z.string().max(40),
  completedAt: z.string().max(40).optional(),
  status: z.enum(["in_progress", "completed", "abandoned"]),
  recording: z.object({ duration: z.number().nonnegative().max(7200) }).optional(),
  createdAt: z.string().max(40).optional(),
});

async function readBoundedBody(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}

export const Route = createFileRoute("/api/db/interview")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const owner = getAuthSession(request);
          if (!owner || owner.role !== "individual") {
            return Response.json({ error: "Authentication required" }, { status: 401 });
          }
          const contentLength = Number(request.headers.get("content-length") ?? 0);
          if (contentLength > 1_000_000) {
            return Response.json({ error: "Interview payload is too large" }, { status: 413 });
          }
          let rawBody: string | null;
          try {
            rawBody = await readBoundedBody(request, 1_000_000);
          } catch {
            return Response.json({ error: "Invalid interview payload" }, { status: 400 });
          }
          if (rawBody === null) {
            return Response.json({ error: "Interview payload is too large" }, { status: 413 });
          }
          let body: unknown;
          try {
            body = JSON.parse(rawBody);
          } catch {
            return Response.json({ error: "Invalid interview payload" }, { status: 400 });
          }
          const parsed = interviewSchema.safeParse(body);
          if (!parsed.success) {
            return Response.json({ error: "Invalid interview payload" }, { status: 400 });
          }

          const interview = await saveInterview(parsed.data as StoredInterview, {
            id: owner.id,
            email: owner.email,
          });
          if (!interview) return Response.json({ error: "Interview not found" }, { status: 404 });
          return Response.json(interview);
        } catch (error) {
          console.error("Failed to save interview:", error);
          return Response.json({ error: "Failed to save interview" }, { status: 500 });
        }
      },

      GET: async ({ request }) => {
        try {
          const owner = getAuthSession(request);
          if (!owner || owner.role !== "individual") {
            return Response.json({ error: "Authentication required" }, { status: 401 });
          }
          const url = new URL(request.url);
          const sessionId = url.searchParams.get("sessionId");

          if (sessionId) {
            const interview = await getInterview(sessionId, { id: owner.id, email: owner.email });
            return interview
              ? Response.json(interview)
              : Response.json({ error: "Interview not found" }, { status: 404 });
          }

          const interviews = await getUserInterviews({ id: owner.id, email: owner.email });
          return Response.json(interviews);
        } catch (error) {
          console.error("Failed to fetch interview:", error);
          return Response.json({ error: "Failed to fetch interview" }, { status: 500 });
        }
      },

      DELETE: async ({ request }) => {
        try {
          const owner = getAuthSession(request);
          if (!owner || owner.role !== "individual") {
            return Response.json({ error: "Authentication required" }, { status: 401 });
          }
          const sessionId = new URL(request.url).searchParams.get("sessionId");
          if (!sessionId || sessionId.length > 100 || !/^[A-Za-z0-9_-]+$/.test(sessionId)) {
            return Response.json({ error: "Invalid session ID" }, { status: 400 });
          }

          const deleted = await deleteInterview(sessionId, { id: owner.id, email: owner.email });
          return Response.json({ deleted });
        } catch (error) {
          console.error("Failed to delete interview:", error);
          return Response.json({ error: "Failed to delete interview" }, { status: 500 });
        }
      },
    },
  },
});
