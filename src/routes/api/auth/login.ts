import { createFileRoute } from "@tanstack/react-router";
import { getUser } from "@/lib/mongodb.server";
import { verifyPassword } from "@/lib/auth-password";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();

          const email =
            typeof body.email === "string"
              ? body.email.trim().toLowerCase()
              : "";

          const password =
            typeof body.password === "string"
              ? body.password
              : "";

          const requestedRole =
            body.role === "company" ||
            body.role === "individual"
              ? body.role
              : "";

          if (!email || !password) {
            return Response.json(
              {
                error: "Email and password are required",
              },
              { status: 400 },
            );
          }

          if (!requestedRole) {
            return Response.json(
              {
                error: "Account type is required",
              },
              { status: 400 },
            );
          }

          const user = await getUser(email);

          /*
           * Deliberately use the same generic error for:
           * - email not found
           * - wrong password
           * - wrong Individual/Company mode
           *
           * This prevents revealing whether an email belongs
           * to a particular account type.
           */
          if (!user) {
            return Response.json(
              {
                error: "Invalid email or password",
              },
              { status: 401 },
            );
          }

          const valid = await verifyPassword(
            password,
            user.passwordHash,
          );

          if (!valid) {
            return Response.json(
              {
                error: "Invalid email or password",
              },
              { status: 401 },
            );
          }

          /*
           * The selected login mode MUST match the role stored
           * in MongoDB.
           *
           * Individual login + company account = rejected.
           * Company login + individual account = rejected.
           */
          if (user.role !== requestedRole) {
            return Response.json(
              {
                error: "Invalid email or password",
              },
              { status: 401 },
            );
          }

          return Response.json({
            success: true,
            user: {
              id: String(user._id ?? user.email),
              email: user.email,
              name: user.name,
              role: user.role,
            },
          });
        } catch (error) {
          console.error("Login error:", error);

          return Response.json(
            {
              error: "Failed to sign in",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});