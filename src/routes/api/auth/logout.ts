import { createFileRoute } from "@tanstack/react-router";
import { clearSessionCookie } from "@/lib/auth-session.server";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async () =>
        Response.json({ success: true }, { headers: { "Set-Cookie": clearSessionCookie() } }),
    },
  },
});