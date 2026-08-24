import { Link } from "@tanstack/react-router";
import { Github, Linkedin, Mail, Sparkles } from "lucide-react";

import { FooterTeam } from "@/components/shared/FooterTeam";

const SOCIALS = [Mail, Github, Linkedin];

const linkClass =
  "inline-block text-sm text-muted-foreground transition-colors duration-300 hover:text-cyber";

export function SiteFooter() {
  return (
    <footer className="relative mt-20 pb-6">
      <span
        aria-hidden
        className="block h-px w-full bg-aurora opacity-30 [mask-image:linear-gradient(to_right,transparent,black,transparent)]"
      />

      <div className="pt-10">
        <div className="grid gap-10 sm:grid-cols-2">
          {/* Brand */}
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-aurora shadow-[0_14px_32px_-16px_color-mix(in_oklab,var(--cyber)_80%,transparent)]">
                <Sparkles className="size-4 text-primary-foreground" strokeWidth={2} />
              </span>
              <span className="truncate font-display text-sm tracking-[0.16em] text-foreground">
                VISION MENTOR X
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              AI-powered interview practice with feedback on what you say and how you say it.
            </p>
            <div className="mt-5 flex items-center gap-2.5">
              {SOCIALS.map((Icon, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="flex size-9 items-center justify-center rounded-xl border border-cyber/20 bg-surface/50 text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-cyber/55 hover:text-cyber hover:shadow-[0_14px_30px_-18px_color-mix(in_oklab,var(--cyber)_80%,transparent)]"
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="min-w-0">
            <h3 className="font-display text-xs tracking-[0.22em] text-cyber uppercase">
              Quick links
            </h3>
            <ul className="mt-5 space-y-3">
              <li>
                <Link to="/" className={linkClass}>
                  Home
                </Link>
              </li>
              <li>
                <Link to="/about" className={linkClass}>
                  About
                </Link>
              </li>
              <li>
                <Link to="/demo" className={linkClass}>
                  Demo
                </Link>
              </li>
              <li>
                <Link to="/auth" className={linkClass}>
                  Sign In
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <FooterTeam />

        <span
          aria-hidden
          className="mt-10 block h-px w-full bg-aurora opacity-40 [mask-image:linear-gradient(to_right,transparent,black,transparent)]"
        />

        <div className="mt-6 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-xs text-muted-foreground">© 2026 Vision Mentor X</p>
          <div className="flex items-center gap-5">
            <span className="text-xs text-muted-foreground transition-colors duration-300 hover:text-cyber">
              Privacy
            </span>
            <span className="text-xs text-muted-foreground transition-colors duration-300 hover:text-cyber">
              Terms
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
