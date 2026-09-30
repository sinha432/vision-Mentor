import { createFileRoute } from "@tanstack/react-router";
import {
  saveAssessment,
  getAssessment,
  getCompanyAssessments,
  deleteAssessment,
  updateAssessmentStatus,
  type StoredAssessment,
} from "@/lib/mongodb.server";
import { getAuthSession } from "@/lib/auth-session.server";

// -ignore: route typing mismatch for generated FileRoutesByPath
export const Route = createFileRoute("/api/db/assessment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as Partial<StoredAssessment>;
          if (!body.code || !body.companyUserId) {
            return new Response(JSON.stringify({ error: "Missing code or companyUserId" }), { status: 400 });
          }

          const session = getAuthSession(request);
          if (!session || session.role !== "company" || session.id !== body.companyUserId) {
            return Response.json({ error: "Company session required" }, { status: 403 });
          }

          const assessment = await saveAssessment(body as StoredAssessment);
          return new Response(JSON.stringify(assessment), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Failed to save assessment:", error);
          return new Response(JSON.stringify({ error: "Failed to save assessment" }), { status: 500 });
        }
      },

      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const code = url.searchParams.get("code");
          const companyUserId = url.searchParams.get("companyUserId");

          if (code) {
            const assessment = await getAssessment(code);
            return new Response(JSON.stringify(assessment || null), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (companyUserId) {
            const session = getAuthSession(request);
            if (!session || session.role !== "company" || session.id !== companyUserId) {
              return Response.json({ error: "Company session required" }, { status: 403 });
            }
            const assessments = await getCompanyAssessments(companyUserId);
            return new Response(JSON.stringify(assessments), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ error: "Missing code or companyUserId" }), { status: 400 });
        } catch (error) {
          console.error("Failed to fetch assessment:", error);
          return new Response(JSON.stringify({ error: "Failed to fetch assessment" }), { status: 500 });
        }
      },

      PUT: async ({ request }) => {
        try {
          const body = await request.json() as {
            code?: string;
            companyUserId?: string;
            status?: "active" | "closed";
          };
          if (!body.code || !body.companyUserId || !body.status) {
            return Response.json({ error: "Missing code, companyUserId or status" }, { status: 400 });
          }

          const session = getAuthSession(request);
          if (!session || session.role !== "company" || session.id !== body.companyUserId) {
            return Response.json({ error: "Company session required" }, { status: 403 });
          }

          const updated = await updateAssessmentStatus(
            body.code,
            body.companyUserId,
            body.status,
          );
          if (!updated) return Response.json({ error: "Assessment not found" }, { status: 404 });
          return Response.json({ updated });
        } catch (error) {
          console.error("Failed to update assessment status:", error);
          return Response.json({ error: "Failed to update assessment status" }, { status: 500 });
        }
      },

      DELETE: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const code = url.searchParams.get("code");
          const companyUserId = url.searchParams.get("companyUserId");

          if (!code || !companyUserId) {
            return new Response(JSON.stringify({ error: "Missing code or companyUserId" }), { status: 400 });
          }

          const session = getAuthSession(request);
          if (!session || session.role !== "company" || session.id !== companyUserId) {
            return Response.json({ error: "Company session required" }, { status: 403 });
          }

          const deleted = await deleteAssessment(code, companyUserId);
          return new Response(JSON.stringify({ deleted }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Failed to delete assessment:", error);
          return new Response(JSON.stringify({ error: "Failed to delete assessment" }), { status: 500 });
        }
      },
    },
  },
});
