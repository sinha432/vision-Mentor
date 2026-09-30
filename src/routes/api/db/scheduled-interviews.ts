import { createFileRoute } from "@tanstack/react-router";
import {
  deleteScheduledInterview,
  getScheduledInterviews,
  saveScheduledInterview,
  type StoredScheduledInterview,
} from "@/lib/mongodb.server";
import { getAuthSession } from "@/lib/auth-session.server";

export const Route = createFileRoute("/api/db/scheduled-interviews")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const companyUserId = url.searchParams.get("companyUserId");
          if (!companyUserId) {
            return Response.json({ error: "Missing companyUserId" }, { status: 400 });
          }
          const session = getAuthSession(request);
          if (!session || session.role !== "company" || session.id !== companyUserId) {
            return Response.json({ error: "Company session required" }, { status: 403 });
          }

          const interviews = await getScheduledInterviews(companyUserId);
          return Response.json(interviews);
        } catch (error) {
          console.error("Failed to fetch scheduled interviews:", error);
          return Response.json({ error: "Failed to fetch scheduled interviews" }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        try {
          const body = await request.json() as Partial<StoredScheduledInterview>;
          if (!body.companyUserId || !body.id) {
            return Response.json({ error: "Missing companyUserId or id" }, { status: 400 });
          }
          const session = getAuthSession(request);
          if (!session || session.role !== "company" || session.id !== body.companyUserId) {
            return Response.json({ error: "Company session required" }, { status: 403 });
          }

          const interview = await saveScheduledInterview(body as StoredScheduledInterview);
          return Response.json(interview);
        } catch (error) {
          console.error("Failed to save scheduled interview:", error);
          return Response.json({ error: "Failed to save scheduled interview" }, { status: 500 });
        }
      },

      DELETE: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const companyUserId = url.searchParams.get("companyUserId");
          const id = url.searchParams.get("id");
          if (!companyUserId || !id) {
            return Response.json({ error: "Missing companyUserId or id" }, { status: 400 });
          }
          const session = getAuthSession(request);
          if (!session || session.role !== "company" || session.id !== companyUserId) {
            return Response.json({ error: "Company session required" }, { status: 403 });
          }

          const deleted = await deleteScheduledInterview(companyUserId, id);
          return Response.json({ deleted });
        } catch (error) {
          console.error("Failed to delete scheduled interview:", error);
          return Response.json({ error: "Failed to delete scheduled interview" }, { status: 500 });
        }
      },
    },
  },
});