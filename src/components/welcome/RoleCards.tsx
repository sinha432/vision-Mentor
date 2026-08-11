import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, UserCircle2 } from "lucide-react";

const ROLES = [
  {
    icon: UserCircle2,
    title: "Individual",
    body: "Practice your delivery, or answer an assessment shared by a company.",
    cta: "Start as an individual",
  },
  {
    icon: Building2,
    title: "Company",
    body: "Create an assessment, share a link, and see candidate results roll in.",
    cta: "Start as a company",
  },
];

export function RoleCards() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {ROLES.map((role, i) => {
        const Icon = role.icon;
        return (
          <article
            key={role.title}
            className="reveal-on-scroll glass group relative overflow-hidden p-7 transition-all duration-300 hover:-translate-y-1 hover:border-cyber/45 hover:shadow-[0_24px_50px_-24px_color-mix(in_oklab,var(--cyber)_55%,transparent)]"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-aurora opacity-40 transition-opacity duration-300 group-hover:opacity-100"
            />
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl border border-cyber/25 bg-surface/70 transition-colors duration-300 group-hover:scale-110 group-hover:border-cyber/55">
                <Icon className="size-5 text-cyber" strokeWidth={1.75} />
              </span>
              <h3 className="font-display text-xl text-foreground">{role.title}</h3>
            </div>
            <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground">{role.body}</p>
            <Link
              to="/auth"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyber/25 bg-surface/60 px-4 py-2 text-sm text-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-cyber/60 hover:text-cyber focus-visible:ring-3 focus-visible:ring-cyber focus-visible:outline-hidden"
            >
              {role.cta}
              <ArrowRight className="size-4" strokeWidth={2} />
            </Link>
          </article>
        );
      })}
    </div>
  );
}
