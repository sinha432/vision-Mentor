import { createFileRoute } from "@tanstack/react-router";
import {
  getCollection,
  getUser,
} from "@/lib/mongodb.server";
import { hashPassword } from "@/lib/auth-password";

type ResetToken = {
  email: string;
  token: string;
  purpose: "password_reset";
  expiresAt: Date;
  createdAt: Date;
};

export const Route = createFileRoute(
  "/api/auth/reset-password",
)({
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

          const resetToken =
            typeof body.resetToken === "string"
              ? body.resetToken
              : "";

          if (!email || !resetToken) {
            return Response.json(
              {
                error:
                  "Reset token and email are required",
              },
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

          const resetTokens =
            await getCollection<ResetToken>(
              "password_reset_tokens",
            );

          const record =
            await resetTokens.findOne({
              email,
              token: resetToken,
              purpose: "password_reset",
            });

          if (!record) {
            return Response.json(
              {
                error:
                  "Invalid or expired reset session",
              },
              { status: 400 },
            );
          }

          if (
            new Date(record.expiresAt).getTime() <
            Date.now()
          ) {
            await resetTokens.deleteOne({
              _id: record._id,
            });

            return Response.json(
              {
                error:
                  "Password reset session has expired",
              },
              { status: 400 },
            );
          }

          const user = await getUser(email);

          if (!user) {
            return Response.json(
              {
                error:
                  "Unable to reset this account",
              },
              { status: 400 },
            );
          }

          const passwordHash =
            await hashPassword(password);

          const users =
            await getCollection("users");

          await users.updateOne(
            { email },
            {
              $set: {
                passwordHash,
                updatedAt: new Date().toISOString(),
              },
            },
          );

          await resetTokens.deleteOne({
            _id: record._id,
          });

          return Response.json({
            success: true,
            message: "Password updated successfully",
          });
        } catch (error) {
          console.error(
            "Reset password error:",
            error,
          );

          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to reset password",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
