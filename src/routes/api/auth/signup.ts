import { createFileRoute } from "@tanstack/react-router";
import {
  getCollection,
  type StoredUser,
} from "@/lib/mongodb.server";
import { hashPassword } from "@/lib/auth-password";

export const Route = createFileRoute("/api/auth/signup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();

          const name =
            typeof body.name === "string" ? body.name.trim() : "";

          const email =
            typeof body.email === "string"
              ? body.email.trim().toLowerCase()
              : "";

          const password =
            typeof body.password === "string"
              ? body.password
              : "";

          const role =
            body.role === "company"
              ? "company"
              : "individual";

          const dob =
            typeof body.dob === "string" && body.dob
              ? body.dob
              : null;

          const country =
            typeof body.country === "string" && body.country
              ? body.country
              : null;

          if (!name) {
            return Response.json(
              { error: "Name is required" },
              { status: 400 },
            );
          }

          if (!email || !email.includes("@")) {
            return Response.json(
              { error: "Valid email is required" },
              { status: 400 },
            );
          }

          if (password.length < 8) {
            return Response.json(
              {
                error:
                  "Password must be at least 8 characters",
              },
              { status: 400 },
            );
          }

          if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
            return Response.json(
              {
                error:
                  "Password must contain at least one letter and one number",
              },
              { status: 400 },
            );
          }

          const users =
            await getCollection<StoredUser>("users");

          const existing = await users.findOne({ email });

          if (existing) {
            return Response.json(
              {
                error:
                  "An account with this email already exists",
              },
              { status: 409 },
            );
          }

          const passwordHash =
            await hashPassword(password);

          const now = new Date().toISOString();

          const result = await users.insertOne({
            email,
            role,
            name,
            passwordHash,
            dob,
            country,
            createdAt: now,
            updatedAt: now,
          });

          return Response.json(
            {
              success: true,
              user: {
                id: result.insertedId.toString(),
                email,
                name,
                role,
              },
            },
            { status: 201 },
          );
        } catch (error) {
          console.error("Signup error:", error);

          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to create account",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
