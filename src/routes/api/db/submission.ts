import { createFileRoute } from "@tanstack/react-router";
import { saveAssessmentSubmission } from "@/lib/mongodb.server";

export const Route = createFileRoute("/api/db/submission")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            attempt?: Record<string, unknown>;
            report?: Record<string, unknown>;
          };

          if (!body.attempt?._id || !body.report?._id || !body.report.attemptId) {
            return new Response(JSON.stringify({ error: "Invalid submission payload" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          await saveAssessmentSubmission(body.attempt, body.report);
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Failed to save assessment submission:", error);
          return new Response(JSON.stringify({ error: "Failed to save assessment submission" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});