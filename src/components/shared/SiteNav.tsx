import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

const LINKS = [
  { to: "/welcome", label: "Home" },
  { to: "/about", label: "About Us" },
  { to: "/demo", label: "Demo" },
] as const;

export function SiteNav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-5 py-3">
        <Link to="/welcome" className="flex items-center gap-2">
          <span className="chip-3d flex size-8 items-center justify-center rounded-xl">
            <Sparkles className="size-4 text-cyber" strokeWidth={2} />
          </span>
          <span className="font-display text-sm tracking-[0.18em] text-gradient uppercase">
            Vision Mentor X
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
              activeProps={{ className: "text-cyber" }}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/auth"
            className="btn-3d ml-1 rounded-full px-4 py-1.5 text-xs font-medium text-primary-foreground sm:text-sm"
          >
            Sign In
          </Link>
        </div>
      </div>
    </nav>
  );
}
