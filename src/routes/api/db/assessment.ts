import { createFileRoute } from "@tanstack/react-router";
import { saveAssessment, getAssessment, getCompanyAssessments, deleteAssessment, type StoredAssessment } from "@/lib/mongodb.server";

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

      DELETE: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const code = url.searchParams.get("code");
          const companyUserId = url.searchParams.get("companyUserId");

          if (!code || !companyUserId) {
            return new Response(JSON.stringify({ error: "Missing code or companyUserId" }), { status: 400 });
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
