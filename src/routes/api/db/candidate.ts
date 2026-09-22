import { createFileRoute } from "@tanstack/react-router";
import { deleteCandidateData } from "@/lib/mongodb.server";

export const Route = createFileRoute("/api/db/candidate")({
  server: {
    handlers: {
      DELETE: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const individualUserId = url.searchParams.get("individualUserId");
          const companyUserId = url.searchParams.get("companyUserId");

          if (!individualUserId || !companyUserId) {
            return new Response(JSON.stringify({ error: "Missing candidate or company identity" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const result = await deleteCandidateData(individualUserId, companyUserId);
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Failed to delete candidate data:", error);
          return new Response(JSON.stringify({ error: "Failed to delete candidate data" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});