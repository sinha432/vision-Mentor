import { createFileRoute } from "@tanstack/react-router";
import { getUser, getCollection } from "@/lib/mongodb.server";

type AuthCode = {
  email: string;
  code: string;
  purpose: "password_reset";
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
};

export const Route = createFileRoute("/api/auth/send-code")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();

          const email =
            typeof body.email === "string"
              ? body.email.trim().toLowerCase()
              : "";

          if (!email || !email.includes("@")) {
            return Response.json(
              { error: "Valid email is required" },
              { status: 400 },
            );
          }

          const user = await getUser(email);

          /*
           * Don't reveal whether an account exists.
           */
          if (!user) {
            return Response.json({
              success: true,
              message:
                "If an account exists for this email, a verification code has been sent.",
            });
          }

          const serviceId =
            process.env.EMAILJS_SERVICE_ID?.trim();

          const templateId =
            process.env.EMAILJS_TEMPLATE_ID?.trim();

          const publicKey =
            process.env.EMAILJS_PUBLIC_KEY?.trim();
            const privateKey =
  process.env.EMAILJS_PRIVATE_KEY?.trim();

         if (
  !serviceId ||
  !templateId ||
  !publicKey ||
  !privateKey ||
  serviceId === "your_service_id" ||
  templateId === "your_template_id" ||
  publicKey === "your_public_key" ||
  privateKey === "your_private_key"
) {
            console.error(
              "EmailJS environment variables are missing or still placeholders",
            );

            return Response.json(
              {
                error:
                  "Email service is not configured. Add the real EmailJS Service ID, Template ID and Public Key to .env and restart the server.",
              },
              { status: 500 },
            );
          }

          const code = String(
            Math.floor(
              100000 + Math.random() * 900000,
            ),
          );

          const expiresAt = new Date(
            Date.now() + 10 * 60 * 1000,
          );

          const authCodes =
            await getCollection<AuthCode>("auth_codes");

          await authCodes.updateOne(
            { email, purpose: "password_reset" },
            {
              $set: {
                email,
                code,
                purpose: "password_reset",
                expiresAt,
                attempts: 0,
                createdAt: new Date(),
              },
            },
            { upsert: true },
          );

          const emailResponse = await fetch(
            "https://api.emailjs.com/api/v1.0/email/send",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
             body: JSON.stringify({
  service_id: serviceId,
  template_id: templateId,
  user_id: publicKey,
  accessToken: privateKey,
  template_params: {
    to_email: email,
    code,
    purpose: "Password Reset",
    app_name: "Vision Mentor X",
  },
}),
            },
          );

          if (!emailResponse.ok) {
            const errorText =
              await emailResponse.text();

            console.error(
              "EmailJS error:",
              emailResponse.status,
              errorText,
            );

            await authCodes.deleteOne({
              email,
              purpose: "password_reset",
            });

            return Response.json(
              {
                error:
                  "Email could not be sent. Check your EmailJS Service ID, Template ID, Public Key and template configuration.",
              },
              { status: 502 },
            );
          }

          return Response.json({
            success: true,
            message: "Verification code sent",
          });
        } catch (error) {
          console.error(
            "Send OTP error:",
            error,
          );

          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to send OTP",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
