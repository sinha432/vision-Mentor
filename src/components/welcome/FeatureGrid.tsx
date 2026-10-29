import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { BarChart3, Bot, Code2, Eye, FileText, Mic, type LucideIcon } from "lucide-react";

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
  const [activeFeature, setActiveFeature] = useState(FEATURES[0]!.title);
  const selectedFeature = FEATURES.find((feature) => feature.title === activeFeature)!;
  const reducedMotion = useReducedMotion();

  return (
    <section id="features" aria-labelledby="features-heading" className="scroll-mt-24">
      <div className="reveal-on-scroll max-w-2xl">
        <p className="font-display text-xs tracking-[0.28em] text-cyber uppercase">
          Capability map
        </p>
        <h2
          id="features-heading"
          className="mt-3 font-display text-2xl leading-tight text-gradient sm:text-3xl"
        >
          Every round, one place to get better.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Explore the tools currently available across interview practice and assessment.
        </p>
      </div>

      <div className="relative mt-8">
        <svg
          aria-hidden="true"
          viewBox="0 0 1000 400"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 top-0 hidden h-[calc(100%-5rem)] w-full lg:block"
        >
          <path
            d="M500 0V60M500 60C500 105 165 82 165 145M500 60V145M500 60C500 105 835 82 835 145M165 210V260M500 210V260M835 210V260"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.34"
            strokeWidth="2"
          />
          <motion.path
            d="M500 0V60M500 60C500 105 165 82 165 145M500 60V145M500 60C500 105 835 82 835 145M165 210V260M500 210V260M835 210V260"
            fill="none"
            stroke="var(--cyber)"
            strokeLinecap="round"
            strokeWidth="2"
            initial={reducedMotion ? false : { pathLength: 0, opacity: 0.3 }}
            whileInView={{ pathLength: 1, opacity: 0.9 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: reducedMotion ? 0 : 1.1, ease: "easeOut" }}
          />
        </svg>

        <div className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.button
                key={feature.title}
                type="button"
                aria-pressed={activeFeature === feature.title}
                aria-controls="feature-map-detail"
                onClick={() => setActiveFeature(feature.title)}
                initial={reducedMotion ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: reducedMotion ? 0 : 0.45,
                  delay: reducedMotion ? 0 : index * 0.07,
                }}
                whileHover={reducedMotion ? undefined : { y: -3 }}
                whileTap={reducedMotion ? undefined : { scale: 0.985 }}
                className={`glass group relative z-10 w-full overflow-hidden p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyber sm:p-6 ${activeFeature === feature.title ? "border-cyber/70 shadow-[0_0_30px_-14px_color-mix(in_oklab,var(--cyber)_85%,transparent)]" : "hover:border-cyber/45"}`}
              >
                <span
                  className="absolute inset-x-0 top-0 h-px bg-aurora opacity-35 transition-opacity duration-300 group-hover:opacity-100"
                  aria-hidden="true"
                />
                <span className="relative flex size-11 items-center justify-center rounded-xl border border-cyber/25 bg-surface/70 transition-all duration-300 group-hover:border-cyber/60 sm:size-12">
                  <span
                    className="absolute inset-0 rounded-2xl bg-glow opacity-50 blur-md transition-opacity duration-300 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                  <Icon className="relative size-5 text-cyber" strokeWidth={1.75} />
                </span>
                <span className="mt-4 flex items-center justify-between gap-3">
                  <span className="font-display text-sm text-foreground sm:text-base">
                    {feature.title}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyber">
                    {activeFeature === feature.title ? "Selected" : "Explore"}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={selectedFeature.title}
            id="feature-map-detail"
            role="region"
            aria-live="polite"
            aria-label={`${selectedFeature.title} details`}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -5 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="mt-4 flex flex-col gap-4 border-y border-cyber/20 py-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <selectedFeature.icon
                className="mt-0.5 size-5 shrink-0 text-cyber"
                aria-hidden="true"
              />
              <div>
                <h3 className="font-display text-sm text-foreground">{selectedFeature.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {selectedFeature.body}
                </p>
              </div>
            </div>
            <Link
              to="/demo"
              className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-cyber transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyber"
            >
              Try the practice demo
              <Code2 className="size-4" aria-hidden="true" />
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
