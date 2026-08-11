import type { InterviewSession } from "./interview-types";

const KEY = "vmx.sessions.v1";
const CONFIG_KEY = "vmx.draft-config.v1";

function canUse() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadSessions(): InterviewSession[] {
  if (!canUse()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InterviewSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSession(session: InterviewSession) {
  if (!canUse()) return;
  const all = loadSessions().filter((s) => s.id !== session.id);
  all.unshift(session);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all.slice(0, 40)));
  } catch {
    /* storage full */
  }
}

export function getSession(id: string): InterviewSession | null {
  return loadSessions().find((s) => s.id === id) ?? null;
}

export function deleteSession(id: string) {
  if (!canUse()) return;
  window.localStorage.setItem(KEY, JSON.stringify(loadSessions().filter((s) => s.id !== id)));
}

export function saveDraftConfig(config: unknown) {
  if (!canUse()) return;
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function loadDraftConfig<T>(): T | null {
  if (!canUse()) return null;
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function newId() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
