export interface GroundedSource {
  id: string;
  source: "job_description" | "resume";
  line: number;
  text: string;
}

export interface SourceCitation {
  sourceId: string;
  quote: string;
}

const STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "for", "from", "have", "into", "job",
  "more", "our", "that", "the", "their", "this", "with", "will", "you",
]);

function terms(text: string): string[] {
  return [...new Set(
    text
      .toLowerCase()
      .match(/[a-z][a-z0-9+#.-]{2,}/g)
      ?.filter((term) => !STOP_WORDS.has(term)) ?? [],
  )];
}

function sourceLines(text: string, prefix: "jd" | "resume", source: GroundedSource["source"]) {
  return text
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((line, index) => line.trim())
    .filter(Boolean)
    .slice(0, 80)
    .map((line, index): GroundedSource => ({
      id: `${prefix}-${index + 1}`,
      source,
      line: index + 1,
      text: line.slice(0, 500),
    }));
}

export function retrieveGroundedSources(
  jobDescription: string,
  resumeText: string,
  query: string,
  limit = 4,
): GroundedSource[] {
  const queryTerms = new Set(terms(query));
  if (queryTerms.size === 0) return [];

  const sources = [
    ...sourceLines(jobDescription, "jd", "job_description"),
    ...sourceLines(resumeText, "resume", "resume"),
  ];
  return sources
    .map((source) => {
      const sourceTerms = terms(source.text);
      const hits = sourceTerms.filter((term) => queryTerms.has(term)).length;
      const relevance = hits / Math.sqrt(Math.max(1, sourceTerms.length));
      return { source, relevance };
    })
    .filter((item) => item.relevance > 0)
    .sort(
      (a, b) =>
        b.relevance - a.relevance ||
        (a.source.source === b.source.source
          ? 0
          : a.source.source === "job_description"
            ? -1
            : 1) ||
        a.source.line - b.source.line,
    )
    .slice(0, Math.max(1, Math.min(8, limit)))
    .map(({ source }) => source);
}

export function validateSourceCitations(
  citations: SourceCitation[],
  sources: GroundedSource[],
): SourceCitation[] {
  const byId = new Map(sources.map((source) => [source.id, source]));
  const accepted: SourceCitation[] = [];
  const seen = new Set<string>();

  for (const citation of citations.slice(0, 4)) {
    const source = byId.get(citation.sourceId);
    const quote = citation.quote.trim().slice(0, 500);
    const key = `${citation.sourceId}:${quote}`;
    if (!source || !quote || !source.text.includes(quote) || seen.has(key)) continue;
    seen.add(key);
    accepted.push({ sourceId: source.id, quote });
  }
  return accepted;
}
