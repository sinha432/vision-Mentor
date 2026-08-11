export interface CompanyProfile {
  id: string;
  name: string;
  tagline: string;
  interviewStyle: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  behavioralStyle: string;
  communicationStyle: string;
  evaluationStyle: string;
  focus: string[];
  initial: string;
}

export const COMPANIES: CompanyProfile[] = [
  {
    id: "google",
    name: "Google",
    tagline: "Algorithmic depth & structured thinking",
    interviewStyle: "Whiteboard-style problem solving with strong emphasis on reasoning out loud",
    difficulty: 5,
    behavioralStyle: "Googleyness — collaboration, ambiguity tolerance, intellectual humility",
    communicationStyle: "Calm, probing, asks 'why' repeatedly",
    evaluationStyle: "Rubric-based on problem solving, coding, design, communication",
    focus: ["DSA", "System Design", "Problem Solving", "Coding"],
    initial: "G",
  },
  {
    id: "amazon",
    name: "Amazon",
    tagline: "Leadership Principles & data-backed stories",
    interviewStyle: "STAR-format behavioral bar-raiser plus coding",
    difficulty: 4,
    behavioralStyle: "16 Leadership Principles, Customer Obsession, Ownership, Bias for Action",
    communicationStyle: "Direct, drills into metrics and your specific contribution",
    evaluationStyle: "Leadership Principle signals with data evidence",
    focus: ["Leadership Principles", "Behavioral", "Coding"],
    initial: "A",
  },
  {
    id: "microsoft",
    name: "Microsoft",
    tagline: "Problem solving, OOP & real projects",
    interviewStyle: "Conversational technical deep dive into your projects",
    difficulty: 4,
    behavioralStyle: "Growth mindset, collaboration, customer empathy",
    communicationStyle: "Friendly, collaborative, hint-giving",
    evaluationStyle: "Design quality, code clarity, project ownership",
    focus: ["Problem Solving", "OOP", "Projects", "Coding"],
    initial: "M",
  },
  {
    id: "apple",
    name: "Apple",
    tagline: "Craft, detail obsession & fundamentals",
    interviewStyle: "Precise questions on fundamentals and quality of craft",
    difficulty: 5,
    behavioralStyle: "Detail orientation, secrecy-aware collaboration, high standards",
    communicationStyle: "Terse, exacting, expects precision in wording",
    evaluationStyle: "Depth of fundamentals and attention to detail",
    focus: ["Fundamentals", "Systems", "Craft", "Coding"],
    initial: "",
  },
  {
    id: "meta",
    name: "Meta",
    tagline: "Speed, scale & impact",
    interviewStyle: "Timed coding plus product/system scaling discussion",
    difficulty: 5,
    behavioralStyle: "Move fast, impact-driven, ambiguity comfort",
    communicationStyle: "Fast-paced, expects concise answers",
    evaluationStyle: "Speed + correctness + impact framing",
    focus: ["Coding", "Scaling", "Product Sense", "Impact"],
    initial: "M",
  },
  {
    id: "netflix",
    name: "Netflix",
    tagline: "Senior-level judgement & candour",
    interviewStyle: "Context-heavy scenario debate, high autonomy expectations",
    difficulty: 5,
    behavioralStyle: "Freedom & responsibility, radical candour, no-brilliant-jerks",
    communicationStyle: "Blunt, challenges your position to test conviction",
    evaluationStyle: "Judgement, selflessness, candour",
    focus: ["Judgement", "Scenarios", "Architecture", "Candour"],
    initial: "N",
  },
  {
    id: "oracle",
    name: "Oracle",
    tagline: "Databases, SQL & enterprise systems",
    interviewStyle: "Structured technical questioning on data and backend",
    difficulty: 3,
    behavioralStyle: "Reliability, process discipline, client focus",
    communicationStyle: "Formal, sequential, checklist-driven",
    evaluationStyle: "SQL accuracy, data modelling, backend depth",
    focus: ["SQL", "Databases", "Backend", "OOP"],
    initial: "O",
  },
  {
    id: "adobe",
    name: "Adobe",
    tagline: "Product craft & applied CS",
    interviewStyle: "Applied coding with product/UX reasoning",
    difficulty: 4,
    behavioralStyle: "Creativity, ownership, cross-functional empathy",
    communicationStyle: "Warm, curious about your creative decisions",
    evaluationStyle: "Applied problem solving + product thinking",
    focus: ["Coding", "Product Craft", "OOP", "Projects"],
    initial: "A",
  },
  {
    id: "tcs",
    name: "TCS",
    tagline: "Fundamentals, aptitude & fitment",
    interviewStyle: "Panel-style CS fundamentals, project walkthrough, HR fitment",
    difficulty: 2,
    behavioralStyle: "Adaptability, willingness to relocate, learning attitude",
    communicationStyle: "Polite, formal, checklist of fundamentals",
    evaluationStyle: "Fundamentals coverage + communication + attitude",
    focus: ["CS Fundamentals", "DBMS", "Projects", "HR Fitment"],
    initial: "T",
  },
  {
    id: "infosys",
    name: "Infosys",
    tagline: "Core CS, coding basics & communication",
    interviewStyle: "Technical fundamentals followed by managerial and HR rounds",
    difficulty: 2,
    behavioralStyle: "Team fit, learnability, integrity",
    communicationStyle: "Structured, encouraging, textbook-oriented",
    evaluationStyle: "Concept clarity and communication",
    focus: ["CS Fundamentals", "Coding Basics", "DBMS", "HR"],
    initial: "I",
  },
  {
    id: "accenture",
    name: "Accenture",
    tagline: "Client readiness & applied tech",
    interviewStyle: "Scenario-driven consulting-flavoured technical interview",
    difficulty: 3,
    behavioralStyle: "Client first, stakeholder communication, ownership",
    communicationStyle: "Professional, scenario framing, business context",
    evaluationStyle: "Applied tech + client communication",
    focus: ["Scenarios", "Applied Tech", "Communication", "SQL"],
    initial: "A",
  },
  {
    id: "capgemini",
    name: "Capgemini",
    tagline: "Delivery mindset & core tech",
    interviewStyle: "Core technical Q&A with delivery/process questions",
    difficulty: 3,
    behavioralStyle: "Collaboration, process adherence, adaptability",
    communicationStyle: "Measured, methodical, documentation-minded",
    evaluationStyle: "Core tech + process discipline",
    focus: ["Core Tech", "Agile", "SQL", "Projects"],
    initial: "C",
  },
  {
    id: "ibm",
    name: "IBM",
    tagline: "Hybrid cloud, AI & engineering depth",
    interviewStyle: "Technical depth with cloud/AI context and behavioral blend",
    difficulty: 3,
    behavioralStyle: "Growth, client value, continuous learning",
    communicationStyle: "Consultative, explains context before asking",
    evaluationStyle: "Technical depth + learning agility",
    focus: ["Cloud", "AI/ML", "Coding", "Behavioral"],
    initial: "I",
  },
];

export function getCompany(id: string): CompanyProfile {
  return COMPANIES.find((c) => c.id === id) ?? COMPANIES[0];
}

export const ROLES = [
  "Software Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Engineer",
  "Data Analyst",
  "Data Scientist",
  "ML Engineer",
  "DevOps Engineer",
  "QA Engineer",
  "Business Analyst",
] as const;

export const EXPERIENCE_LEVELS = [
  { id: "student", label: "Student / Final year" },
  { id: "fresher", label: "Fresher (0–1 yrs)" },
  { id: "junior", label: "Junior (1–3 yrs)" },
  { id: "mid", label: "Mid-level (3–6 yrs)" },
  { id: "senior", label: "Senior (6+ yrs)" },
] as const;

/* ------------------------------------------------------------------ */
/* hiring brief & eligibility                                          */
/* ------------------------------------------------------------------ */

export interface CompanyHiringData {
  about: string;
  process: string[];
  /** Baseline eligibility that applies to every role at this company. */
  eligibilityBase: string[];
  screens: string[];
  rejections: string[];
}

export interface CompanyHiring extends Omit<CompanyHiringData, "eligibilityBase"> {
  eligibility: (role: string) => string[];
}

const HIRING: Record<string, CompanyHiringData> = {
  google: {
    about:
      "Google hires generalist engineers through a standardised, rubric-scored loop. Pedigree matters less than demonstrable problem solving.",
    process: [
      "Online assessment or recruiter screen",
      "1–2 technical phone screens (DSA, 45 min each)",
      "Onsite loop: 3–4 coding rounds + 1 behavioural (Googleyness)",
      "Hiring committee review, then team match",
    ],
    eligibilityBase: [
      "Bachelor's in CS/IT or equivalent practical experience",
      "No formal CGPA cutoff, but strong coding evidence expected",
      "Publicly verifiable projects, internships or open-source help",
    ],
    screens: [
      "Optimal solutions with correct complexity analysis",
      "Reasoning out loud, handling hints without stalling",
      "Clean, compiling code on the first pass",
    ],
    rejections: [
      "Brute-force answer with no optimisation attempt",
      "Silent thinking — interviewer cannot score your reasoning",
    ],
  },
  amazon: {
    about:
      "Amazon interviews are built around the 16 Leadership Principles; every answer is scored for a specific principle with data behind it.",
    process: [
      "Online assessment (coding + work simulation)",
      "Technical phone screen",
      "Loop of 4–5 rounds, each mapped to Leadership Principles, incl. a bar raiser",
    ],
    eligibilityBase: [
      "Bachelor's degree (any engineering branch accepted)",
      "Freshers: OA performance drives shortlisting",
      "Experienced: 2+ shipped, measurable projects",
    ],
    screens: [
      "STAR stories with your specific contribution and metrics",
      "Customer Obsession and Ownership evidence",
      "Working code plus edge-case handling",
    ],
    rejections: [
      '"We" stories with no personal ownership',
      "No numbers to back the impact claimed",
    ],
  },
  microsoft: {
    about:
      "Microsoft runs a conversational loop that goes deep into your own projects and design decisions.",
    process: [
      "Recruiter screen",
      "1–2 technical rounds (coding + OOP/design)",
      "As-appropriate round with a senior leader",
    ],
    eligibilityBase: [
      "Bachelor's in CS/IT or related field",
      "Campus hiring typically 7.0+ CGPA / 70%",
      "At least one substantial project you can defend end to end",
    ],
    screens: [
      "Clarity of design choices and trade-offs",
      "Object-oriented modelling quality",
      "Collaboration — using hints well",
    ],
    rejections: [
      "Cannot explain your own project's architecture",
      "Code that ignores readability and edge cases",
    ],
  },
  apple: {
    about:
      "Apple hires for craft and depth in a specific area; teams interview independently and expect precision.",
    process: [
      "Recruiter screen",
      "Team-specific technical screens",
      "Onsite with 4–6 interviewers from the hiring team",
    ],
    eligibilityBase: [
      "Bachelor's/Master's in CS, EE or related field",
      "Deep specialism in the team's domain",
      "Confidentiality-friendly work history",
    ],
    screens: [
      "Fundamentals — memory, concurrency, systems detail",
      "Exact wording and precision in explanations",
      "Quality obsession in the small details",
    ],
    rejections: [
      "Hand-wavy fundamentals under follow-up questioning",
      "Breadth without any real depth",
    ],
  },
  meta: {
    about:
      "Meta optimises for speed and impact: timed coding plus product/system scaling discussion.",
    process: [
      "Recruiter screen",
      "Technical screen (2 problems in 45 min)",
      "Onsite: 2 coding, 1 system/product design, 1 behavioural (Jedi)",
    ],
    eligibilityBase: [
      "Bachelor's in CS or equivalent experience",
      "Strong competitive-programming-style speed",
      "Evidence of shipping at scale for senior roles",
    ],
    screens: [
      "Two clean solutions inside the time box",
      "Scaling reasoning with concrete numbers",
      "Impact framing — what moved because of you",
    ],
    rejections: [
      "Only one problem finished in the coding screen",
      "Design answers with no scale estimation",
    ],
  },
  netflix: {
    about:
      "Netflix hires senior, self-directed engineers and tests judgement and candour more than puzzles.",
    process: [
      "Recruiter screen on context and expectations",
      "Hiring-manager deep dive",
      "Loop of scenario debates with peers and cross-functional partners",
    ],
    eligibilityBase: [
      "Senior-level experience (typically 6+ yrs)",
      "Track record of independent, high-stakes decisions",
      "Comfort with direct feedback culture",
    ],
    screens: [
      "Judgement under ambiguity",
      "Willingness to disagree with evidence",
      "Architecture ownership at scale",
    ],
    rejections: [
      "Needing direction rather than setting it",
      "Backing down from a correct position when challenged",
    ],
  },
  oracle: {
    about:
      "Oracle interviews are structured and data-centric, weighted towards SQL, databases and enterprise backend.",
    process: [
      "Online aptitude + technical test",
      "Technical rounds on SQL, DBMS and backend",
      "Managerial and HR round",
    ],
    eligibilityBase: [
      "Bachelor's in CS/IT/ECE",
      "Campus bar usually 6.5–7.0 CGPA, no active backlogs",
      "Working SQL knowledge is non-negotiable",
    ],
    screens: [
      "Query correctness including joins and window functions",
      "Normalisation and indexing reasoning",
      "Transaction/isolation understanding",
    ],
    rejections: [
      "SQL that does not run or ignores NULL behaviour",
      "Theory recited without applying it to a schema",
    ],
  },
  adobe: {
    about:
      "Adobe blends applied coding with product craft — how your choices affect the user matters.",
    process: [
      "Online coding test",
      "2 technical rounds (coding + design/OOP)",
      "Hiring manager round on product thinking",
    ],
    eligibilityBase: [
      "Bachelor's in CS/IT or design-adjacent engineering",
      "Campus bar around 7.0 CGPA",
      "A portfolio project with visible UX decisions",
    ],
    screens: [
      "Applied problem solving on realistic features",
      "Clean OOP modelling",
      "Reasoning about the end user",
    ],
    rejections: [
      "Solving the literal prompt while missing the user need",
      "No justification for creative or UX decisions",
    ],
  },
  tcs: {
    about: "TCS hires at volume through NQT, weighting fundamentals, communication and fitment.",
    process: [
      "TCS NQT (aptitude + coding)",
      "Technical panel round on CS fundamentals and projects",
      "Managerial + HR fitment round",
    ],
    eligibilityBase: [
      "Full-time UG/PG degree, 60%+ throughout (10th, 12th, degree)",
      "No active backlogs at the time of joining",
      "Max 2-year education gap; willing to relocate anywhere in India",
    ],
    screens: [
      "Breadth of CS fundamentals (OOP, DBMS, OS, networks)",
      "Clear spoken communication",
      "Learning attitude and flexibility",
    ],
    rejections: [
      "Backlogs or percentage below the stated cutoff",
      "Unwillingness to relocate or work on any tech stack",
    ],
  },
  infosys: {
    about:
      "Infosys hires freshers through HackWithInfy/InfyTQ and lateral candidates on core tech interviews.",
    process: [
      "Online assessment (aptitude, reasoning, coding)",
      "Technical interview on fundamentals and coding basics",
      "HR round on stability and fitment",
    ],
    eligibilityBase: [
      "Full-time degree with 60%+ aggregate",
      "No active backlogs; consistent academic record",
      "Open to any location and technology allocation",
    ],
    screens: [
      "Concept clarity over memorisation",
      "Basic coding correctness",
      "Integrity and team fit",
    ],
    rejections: [
      "Textbook definitions without an example",
      "Cannot write a simple program without help",
    ],
  },
  accenture: {
    about:
      "Accenture screens for client readiness: applied technology plus stakeholder communication.",
    process: [
      "Cognitive and technical assessment",
      "Coding round",
      "Technical + HR interview with scenario questions",
    ],
    eligibilityBase: [
      "Full-time degree, 60%+ aggregate",
      "No active backlogs; max 1-year gap",
      "Comfortable with client-facing communication",
    ],
    screens: [
      "Applying tech to a business scenario",
      "Explaining technical work to non-technical stakeholders",
      "SQL and core language basics",
    ],
    rejections: [
      "Technically right but unable to explain it simply",
      "No structure when handling an open scenario",
    ],
  },
  capgemini: {
    about: "Capgemini focuses on delivery discipline alongside core technical ability.",
    process: [
      "Game-based aptitude + technical assessment",
      "Technical interview on core tech and SQL",
      "HR round on process and availability",
    ],
    eligibilityBase: [
      "Full-time degree with 60%+ aggregate",
      "No active backlogs at time of joining",
      "Willing to work in Agile delivery teams across locations",
    ],
    screens: [
      "Core language and SQL correctness",
      "Understanding of Agile/SDLC process",
      "Documentation and handover mindset",
    ],
    rejections: [
      "No awareness of how work is delivered in a team",
      "Weak fundamentals in the chosen primary language",
    ],
  },
  ibm: {
    about:
      "IBM hires for hybrid cloud and AI work, mixing technical depth with consultative behaviour.",
    process: [
      "Cognitive ability assessment + coding",
      "Technical interview with cloud/AI context",
      "Behavioural/managerial round",
    ],
    eligibilityBase: [
      "Bachelor's/Master's in CS, IT or related field",
      "65%+ aggregate for campus roles",
      "Exposure to cloud, containers or ML tooling helps",
    ],
    screens: [
      "Depth in one technical area plus cloud literacy",
      "Learning agility across shifting stacks",
      "Client-value framing of your work",
    ],
    rejections: [
      "No hands-on exposure beyond coursework",
      "Cannot connect technical work to business value",
    ],
  },
};

const ROLE_ELIGIBILITY: Record<string, string> = {
  "Software Engineer": "Solid DSA plus one production-quality project or internship",
  "Frontend Engineer": "React/TypeScript depth with accessibility and performance awareness",
  "Backend Engineer": "APIs, database design and one deployed service you own",
  "Full Stack Engineer": "End-to-end ownership of at least one deployed app",
  "Data Analyst": "Strong SQL plus a dashboard/reporting portfolio",
  "Data Scientist": "Statistics, Python and a modelling project with measured results",
  "ML Engineer": "Model training plus deployment/inference experience",
  "DevOps Engineer": "CI/CD, containers and infrastructure-as-code exposure",
  "QA Engineer": "Test design plus at least one automation framework",
  "Business Analyst": "Requirements gathering, SQL and stakeholder documentation",
};

const EXPERIENCE_HINT: Record<string, string> = {
  student: "Students/freshers: projects and internships stand in for work history",
  senior: "Senior candidates: expect ownership and mentoring evidence",
};

export function getHiring(companyId: string): CompanyHiring {
  const data = HIRING[companyId] ?? HIRING.google;
  return {
    about: data.about,
    process: data.process,
    screens: data.screens,
    rejections: data.rejections,
    eligibility: (role: string) => {
      const roleLine = ROLE_ELIGIBILITY[role];
      return roleLine ? [...data.eligibilityBase, roleLine] : data.eligibilityBase;
    },
  };
}

export const EXPERIENCE_ELIGIBILITY_HINT = EXPERIENCE_HINT;
