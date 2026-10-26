import { QUESTION_BANK } from "./question-bank.ts";

export interface SkillObservation {
  sessionId: string;
  topic: string;
  score: number;
  evidenceCoverage?: number;
  verified?: boolean;
}

export interface SkillMastery {
  skill: string;
  mastery: number;
  observations: number;
  evidenceCoverage: number;
  priority: number;
}

export interface PracticeRecommendation {
  skill: string;
  prompt: string;
  bankId: string;
  reason: string;
}

const LEARN = 0.15;
const GUESS = 0.2;
const SLIP = 0.1;
const INITIAL_MASTERY = 0.2;

function updateMastery(prior: number, demonstrated: boolean): number {
  const likelihood = prior * (1 - SLIP) + (1 - prior) * GUESS;
  const posterior = demonstrated
    ? (prior * (1 - SLIP)) / likelihood
    : (prior * SLIP) / Math.max(Number.EPSILON, 1 - likelihood);
  return Math.max(0.01, Math.min(0.99, posterior + (1 - posterior) * LEARN));
}

export function buildSkillMastery(observations: SkillObservation[]): SkillMastery[] {
  const skills = new Map<
    string,
    { mastery: number; observations: number; evidenceSum: number }
  >();
  const seen = new Set<string>();

  for (const observation of observations) {
    const topic = observation.topic.trim();
    const key = topic.toLowerCase();
    if (!topic || seen.has(`${observation.sessionId}:${key}`)) continue;
    if (!Number.isFinite(observation.score)) continue;
    seen.add(`${observation.sessionId}:${key}`);

    const evidence = Math.max(0, Math.min(100, observation.evidenceCoverage ?? 0));
    const state = skills.get(key) ?? {
      mastery: INITIAL_MASTERY,
      observations: 0,
      evidenceSum: 0,
    };
    const demonstrated =
      observation.score >= 70 && evidence >= 50 && observation.verified !== false;
    state.mastery = updateMastery(state.mastery, demonstrated);
    state.observations += 1;
    state.evidenceSum += evidence;
    skills.set(key, state);
  }

  return [...skills.entries()]
    .map(([key, state]) => {
      const skill =
        observations.find((observation) => observation.topic.trim().toLowerCase() === key)?.topic ??
        key;
      const evidenceCoverage = Math.round(state.evidenceSum / state.observations);
      const evidenceMaturity = Math.min(1, state.observations / 4);
      return {
        skill,
        mastery: Math.round(state.mastery * 100),
        observations: state.observations,
        evidenceCoverage,
        priority: Math.round((1 - state.mastery) * (1.5 - evidenceMaturity) * 100),
      };
    })
    .sort((a, b) => b.priority - a.priority || a.skill.localeCompare(b.skill));
}

export function recommendPractice(
  profiles: SkillMastery[],
  usedBankIds: string[] = [],
): PracticeRecommendation | null {
  for (const profile of profiles) {
    const candidate = QUESTION_BANK.find(
      (question) =>
        !usedBankIds.includes(question.id) &&
        (question.topic.toLowerCase() === profile.skill.toLowerCase() ||
          question.topic.toLowerCase().includes(profile.skill.toLowerCase()) ||
          profile.skill.toLowerCase().includes(question.topic.toLowerCase())),
    );
    if (candidate) {
      return {
        skill: profile.skill,
        prompt: candidate.prompt,
        bankId: candidate.id,
        reason: `${profile.observations} scored response${profile.observations === 1 ? "" : "s"}; evidence-based mastery estimate is ${profile.mastery}%.`,
      };
    }
  }
  return null;
}
