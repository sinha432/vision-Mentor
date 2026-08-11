import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";

export function ClosingCta() {
  return (
    <section className="reveal-on-scroll glass-strong relative overflow-hidden px-6 py-12 text-center sm:px-12 sm:py-16">
      <span
        aria-hidden
        className="animate-glow-pulse pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-glow blur-3xl"
      />
      <div className="relative">
        <h2 className="font-display text-2xl leading-tight tracking-[0.04em] text-gradient sm:text-4xl">
          Ready for your next interview?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
          Start practising today, or share an assessment with candidates in a couple of minutes.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/auth"
            className="shimmer-surface group inline-flex items-center justify-center gap-3 rounded-full px-8 py-4 font-display text-base text-primary-foreground shadow-[0_18px_45px_-18px_color-mix(in_oklab,var(--cyber)_85%,transparent)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_60px_-18px_color-mix(in_oklab,var(--violet-accent)_90%,transparent)] focus-visible:ring-3 focus-visible:ring-cyber focus-visible:outline-hidden"
          >
            <Sparkles className="size-5 transition-transform duration-300 group-hover:scale-110" strokeWidth={2} />
            Get Started
          </Link>
          <Link
            to="/demo"
            className="group inline-flex items-center justify-center gap-3 rounded-full border border-cyber/25 bg-surface/60 px-8 py-4 font-display text-base text-foreground backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-cyber/60 hover:text-cyber focus-visible:ring-3 focus-visible:ring-cyber focus-visible:outline-hidden"
          >
            Try a Live Demo
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </section>
  );
}
