/**
 * Single data-access module for the company dashboard.
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
  industry: string;
  website: string;
  bio: string;
  contactEmail: string;
  phone: string;
  preferences: CompanyPreferences;
}

export interface CompanyPreferences {
  assessmentDefaults: {
    requireMedia: boolean;
    questionWeight: number;
  };
  notifications: {
    enabled: boolean;
    scheduleEmails: boolean;
    browserReminders: boolean;
    assessmentSubmissions: boolean;
  };
}

export interface UpdateCompanyProfileInput {
  companyName: string;
  industry: string;
  website: string;
  bio: string;
  contactEmail: string;
  phone: string;
  preferences?: CompanyPreferences;
}

const emptyCompanyProfile: CompanyProfile = {
  name: "Your Company",
  industry: "",
  website: "",
  bio: "",
  contactEmail: "",
  phone: "",
  preferences: {
    assessmentDefaults: {
      requireMedia: false,
      questionWeight: 1,
    },
    notifications: {
      enabled: true,
      scheduleEmails: true,
      browserReminders: true,
      assessmentSubmissions: true,
    },
  },
};

export function shareLink(code: string): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "";

  return `${origin}/a/${code}`;
}

function currentCompanyUserId(): string {
  if (typeof window === "undefined") return "";

  try {
    const activeRaw = localStorage.getItem("vmx_user");
    const storedRaw = localStorage.getItem("vmx_company_user");

    if (!activeRaw && !storedRaw) return "";

    const active = activeRaw ? JSON.parse(activeRaw) as { id?: string; role?: string } : null;
    const u = active?.role === "company"
      ? active
      : storedRaw
        ? JSON.parse(storedRaw) as { id?: string; role?: string }
        : null;

    if (!u) return "";

    const companyId = u.id;
    if (!companyId) return "";
    return companyId;
  } catch {
    return "";
  }
}

function currentCompanyEmail(): string {
  if (typeof window === "undefined") return "";

  try {
    const activeRaw = localStorage.getItem("vmx_user");
    const storedRaw = localStorage.getItem("vmx_company_user");

    if (!activeRaw && !storedRaw) return "";

    const active = activeRaw ? JSON.parse(activeRaw) as { email?: string; role?: string } : null;
    const u = active?.role === "company"
      ? active
      : storedRaw
        ? JSON.parse(storedRaw) as { email?: string; role?: string }
        : null;

    if (!u) return "";
    return u.email?.trim().toLowerCase() ?? "";
  } catch {
    return "";
  }
}

/* -------------------------------------------------------
   COMPANY ASSESSMENTS
------------------------------------------------------- */

export async function listCompanyAssessments(): Promise<
  CompanyAssessment[]
> {
  const companyUserId =
    currentCompanyUserId();

  if (!companyUserId) return [];

  const rows =
    await realListCompanyAssessments({
      data: { companyUserId },
    });

  return rows.map((a) => ({
    id: a._id,
    title: a.title,
    code: a.code,
    status: a.status,
    questionCount: Array.isArray(a.questions) ? a.questions.length : 0,
    attemptCount: a.attemptCount,
    avgScore: a.avgScore ?? 0,
  }));
}

export async function setAssessmentStatus(input: {
  id: string;
  status: AssessmentStatus;
}): Promise<void> {
  const companyUserId =
    currentCompanyUserId();

  if (!companyUserId) {
    throw new Error(
      "Not signed in as a company",
    );
  }

  await realSetAssessmentStatus({
    data: {
      assessmentId: input.id,
      companyUserId,
      status: input.status,
    },
  });
}

export async function deleteAssessment(input: {
  id: string;
  code?: string;
}): Promise<void> {
  const companyUserId =
    currentCompanyUserId();

  if (!companyUserId) {
    throw new Error(
      "Not signed in as a company",
    );
  }

  await realDeleteAssessment({
    data: {
      assessmentId: input.id,
      companyUserId,
      code: input.code,
    },
  });
}

export async function listAssessmentAttempts(
  input: { code: string },
): Promise<AssessmentAttempt[]> {
  const companyUserId =
    currentCompanyUserId();

  if (!companyUserId) return [];

  const assessment =
    await getAssessmentByCode({
      data: { code: input.code },
    });

  if (
    !assessment ||
    assessment.companyUserId !== companyUserId
  ) {
    return [];
  }

  const result =
    await realListAssessmentAttempts({
      data: {
        assessmentId: assessment._id,
        companyUserId,
      },
    });

  return result.attempts.map((a) => ({
    id: a.attemptId,
    candidateName: a.candidateName,
    candidateEmail: a.candidateEmail,
    submittedAt: a.submittedAt,
    score: a.overallScore,
    reportUrl: a.reportId
      ? `/report/${a.reportId}`
      : "",
  }));
}

export async function rescoreAssessmentAttempts(
  input: { code: string },
): Promise<{
  rescored: number;
  results: {
    attemptId: string;
    reportId: string;
    before: number;
    after: number;
  }[];
}> {
  const companyUserId =
    currentCompanyUserId();

  if (!companyUserId) {
    throw new Error(
      "Not signed in as a company",
    );
  }

  const assessment =
    await getAssessmentByCode({
      data: { code: input.code },
    });

  if (
    !assessment ||
    assessment.companyUserId !== companyUserId
  ) {
    throw new Error(
      "Assessment not found",
    );
  }

  return realRescoreAssessmentAttempts({
    data: {
      assessmentId: assessment._id,
      companyUserId,
    },
  });
}

/* -------------------------------------------------------
   COMPANY PROFILE
------------------------------------------------------- */

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const email = currentCompanyEmail();

  if (!email) {
    return emptyCompanyProfile;
  }

  try {
    const response = await fetch(
      `/api/db/user-profile?email=${encodeURIComponent(email)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Profile request failed: ${response.status}`,
      );
    }

    const profile = (await response.json()) as {
      name?: string;
      companyName?: string;
      industry?: string;
      website?: string;
      bio?: string;
      contactEmail?: string;
      phone?: string;
      preferences?: {
        notifications?: boolean;
        assessmentDefaults?: {
          requireMedia?: boolean;
          questionWeight?: number;
        };
        notificationPreferences?: {
          scheduleEmails?: boolean;
          browserReminders?: boolean;
          assessmentSubmissions?: boolean;
        };
      };
    } | null;

    if (!profile) {
      return {
        ...emptyCompanyProfile,
        name: getLocalCompanyName(),
      };
    }

    return {
      name:
        profile.companyName?.trim() ||
        profile.name?.trim() ||
        getLocalCompanyName(),

      industry:
        profile.industry ?? "",

      website:
        profile.website ?? "",

      bio:
        profile.bio ?? "",

      contactEmail:
        profile.contactEmail ??
        email,

      phone:
        profile.phone ?? "",
      preferences: {
        assessmentDefaults: {
          requireMedia:
            profile.preferences?.assessmentDefaults?.requireMedia ??
            false,
          questionWeight: Math.min(
            100,
            Math.max(
              1,
              profile.preferences?.assessmentDefaults?.questionWeight ??
                1,
            ),
          ),
        },
        notifications: {
          enabled:
            profile.preferences?.notifications ?? true,
          scheduleEmails:
            profile.preferences?.notificationPreferences?.scheduleEmails ??
            true,
          browserReminders:
            profile.preferences?.notificationPreferences?.browserReminders ??
            true,
          assessmentSubmissions:
            profile.preferences?.notificationPreferences?.assessmentSubmissions ??
            true,
        },
      },
    };
  } catch (error) {
    console.error(
      "Failed to load company profile:",
      error,
    );

    return {
      ...emptyCompanyProfile,
      name: getLocalCompanyName(),
      contactEmail: email,
    };
  }
}

function getLocalCompanyName(): string {
  if (typeof window === "undefined") {
    return "Your Company";
  }

  try {
    const raw = localStorage.getItem("vmx_user");

    if (!raw) {
      return "Your Company";
    }

    const u = JSON.parse(raw) as {
      name?: string;
      role?: string;
    };

    return u.role === "company"
      ? u.name?.trim() || "Your Company"
      : "Your Company";
  } catch {
    return "Your Company";
  }
}

export async function updateCompanyProfile(
  input: UpdateCompanyProfileInput,
): Promise<CompanyProfile> {
  const email = currentCompanyEmail();

  if (!email) {
    throw new Error(
      "Company account could not be identified.",
    );
  }

  const response = await fetch(
    `/api/db/user-profile?email=${encodeURIComponent(email)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        name: input.companyName,
        companyName: input.companyName,
        industry: input.industry,
        website: input.website,
        bio: input.bio,
        contactEmail: input.contactEmail,
        phone: input.phone,
        preferences: input.preferences
          ? {
              notifications: input.preferences.notifications.enabled,
              assessmentDefaults: input.preferences.assessmentDefaults,
              notificationPreferences: {
                scheduleEmails:
                  input.preferences.notifications.scheduleEmails,
                browserReminders:
                  input.preferences.notifications.browserReminders,
                assessmentSubmissions:
                  input.preferences.notifications.assessmentSubmissions,
              },
            }
          : undefined,
      }),
    },
  );

  const result = (await response.json()) as {
    error?: string;
    name?: string;
    companyName?: string;
    industry?: string;
    website?: string;
    bio?: string;
    contactEmail?: string;
    phone?: string;
    preferences?: CompanyPreferences;
  };

  if (!response.ok) {
    throw new Error(
      result.error ||
        "Failed to save company profile.",
    );
  }

  /*
   * Keep the company name synchronized with the
   * currently logged-in company account.
   */
  try {
  const raw = localStorage.getItem("vmx_user");

  if (raw) {
    const user = JSON.parse(raw) as {
      id?: string;
      email?: string;
      name?: string;
      role?: string;
    };

    if (user.role === "company") {
      user.name = input.companyName;

      localStorage.setItem(
        "vmx_user",
        JSON.stringify(user),
      );
    }
  }
} catch {
  // MongoDB save already succeeded.
}

  return {
    name:
      result.companyName ||
      result.name ||
      input.companyName,

    industry:
      result.industry ??
      input.industry,

    website:
      result.website ??
      input.website,

    bio:
      result.bio ??
      input.bio,

    contactEmail:
      result.contactEmail ??
      input.contactEmail,

    phone:
      result.phone ??
      input.phone,

    preferences:
      result.preferences ??
      input.preferences ??
      emptyCompanyProfile.preferences,
  };
}