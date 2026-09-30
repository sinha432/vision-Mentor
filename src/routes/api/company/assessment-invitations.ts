import { createFileRoute } from "@tanstack/react-router";
import { getAuthSession } from "@/lib/auth-session.server";
import { loadDotEnv } from "@/lib/server-env";
import { getAssessment, getIndividualUsersByIds } from "@/lib/mongodb.server";

loadDotEnv();

type InvitationResult = {
  candidateId: string;
  name: string;
  email: string;
  success: boolean;
  error?: string;
};

export const Route = createFileRoute("/api/company/assessment-invitations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = getAuthSession(request);
        if (!session || session.role !== "company") {
          return Response.json({ error: "Company session required" }, { status: 403 });
        }

        try {
          const body = (await request.json()) as { code?: unknown; candidateIds?: unknown };
          const code = typeof body.code === "string" ? body.code.trim() : "";
          const rawCandidateIds = body.candidateIds;

          if (!/^[A-Za-z0-9-]{1,100}$/.test(code)) {
            return Response.json({ error: "Valid assessment code is required" }, { status: 400 });
          }
          if (
            !Array.isArray(rawCandidateIds) ||
            rawCandidateIds.length === 0 ||
            rawCandidateIds.length > 25 ||
            rawCandidateIds.some((id) => typeof id !== "string" || !id.trim() || id.length > 100)
          ) {
            return Response.json(
              { error: "Select between 1 and 25 valid candidates" },
              { status: 400 },
            );
          }
          const candidateIds = [...new Set(rawCandidateIds as string[])];

          const assessment = await getAssessment(code);
          if (!assessment || assessment.companyUserId !== session.id) {
            return Response.json({ error: "Assessment not found" }, { status: 404 });
          }
          if (assessment.status !== "active") {
            return Response.json({ error: "This assessment is closed" }, { status: 409 });
          }

          const candidates = await getIndividualUsersByIds(candidateIds);
          const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
          const serviceId = process.env.EMAILJS_ASSESSMENT_SERVICE_ID?.trim();
          const templateId = process.env.EMAILJS_ASSESSMENT_TEMPLATE_ID?.trim();
          const publicKey = process.env.EMAILJS_ASSESSMENT_PUBLIC_KEY?.trim();
          const privateKey = process.env.EMAILJS_ASSESSMENT_PRIVATE_KEY?.trim();
          const appBaseUrl = (
            process.env.APP_BASE_URL?.trim() || new URL(request.url).origin
          ).replace(/\/+$/, "");
          const testLink = `${appBaseUrl}/a/${encodeURIComponent(assessment.code)}`;

          const results: InvitationResult[] = await Promise.all(
            candidateIds.map(async (candidateId) => {
              const candidate = candidatesById.get(candidateId);
              if (!candidate) {
                return {
                  candidateId,
                  name: "Candidate",
                  email: "",
                  success: false,
                  error: "Candidate account was not found.",
                };
              }
              if (!serviceId || !templateId || !publicKey || !privateKey) {
                return {
                  ...candidate,
                  candidateId,
                  success: false,
                  error: "Assessment email is not configured.",
                };
              }

              try {
                const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    service_id: serviceId,
                    template_id: templateId,
                    user_id: publicKey,
                    accessToken: privateKey,
                    template_params: {
                      to_email: candidate.email,
                      candidate_name: candidate.name,
                      candidate_email: candidate.email,
                      assessment_title: assessment.title,
                      test_link: testLink,
                      company_name: session.name,
                      app_name: "Vision Mentor X",
                    },
                  }),
                });

                if (!response.ok) {
                  const providerMessage = (await response.text()).trim().slice(0, 300);
                  console.error(
                    "Assessment invitation EmailJS error:",
                    response.status,
                    providerMessage,
                  );
                  return {
                    ...candidate,
                    candidateId,
                    success: false,
                    error:
                      response.status === 403 &&
                      providerMessage.toLowerCase().includes("non-browser environments")
                        ? "EmailJS server-side API access is disabled. Enable API access from non-browser environments in EmailJS Account > Security, then retry."
                        : response.status === 403
                          ? "EmailJS denied this request. Confirm the assessment service ID, public/private keys, and template belong to the same EmailJS account, and that the service and template are active."
                          : `EmailJS could not send this invitation (HTTP ${response.status}).`,
                  };
                }

                return { ...candidate, candidateId, success: true };
              } catch (error) {
                console.error("Assessment invitation request failed:", error);
                return {
                  ...candidate,
                  candidateId,
                  success: false,
                  error: "The invitation could not be sent. Try again.",
                };
              }
            }),
          );

          return Response.json({ results, testLink });
        } catch (error) {
          console.error("Assessment invitation request failed:", error);
          return Response.json({ error: "Could not send assessment invitations" }, { status: 500 });
        }
      },
    },
  },
});
