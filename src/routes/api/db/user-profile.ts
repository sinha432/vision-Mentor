import { createFileRoute } from "@tanstack/react-router";
import { saveUserProfile, getUserProfile, getUserProfileById, updateUserProfile, deleteUserProfile, type StoredUserProfile } from "@/lib/mongodb.server";

export const Route = createFileRoute("/api/db/user-profile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as Partial<StoredUserProfile>;
          if (!body.email) {
            return new Response(JSON.stringify({ error: "Missing email" }), { status: 400 });
          }

          const profile = await saveUserProfile(body as StoredUserProfile);
          return new Response(JSON.stringify(profile), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Failed to save user profile:", error);
          return new Response(JSON.stringify({ error: "Failed to save user profile" }), { status: 500 });
        }
      },

      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const email = url.searchParams.get("email");
          const userId = url.searchParams.get("userId");

          if (email) {
            const profile = await getUserProfile(email);
            return new Response(JSON.stringify(profile || null), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (userId) {
            const profile = await getUserProfileById(userId);
            return new Response(JSON.stringify(profile || null), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ error: "Missing email or userId" }), { status: 400 });
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
          return new Response(JSON.stringify({ error: "Failed to fetch user profile" }), { status: 500 });
        }
      },

      PUT: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const email = url.searchParams.get("email");

          if (!email) {
            return new Response(JSON.stringify({ error: "Missing email" }), { status: 400 });
          }

          const body = await request.json() as Partial<StoredUserProfile>;
          const profile = await updateUserProfile(email, body);

          if (!profile) {
            return new Response(JSON.stringify({ error: "User profile not found" }), { status: 404 });
          }

          return new Response(JSON.stringify(profile), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Failed to update user profile:", error);
          return new Response(JSON.stringify({ error: "Failed to update user profile" }), { status: 500 });
        }
      },

      DELETE: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const email = url.searchParams.get("email");

          if (!email) {
            return new Response(JSON.stringify({ error: "Missing email" }), { status: 400 });
          }

          const deleted = await deleteUserProfile(email);

          if (!deleted) {
            return new Response(JSON.stringify({ error: "User profile not found" }), { status: 404 });
          }

          return new Response(JSON.stringify({ success: true, message: "User profile deleted" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Failed to delete user profile:", error);
          return new Response(JSON.stringify({ error: "Failed to delete user profile" }), { status: 500 });
        }
      },
    },
  },
});
