import { createFileRoute } from "@tanstack/react-router";
import {
  saveUserProfile,
  getUserProfile,
  getUserProfileById,
  updateUserProfile,
  deleteUserProfile,
  type StoredUserProfile,
} from "@/lib/mongodb.server";

export const Route = createFileRoute("/api/db/user-profile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body =
            (await request.json()) as Partial<StoredUserProfile>;

          if (!body.email) {
            return Response.json(
              { error: "Missing email" },
              { status: 400 },
            );
          }

          const profile = await saveUserProfile(
            body as StoredUserProfile,
          );

          return Response.json(profile);
        } catch (error) {
          console.error(
            "Failed to save user profile:",
            error,
          );

          return Response.json(
            { error: "Failed to save user profile" },
            { status: 500 },
          );
        }
      },

      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);

          const email = url.searchParams.get("email");
          const userId = url.searchParams.get("userId");

          if (email) {
            const profile = await getUserProfile(email);

            return Response.json(profile ?? null);
          }

          if (userId) {
            const profile =
              await getUserProfileById(userId);

            return Response.json(profile ?? null);
          }

          return Response.json(
            { error: "Missing email or userId" },
            { status: 400 },
          );
        } catch (error) {
          console.error(
            "Failed to fetch user profile:",
            error,
          );

          return Response.json(
            { error: "Failed to fetch user profile" },
            { status: 500 },
          );
        }
      },

      PUT: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const email = url.searchParams.get("email");

          if (!email) {
            return Response.json(
              { error: "Missing email" },
              { status: 400 },
            );
          }

          const body =
            (await request.json()) as Partial<StoredUserProfile>;

          /*
           * First try to update the existing profile.
           */
          const updated =
            await updateUserProfile(email, {
              ...body,
              email,
            });

          if (updated) {
            return Response.json(updated);
          }

          /*
           * If the company does not have a profile yet,
           * create it instead of returning 404.
           */
          const created = await saveUserProfile({
            ...body,
            email,
          } as StoredUserProfile);

          return Response.json(created);
        } catch (error) {
          console.error(
            "Failed to update user profile:",
            error,
          );

          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to update user profile",
            },
            { status: 500 },
          );
        }
      },

      DELETE: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const email = url.searchParams.get("email");

          if (!email) {
            return Response.json(
              { error: "Missing email" },
              { status: 400 },
            );
          }

          const deleted =
            await deleteUserProfile(email);

          if (!deleted) {
            return Response.json(
              { error: "User profile not found" },
              { status: 404 },
            );
          }

          return Response.json({
            success: true,
            message: "User profile deleted",
          });
        } catch (error) {
          console.error(
            "Failed to delete user profile:",
            error,
          );

          return Response.json(
            { error: "Failed to delete user profile" },
            { status: 500 },
          );
        }
      },
    },
  },
});