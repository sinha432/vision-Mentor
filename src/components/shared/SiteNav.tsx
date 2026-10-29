import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Sparkles, X } from "lucide-react";

const LINKS = [
  { to: "/welcome", label: "Home" },
  { to: "/about", label: "About Us" },
  { to: "/demo", label: "Demo" },
] as const;

const PUBLIC_LINKS = [
  { to: "/welcome", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/demo", label: "Demo" },
  { section: "features", label: "Features" },
  { section: "how-it-works", label: "How it works" },
] as const;

type SiteNavProps = {
  variant?: "default" | "welcome" | "public";
};

export function SiteNav({ variant = "default" }: SiteNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isWelcome = variant === "welcome";
  const isPublic = isWelcome || variant === "public";
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const sectionHref = (section: string) => (isWelcome ? `#${section}` : `/welcome#${section}`);

  function renderPublicLink(link: (typeof PUBLIC_LINKS)[number], index: number, mobile = false) {
    const className = mobile
      ? "block rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-200"
      : `welcome-nav-item relative rounded-full px-3 py-2 text-xs font-medium transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 xl:text-sm ${"to" in link && pathname === link.to ? "text-white after:scale-x-100" : "text-slate-300"} after:absolute after:inset-x-3 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-cyan-300 after:transition-transform hover:after:scale-x-100`;
    const style = mobile ? undefined : { animationDelay: `${0.6 + index * 0.1}s` };

    if ("to" in link) {
      return (
        <Link
          key={link.to}
          to={link.to}
          className={className}
          style={style}
          aria-current={pathname === link.to ? "page" : undefined}
          onClick={() => setMenuOpen(false)}
        >
          {link.label}
        </Link>
      );
    }

    return (
      <a
        key={link.section}
        href={sectionHref(link.section)}
        className={className}
        style={style}
        onClick={() => setMenuOpen(false)}
      >
        {link.label}
      </a>
    );
  }

  return (
    <nav
      className={
        isPublic
          ? "fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/75 text-white backdrop-blur-xl"
          : "fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl"
      }
    >
      <div
        className={`mx-auto flex w-full items-center gap-4 px-5 py-3 ${isPublic ? "max-w-7xl sm:gap-4 sm:px-8" : "max-w-6xl"}`}
      >
        <Link
          to="/welcome"
          className={`flex items-center gap-2 ${isPublic ? "welcome-nav-logo" : ""}`}
        >
          <span
            className={
              isPublic
                ? "grid size-8 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10"
                : "chip-3d flex size-8 items-center justify-center rounded-xl"
            }
          >
            <Sparkles
              className={`size-4 ${isPublic ? "text-cyan-200" : "text-cyber"}`}
              strokeWidth={2}
            />
          </span>
          <span
            className={
              isPublic
                ? "font-display text-xs tracking-[0.12em] text-white uppercase sm:text-sm"
                : "font-display text-sm tracking-[0.18em] text-gradient uppercase"
            }
          >
            Vision Mentor X
          </span>
        </Link>

        {!isPublic && (
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
        )}

        {isPublic && (
          <>
            <div className="ml-auto hidden items-center gap-1 lg:flex">
              {PUBLIC_LINKS.map((link, index) => renderPublicLink(link, index))}
            </div>
            <Link
              to="/auth"
              className="welcome-nav-cta ml-auto rounded-full bg-linear-to-r from-cyan-400 to-violet-500 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-[0_0_24px_-8px_rgba(0,200,255,0.9)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 lg:ml-2 sm:px-4 sm:text-sm"
            >
              Get Started
            </Link>

            <button
              type="button"
              className="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 text-white transition-colors hover:border-cyan-200/50 hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 lg:hidden"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
              aria-controls="welcome-mobile-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </>
        )}
      </div>

      {isPublic && menuOpen && (
        <div
          id="welcome-mobile-nav"
          className="border-t border-white/10 bg-slate-950/95 px-5 py-3 backdrop-blur-xl lg:hidden"
        >
          <div className="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
            {PUBLIC_LINKS.map((link, index) => renderPublicLink(link, index, true))}
          </div>
        </div>
      )}
    </nav>
  );
}
