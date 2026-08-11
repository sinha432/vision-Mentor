const STATS = [
  { value: "12,400+", label: "Practice interviews completed" },
  { value: "180+", label: "Teams running assessments" },
  { value: "+31%", label: "Average score improvement" },
];

export function StatsStrip() {
  return (
    <section className="reveal-on-scroll glass-strong relative overflow-hidden px-6 py-9 sm:px-10">
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-aurora opacity-50" />
      <div className="grid gap-8 sm:grid-cols-3">
        {STATS.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="font-display text-3xl tracking-[0.04em] text-gradient sm:text-4xl">
              {stat.value}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-xs tracking-[0.18em] text-muted-foreground/70 uppercase">
        Placeholder figures — illustrative only
      </p>
    </section>
  );
}
