import type { CompanyProfile } from "./companies";

export interface AtsBreakdownItem {
  label: string;
  score: number;
  max: number;
  hint: string;
}

export interface AtsResult {
  score: number;
  breakdown: AtsBreakdownItem[];
  presentKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
}

/** Keywords an ATS screen looks for, by target role. */
const ROLE_KEYWORDS: Record<string, string[]> = {
  "Software Engineer": ["data structures", "algorithms", "api", "testing", "git", "system design"],
  "Frontend Engineer": ["react", "typescript", "css", "accessibility", "performance", "responsive"],
  "Backend Engineer": ["api", "database", "sql", "caching", "microservices", "docker"],
  "Full Stack Engineer": ["react", "node", "api", "sql", "deployment", "testing"],
  "Data Analyst": ["sql", "excel", "dashboard", "power bi", "tableau", "statistics"],
  "Data Scientist": ["python", "machine learning", "pandas", "statistics", "model", "feature"],
  "ML Engineer": ["python", "pytorch", "tensorflow", "training", "inference", "pipeline"],
  "DevOps Engineer": ["ci/cd", "docker", "kubernetes", "terraform", "monitoring", "aws"],
  "QA Engineer": ["test cases", "automation", "selenium", "regression", "bug", "coverage"],
  "Business Analyst": ["requirements", "stakeholder", "process", "sql", "documentation", "kpi"],
};

const SECTION_HINTS: { label: string; patterns: RegExp[] }[] = [
  { label: "Contact details", patterns: [/@[\w.-]+\.\w+/, /\+?\d[\d\s-]{8,}/] },
  { label: "Skills section", patterns: [/\bskills?\b/i, /\btech(nologies|nical)\b/i] },
  { label: "Projects", patterns: [/\bprojects?\b/i] },
  { label: "Experience", patterns: [/\bexperience\b/i, /\bintern(ship)?\b/i, /\bemploy/i] },
  {
    label: "Education",
    patterns: [/\beducation\b/i, /\bb\.?\s?tech\b/i, /\bbachelor\b/i, /\bdegree\b/i],
  },
];

const ACTION_VERBS = [
  "built",
  "designed",
  "developed",
  "led",
  "shipped",
  "optimised",
  "optimized",
  "reduced",
  "improved",
  "automated",
  "migrated",
  "launched",
  "owned",
  "scaled",
];

const FORMATTING_RISKS: { test: RegExp; note: string }[] = [
  { test: /\t{2,}/, note: "Looks table/column formatted — ATS parsers drop multi-column layouts." },
  { test: /[│┃|]{2,}/, note: "Remove ASCII table borders; use plain bullet lines." },
  { test: /\b(page \d of \d)\b/i, note: "Remove headers/footers like page numbers." },
];

function keywordsFor(company: CompanyProfile, role: string): string[] {
  const focus = company.focus.map((f) => f.toLowerCase());
  const roleWords = ROLE_KEYWORDS[role] ?? ROLE_KEYWORDS["Software Engineer"];
  return Array.from(new Set([...focus, ...roleWords]));
}

/**
 * Instant, offline ATS estimate. Deterministic so the number can update as the
 * candidate types — no model call, no latency.
 */
export function computeAts(
  resumeText: string,
  company: CompanyProfile,
  role: string,
  experience: string,
): AtsResult {
  const text = resumeText.trim();
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);

  if (words.length < 20) {
    return {
      score: 0,
      breakdown: [],
      presentKeywords: [],
      missingKeywords: keywordsFor(company, role),
      suggestions: ["Paste or upload your resume to get a live ATS score."],
    };
  }

  const keywords = keywordsFor(company, role);
  const present = keywords.filter((k) => {
    const head = k.split(/[\s/]+/)[0];
    return lower.includes(k) || (head.length > 3 && lower.includes(head));
  });
  const missing = keywords.filter((k) => !present.includes(k));

  const suggestions: string[] = [];

  // 1. Keyword coverage (35)
  const keywordScore = Math.round((present.length / keywords.length) * 35);
  if (missing.length) {
    suggestions.push(
      `Add ${company.name}-relevant keywords naturally in your bullets: ${missing.slice(0, 5).join(", ")}.`,
    );
  }

  // 2. Section completeness (20)
  const missingSections = SECTION_HINTS.filter((s) => !s.patterns.some((p) => p.test(text)));
  const sectionScore = Math.round(
    ((SECTION_HINTS.length - missingSections.length) / SECTION_HINTS.length) * 20,
  );
  missingSections.forEach((s) =>
    suggestions.push(`Add a clearly labelled "${s.label}" section — parsers look for the heading.`),
  );

  // 3. Quantified achievements (20)
  const metrics = (
    text.match(/\b\d+(\.\d+)?\s?(%|k|x|ms|s|users|requests|hours|days|₹|\$)/gi) ?? []
  ).length;
  const metricScore = Math.min(20, metrics * 4);
  if (metrics < 4) {
    suggestions.push(
      "Quantify results — add numbers to at least 4 bullets (latency cut %, users served, hours saved).",
    );
  }

  // 4. Action verbs (10)
  const verbs = ACTION_VERBS.filter((v) => lower.includes(v)).length;
  const verbScore = Math.min(10, verbs * 2);
  if (verbs < 4)
    suggestions.push("Start bullets with action verbs (built, designed, reduced, led).");

  // 5. Length / density (10)
  const lengthScore = words.length < 180 ? 4 : words.length > 1100 ? 6 : 10;
  if (words.length < 180)
    suggestions.push("Resume is thin — expand projects with stack, scale and outcome.");
  if (words.length > 1100)
    suggestions.push("Trim to the strongest 1–2 pages; recruiters skim the top third.");

  // 6. Formatting safety (5)
  const risks = FORMATTING_RISKS.filter((r) => r.test.test(text));
  const formatScore = risks.length ? 0 : 5;
  risks.forEach((r) => suggestions.push(r.note));

  // Experience framing nudge (no score impact).
  if (/student|fresher/i.test(experience) && !/\b(project|intern)/i.test(lower)) {
    suggestions.push("With little experience, lead with projects and internships, not objectives.");
  }

  const score = Math.max(
    0,
    Math.min(
      100,
      keywordScore + sectionScore + metricScore + verbScore + lengthScore + formatScore,
    ),
  );

  return {
    score,
    breakdown: [
      {
        label: `${company.name} keyword match`,
        score: keywordScore,
        max: 35,
        hint: `${present.length}/${keywords.length} target keywords found`,
      },
      {
        label: "Section structure",
        score: sectionScore,
        max: 20,
        hint: missingSections.length
          ? `Missing: ${missingSections.map((s) => s.label).join(", ")}`
          : "All key sections detected",
      },
      {
        label: "Quantified impact",
        score: metricScore,
        max: 20,
        hint: `${metrics} measurable results`,
      },
      { label: "Action verbs", score: verbScore, max: 10, hint: `${verbs} strong verbs` },
      { label: "Length & density", score: lengthScore, max: 10, hint: `${words.length} words` },
      {
        label: "Parser safety",
        score: formatScore,
        max: 5,
        hint: risks.length ? "Formatting risks found" : "Clean plain-text layout",
      },
    ],
    presentKeywords: present,
    missingKeywords: missing,
    suggestions: suggestions.slice(0, 7),
  };
}
