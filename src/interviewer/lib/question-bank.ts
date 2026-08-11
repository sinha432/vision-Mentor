import type { CodeLanguage, QuestionKind } from "./interview-types";

export type BankPhase = "technical" | "coding" | "behavioral" | "hr";
export type RoleTrack = "frontend" | "backend" | "fullstack" | "data" | "general";

export interface BankQuestion {
  id: string;
  track: RoleTrack;
  phase: BankPhase;
  kind: QuestionKind;
  topic: string;
  difficulty: number;
  prompt: string;
  /** MCQ only */
  options?: string[];
  /** MCQ only — index into options */
  correctOption?: number;
  /** coding only */
  language?: CodeLanguage;
  starterCode?: string;
  testCases?: { input: string; expected: string }[];
  /** The verified reference answer a strong candidate would give. */
  referenceAnswer: string;
  /** Rubric key points; grading checks how many were covered. */
  keyPoints: string[];
}

export const QUESTION_BANK: BankQuestion[] = [
  // ---------------- Frontend · technical ----------------
  {
    id: "fe-t-1",
    track: "frontend",
    phase: "technical",
    kind: "text",
    topic: "React rendering",
    difficulty: 2,
    prompt:
      "Walk me through what actually happens when React state changes. Where does re-rendering stop, and how do you keep a large list from re-rendering on every keystroke?",
    referenceAnswer:
      "setState schedules a render; React re-renders that component and its subtree, diffs the new element tree against the old one and commits only the changed DOM. Children re-render even if their props are equal unless they are memoized. Large lists are kept cheap with React.memo on the row, stable keys, memoized callbacks/values (useCallback/useMemo), keeping the fast-changing state local to the input, and virtualization for very long lists.",
    keyPoints: [
      "State change schedules a render of the component and its subtree",
      "Reconciliation diffs the element tree and commits only real DOM changes",
      "Children re-render by default; memoization is opt-in",
      "React.memo / useMemo / useCallback with stable keys",
      "Keep fast-changing state local, or virtualize long lists",
    ],
  },
  {
    id: "fe-t-2",
    track: "frontend",
    phase: "technical",
    kind: "mcq",
    topic: "JavaScript event loop",
    difficulty: 2,
    prompt:
      "In a browser, which of these callbacks runs first after the currently executing script finishes?",
    options: [
      "A setTimeout(fn, 0) callback",
      "A promise .then() callback (microtask)",
      "A requestAnimationFrame callback",
      "A setInterval(fn, 0) callback",
    ],
    correctOption: 1,
    referenceAnswer:
      "Microtasks (promise callbacks) drain completely after the current script and before any macrotask such as setTimeout, setInterval, or the next animation frame.",
    keyPoints: ["Microtask queue drains before macrotasks", "Promise callbacks are microtasks"],
  },
  {
    id: "fe-t-3",
    track: "frontend",
    phase: "technical",
    kind: "text",
    topic: "Web performance",
    difficulty: 3,
    prompt:
      "A product page has a Largest Contentful Paint of 4.2 seconds. How do you diagnose it, and what are the concrete fixes you would ship first?",
    referenceAnswer:
      "Measure first with field data (CrUX/RUM) plus a Lighthouse/WebPageTest trace to find whether LCP is blocked by TTFB, render-blocking resources, or the hero asset itself. Typical fixes: cache/CDN and server response work for TTFB, preload the LCP image with correct sizes and modern formats, remove render-blocking CSS/JS, inline critical CSS, defer non-critical scripts, self-host fonts with font-display:swap, and code-split the bundle.",
    keyPoints: [
      "Measure with field + lab data before guessing",
      "Split LCP into TTFB, render-blocking, and resource load time",
      "Optimize/preload the hero image, modern formats, correct sizing",
      "Remove render-blocking CSS/JS, inline critical CSS, defer the rest",
      "CDN/caching and bundle code-splitting",
    ],
  },
  {
    id: "fe-t-4",
    track: "frontend",
    phase: "technical",
    kind: "text",
    topic: "Accessibility",
    difficulty: 3,
    prompt:
      "You are building a custom dropdown from divs. What does it take for that component to be genuinely accessible?",
    referenceAnswer:
      "Use native elements where possible; otherwise implement the combobox/listbox ARIA pattern: role=combobox with aria-expanded and aria-controls on the trigger, role=listbox/option for the menu, aria-activedescendant or roving tabindex, full keyboard support (arrows, Home/End, Enter, Escape, typeahead), focus trapping and restoration, visible focus styles, and testing with a real screen reader plus axe.",
    keyPoints: [
      "Prefer native semantics; ARIA only when necessary",
      "Correct roles and aria-expanded/controls/activedescendant",
      "Full keyboard interaction model including Escape and focus return",
      "Visible focus indicators and contrast",
      "Verify with a screen reader / automated audit",
    ],
  },
  {
    id: "fe-t-5",
    track: "frontend",
    phase: "technical",
    kind: "mcq",
    topic: "CSS layout",
    difficulty: 1,
    prompt: "Which statement about CSS `position: sticky` is correct?",
    options: [
      "It removes the element from normal flow like position: fixed",
      "It sticks relative to its nearest scrolling ancestor and requires a threshold such as top",
      "It only works inside a flex container",
      "It always sticks to the viewport regardless of overflow on ancestors",
    ],
    correctOption: 1,
    referenceAnswer:
      "Sticky elements stay in normal flow and stick within their scroll container once a threshold (top/bottom/left/right) is reached; an ancestor with overflow hidden/auto changes the containing scroll context.",
    keyPoints: ["Stays in flow", "Needs a threshold", "Scoped to the scroll container"],
  },

  // ---------------- Backend · technical ----------------
  {
    id: "be-t-1",
    track: "backend",
    phase: "technical",
    kind: "text",
    topic: "Database indexing",
    difficulty: 3,
    prompt:
      "A query filtering on `status` and sorting by `created_at` got slow at ten million rows. How do you find the problem and fix it?",
    referenceAnswer:
      "Read EXPLAIN ANALYZE to see whether it is a sequential scan, a bad index choice, or an expensive sort. A composite index on (status, created_at DESC) lets the index satisfy both the filter and the ordering; keyset pagination beats large OFFSETs; covering indexes avoid heap lookups. Watch selectivity, stale statistics, and index write cost.",
    keyPoints: [
      "EXPLAIN ANALYZE before changing anything",
      "Composite index ordered to match filter + sort",
      "Keyset pagination instead of large OFFSET",
      "Covering index / selectivity considerations",
      "Indexes cost writes and storage",
    ],
  },
  {
    id: "be-t-2",
    track: "backend",
    phase: "technical",
    kind: "mcq",
    topic: "HTTP semantics",
    difficulty: 2,
    prompt: "Which HTTP method is idempotent but NOT safe?",
    options: ["GET", "POST", "PUT", "CONNECT"],
    correctOption: 2,
    referenceAnswer:
      "PUT changes server state (so it is not safe) but repeating the same PUT produces the same result (idempotent). GET is both safe and idempotent; POST is neither.",
    keyPoints: ["PUT is idempotent", "PUT is not safe because it mutates state"],
  },
  {
    id: "be-t-3",
    track: "backend",
    phase: "technical",
    kind: "scenario",
    topic: "Distributed systems",
    difficulty: 4,
    prompt:
      "Your payment service sometimes charges a customer twice when the client retries. How do you design this away?",
    referenceAnswer:
      "Make the charge endpoint idempotent: the client sends an idempotency key, the server stores key -> result in a durable store inside the same transaction, and returns the stored result for repeats. Add a unique constraint on (order_id) as the last line of defence, use an outbox/state machine for downstream effects, exponential backoff with jitter on retries, and reconcile against the payment provider.",
    keyPoints: [
      "Idempotency key persisted with the result",
      "Uniqueness constraint at the data layer",
      "Transactional/outbox handling of side effects",
      "Safe retry policy with backoff",
      "Reconciliation with the provider",
    ],
  },
  {
    id: "be-t-4",
    track: "backend",
    phase: "technical",
    kind: "text",
    topic: "Caching",
    difficulty: 3,
    prompt:
      "Explain the caching strategy you would use for a read-heavy API, including how you handle invalidation and a cache stampede.",
    referenceAnswer:
      "Cache-aside with a TTL for most reads, write-through where consistency matters. Invalidate by key on write or use short TTL plus versioned keys. Prevent stampedes with request coalescing / single-flight locks, early (probabilistic) refresh, and stale-while-revalidate. Layer browser, CDN, and application caches, and always measure hit rate.",
    keyPoints: [
      "Cache-aside vs write-through trade-off",
      "Key-based or versioned invalidation with TTL",
      "Stampede protection: single-flight lock or early refresh",
      "Stale-while-revalidate",
      "Multiple cache layers and hit-rate monitoring",
    ],
  },

  // ---------------- Data · technical ----------------
  {
    id: "da-t-1",
    track: "data",
    phase: "technical",
    kind: "text",
    topic: "Model evaluation",
    difficulty: 3,
    prompt:
      "Your fraud model has 99% accuracy but the business says it is useless. What happened and what do you measure instead?",
    referenceAnswer:
      "Class imbalance — predicting the majority class gives high accuracy with no recall on fraud. Use precision, recall, F1, PR-AUC, and confusion-matrix analysis at the operating threshold chosen from the cost of false positives vs false negatives; consider resampling, class weights, and threshold tuning, and validate on a time-based split.",
    keyPoints: [
      "Class imbalance makes accuracy misleading",
      "Precision/recall/F1 and PR-AUC",
      "Threshold chosen from business cost asymmetry",
      "Resampling or class weighting",
      "Time-aware validation split",
    ],
  },
  {
    id: "da-t-2",
    track: "data",
    phase: "technical",
    kind: "mcq",
    topic: "Statistics",
    difficulty: 2,
    prompt: "In an A/B test, a p-value of 0.03 means:",
    options: [
      "There is a 3% chance the null hypothesis is true",
      "There is a 97% chance variant B is better",
      "If the null hypothesis were true, data this extreme would occur 3% of the time",
      "The effect size is 3%",
    ],
    correctOption: 2,
    referenceAnswer:
      "A p-value is the probability of observing data at least this extreme assuming the null hypothesis is true. It is not the probability that the hypothesis is true, and it says nothing about effect size.",
    keyPoints: ["Conditional on the null being true", "Not the probability of the hypothesis"],
  },

  // ---------------- General · technical ----------------
  {
    id: "ge-t-1",
    track: "general",
    phase: "technical",
    kind: "text",
    topic: "System design basics",
    difficulty: 3,
    prompt:
      "Design a URL shortener that must handle a hundred million redirects a day. Walk me through the key decisions.",
    referenceAnswer:
      "Short code generation (base62 of an ID sequence or hash with collision check), a key-value store optimised for reads, an aggressive cache/CDN layer in front of redirects, 301 vs 302 trade-off for analytics, sharding and replication for scale, async analytics via a queue, and rate limiting plus abuse detection on creation.",
    keyPoints: [
      "Code generation scheme and collision handling",
      "Read-optimised storage plus caching/CDN",
      "Redirect status code trade-off",
      "Horizontal scaling: sharding/replication",
      "Async analytics and abuse protection",
    ],
  },
  {
    id: "ge-t-2",
    track: "general",
    phase: "technical",
    kind: "mcq",
    topic: "Complexity",
    difficulty: 1,
    prompt:
      "What is the average time complexity of looking up a key in a well-distributed hash table?",
    options: ["O(log n)", "O(1)", "O(n)", "O(n log n)"],
    correctOption: 1,
    referenceAnswer:
      "Average case is O(1); worst case degrades to O(n) when many keys collide into one bucket.",
    keyPoints: ["O(1) average", "O(n) worst case with collisions"],
  },
  {
    id: "ge-t-3",
    track: "general",
    phase: "technical",
    kind: "text",
    topic: "Version control & delivery",
    difficulty: 2,
    prompt:
      "A bad deploy just reached production. Talk me through exactly what you do in the first fifteen minutes.",
    referenceAnswer:
      "Stop the bleeding first: roll back or flip the feature flag, confirm recovery on dashboards, then communicate status. Only after mitigation do you investigate with logs, traces, and the diff, add a regression test, and write a blameless postmortem with follow-up actions.",
    keyPoints: [
      "Mitigate before diagnosing — rollback or feature flag",
      "Verify recovery with metrics",
      "Communicate to stakeholders",
      "Root-cause with logs/traces and the diff",
      "Regression test and blameless postmortem",
    ],
  },

  // ---------------- Coding ----------------
  {
    id: "co-1",
    track: "general",
    phase: "coding",
    kind: "coding",
    topic: "Arrays & hashing",
    difficulty: 2,
    language: "python",
    prompt:
      "Given an array of integers and a target, return the indices of the two numbers that add up to the target. Assume exactly one solution. Aim for linear time and explain your complexity.",
    starterCode: "def two_sum(nums, target):\n    # return a list of two indices\n    pass\n",
    testCases: [
      { input: "two_sum([2,7,11,15], 9)", expected: "[0, 1]" },
      { input: "two_sum([3,2,4], 6)", expected: "[1, 2]" },
      { input: "two_sum([3,3], 6)", expected: "[0, 1]" },
    ],
    referenceAnswer:
      "Single pass with a dict mapping value -> index. For each number check whether target - num is already in the dict; if so return the stored index and the current index, otherwise store the current value. O(n) time, O(n) space.",
    keyPoints: [
      "Hash map of seen values to indices",
      "Single pass checking the complement",
      "O(n) time and O(n) space stated correctly",
      "Returns indices, not values",
    ],
  },
  {
    id: "co-2",
    track: "general",
    phase: "coding",
    kind: "coding",
    topic: "Strings",
    difficulty: 2,
    language: "javascript",
    prompt:
      "Write a function that returns the length of the longest substring without repeating characters. Explain your approach and complexity.",
    starterCode:
      "function longestUnique(s) {\n  // return the length of the longest substring with all-unique characters\n}\n",
    testCases: [
      { input: 'longestUnique("abcabcbb")', expected: "3" },
      { input: 'longestUnique("bbbbb")', expected: "1" },
      { input: 'longestUnique("pwwkew")', expected: "3" },
      { input: 'longestUnique("")', expected: "0" },
    ],
    referenceAnswer:
      "Sliding window with a map of character -> last index. Move the right pointer, and when a repeat is inside the window move the left pointer past its previous index. Track the max window size. O(n) time, O(min(n, alphabet)) space.",
    keyPoints: [
      "Sliding window with two pointers",
      "Map of last seen index per character",
      "Left pointer never moves backwards",
      "O(n) time complexity",
      "Handles the empty string",
    ],
  },
  {
    id: "co-3",
    track: "backend",
    phase: "coding",
    kind: "coding",
    topic: "SQL",
    difficulty: 3,
    language: "sql",
    prompt:
      "Tables: orders(id, customer_id, total_cents, created_at) and customers(id, name). Write a query returning the top 5 customers by total spend in the last 30 days, including customers' names and their order counts.",
    starterCode: "-- top 5 customers by spend in the last 30 days\nSELECT\n",
    testCases: [
      {
        input: "Customer with 3 orders totalling 50000 cents in window",
        expected: "appears once with order_count 3 and total 50000",
      },
    ],
    referenceAnswer:
      "SELECT c.name, COUNT(o.id) AS order_count, SUM(o.total_cents) AS total FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.created_at >= NOW() - INTERVAL '30 days' GROUP BY c.id, c.name ORDER BY total DESC LIMIT 5;",
    keyPoints: [
      "JOIN customers to orders on customer_id",
      "Date filter on created_at for the last 30 days",
      "GROUP BY the customer with SUM and COUNT aggregates",
      "ORDER BY total spend DESC with LIMIT 5",
    ],
  },
  {
    id: "co-4",
    track: "frontend",
    phase: "coding",
    kind: "coding",
    topic: "Async JavaScript",
    difficulty: 3,
    language: "javascript",
    prompt:
      "Implement a `debounce(fn, wait)` that returns a debounced function preserving `this` and arguments, plus a `.cancel()` method. Explain when you would use debounce over throttle.",
    starterCode:
      "function debounce(fn, wait) {\n  // return a debounced function with a .cancel() method\n}\n",
    testCases: [
      { input: "3 rapid calls within wait", expected: "fn called once with the last arguments" },
      { input: "cancel() before the timer fires", expected: "fn never called" },
    ],
    referenceAnswer:
      "Keep a timer id in closure; each call clears the pending timer and schedules a new one that invokes fn.apply(this, args) after wait. Expose cancel() to clearTimeout and reset. Debounce waits for a pause in activity (search-as-you-type); throttle guarantees a call at a fixed rate (scroll handlers).",
    keyPoints: [
      "Closure over the timer id, cleared on each call",
      "Preserves this and arguments via apply",
      "cancel() clears the pending timer",
      "Correct debounce vs throttle distinction",
    ],
  },

  // ---------------- Behavioral ----------------
  {
    id: "be-b-1",
    track: "general",
    phase: "behavioral",
    kind: "text",
    topic: "Conflict & collaboration",
    difficulty: 2,
    prompt:
      "Tell me about a time you disagreed with a teammate on a technical decision. What did you do, and how did it end?",
    referenceAnswer:
      "A specific story in STAR form: the situation and stakes, your concrete actions to surface data and hear the other view, the decision made, the measurable outcome, and what you would do differently.",
    keyPoints: [
      "Specific real situation, not a hypothetical",
      "Clear personal actions (I, not we)",
      "Evidence or data used to resolve the disagreement",
      "Concrete outcome",
      "Reflection or learning",
    ],
  },
  {
    id: "be-b-2",
    track: "general",
    phase: "behavioral",
    kind: "scenario",
    topic: "Ownership under pressure",
    difficulty: 3,
    prompt:
      "You are two days from a launch and discover a bug that affects a small share of users. The fix is risky. What do you do, and who do you tell?",
    referenceAnswer:
      "Quantify impact and severity, check for a low-risk mitigation or feature flag, escalate transparently to the stakeholders with options and a recommendation, and make the call by user harm rather than schedule pressure — with a plan to monitor and follow up post-launch.",
    keyPoints: [
      "Quantify blast radius and severity first",
      "Look for lower-risk mitigation (flag, partial rollout)",
      "Transparent early escalation with options",
      "Decision framed around user impact, not ego or schedule",
      "Monitoring and follow-up plan",
    ],
  },
  {
    id: "be-b-3",
    track: "general",
    phase: "behavioral",
    kind: "text",
    topic: "Learning & growth",
    difficulty: 2,
    prompt:
      "Describe something you got wrong in a project. What was the actual mistake, and what changed in how you work afterwards?",
    referenceAnswer:
      "An honest, specific failure with real ownership, the concrete consequence, and a durable behaviour change (process, testing, communication) that has since been applied.",
    keyPoints: [
      "Genuine mistake, owned without deflecting",
      "Specific consequence described",
      "Concrete change in behaviour or process",
      "Evidence the change stuck",
    ],
  },

  // ---------------- HR ----------------
  {
    id: "hr-1",
    track: "general",
    phase: "hr",
    kind: "text",
    topic: "Motivation & fit",
    difficulty: 1,
    prompt:
      "Why this company, and why this role specifically? Be concrete — what about how we work appeals to you?",
    referenceAnswer:
      "A researched, specific answer connecting the company's products, engineering culture or scale to the candidate's own goals and experience, rather than generic praise.",
    keyPoints: [
      "Specific knowledge of the company or its products",
      "Link to the candidate's own experience or goals",
      "Honest, non-generic motivation",
    ],
  },
  {
    id: "hr-2",
    track: "general",
    phase: "hr",
    kind: "text",
    topic: "Career trajectory",
    difficulty: 1,
    prompt:
      "Where do you want your skills to be in two years, and what kind of work gets you there?",
    referenceAnswer:
      "A realistic trajectory with named skills or scope, tied to the role on offer, showing self-awareness about current gaps.",
    keyPoints: [
      "Concrete skills or scope named",
      "Realistic and tied to this role",
      "Awareness of current gaps",
    ],
  },
];

const TRACK_KEYWORDS: { track: RoleTrack; words: string[] }[] = [
  { track: "frontend", words: ["frontend", "front-end", "ui", "react", "web developer", "client"] },
  {
    track: "backend",
    words: ["backend", "back-end", "server", "api", "java developer", "platform", "devops", "sre"],
  },
  {
    track: "fullstack",
    words: ["full stack", "fullstack", "full-stack", "software engineer", "sde"],
  },
  {
    track: "data",
    words: ["data", "machine learning", "ml", "ai", "analyst", "scientist", "analytics"],
  },
];

export function trackForRole(role: string): RoleTrack {
  const value = role.toLowerCase();
  for (const entry of TRACK_KEYWORDS) {
    if (entry.words.some((word) => value.includes(word))) return entry.track;
  }
  return "general";
}

function tracksFor(track: RoleTrack): RoleTrack[] {
  if (track === "fullstack") return ["fullstack", "frontend", "backend", "general"];
  if (track === "general") return ["general", "fullstack", "backend", "frontend"];
  return [track, "fullstack", "general"];
}

export function selectBankQuestion(params: {
  role: string;
  phase: BankPhase;
  difficulty: number;
  usedIds: string[];
  focus?: string[];
}): BankQuestion | null {
  const allowed = tracksFor(trackForRole(params.role));
  const focus = (params.focus ?? []).map((f) => f.toLowerCase());
  const pool = QUESTION_BANK.filter(
    (q) => q.phase === params.phase && allowed.includes(q.track) && !params.usedIds.includes(q.id),
  );
  if (pool.length === 0) return null;

  const scored = pool.map((q) => {
    const trackRank = allowed.indexOf(q.track);
    const focusHit = focus.some(
      (f) => q.topic.toLowerCase().includes(f) || f.includes(q.topic.toLowerCase()),
    )
      ? 0
      : 1;
    const distance = Math.abs(q.difficulty - params.difficulty);
    return { q, key: distance * 10 + focusHit * 3 + trackRank };
  });
  scored.sort((a, b) => a.key - b.key);
  return scored[0].q;
}

export function getBankQuestion(id: string | null | undefined): BankQuestion | null {
  if (!id) return null;
  return QUESTION_BANK.find((q) => q.id === id) ?? null;
}

/** Deterministic MCQ grading: accepts option text, "B", or "2". */
export function gradeMcq(question: BankQuestion, answer: string): boolean | null {
  if (question.kind !== "mcq" || question.correctOption == null || !question.options) return null;
  const clean = answer.trim().toLowerCase();
  if (!clean) return false;
  const correct = question.options[question.correctOption].trim().toLowerCase();
  if (clean === correct || clean.includes(correct)) return true;

  const letter = clean.match(/^\(?([a-d])\)?[).\s]?/);
  if (letter) return letter[1].charCodeAt(0) - 97 === question.correctOption;

  const numeric = clean.match(/^\(?([1-9])\)?[).\s]?/);
  if (numeric) return Number(numeric[1]) - 1 === question.correctOption;

  // Fall back to matching whichever option shares the most distinctive words.
  const chosen = question.options.findIndex((option) =>
    clean.includes(option.trim().toLowerCase().slice(0, 24)),
  );
  return chosen === -1 ? false : chosen === question.correctOption;
}
