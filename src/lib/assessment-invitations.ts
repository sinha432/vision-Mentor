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

export type InvitationRecipient = {
  id: string;
  name: string;
  email: string;
};

export async function sendAssessmentInvitations(
  code: string,
  recipients: string[] | InvitationRecipient[],
): Promise<InvitationResponse> {
  const candidateIds: string[] = [];
  const emailRecipients: { name: string; email: string }[] = [];
  for (const recipient of recipients) {
    if (typeof recipient === "string") {
      candidateIds.push(recipient);
    } else if (recipient.id.startsWith("email:")) {
      emailRecipients.push({ name: recipient.name, email: recipient.email });
    } else {
      candidateIds.push(recipient.id);
    }
  }

  const response = await fetch("/api/company/assessment-invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, candidateIds, recipients: emailRecipients }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(result.results)) {
    throw new Error(result.error ?? "Could not send assessment invitations");
  }
  return result as InvitationResponse;
}
