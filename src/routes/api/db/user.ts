import { createFileRoute } from "@tanstack/react-router";
import { saveUser, getUser, type StoredUser } from "@/lib/mongodb.server";

export const Route = createFileRoute("/api/db/user")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as Partial<StoredUser>;
          if (!body.email) {
            return new Response(JSON.stringify({ error: "Missing email" }), { status: 400 });
          }

          const user = await saveUser(body as StoredUser);
          return new Response(JSON.stringify(user), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Failed to save user:", error);
          return new Response(JSON.stringify({ error: "Failed to save user" }), { status: 500 });
        }
      },

      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const email = url.searchParams.get("email");

          if (!email) {
            return new Response(JSON.stringify({ error: "Missing email" }), { status: 400 });
          }

          const user = await getUser(email);
          return new Response(JSON.stringify(user || null), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Failed to fetch user:", error);
          return new Response(JSON.stringify({ error: "Failed to fetch user" }), { status: 500 });
        }
      },
    },
  },
});
