import { createFileRoute } from "@tanstack/react-router";
import { createGoogleCalendarUrl, type ScheduleCalendarDetails } from "@/lib/schedule-calendar";
import { loadDotEnv } from "@/lib/server-env";

loadDotEnv();

interface ScheduleNotificationRequest extends ScheduleCalendarDetails {}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function readDetails(body: unknown): ScheduleNotificationRequest | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const value = body as Record<string, unknown>;
  const details = {
    candidateName: typeof value.candidateName === "string" ? value.candidateName.trim() : "",
    candidateEmail: typeof value.candidateEmail === "string" ? value.candidateEmail.trim() : "",
    role: typeof value.role === "string" ? value.role.trim() : "",
    date: typeof value.date === "string" ? value.date : "",
    time: typeof value.time === "string" ? value.time : "",
    duration: typeof value.duration === "string" ? value.duration : "",
    notes: typeof value.notes === "string" ? value.notes.trim() : "",
    timeZone: typeof value.timeZone === "string" ? value.timeZone.trim() : "",
  };

  if (
    !details.candidateName ||
    !isValidEmail(details.candidateEmail) ||
    !details.role ||
    !/^\d{4}-\d{2}-\d{2}$/.test(details.date) ||
    !/^\d{2}:\d{2}$/.test(details.time) ||
    !/^\d+$/.test(details.duration) ||
    !details.timeZone
  ) {
    return null;
  }

  return details;
}

export const Route = createFileRoute("/api/company-schedule/notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const details = readDetails(await request.json());

          if (!details) {
            return Response.json(
              { error: "Valid interview details are required." },
              { status: 400 },
            );
          }

          const serviceId = process.env.EMAILJS_SERVICE_ID?.trim();
          const templateId = process.env.EMAILJS_SCHEDULE_TEMPLATE_ID?.trim();
          const publicKey = process.env.EMAILJS_PUBLIC_KEY?.trim();
          const privateKey = process.env.EMAILJS_PRIVATE_KEY?.trim();

          if (!serviceId || !templateId || !publicKey || !privateKey) {
            console.error("Schedule email service is not configured.");
            return Response.json(
              {
                error:
                  "Schedule email is not configured. Add EMAILJS_SCHEDULE_TEMPLATE_ID and EmailJS credentials to .env.",
              },
              { status: 500 },
            );
          }

          const calendarUrl = createGoogleCalendarUrl(details);
          const emailResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service_id: serviceId,
              template_id: templateId,
              user_id: publicKey,
              accessToken: privateKey,
              template_params: {
                to_email: details.candidateEmail,
                candidate_name: details.candidateName,
                candidate_email: details.candidateEmail,
                role: details.role,
                interview_date: details.date,
                interview_time: details.time,
                duration: details.duration,
                notes: details.notes || "No additional notes",
                timezone: details.timeZone,
                google_calendar_url: calendarUrl,
                app_name: "Vision Mentor X",
              },
            }),
          });

          if (!emailResponse.ok) {
            console.error(
              "Schedule EmailJS error:",
              emailResponse.status,
              await emailResponse.text(),
            );
            return Response.json(
              { error: "The interview was saved, but the confirmation email could not be sent." },
              { status: 502 },
            );
          }

          return Response.json({ success: true, calendarUrl });
        } catch (error) {
          console.error("Schedule notification error:", error);
          return Response.json(
            { error: "The interview was saved, but the confirmation email could not be sent." },
            { status: 500 },
          );
        }
      },
    },
  },
});
