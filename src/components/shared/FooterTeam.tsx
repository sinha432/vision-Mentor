import { Github, Linkedin } from "lucide-react";

const CONTRIBUTORS = [
  { initials: "AS", name: "Aman Kumar Sinha", role: "4VP23CD002" },
  { initials: "CH", name: "Chirag H", role: "4VP23CD011" },
  { initials: "PS", name: "P S Shreevishnu", role: "4VP23CD035" },
  { initials: "SN", name: "Shreekanth N", role: "4VP23CD051" },
];

export function FooterTeam() {
  return (
    <section className="mt-10">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-xs tracking-[0.22em] text-cyber uppercase">
          Team &amp; contributors
        </h3>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CONTRIBUTORS.map((person, i) => (
          <article
            key={i}
            className="glass group flex items-center gap-3 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-cyber/45 hover:shadow-[0_20px_44px_-24px_color-mix(in_oklab,var(--cyber)_55%,transparent)]"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-aurora font-display text-xs tracking-[0.08em] text-primary-foreground transition-transform duration-300 group-hover:scale-105">
              {person.initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm text-foreground">{person.name}</p>
              <p className="truncate text-xs text-muted-foreground">{person.role}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex size-6 items-center justify-center rounded-md border border-cyber/20 text-muted-foreground transition-colors duration-300 group-hover:border-cyber/50 group-hover:text-cyber"
                >
                  <Github className="size-3" strokeWidth={1.75} />
                </span>
                <span
                  aria-hidden
                  className="flex size-6 items-center justify-center rounded-md border border-cyber/20 text-muted-foreground transition-colors duration-300 group-hover:border-cyber/50 group-hover:text-cyber"
                >
                  <Linkedin className="size-3" strokeWidth={1.75} />
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
