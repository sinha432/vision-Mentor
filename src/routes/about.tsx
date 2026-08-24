import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CircuitBoard,
  Compass,
  Cpu,
  Map as MapIcon,
  MessageCircle,
  ShieldCheck,
  Target,
  TriangleAlert,
  Users,
  Workflow,
} from "lucide-react";

import { AuroraOrbs } from "@/components/shared/AuroraOrbs";
import { AboutPoints } from "@/components/about/AboutPoints";
import { AboutSection } from "@/components/about/AboutSection";
import { RoadmapTimeline } from "@/components/about/RoadmapTimeline";
import { TeamStrip } from "@/components/about/TeamStrip";
import { ContactBlock } from "@/components/about/ContactBlock";
import { SiteFooter } from "@/components/shared/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";

const TITLE = "About Vision Mentor X — mission, features and roadmap";
const DESCRIPTION =
  "Why Vision Mentor X exists, the problem it solves, the technologies behind it, and where the project is heading next.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

const TECHNOLOGIES = [
  "AI conversation",
  "Computer vision",
  "Speech analysis",
  "Resume intelligence",
  "Automated scoring",
  "Performance analytics",
];

const OBJECTIVES = [
  "Make realistic interview practice available on demand.",
  "Give feedback while it still matters — during the answer, not days later.",
  "Score every submission the same way for both candidate and company.",
  "Turn scattered practice into a measurable progress record.",
];

const REASONS = [
  "Feedback covers what you say and how you say it.",
  "One platform serves both practice and real assessments.",
  "Reports are identical on both sides — no hidden scoring.",
  "Built to keep improving, with a public roadmap.",
];

function About() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <SiteNav />
      <AuroraOrbs dense />

      <div className="relative mx-auto w-full max-w-5xl px-5 pt-20 pb-16 sm:pt-28">
        <header className="flex flex-col items-center text-center">
          <h1
            className="reveal font-display text-3xl leading-[1.08] tracking-[0.06em] text-gradient sm:text-5xl lg:text-6xl"
            style={{ animationDelay: "0s" }}
          >
            ABOUT VISION MENTOR X
          </h1>

          <p
            className="reveal mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            style={{ animationDelay: "0.2s" }}
          >
            {DESCRIPTION}
          </p>
        </header>

        <div className="mt-9 flex justify-center">
          <Link
            to="/welcome"
            className="reveal glass group relative inline-flex items-center gap-3 rounded-full border border-cyber/20 py-3 pr-6 pl-3 font-display text-sm text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-cyber/50 hover:text-foreground hover:shadow-[0_18px_40px_-24px_color-mix(in_oklab,var(--cyber)_75%,transparent)] focus-visible:ring-3 focus-visible:ring-cyber focus-visible:outline-hidden"
            style={{ animationDelay: "0.35s" }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-2 rounded-full bg-glow opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-60"
            />
            <span className="relative flex size-8 items-center justify-center rounded-full bg-aurora text-primary-foreground transition-transform duration-300 group-hover:scale-110">
              <ArrowLeft className="size-4" strokeWidth={1.75} />
            </span>
            <span className="relative">Back to home</span>
          </Link>
        </div>

        <div className="mt-12 sm:mt-16">
          <AboutPoints />
        </div>

        <div className="mt-6 space-y-6">
          <AboutSection icon={Compass} eyebrow="Overview" title="Mission and vision" delay={0.0}>
            <p>
              Vision Mentor X exists to make high-quality interview preparation something anyone can
              reach, at any hour, without needing a coach on call.
            </p>
            <p>
              The longer-term vision is a single place where candidates build interview skill over
              time and companies run fair, consistent assessments from the same foundation.
            </p>
          </AboutSection>

          <AboutSection
            icon={TriangleAlert}
            eyebrow="The problem"
            title="Practice without feedback"
            delay={0.06}
          >
            <p>
              Most candidates prepare by reading question lists and rehearsing alone. There is no
              signal on delivery, pacing, eye contact or clarity — the things that decide how an
              answer actually lands.
            </p>
            <p>
              On the other side, companies screen candidates with ad-hoc processes that are hard to
              compare and slow to review.
            </p>
          </AboutSection>

          <AboutSection
            icon={Target}
            eyebrow="Features"
            title="Key features and objectives"
            delay={0.12}
          >
            <ul className="space-y-2.5">
              {OBJECTIVES.map((objective) => (
                <li key={objective} className="flex gap-3">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-cyber" />
                  <span>{objective}</span>
                </li>
              ))}
            </ul>
          </AboutSection>

          <AboutSection icon={Cpu} eyebrow="Under the hood" title="Technologies used" delay={0.18}>
            <p>
              The platform combines several capabilities into one session. Specific tooling is kept
              deliberately generic here.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {TECHNOLOGIES.map((tech) => (
                <span
                  key={tech}
                  className="inline-flex items-center gap-2 rounded-full border border-cyber/25 bg-surface/60 px-4 py-1.5 text-xs tracking-[0.12em] text-cyber uppercase backdrop-blur-md transition-colors duration-300 hover:border-cyber/60"
                >
                  <CircuitBoard className="size-3.5" strokeWidth={1.75} />
                  {tech}
                </span>
              ))}
            </div>
          </AboutSection>

          <AboutSection icon={Workflow} eyebrow="Process" title="How it works" delay={0.24}>
            <p>
              Sign up as an individual or a company. Individuals practice a live session or answer
              an assessment they have been sent; companies build an assessment and share a link.
            </p>
            <p>
              Everything submitted is analysed and scored automatically, then turned into a report
              both sides can read.
            </p>
          </AboutSection>

          <AboutSection
            icon={ShieldCheck}
            eyebrow="Why us"
            title="Why choose Vision Mentor X"
            delay={0.3}
          >
            <ul className="space-y-2.5">
              {REASONS.map((reason) => (
                <li key={reason} className="flex gap-3">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-cyber" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </AboutSection>

          <AboutSection icon={MapIcon} eyebrow="What's next" title="Future roadmap" delay={0.36}>
            <p className="text-xs tracking-[0.18em] text-muted-foreground/70 uppercase">
              Placeholder roadmap — indicative only
            </p>
            <RoadmapTimeline />
          </AboutSection>

          <AboutSection
            icon={Users}
            eyebrow="Who's building it"
            title="The project team"
            delay={0.42}
          >
            <p>
              A small team working across product, AI engineering and experience design. Details
              below are placeholders.
            </p>
            <TeamStrip />
          </AboutSection>

          <AboutSection icon={MessageCircle} eyebrow="Say hello" title="Get in touch" delay={0.48}>
            <p>
              Questions, feedback or interest in trying the platform — the placeholder channels
              below show where those will land.
            </p>
            <ContactBlock />
          </AboutSection>
        </div>

        <SiteFooter />
      </div>
    </main>
  );
}
