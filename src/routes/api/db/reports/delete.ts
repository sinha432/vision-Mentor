import { createFileRoute } from "@tanstack/react-router";
import { deleteIndividualReports } from "@/lib/mongodb.server";
import { getAuthSession } from "@/lib/auth-session.server";

export const Route = createFileRoute("/api/db/reports/delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            individualUserId?: string;
            attemptIds?: string[];
          };
          if (!body.individualUserId || !Array.isArray(body.attemptIds)) {
            return new Response(JSON.stringify({ error: "Invalid report deletion payload" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const session = getAuthSession(request);
          if (!session || session.role !== "individual" || session.id !== body.individualUserId) {
            return Response.json({ error: "Individual session required" }, { status: 403 });
          }

          const result = await deleteIndividualReports(
            body.individualUserId,
            body.attemptIds,
          );
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Failed to delete individual reports:", error);
          return new Response(JSON.stringify({ error: "Failed to delete individual reports" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});