import { createFileRoute } from "@tanstack/react-router";
import { clearSessionCookie, getAuthSession } from "@/lib/auth-session.server";

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = getAuthSession(request);
        if (!session) {
          return Response.json(
            { error: "Authentication required" },
            { status: 401, headers: { "Set-Cookie": clearSessionCookie() } },
          );
        }

        const { id, email, name, role } = session;
        return Response.json({ user: { id, email, name, role } });
      },
    },
  },
});