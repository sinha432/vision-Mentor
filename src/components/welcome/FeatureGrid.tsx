import {
  BarChart3,
  Bot,
  Code2,
  Eye,
  FileText,
  Mic,
  type LucideIcon,
} from "lucide-react";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Bot,
    title: "AI Interviewer",
    body: "Hold a natural back-and-forth interview with an AI that adapts to your answers.",
  },
  {
    icon: FileText,
    title: "Resume Analysis",
    body: "Your resume is read and turned into questions a real interviewer would ask.",
  },
  {
    icon: Eye,
    title: "Computer Vision",
    body: "Live eye-contact and posture feedback while you speak, not after the fact.",
  },
  {
    icon: Mic,
    title: "Speech Analysis",
    body: "Pacing, filler words and clarity measured across every answer you give.",
  },
  {
    icon: Code2,
    title: "Coding Interview",
    body: "Work through coding questions in-session and get your solution scored.",
  },
  {
    icon: BarChart3,
    title: "Performance Analytics",
    body: "Every session rolls into a report that shows what is improving over time.",
  },
];

export function FeatureGrid() {
  return (
    <section aria-labelledby="features-heading">
      <h2
        id="features-heading"
        className="reveal-on-scroll font-display text-xs tracking-[0.32em] text-muted-foreground uppercase sm:text-sm"
      >
        What&apos;s inside
      </h2>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <article
              key={feature.title}
              className="reveal-on-scroll glass group relative overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cyber/45 hover:shadow-[0_24px_50px_-24px_color-mix(in_oklab,var(--cyber)_55%,transparent)]"
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-aurora opacity-35 transition-opacity duration-300 group-hover:opacity-100"
              />
              <span className="relative flex size-12 items-center justify-center rounded-2xl border border-cyber/25 bg-surface/70 transition-all duration-300 group-hover:scale-110 group-hover:border-cyber/60">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-2xl bg-glow opacity-50 blur-md transition-opacity duration-300 group-hover:opacity-100"
                />
                <Icon className="relative size-5 text-cyber" strokeWidth={1.75} />
              </span>
              <h3 className="mt-5 font-display text-base tracking-[0.03em] text-foreground sm:text-lg">
                {feature.title}
              </h3>
              <p className="mt-2.5 text-[0.92rem] leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
