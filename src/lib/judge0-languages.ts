import type { CodeLanguage } from "./assessment-types";

export const JUDGE0_LANGUAGE_IDS: Record<Exclude<CodeLanguage, "sql">, number> = {
  java: 62,
  javascript: 63,
  python: 71,
  c: 50,
  cpp: 54,
};
