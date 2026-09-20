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

export async function fetchAssessmentFromMongoDB(code: string): Promise<any> {
  try {
    const response = await fetch(`/api/db/assessment?code=${encodeURIComponent(code)}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn("Failed to fetch assessment from MongoDB:", error);
    return null;
  }
}

export async function fetchCompanyAssessmentsFromMongoDB(companyUserId: string): Promise<any[]> {
  try {
    const response = await fetch(
      `/api/db/assessment?companyUserId=${encodeURIComponent(companyUserId)}`,
    );
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("Failed to fetch company assessments from MongoDB:", error);
    return [];
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
