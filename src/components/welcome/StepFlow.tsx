import { ChevronRight, ClipboardCheck, FileBarChart, UserPlus } from "lucide-react";

const STEPS = [
  {
    icon: UserPlus,
    label: "Step 1",
    title: "Sign up",
    body: "Create an account as an Individual (to practice and take assessments) or a Company (to create assessments and review candidates).",
  },
  {
    icon: ClipboardCheck,
    label: "Step 2",
    title: "Practice or take an assessment",
    body: "Individuals can practice communication skills with live eye-contact and posture feedback, or answer an assessment a company has shared with you — text, multiple choice, and coding questions.",
  },
  {
    icon: FileBarChart,
    label: "Step 3",
    title: "Get your report",
    body: "Every submission is scored automatically and turned into a report — your side, and the company's side, see the same result.",
  },
];

export function StepFlow() {
  return (
    <section className="glass-strong relative px-6 py-10 sm:px-10 sm:py-12">
      <h2 className="font-display text-xs tracking-[0.32em] text-muted-foreground uppercase sm:text-sm">
        How it works
      </h2>

      <ol className="mt-10 grid gap-10 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-0">
        {STEPS.map((step, i) => (
          <StepItem key={step.title} step={step} index={i} isLast={i === STEPS.length - 1} />
        ))}
      </ol>
    </section>
  );
}

function StepItem({
  step,
  index,
  isLast,
}: {
  step: (typeof STEPS)[number];
  index: number;
  isLast: boolean;
}) {
  const Icon = step.icon;

  return (
    <>
      <li
        className="reveal-on-scroll group relative flex gap-5 md:flex-col md:items-center md:gap-4 md:px-5 md:text-center"
        style={{ animationDelay: `${0.15 * index + 0.1}s` }}
      >
        {/* vertical connector — mobile only */}
        {!isLast && (
          <span
            aria-hidden
            className="connector-draw-y absolute top-16 left-[27px] h-[calc(100%+1.5rem)] w-px bg-linear-to-b from-cyber/45 to-transparent md:hidden"
            style={{ animationDelay: `${0.15 * index + 0.35}s` }}
          />
        )}

        <span className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl border border-cyber/25 bg-surface/80 transition-all duration-300 group-hover:border-cyber/60">
          <span
            aria-hidden
            className="absolute inset-0 rounded-2xl bg-glow opacity-60 blur-md transition-opacity duration-300 group-hover:opacity-100"
          />
          <Icon className="relative size-6 text-cyber" strokeWidth={1.75} />
        </span>

        <div className="md:space-y-1">
          <p className="text-sm text-muted-foreground">{step.label}</p>
          <h3 className="font-display text-lg leading-tight text-foreground sm:text-xl">
            {step.title}
          </h3>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-muted-foreground md:mt-0">
            {step.body}
          </p>
        </div>
      </li>

      {!isLast && (
        <div aria-hidden className="hidden items-center self-start pt-7 md:flex">
          <span
            className="connector-draw h-px w-8 bg-linear-to-r from-transparent via-cyber/50 to-cyber/50"
            style={{ animationDelay: `${0.15 * index + 0.3}s` }}
          />
          <ChevronRight className="size-4 text-cyber/70" />
        </div>
      )}
    </>
  );
}
