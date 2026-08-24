import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function AboutSection({
  icon: Icon,
  eyebrow,
  title,
  delay = 0,
  children,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <section
      className="reveal-on-scroll glass-strong relative overflow-hidden px-6 py-9 sm:px-10 sm:py-11"
      style={{ animationDelay: `${delay}s` }}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-aurora opacity-45" />

      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-cyber/25 bg-surface/70">
          <Icon className="size-5 text-cyber" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-xs tracking-[0.28em] text-muted-foreground uppercase">{eyebrow}</p>
          <h2 className="mt-1 font-display text-xl leading-tight tracking-[0.03em] text-foreground sm:text-2xl">
            {title}
          </h2>
        </div>
      </div>
      <div className="mt-6 space-y-4 text-[0.95rem] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
