export interface EvidenceCandidate {
  criterion: string;
  quote: string;
}

export interface ValidatedEvidence extends EvidenceCandidate {
  start: number;
  end: number;
}

export function validateEvidence(
  answer: string,
  candidates: EvidenceCandidate[],
): ValidatedEvidence[] {
  const validated: ValidatedEvidence[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates.slice(0, 12)) {
    const criterion = candidate.criterion.trim().slice(0, 240);
    const quote = candidate.quote.trim().slice(0, 500);
    const key = criterion.toLowerCase();
    if (!criterion || !quote || seen.has(key)) continue;

    const start = answer.indexOf(quote);
    if (start < 0) continue;

    seen.add(key);
    validated.push({ criterion, quote, start, end: start + quote.length });
  }

  return validated;
}

export function evidenceCoverage(matchedCriteria: number, totalCriteria: number): number {
  if (!Number.isFinite(matchedCriteria) || !Number.isFinite(totalCriteria) || totalCriteria <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((matchedCriteria / totalCriteria) * 100)));
}

export function summarizeBenchmark(results: Array<{ expected: number; actual: number }>) {
  if (!results.length) return { count: 0, meanAbsoluteError: 0, withinTenPoints: 0 };

  const errors = results.map(({ expected, actual }) =>
    Math.abs(Math.max(0, Math.min(100, actual)) - Math.max(0, Math.min(100, expected))),
  );
  return {
    count: errors.length,
    meanAbsoluteError: Math.round((errors.reduce((sum, error) => sum + error, 0) / errors.length) * 100) / 100,
    withinTenPoints: Math.round((errors.filter((error) => error <= 10).length / errors.length) * 100),
  };
}
