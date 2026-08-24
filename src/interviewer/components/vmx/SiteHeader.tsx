import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import logo from "@/assets/ai-interviewer.png";

export function Brand({ className }: { className?: string }) {
  return (
    <Link to="/interviewer" className={cn("group flex items-center gap-2.5", className)}>
      <img
        src={logo}
        alt="Vision Mentor X logo"
        className="h-9 w-9 rounded-xl border border-border/60 bg-primary/10 object-cover shadow-[0_0_18px_rgba(59,130,246,0.35)]"
      />
      <span className="font-display text-base font-semibold tracking-tight">
        Vision Mentor <span className="text-signal">X</span>
      </span>
    </Link>
  );
}

export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Brand />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <Link
            to="/interviewer/setup"
            activeProps={{ className: "text-foreground" }}
            className="transition-colors hover:text-foreground"
          >
            New interview
          </Link>
          <Link
            to="/interviewer/dashboard"
            activeProps={{ className: "text-foreground" }}
            className="transition-colors hover:text-foreground"
          >
            Dashboard
          </Link>
        </nav>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}
