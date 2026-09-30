import { createFileRoute } from "@tanstack/react-router";
import { getAuthSession } from "@/lib/auth-session.server";
import { searchIndividualUsers } from "@/lib/mongodb.server";

export const Route = createFileRoute("/api/company/candidates")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = getAuthSession(request);
        if (!session || session.role !== "company") {
          return Response.json({ error: "Company session required" }, { status: 403 });
        }

        const search = new URL(request.url).searchParams.get("q")?.trim() ?? "";
        if (search.length < 2) {
          return Response.json({ candidates: [] });
        }

        try {
          const candidates = await searchIndividualUsers(search);
          return Response.json({ candidates });
        } catch (error) {
          console.error("Failed to search candidates:", error);
          return Response.json({ error: "Candidate search failed" }, { status: 500 });
        }
      },
    },
  },
});
