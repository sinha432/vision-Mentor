export const ASSESSMENT_EMAIL_SETTING_NAMES = [
  "EMAILJS_ASSESSMENT_SERVICE_ID",
  "EMAILJS_ASSESSMENT_TEMPLATE_ID",
  "EMAILJS_ASSESSMENT_PUBLIC_KEY",
  "EMAILJS_ASSESSMENT_PRIVATE_KEY",
] as const;

export type AssessmentEmailSettings = Record<
  (typeof ASSESSMENT_EMAIL_SETTING_NAMES)[number],
  string | undefined
>;

export function missingAssessmentEmailSettings(settings: AssessmentEmailSettings): string[] {
  return ASSESSMENT_EMAIL_SETTING_NAMES.filter((name) => !settings[name]?.trim());
}

export function describeEmailJsFailure(status: number, providerMessage: string): string {
  const normalized = providerMessage.toLowerCase();
  if (status === 403 && normalized.includes("non-browser environments")) {
    return "EmailJS server-side API access is disabled. Enable API access from non-browser environments in EmailJS Account > Security, then retry.";
  }
  if (status === 400) {
    return "EmailJS rejected the message or template parameters. Check the active assessment template and its to_email, candidate_name, assessment_title, test_link, company_name, and app_name fields.";
  }
  if (status === 401 || status === 403) {
    return "EmailJS denied this request. Confirm the service, template, public key, and private key belong to the same active account.";
  }
  if (status === 429) {
    return "EmailJS rate limit reached. Wait a moment, then retry the failed invitation.";
  }
  if (status >= 500) {
    return "EmailJS is temporarily unavailable. Retry the failed invitation shortly.";
  }
  return `EmailJS could not send this invitation (HTTP ${status}).`;
}
