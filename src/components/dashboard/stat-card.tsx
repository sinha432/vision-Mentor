import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type StatAccent = "cyber" | "violet" | "emerald" | "amber";

const accentText: Record<StatAccent, string> = {
  cyber: "text-cyber",
  violet: "text-violet",
  emerald: "text-emerald",
  amber: "text-amber",
};

const accentRing: Record<StatAccent, string> = {
  cyber: "bg-cyber/15 text-cyber",
  violet: "bg-violet/15 text-violet",
  emerald: "bg-emerald/15 text-emerald",
  amber: "bg-amber/15 text-amber",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  className,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent: StatAccent;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass hover-glow animate-fade-in flex items-center gap-4 rounded-2xl p-5",
        className,
      )}
    >
      <div
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
          accentRing[accent],
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "font-display text-2xl font-bold leading-none",
            accentText[accent],
          )}
        >
          {value}
        </p>
        <p className="mt-1 truncate text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
      </div>
    </div>
  );
}
