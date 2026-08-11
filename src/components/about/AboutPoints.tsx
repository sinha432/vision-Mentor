import { Gauge, Users2, Wrench } from "lucide-react";

const POINTS = [
  {
    icon: Gauge,
    title: "Real-time feedback",
    body: "Practice sessions are analysed as you speak, so you get feedback on delivery, pacing and clarity right away.",
  },
  {
    icon: Users2,
    title: "Two sides, one platform",
    body: "Individuals practice and answer assessments; companies create them, share a link and review scored results.",
  },
  {
    icon: Wrench,
    title: "A work in progress",
    body: "Vision Mentor X is still evolving. Features are being added and refined, so expect things to keep improving.",
  },
];

export function AboutPoints() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {POINTS.map((point, i) => {
        const Icon = point.icon;
        return (
          <article
            key={point.title}
            className="reveal-on-scroll glass group relative overflow-hidden p-7 transition-all duration-300 hover:-translate-y-1 hover:border-cyber/45 hover:shadow-[0_24px_50px_-24px_color-mix(in_oklab,var(--cyber)_55%,transparent)]"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-aurora opacity-40 transition-opacity duration-300 group-hover:opacity-100"
            />
            <span className="relative flex size-12 items-center justify-center rounded-2xl bg-aurora shadow-[0_14px_32px_-16px_color-mix(in_oklab,var(--cyber)_80%,transparent)] transition-transform duration-300 group-hover:scale-105">
              <Icon className="size-6 text-primary-foreground" strokeWidth={1.75} />
            </span>
            <h3 className="mt-5 font-display text-lg tracking-[0.03em] text-foreground">
              {point.title}
            </h3>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">{point.body}</p>
          </article>
        );
      })}
    </div>
  );
}
