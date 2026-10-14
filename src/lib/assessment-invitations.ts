export type InvitationResult = {
  candidateId: string;
  name: string;
  email: string;
  success: boolean;
  error?: string;
};

export type InvitationResponse = {
  results: InvitationResult[];
  testLink?: string;
};

export async function sendAssessmentInvitations(
  code: string,
  candidateIds: string[],
): Promise<InvitationResponse> {
  const response = await fetch("/api/company/assessment-invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, candidateIds }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(result.results)) {
    throw new Error(result.error ?? "Could not send assessment invitations");
  }
  return result as InvitationResponse;
}
