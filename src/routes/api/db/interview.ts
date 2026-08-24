import { createFileRoute } from "@tanstack/react-router";
import { saveInterview, getInterview, getUserInterviews, type StoredInterview } from "@/lib/mongodb.server";

export const Route = createFileRoute("/api/db/interview")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as Partial<StoredInterview>;
          if (!body.sessionId || !body.email) {
            return new Response(JSON.stringify({ error: "Missing sessionId or email" }), { status: 400 });
          }

          const interview = await saveInterview(body as StoredInterview);
          return new Response(JSON.stringify(interview), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Failed to save interview:", error);
          return new Response(JSON.stringify({ error: "Failed to save interview" }), { status: 500 });
        }
      },

      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const sessionId = url.searchParams.get("sessionId");
          const email = url.searchParams.get("email");

          if (sessionId) {
            const interview = await getInterview(sessionId);
            return new Response(JSON.stringify(interview || null), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (email) {
            const interviews = await getUserInterviews(email);
            return new Response(JSON.stringify(interviews), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ error: "Missing sessionId or email" }), { status: 400 });
        } catch (error) {
          console.error("Failed to fetch interview:", error);
          return new Response(JSON.stringify({ error: "Failed to fetch interview" }), { status: 500 });
        }
      },
    },
  },
});
