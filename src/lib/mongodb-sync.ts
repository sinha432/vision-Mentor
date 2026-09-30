import type {
  StoredAssessment,
  StoredAttempt,
  StoredReport,
} from "@/lib/assessment-types";

/**
 * Helper to sync data to MongoDB with localStorage fallback.
 * This runs in the browser and calls the server API endpoints.
 */

export async function syncInterviewToMongoDB(interview: any): Promise<any> {
  try {
    const response = await fetch("/api/db/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(interview),
    });

    if (!response.ok) {
      console.warn("MongoDB sync failed, will use localStorage");
      return null;
    }

    const result = await response.json();
    console.log("✓ Interview synced to MongoDB");
    return result;
  } catch (error) {
    console.warn("MongoDB sync error:", error);
    return null;
  }
}

export async function syncAssessmentToMongoDB(assessment: any): Promise<any> {
  try {
    const response = await fetch("/api/db/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assessment),
    });

    if (!response.ok) {
      console.warn("MongoDB sync failed, will use localStorage");
      return null;
    }

    const result = await response.json();
    console.log("✓ Assessment synced to MongoDB");
    return result;
  } catch (error) {
    console.warn("MongoDB sync error:", error);
    return null;
  }
}

export async function syncUserToMongoDB(user: any): Promise<any> {
  try {
    const response = await fetch("/api/db/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });

    if (!response.ok) {
      console.warn("MongoDB sync failed, will use localStorage");
      return null;
    }

    const result = await response.json();
    console.log("✓ User synced to MongoDB");
    return result;
  } catch (error) {
    console.warn("MongoDB sync error:", error);
    return null;
  }
}

export async function fetchInterviewFromMongoDB(sessionId: string): Promise<any> {
  try {
    const response = await fetch(`/api/db/interview?sessionId=${encodeURIComponent(sessionId)}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn("Failed to fetch interview from MongoDB:", error);
    return null;
  }
}

export async function fetchUserInterviewsFromMongoDB(email: string): Promise<any[]> {
  try {
    const response = await fetch(`/api/db/interview?email=${encodeURIComponent(email)}`);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.warn("Failed to fetch user interviews from MongoDB:", error);
    return [];
  }
}

export async function fetchAssessmentFromMongoDB(
  code: string,
): Promise<any | null | undefined> {
  try {
    const response = await fetch(`/api/db/assessment?code=${encodeURIComponent(code)}`);
    if (!response.ok) return undefined;
    return await response.json();
  } catch (error) {
    console.warn("Failed to fetch assessment from MongoDB:", error);
    return undefined;
  }
}

export async function fetchCompanyAssessmentsFromMongoDB(
  companyUserId: string,
): Promise<any[] | null> {
  try {
    const response = await fetch(
      `/api/db/assessment?companyUserId=${encodeURIComponent(companyUserId)}`,
    );
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data) ? data : null;
  } catch (error) {
    console.warn("Failed to fetch company assessments from MongoDB:", error);
    return null;
  }
}

export async function deleteAssessmentFromMongoDB(
  code: string,
  companyUserId: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/db/assessment?code=${encodeURIComponent(code)}&companyUserId=${encodeURIComponent(companyUserId)}`,
      { method: "DELETE" },
    );
    if (!response.ok) return false;
    const result = (await response.json()) as { deleted?: boolean };
    return result.deleted === true;
  } catch (error) {
    console.warn("Failed to delete assessment from MongoDB:", error);
    return false;
  }
}

export async function updateAssessmentStatusInMongoDB(
  code: string,
  companyUserId: string,
  status: "active" | "closed",
): Promise<boolean> {
  try {
    const response = await fetch("/api/db/assessment", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, companyUserId, status }),
    });
    return response.ok;
  } catch (error) {
    console.warn("Failed to update MongoDB assessment status:", error);
    return false;
  }
}

export async function deleteCandidateFromMongoDB(
  individualUserId: string,
  companyUserId: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/db/candidate?individualUserId=${encodeURIComponent(individualUserId)}&companyUserId=${encodeURIComponent(companyUserId)}`,
      { method: "DELETE" },
    );
    return response.ok;
  } catch (error) {
    console.warn("Failed to delete candidate data from MongoDB:", error);
    return false;
  }
}

export async function syncAssessmentSubmissionToMongoDB(
  attempt: any,
  report: any,
): Promise<boolean> {
  try {
    const response = await fetch("/api/db/submission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attempt, report }),
    });
    return response.ok;
  } catch (error) {
    console.warn("Assessment submission MongoDB sync failed:", error);
    return false;
  }
}

export async function fetchCompanyAssessmentSubmissionsFromMongoDB(
  companyUserId: string,
  code?: string,
): Promise<{ attempts: StoredAttempt[]; reports: StoredReport[] } | null> {
  try {
    const params = new URLSearchParams({ companyUserId });
    if (code) params.set("code", code);

    const response = await fetch(`/api/db/submission?${params.toString()}`);
    if (!response.ok) return null;

    const result = await response.json();
    if (!Array.isArray(result?.attempts) || !Array.isArray(result?.reports)) {
      return null;
    }

    return {
      attempts: result.attempts as StoredAttempt[],
      reports: result.reports as StoredReport[],
    };
  } catch (error) {
    console.warn("Failed to fetch company assessment submissions:", error);
    return null;
  }
}

export async function hasAssessmentSubmissionInMongoDB(
  code: string,
  individualUserId: string,
): Promise<boolean | null> {
  try {
    const params = new URLSearchParams({ code, individualUserId });
    const response = await fetch(`/api/db/submission?${params.toString()}`);
    if (!response.ok) return null;
    const result = await response.json();
    return typeof result?.submitted === "boolean" ? result.submitted : null;
  } catch (error) {
    console.warn("Failed to check MongoDB assessment submission:", error);
    return null;
  }
}

export async function fetchAssessmentReportFromMongoDB(
  reportId: string,
  userId: string,
): Promise<{ report: StoredReport; attempt: StoredAttempt; assessment: StoredAssessment } | null | undefined> {
  try {
    const params = new URLSearchParams({ reportId, userId });
    const response = await fetch(`/api/db/submission?${params.toString()}`);
    if (response.status === 404) return null;
    if (!response.ok) return undefined;
    return await response.json();
  } catch (error) {
    console.warn("Failed to fetch assessment report from MongoDB:", error);
    return undefined;
  }
}

export async function deleteIndividualReportsFromMongoDB(
  individualUserId: string,
  attemptIds: string[],
): Promise<boolean> {
  try {
    const response = await fetch("/api/db/reports/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ individualUserId, attemptIds }),
    });
    return response.ok;
  } catch (error) {
    console.warn("Failed to delete individual reports from MongoDB:", error);
    return false;
  }
}

export async function fetchUserFromMongoDB(email: string): Promise<any> {
  try {
    const response = await fetch(`/api/db/user?email=${encodeURIComponent(email)}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn("Failed to fetch user from MongoDB:", error);
    return null;
  }
}

export async function syncUserProfileToMongoDB(profile: any): Promise<any> {
  try {
    const response = await fetch("/api/db/user-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });

    if (!response.ok) {
      console.warn("User profile sync to MongoDB failed, will use localStorage");
      return null;
    }

    const result = await response.json();
    console.log("✓ User profile synced to MongoDB");
    return result;
  } catch (error) {
    console.warn("User profile sync error:", error);
    return null;
  }
}

export async function fetchUserProfileFromMongoDB(email: string): Promise<any> {
  try {
    const response = await fetch(`/api/db/user-profile?email=${encodeURIComponent(email)}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn("Failed to fetch user profile from MongoDB:", error);
    return null;
  }
}

export async function updateUserProfileInMongoDB(email: string, profile: any): Promise<any> {
  try {
    const response = await fetch(`/api/db/user-profile?email=${encodeURIComponent(email)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });

    if (!response.ok) {
      console.warn("User profile update in MongoDB failed");
      return null;
    }

    const result = await response.json();
    console.log("✓ User profile updated in MongoDB");
    return result;
  } catch (error) {
    console.warn("User profile update error:", error);
    return null;
  }
}

export async function fetchScheduledInterviewsFromMongoDB<T extends object>(
  companyUserId: string,
): Promise<T[] | null> {
  try {
    const response = await fetch(
      `/api/db/scheduled-interviews?companyUserId=${encodeURIComponent(companyUserId)}`,
    );
    if (!response.ok) return null;
    const interviews = await response.json();
    return Array.isArray(interviews) ? interviews as T[] : null;
  } catch (error) {
    console.warn("Failed to fetch scheduled interviews from MongoDB:", error);
    return null;
  }
}

export async function syncScheduledInterviewToMongoDB(
  companyUserId: string,
  interview: object,
): Promise<boolean> {
  try {
    const response = await fetch("/api/db/scheduled-interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...interview, companyUserId }),
    });
    return response.ok;
  } catch (error) {
    console.warn("Scheduled interview MongoDB sync failed:", error);
    return false;
  }
}

export async function deleteScheduledInterviewFromMongoDB(
  companyUserId: string,
  id: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/db/scheduled-interviews?companyUserId=${encodeURIComponent(companyUserId)}&id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    return response.ok;
  } catch (error) {
    console.warn("Scheduled interview MongoDB delete failed:", error);
    return false;
  }
}
