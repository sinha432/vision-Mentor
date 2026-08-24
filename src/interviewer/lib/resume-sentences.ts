import type { CompanyProfile } from "./companies";

export type SentenceKind =
  "experience" | "project" | "skills" | "education" | "contact" | "summary" | "heading" | "other";

export type SentenceStrength = "strong" | "ok" | "weak";

export interface SentenceInsight {
  text: string;
  kind: SentenceKind;
  strength: SentenceStrength;
  /** What is wrong with this exact line. */
  issues: string[];
  /** A concrete rewrite the candidate can paste back in. */
  rewrite: string | null;
  /** Company focus areas this line actually evidences. */
  matches: string[];
}

export interface ResumeValidation {
  isResume: boolean;
  /** 0-100 confidence that this document is a resume. */
  confidence: number;
  reason: string;
  /** What kind of document it looks like when it is not a resume. */
  looksLike: string;
}

export interface RequirementMatch {
  requirement: string;
  status: "evidenced" | "weak" | "missing";
  evidence: string;
}

export interface SentenceAnalysis {
  validation: ResumeValidation;
  sentences: SentenceInsight[];
  requirements: RequirementMatch[];
}

export function candidateNameMatchesResume(candidateName: string, resumeName: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1 && !/^(mr|mrs|ms|dr|prof)$/.test(token));
  const candidateTokens = normalize(candidateName);
  const resumeTokens = new Set(normalize(resumeName));
  return candidateTokens.length > 0 && candidateTokens.every((token) => resumeTokens.has(token));
}

const ACTION_VERBS =
  /\b(built|designed|developed|led|shipped|optimis|optimiz|reduced|improved|automated|migrated|launched|owned|scaled|implemented|delivered|architected|refactored|mentored|analysed|analyzed)/i;

const METRIC =
  /\b\d+(\.\d+)?\s?(%|k\b|x\b|ms\b|s\b|users|requests|hours|days|weeks|months|₹|\$|crore|lakh|mn|million)/i;

const WEAK_PHRASES = [
  "responsible for",
  "worked on",
  "involved in",
  "helped with",
  "hard working",
  "hardworking",
  "team player",
  "good communication",
  "quick learner",
  "familiar with",
  "basic knowledge",
];

const NON_RESUME_SIGNALS: { test: RegExp; looksLike: string }[] = [
  { test: /\b(invoice|invoice no|amount due|gst|tax invoice|bill to)\b/i, looksLike: "an invoice" },
  {
    test: /\b(terms and conditions|privacy policy|agreement between)\b/i,
    looksLike: "a legal document",
  },
  { test: /\b(abstract|references|doi|et al\.)\b/i, looksLike: "a research paper" },
  {
    test: /\b(admit card|marksheet|hall ticket|roll no\.)\b/i,
    looksLike: "a certificate or marksheet",
  },
  { test: /\b(dear sir|dear madam|yours sincerely|cover letter)\b/i, looksLike: "a cover letter" },
];

function classify(line: string): SentenceKind {
  const l = line.toLowerCase();
  if (/@[\w.-]+\.\w+/.test(line) || /\+?\d[\d\s-]{8,}/.test(line) || /linkedin|github/i.test(line))
    return "contact";
  if (line.length < 40 && /^[A-Z0-9\s&/-]+$/.test(line.trim())) return "heading";
  if (/\b(skills?|technolog|languages|frameworks|tools)\b/.test(l)) return "skills";
  if (
    /\b(b\.?tech|bachelor|master|m\.?sc|degree|university|college|cgpa|gpa|school|education)\b/.test(
      l,
    )
  )
    return "education";
  if (
    /\b(intern|engineer at|worked at|company|employment|experience|20\d\d\s?[-–]\s?(20\d\d|present))\b/.test(
      l,
    )
  )
    return "experience";
  if (/\b(project|built|developed|created|app|website|platform|system)\b/.test(l)) return "project";
  if (/\b(objective|summary|profile|seeking|aspiring)\b/.test(l)) return "summary";
  return "other";
}

function rewriteFor(line: string, kind: SentenceKind, focus: string[]): string | null {
  const trimmed = line.replace(/^[-•*\s]+/, "").trim();
  if (!trimmed) return null;
  const target = focus[0] ?? "the role";

  const weak = WEAK_PHRASES.find((w) => trimmed.toLowerCase().includes(w));
  if (weak) {
    const rest = trimmed
      .replace(new RegExp(weak, "i"), "")
      .replace(/^[\s:,-]+/, "")
      .trim();
    return `Built and owned ${rest || target} — state the stack you used and the measurable result (e.g. "cut response time 40%").`;
  }
  if (kind === "summary") {
    return `${target}-focused engineer with hands-on work in ${focus.slice(0, 2).join(" and ") || "the core stack"} — replace the objective with 2 lines of proof (what you shipped, the impact number).`;
  }
  if ((kind === "project" || kind === "experience") && !METRIC.test(trimmed)) {
    return `${trimmed.replace(/[.\s]+$/, "")}, cutting <metric> by <number>% for <number> users.`;
  }
  if ((kind === "project" || kind === "experience") && !ACTION_VERBS.test(trimmed)) {
    return `Designed and shipped ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
  }
  if (kind === "skills" && focus.length) {
    return `${trimmed.replace(/[.\s]+$/, "")} — group by ${focus.slice(0, 2).join(", ")} so the ${target} screen matches instantly.`;
  }
  return null;
}

/**
 * Sentence-by-sentence resume analysis: is this really a resume, how strong is
 * each line, and what would a stronger version of that line say for this
 * company. Fully deterministic so it can run as the candidate types.
 */
export function analyzeResumeSentences(
  resumeText: string,
  company: CompanyProfile,
  role: string,
): SentenceAnalysis {
  const text = resumeText.trim();
  const focus = company.focus.map((f) => f.toLowerCase());
  const lines = text
    .split(/\n+|(?<=[.;])\s{1,}(?=[A-Z])/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  if (lines.length < 3) {
    return {
      validation: {
        isResume: false,
        confidence: 0,
        reason: "There is not enough text to analyse — paste or upload the full resume.",
        looksLike: "an empty or unreadable file",
      },
      sentences: [],
      requirements: [],
    };
  }

  const sentences: SentenceInsight[] = lines.slice(0, 120).map((line) => {
    const kind = classify(line);
    const lower = line.toLowerCase();
    const matches = focus.filter((f) => lower.includes(f) || lower.includes(f.split(/[\s/]+/)[0]));
    const issues: string[] = [];

    const weak = WEAK_PHRASES.find((w) => lower.includes(w));
    if (weak) issues.push(`Filler phrase "${weak}" — recruiters skip it.`);
    if ((kind === "experience" || kind === "project") && !METRIC.test(line))
      issues.push("No measurable outcome in this line.");
    if ((kind === "experience" || kind === "project") && !ACTION_VERBS.test(line))
      issues.push("Does not start with a strong action verb.");
    if (kind === "summary") issues.push("Objective statements score poorly against ATS screens.");
    if (line.length > 220) issues.push("Too long — split into two bullets.");

    const strength: SentenceStrength =
      issues.length === 0 && (matches.length > 0 || METRIC.test(line))
        ? "strong"
        : issues.length >= 2
          ? "weak"
          : "ok";

    return {
      text: line,
      kind,
      strength,
      issues,
      rewrite: issues.length ? rewriteFor(line, kind, focus) : null,
      matches,
    };
  });

  // Validation: resume-shaped sentences vs. non-resume signals.
  const resumeLike = sentences.filter((s) =>
    ["experience", "project", "skills", "education", "contact"].includes(s.kind),
  ).length;
  const ratio = resumeLike / sentences.length;
  const hasContact = sentences.some((s) => s.kind === "contact");
  const hasEducationOrExp = sentences.some(
    (s) => s.kind === "education" || s.kind === "experience",
  );
  const foreign = NON_RESUME_SIGNALS.find((n) => n.test.test(text));

  let confidence = Math.round(ratio * 70 + (hasContact ? 15 : 0) + (hasEducationOrExp ? 15 : 0));
  if (foreign) confidence = Math.max(0, confidence - 55);
  confidence = Math.max(0, Math.min(100, confidence));
  const isResume = confidence >= 55 && !!hasEducationOrExp;

  const validation: ResumeValidation = {
    isResume,
    confidence,
    looksLike: foreign?.looksLike ?? (isResume ? "a resume" : "a non-resume document"),
    reason: isResume
      ? `${resumeLike} of ${sentences.length} sentences read as resume content (experience, projects, skills, education).`
      : foreign
        ? `This reads like ${foreign.looksLike}. Please upload your actual resume (PDF or DOCX).`
        : `Only ${resumeLike} of ${sentences.length} sentences read as resume content, and no clear experience or education section was found. Please upload the correct file.`,
  };

  // Line-by-line comparison against what this company screens for.
  const requirements: RequirementMatch[] = company.focus.map((req) => {
    const key = req.toLowerCase();
    const hit = sentences.find((s) => s.matches.includes(key));
    if (!hit) return { requirement: req, status: "missing", evidence: "" };
    const strong = hit.strength === "strong" || METRIC.test(hit.text);
    return {
      requirement: req,
      status: strong ? "evidenced" : "weak",
      evidence: hit.text.slice(0, 160),
    };
  });

  return { validation, sentences, requirements };
}
