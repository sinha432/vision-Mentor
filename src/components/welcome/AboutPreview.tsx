import { Link } from "@tanstack/react-router";
import { ArrowRight, Compass, ShieldCheck, Target, Users } from "lucide-react";

const POINTS = [
  {
    icon: Target,
    title: "The mission",
    body: "Make realistic interview practice available on demand, so preparation is a habit and not a panic.",
  },
  {
    icon: Compass,
    title: "The problem",
    body: "Most feedback arrives days later and only covers what you said — never how you said it.",
  },
  {
    icon: ShieldCheck,
    title: "The promise",
    body: "Candidate and company see the exact same scored report. No hidden scoring, no surprises.",
  },
  {
    icon: Users,
    title: "The team",
    body: "Built by a small student team as an open project, with a public roadmap of what comes next.",
  },
];

export function AboutPreview() {
  return (
    <section id="about" className="scroll-mt-24">
      <p className="font-display text-xs tracking-[0.28em] text-cyber uppercase">About us</p>
      <h2 className="mt-3 font-display text-2xl leading-tight text-gradient sm:text-3xl">
        Why Vision Mentor X exists
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        Vision Mentor X combines AI conversation, computer vision, speech analysis and resume
        intelligence into one interview practice platform — so you can see what is improving and
        what still needs work.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {POINTS.map((point) => (
          <div key={point.title} className="card-3d rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <span className="chip-3d flex size-9 items-center justify-center rounded-xl">
                <point.icon className="size-4 text-cyber" strokeWidth={1.75} />
              </span>
              <h3 className="font-display text-base text-foreground">{point.title}</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Link
          to="/about"
          className="btn-3d inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Read the full story
          <ArrowRight className="size-4" strokeWidth={2} />
        </Link>
      </div>
    </section>
  );
}
