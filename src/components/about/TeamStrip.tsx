const MEMBERS = [
  { initials: "AS", name: "Aman Kumar Sinha", role: "4VP23CD002" },
  { initials: "CH", name: "Chirag H", role: "4VP23CD011" },
  { initials: "PS", name: "P S Shreevishnu", role: "4VP23CD035" },
  { initials: "SN", name: "Shreekanth N", role: "4VP23CD051" },
];

export function TeamStrip() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {MEMBERS.map((member, i) => (
        <div
          key={member.name}
          className="reveal-on-scroll glass group flex items-center gap-4 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyber/45"
          style={{ animationDelay: `${i * 0.08}s` }}
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-aurora font-display text-sm text-primary-foreground transition-transform duration-300 group-hover:scale-110">
            {member.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-sm text-foreground">{member.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{member.role}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
