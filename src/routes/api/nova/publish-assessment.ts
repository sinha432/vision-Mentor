import { createFileRoute } from "@tanstack/react-router";
import {
  saveAssessment,
  type StoredAssessment,
} from "@/lib/mongodb.server";

type PublishQuestion = {
  id: string;
  type: "text" | "mcq" | "code";
  text: string;
  weight?: number;
  keywords?: string[];
};

type PublishAssessmentBody = {
  companyUserId: string;
  title: string;
  code: string;
  description?: string;
  questions: PublishQuestion[];
};

function createAssessmentCode(): string {
  return `NOVA-${Date.now().toString(36).toUpperCase()}`;
}

export const Route = createFileRoute(
  "/api/nova/publish-assessment",
)({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body =
            (await request.json()) as Partial<PublishAssessmentBody>;

          if (!body.companyUserId) {
            return new Response(
              JSON.stringify({
                error: "Missing companyUserId",
              }),
              {
                status: 400,
                headers: {
                  "Content-Type": "application/json",
                },
              },
            );
          }

          if (!body.title?.trim()) {
            return new Response(
              JSON.stringify({
                error: "Missing assessment title",
              }),
              {
                status: 400,
                headers: {
                  "Content-Type": "application/json",
                },
              },
            );
          }

          if (
            !Array.isArray(body.questions) ||
            body.questions.length === 0
          ) {
            return new Response(
              JSON.stringify({
                error:
                  "At least one question is required",
              }),
              {
                status: 400,
                headers: {
                  "Content-Type": "application/json",
                },
              },
            );
          }

          const questions =
            body.questions.map((question, index) => ({
              id:
                question.id ||
                `nova-question-${Date.now()}-${index}`,
              type: question.type || "text",
              text: question.text.trim(),
              weight: question.weight ?? 10,
              keywords: question.keywords ?? [],
            }));

          const invalidQuestion =
            questions.find(
              (question) =>
                !question.text.trim(),
            );

          if (invalidQuestion) {
            return new Response(
              JSON.stringify({
                error:
                  "Every question must contain text",
              }),
              {
                status: 400,
                headers: {
                  "Content-Type": "application/json",
                },
              },
            );
          }

          const assessment: StoredAssessment = {
            companyUserId:
              body.companyUserId,
            title: body.title.trim(),
            code:
              body.code?.trim() ||
              createAssessmentCode(),
            description:
              body.description?.trim() ||
              "AI-generated assessment created by Nova Hiring Copilot.",
            status: "active",
            questions,
            createdAt:
              new Date().toISOString(),
            updatedAt:
              new Date().toISOString(),
          };

          const saved =
            await saveAssessment(assessment);

          return new Response(
            JSON.stringify({
              success: true,
              assessment: saved,
              message:
                "Assessment published successfully.",
            }),
            {
              status: 200,
              headers: {
                "Content-Type":
                  "application/json",
              },
            },
          );
        } catch (error) {
          console.error(
            "Nova assessment publication failed:",
            error,
          );

          return new Response(
            JSON.stringify({
              error:
                "Failed to publish assessment",
            }),
            {
              status: 500,
              headers: {
                "Content-Type":
                  "application/json",
              },
            },
          );
        }
      },
    },
  },
});