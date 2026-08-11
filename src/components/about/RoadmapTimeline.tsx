const ROADMAP = [
  {
    phase: "Now",
    title: "Core practice loop",
    body: "AI interviewer, live vision and speech feedback, and scored reports for both sides.",
  },
  {
    phase: "Next",
    title: "Deeper analytics",
    body: "Trend lines across sessions, per-skill breakdowns, and shareable progress summaries.",
  },
  {
    phase: "Later",
    title: "Role-specific tracks",
    body: "Guided preparation paths tuned to engineering, product, sales and support interviews.",
  },
  {
    phase: "Exploring",
    title: "Team workflows",
    body: "Collaborative review, candidate shortlisting, and integrations with existing hiring tools.",
  },
];

export function RoadmapTimeline() {
  return (
    <ol className="relative space-y-6 pl-8">
      <span
        aria-hidden
        className="connector-draw-y absolute top-2 bottom-2 left-[7px] w-px bg-linear-to-b from-cyber/50 via-cyber/25 to-transparent"
      />
      {ROADMAP.map((item, i) => (
        <li
          key={item.title}
          className="reveal-on-scroll relative"
          style={{ animationDelay: `${i * 0.08}s` }}
        >
          <span
            aria-hidden
            className="absolute top-2 -left-8 size-[15px] rounded-full border border-cyber/50 bg-surface"
          >
            <span className="absolute inset-[3px] rounded-full bg-aurora" />
          </span>
          <p className="text-xs tracking-[0.24em] text-cyber uppercase">{item.phase}</p>
          <h3 className="mt-1 font-display text-base text-foreground sm:text-lg">{item.title}</h3>
          <p className="mt-1.5 text-[0.92rem] leading-relaxed text-muted-foreground">{item.body}</p>
        </li>
      ))}
    </ol>
  );
}
