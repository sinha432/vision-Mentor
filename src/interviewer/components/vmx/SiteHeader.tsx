import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const logo = "/logo.png";

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
        <nav className="flex items-center gap-2 text-sm sm:gap-4 lg:gap-7">
          <Link
            to="/interviewer/setup"
            search={{ focus: undefined }}
            activeProps={{ className: "text-foreground" }}
            className="hidden transition-colors hover:text-foreground lg:inline-flex"
          >
            New interview
          </Link>
          <Link
            to="/interviewer/dashboard"
            activeProps={{ className: "text-foreground" }}
            className="hidden transition-colors hover:text-foreground lg:inline-flex"
          >
            Dashboard
          </Link>
          <Link
            to="/chatbot"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/60 bg-primary/10 px-2.5 py-2 text-xs font-semibold text-primary shadow-[0_0_20px_-10px_hsl(var(--primary))] transition-colors hover:bg-primary/20 sm:gap-2 sm:px-3 sm:text-sm"
          >
            <MessageCircle className="size-4 shrink-0" />
            <span>Chat with Nova</span>
          </Link>
        </nav>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}
