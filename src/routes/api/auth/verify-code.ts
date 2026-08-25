import { createFileRoute } from "@tanstack/react-router";
import {
  getCollection,
  getUser,
} from "@/lib/mongodb.server";
import { randomBytes } from "node:crypto";

type AuthCode = {
  email: string;
  code: string;
  purpose: "password_reset";
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
};

type ResetToken = {
  email: string;
  token: string;
  purpose: "password_reset";
  expiresAt: Date;
  createdAt: Date;
};

export const Route = createFileRoute(
  "/api/auth/verify-code",
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

          const code =
            typeof body.code === "string"
              ? body.code.trim()
              : "";

          if (!email || !code) {
            return Response.json(
              {
                error:
                  "Email and OTP are required",
              },
              { status: 400 },
            );
          }

          const user = await getUser(email);

          if (!user) {
            return Response.json(
              { error: "Invalid verification code" },
              { status: 400 },
            );
          }

          const authCodes =
            await getCollection<AuthCode>(
              "auth_codes",
            );

          const record =
            await authCodes.findOne({
              email,
              purpose: "password_reset",
            });

          if (!record) {
            return Response.json(
              {
                error:
                  "OTP not found or already used",
              },
              { status: 400 },
            );
          }

          if (
            new Date(record.expiresAt).getTime() <
            Date.now()
          ) {
            await authCodes.deleteOne({
              email,
              purpose: "password_reset",
            });

            return Response.json(
              { error: "OTP has expired" },
              { status: 400 },
            );
          }

          if ((record.attempts ?? 0) >= 5) {
            await authCodes.deleteOne({
              email,
              purpose: "password_reset",
            });

            return Response.json(
              {
                error:
                  "Too many incorrect attempts. Request a new OTP.",
              },
              { status: 429 },
            );
          }

          if (record.code !== code) {
            await authCodes.updateOne(
              {
                email,
                purpose: "password_reset",
              },
              {
                $inc: {
                  attempts: 1,
                },
              },
            );

            return Response.json(
              { error: "Invalid OTP" },
              { status: 400 },
            );
          }

          await authCodes.deleteOne({
            email,
            purpose: "password_reset",
          });

          const token = randomBytes(32).toString("hex");

          const resetTokens =
            await getCollection<ResetToken>(
              "password_reset_tokens",
            );

          await resetTokens.deleteMany({
            email,
            purpose: "password_reset",
          });

          await resetTokens.insertOne({
            email,
            token,
            purpose: "password_reset",
            expiresAt: new Date(
              Date.now() + 15 * 60 * 1000,
            ),
            createdAt: new Date(),
          });

          return Response.json({
            success: true,
            verified: true,
            resetToken: token,
          });
        } catch (error) {
          console.error(
            "Verify OTP error:",
            error,
          );

          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to verify OTP",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
