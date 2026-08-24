/**
 * Single data-access module for the company dashboard.
 *
 * Wired to the app's real server functions (src/lib/assessments.functions.ts).
 * Every dashboard screen imports from here, not from assessments.functions.ts
 * directly, so the field-name/shape adaptation only has to happen once.
 */

import {
  listCompanyAssessments as realListCompanyAssessments,
  setAssessmentStatus as realSetAssessmentStatus,
  deleteAssessment as realDeleteAssessment,
  listAssessmentAttempts as realListAssessmentAttempts,
  rescoreAssessmentAttempts as realRescoreAssessmentAttempts,
  getAssessmentByCode,
} from "@/lib/assessments.functions";

export type AssessmentStatus = "active" | "closed";

export interface CompanyAssessment {
  id: string;
  title: string;
  code: string;
  status: AssessmentStatus;
  questionCount: number;
  attemptCount: number;
  avgScore: number;
}

export interface AssessmentAttempt {
  id: string;
  candidateName: string;
  candidateEmail: string;
  submittedAt: string;
  score: number;
  reportUrl: string;
}

export interface CompanyProfile {
  name: string;
}

export function shareLink(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/a/${code}`;
}

function currentCompanyUserId(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("vmx_demo_user");
    if (!raw) return "";
    const u = JSON.parse(raw) as { id?: string; role?: string };
    return u.role === "company" ? (u.id ?? "") : "";
  } catch {
    return "";
  }
}

export async function listCompanyAssessments(): Promise<CompanyAssessment[]> {
  const companyUserId = currentCompanyUserId();
  if (!companyUserId) return [];
  const rows = await realListCompanyAssessments({ data: { companyUserId } });
  return rows.map((a) => ({
    id: a._id,
    title: a.title,
    code: a.code,
    status: a.status,
    questionCount: a.questions.length,
    attemptCount: a.attemptCount,
    avgScore: a.avgScore ?? 0,
  }));
}

export async function setAssessmentStatus(input: {
  id: string;
  status: AssessmentStatus;
}): Promise<void> {
  const companyUserId = currentCompanyUserId();
  if (!companyUserId) throw new Error("Not signed in as a company");
  await realSetAssessmentStatus({
    data: { assessmentId: input.id, companyUserId, status: input.status },
  });
}

export async function deleteAssessment(input: { id: string }): Promise<void> {
  const companyUserId = currentCompanyUserId();
  if (!companyUserId) throw new Error("Not signed in as a company");
  await realDeleteAssessment({ data: { assessmentId: input.id, companyUserId } });
}

export async function listAssessmentAttempts(input: {
  code: string;
}): Promise<AssessmentAttempt[]> {
  const companyUserId = currentCompanyUserId();
  if (!companyUserId) return [];

  // The real listAssessmentAttempts endpoint keys off the assessment's
  // internal id, not its share code, so resolve that first.
  const assessment = await getAssessmentByCode({ data: { code: input.code } });
  if (!assessment || assessment.companyUserId !== companyUserId) return [];

  const result = await realListAssessmentAttempts({
    data: { assessmentId: assessment._id, companyUserId },
  });

  return result.attempts.map((a) => ({
    id: a.attemptId,
    candidateName: a.candidateName,
    candidateEmail: a.candidateEmail,
    submittedAt: a.submittedAt,
    score: a.overallScore,
    reportUrl: a.reportId ? `/report/${a.reportId}` : "",
  }));
}

export async function rescoreAssessmentAttempts(input: {
  code: string;
}): Promise<{ rescored: number; results: { attemptId: string; reportId: string; before: number; after: number }[] }> {
  const companyUserId = currentCompanyUserId();
  if (!companyUserId) throw new Error("Not signed in as a company");

  const assessment = await getAssessmentByCode({ data: { code: input.code } });
  if (!assessment || assessment.companyUserId !== companyUserId) {
    throw new Error("Assessment not found");
  }

  return realRescoreAssessmentAttempts({
    data: { assessmentId: assessment._id, companyUserId },
  });
}

export async function getCompanyProfile(): Promise<CompanyProfile> {
  if (typeof window === "undefined") return { name: "Your Company" };
  try {
    const raw = localStorage.getItem("vmx_demo_user");
    if (!raw) return { name: "Your Company" };
    const u = JSON.parse(raw) as { name?: string; role?: string };
    return { name: u.role === "company" ? (u.name ?? "Your Company") : "Your Company" };
  } catch {
    return { name: "Your Company" };
  }
}
