import { createFileRoute } from "@tanstack/react-router";
import {
  getAuthorizedAssessmentReport,
  getCompanyAssessmentSubmissions,
  hasAssessmentSubmission,
  saveAssessmentSubmission,
} from "@/lib/mongodb.server";
import { getAuthSession } from "@/lib/auth-session.server";

export const Route = createFileRoute("/api/db/submission")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const companyUserId = url.searchParams.get("companyUserId");
          const code = url.searchParams.get("code") ?? undefined;
          const individualUserId = url.searchParams.get("individualUserId");
          const reportId = url.searchParams.get("reportId");
          const userId = url.searchParams.get("userId");
          const session = getAuthSession(request);

          if (reportId && userId) {
            if (!session || session.id !== userId) {
              return Response.json({ error: "Authentication required" }, { status: 401 });
            }
            const result = await getAuthorizedAssessmentReport(reportId, userId);
            if (!result) {
              return Response.json({ error: "Report not found" }, { status: 404 });
            }
            return Response.json(result);
          }

          if (individualUserId && code) {
            if (!session || session.role !== "individual" || session.id !== individualUserId) {
              return Response.json({ error: "Individual session required" }, { status: 403 });
            }
            const submitted = await hasAssessmentSubmission(code, individualUserId);
            return Response.json({ submitted });
          }

          if (!companyUserId) {
            return Response.json({ error: "Missing companyUserId" }, { status: 400 });
          }
          if (!session || session.role !== "company" || session.id !== companyUserId) {
            return Response.json({ error: "Company session required" }, { status: 403 });
          }

          const submissions = await getCompanyAssessmentSubmissions(companyUserId, code);
          return Response.json(submissions);
        } catch (error) {
          console.error("Failed to fetch assessment submissions:", error);
          return Response.json({ error: "Failed to fetch assessment submissions" }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            attempt?: Record<string, unknown>;
            report?: Record<string, unknown>;
          };

          const session = getAuthSession(request);
          if (!session || session.role !== "individual" || session.id !== body.attempt?.individualUserId) {
            return Response.json({ error: "Individual session required" }, { status: 403 });
          }

          if (!body.attempt?._id || !body.report?._id || !body.report.attemptId) {
            return new Response(JSON.stringify({ error: "Invalid submission payload" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const saved = await saveAssessmentSubmission(body.attempt, body.report);
          if (!saved) {
            return Response.json({ error: "This candidate has already submitted this assessment" }, { status: 409 });
          }

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