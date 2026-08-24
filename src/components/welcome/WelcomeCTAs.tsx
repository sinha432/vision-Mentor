import { Link } from "@tanstack/react-router";
import { ArrowRight, CirclePlay, Sparkles } from "lucide-react";

export function WelcomeCTAs() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-stretch justify-center gap-5 sm:flex-row">
        <Link
          to="/auth"
          className="shimmer-surface group relative flex items-center justify-center gap-3 rounded-full px-9 py-5 font-display text-base text-primary-foreground shadow-[0_18px_45px_-18px_color-mix(in_oklab,var(--cyber)_85%,transparent)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_65px_-18px_color-mix(in_oklab,var(--violet-accent)_90%,transparent)] focus-visible:ring-3 focus-visible:ring-cyber focus-visible:outline-hidden"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-3 rounded-full bg-glow opacity-0 blur-xl transition-opacity duration-300 group-hover:animate-glow-pulse group-hover:opacity-90"
          />
          <Sparkles
            className="relative size-5 transition-transform duration-300 group-hover:scale-110"
            strokeWidth={2}
          />
          <span className="relative">Get Started</span>
          <ArrowRight
            className="relative size-4 transition-transform duration-300 group-hover:translate-x-1"
            strokeWidth={2}
          />
        </Link>

        <Link
          to="/demo"
          className="group flex items-center justify-center gap-3 rounded-full border border-cyber/25 bg-surface/60 px-9 py-5 font-display text-base text-foreground backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-cyber/60 hover:text-cyber hover:shadow-[0_20px_45px_-24px_color-mix(in_oklab,var(--cyber)_75%,transparent)] focus-visible:ring-3 focus-visible:ring-cyber focus-visible:outline-hidden"
        >
          <CirclePlay
            className="size-5 transition-transform duration-300 group-hover:scale-110"
            strokeWidth={1.75}
          />
          Try a Live Demo
        </Link>
      </div>

      <div className="flex justify-center">
        <Link
          to="/about"
          className="glass group relative inline-flex items-center gap-3 rounded-full border border-cyber/20 px-6 py-3 font-display text-sm text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-cyber/50 hover:text-foreground hover:shadow-[0_18px_40px_-24px_color-mix(in_oklab,var(--cyber)_75%,transparent)] focus-visible:ring-3 focus-visible:ring-cyber focus-visible:outline-hidden"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-2 rounded-full bg-glow opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-60"
          />
          <span className="relative">About this project</span>
          <ArrowRight
            className="relative size-4 transition-transform duration-300 group-hover:translate-x-1"
            strokeWidth={2}
          />
        </Link>
      </div>
    </div>
  );
}
