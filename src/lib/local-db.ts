// Browser-local persistence for accounts, assessments, attempts and reports.
//
// MongoDB integration: attempts to sync with MongoDB first, falls back to
// browser localStorage if MongoDB is unavailable.

import {
  newCode,
  newId,
  type StoredAssessment,
  type StoredAttempt,
  type StoredReport,
  type StoredUser,
} from "./assessment-types";
import { syncAssessmentToMongoDB, fetchAssessmentFromMongoDB } from "./mongodb-sync";

const KEYS = {
  users: "vmx_users",
  assessments: "vmx_assessments",
  attempts: "vmx_attempts",
  reports: "vmx_reports",
  seeded: "vmx_seeded_v1",
} as const;

const isBrowser = () => typeof window !== "undefined" && typeof localStorage !== "undefined";

function read<T>(key: string): T[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, rows: T[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(rows));
}

/* ------------------------------------------------------------------ */
/* sample data so the public live demo always has something to show    */
/* ------------------------------------------------------------------ */

export const DEMO_ASSESSMENT_CODE = "DEMO2024";

function seed(): void {
  if (!isBrowser()) return;
  if (localStorage.getItem(KEYS.seeded)) return;
  localStorage.setItem(KEYS.seeded, "1");

  const existing = read<StoredAssessment>(KEYS.assessments);
  if (existing.some((a) => a.code === DEMO_ASSESSMENT_CODE)) return;

  const demo: StoredAssessment = {
    _id: newId(),
    companyUserId: "demo-company",
    title: "Frontend Engineer — Sample Assessment",
    code: DEMO_ASSESSMENT_CODE,
    status: "active",
    createdAt: new Date().toISOString(),
    questions: [
      {
        id: newId(),
        type: "text",
        text: "Describe a performance problem you fixed in a web app. What did you measure, what did you change, and what was the result?",
        weight: 2,
        keywords: ["profile", "render", "bundle", "measure", "latency"],
        maxLength: 900,
      },
      {
        id: newId(),
        type: "mcq",
        text: "Which of these most directly improves Largest Contentful Paint on a content-heavy page?",
        weight: 1,
        keywords: [],
        maxLength: null,
        choices: [
          { id: "a", text: "Preloading the hero image and serving it in a modern format" },
          { id: "b", text: "Adding more client-side state management" },
          { id: "c", text: "Renaming CSS classes to be shorter" },
          { id: "d", text: "Increasing the JavaScript bundle size" },
        ],
        correctChoiceId: "a",
      },
      {
        id: newId(),
        type: "code",
        text: "Read a line of text from stdin and print the number of unique words (case-insensitive).",
        weight: 2,
        keywords: [],
        maxLength: null,
        starterCode:
          "// Read stdin, print the count of unique words.\nconst input = require('fs').readFileSync(0, 'utf8').trim();\n",
        testCases: [
          { input: "the cat the hat", expectedStdout: "3" },
          { input: "Hello hello world", expectedStdout: "2" },
        ],
      },
    ],
  };
  write(KEYS.assessments, [demo, ...existing]);
}

/* ------------------------------------------------------------------ */
/* password hashing (PBKDF2 via WebCrypto)                             */
/* ------------------------------------------------------------------ */

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function derive(password: string, saltHex: string): Promise<string> {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g) ?? [], (h) => parseInt(h, 16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: 120_000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = Array.from(saltBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${salt}:${await derive(password, salt)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = await derive(password, salt);
  if (candidate.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------------------------------------------ */
/* users                                                               */
/* ------------------------------------------------------------------ */

export function readUsers(): StoredUser[] {
  return read<StoredUser>(KEYS.users);
}

export function findUserByEmail(email: string): StoredUser | null {
  const target = email.trim().toLowerCase();
  return readUsers().find((u) => u.email === target) ?? null;
}

export function findUserById(id: string): StoredUser | null {
  return readUsers().find((u) => u._id === id) ?? null;
}

export function insertUser(u: Omit<StoredUser, "_id" | "createdAt">): StoredUser {
  if (!isBrowser()) throw new Error("Accounts can only be created in the browser");
  const users = readUsers();
  if (users.some((x) => x.email === u.email.toLowerCase())) {
    throw new Error("An account with that email already exists");
  }
  const rec: StoredUser = {
    ...u,
    email: u.email.toLowerCase(),
    _id: newId(),
    createdAt: new Date().toISOString(),
  };
  write(KEYS.users, [rec, ...users]);
  return rec;
}

/* ------------------------------------------------------------------ */
/* assessments                                                         */
/* ------------------------------------------------------------------ */

export function readAssessments(): StoredAssessment[] {
  seed();
  return read<StoredAssessment>(KEYS.assessments).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function insertAssessment(
  a: Omit<StoredAssessment, "_id" | "code" | "createdAt" | "status">,
): StoredAssessment {
  if (!isBrowser()) throw new Error("Assessments can only be created in the browser");
  const all = readAssessments();
  let code = newCode();
  while (all.some((x) => x.code === code)) code = newCode();
  const rec: StoredAssessment = {
    ...a,
    _id: newId(),
    code,
    status: "active",
    createdAt: new Date().toISOString(),
  };
  write(KEYS.assessments, [rec, ...all]);
  
  // Also sync to MongoDB if available
  void syncAssessmentToMongoDB(rec).catch(() => {
    // MongoDB sync failed, but localStorage backup is already saved
    console.log("Assessment created locally; MongoDB sync will retry on update");
  });
  
  return rec;
}

export function setAssessmentStatusLocal(id: string, status: "active" | "closed"): StoredAssessment {
  const all = readAssessments();
  const idx = all.findIndex((a) => a._id === id);
  if (idx === -1) throw new Error("Assessment not found");
  const next = { ...all[idx]!, status };
  all[idx] = next;
  write(KEYS.assessments, all);
  
  // Also sync to MongoDB
  void syncAssessmentToMongoDB(next).catch(() => {
    console.log("Assessment status updated locally; MongoDB sync will retry");
  });
  
  return next;
}

export function deleteAssessmentLocal(id: string): void {
  const all = readAssessments();
  if (!all.some((a) => a._id === id)) throw new Error("Assessment not found");
  write(
    KEYS.assessments,
    all.filter((a) => a._id !== id),
  );
}

/* ------------------------------------------------------------------ */
/* attempts + reports                                                  */
/* ------------------------------------------------------------------ */

export function readAttempts(): StoredAttempt[] {
  return read<StoredAttempt>(KEYS.attempts);
}

export function insertAttempt(a: Omit<StoredAttempt, "_id" | "status" | "submittedAt">): StoredAttempt {
  const rec: StoredAttempt = {
    ...a,
    _id: newId(),
    status: "submitted",
    submittedAt: new Date().toISOString(),
  };
  write(KEYS.attempts, [rec, ...readAttempts()]);
  return rec;
}

export function readReports(): StoredReport[] {
  return read<StoredReport>(KEYS.reports);
}

export function insertReport(r: Omit<StoredReport, "_id" | "createdAt">): StoredReport {
  const rec: StoredReport = { ...r, _id: newId(), createdAt: new Date().toISOString() };
  write(KEYS.reports, [rec, ...readReports()]);
  return rec;
}

export function updateReportLocal(
  id: string,
  patch: Partial<Omit<StoredReport, "_id" | "createdAt">>,
): StoredReport {
  const all = readReports();
  const idx = all.findIndex((r) => r._id === id);
  if (idx === -1) throw new Error("Report not found");
  const next = { ...all[idx]!, ...patch };
  all[idx] = next;
  write(KEYS.reports, all);
  return next;
}
