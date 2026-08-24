import { useState } from "react";
import { Building2, ChevronDown, GraduationCap, ListOrdered, Target, XCircle } from "lucide-react";
import { getHiring, type CompanyProfile } from "@/interviewer/lib/companies";
import { cn } from "@/lib/utils";

export function CompanyBrief({ company, role }: { company: CompanyProfile; role: string }) {
  const [open, setOpen] = useState(false);
  const hiring = getHiring(company.id);
  const eligibility = hiring.eligibility(role);

  return (
    <div className="rounded-xl border border-border bg-secondary/25">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Building2 className="h-4 w-4 text-primary" />
          About {company.name} · eligibility for {role}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="animate-rise space-y-4 border-t border-border/70 px-4 py-4 text-xs">
          <p className="text-muted-foreground">{hiring.about}</p>

          <Block icon={ListOrdered} title="Interview process">
            {hiring.process}
          </Block>
          <Block icon={GraduationCap} title={`Typical eligibility — ${role}`}>
            {eligibility}
          </Block>
          <Block icon={Target} title="What they screen hardest on">
            {hiring.screens}
          </Block>
          <Block icon={XCircle} title="Common rejection reasons">
            {hiring.rejections}
          </Block>
        </div>
      )}
    </div>
  );
}

function Block({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: string[];
}) {
  return (
    <div>
      <h4 className="flex items-center gap-2 text-xs font-semibold">
        <Icon className="h-3.5 w-3.5 text-primary" /> {title}
      </h4>
      <ul className="mt-1.5 space-y-1 text-muted-foreground">
        {children.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-muted-foreground/60">•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
