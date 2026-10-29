import { CalendarDays, FileQuestion, Sparkles, Users, BarChart3 } from "lucide-react";

export interface CompanyNovaAction {
  type:
    | "generate_questions"
    | "create_assessment"
    | "analyze_candidates"
    | "schedule_interview"
    | "hiring_analytics";
  label: string;
  description: string;
}

interface CompanyNovaActionsProps {
  collapsed?: boolean;
  onAction?: (action: CompanyNovaAction) => void;
}

const actions: CompanyNovaAction[] = [
  {
    type: "generate_questions",
    label: "Generate Questions",
    description: "Create AI-powered interview questions.",
  },
  {
    type: "create_assessment",
    label: "Create Assessment",
    description: "Build an assessment for a hiring role.",
  },
  {
    type: "analyze_candidates",
    label: "Analyze Candidates",
    description: "Review candidate performance and scores.",
  },
  {
    type: "schedule_interview",
    label: "Schedule Interview",
    description: "Plan an interview and recruitment event.",
  },
  {
    type: "hiring_analytics",
    label: "Hiring Analytics",
    description: "Understand hiring performance and trends.",
  },
];

const icons = {
  generate_questions: FileQuestion,
  create_assessment: Sparkles,
  analyze_candidates: Users,
  schedule_interview: CalendarDays,
  hiring_analytics: BarChart3,
};

export function CompanyNovaActions({
  collapsed = false,
  onAction,
}: CompanyNovaActionsProps) {
  return (
    <section className={collapsed ? "space-y-2" : "space-y-2.5"}>
      {!collapsed && (
        <div className="px-2">
          <h3 className="text-xs font-semibold text-foreground">
            Nova Hiring Copilot
          </h3>

          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Quick actions for your hiring workflow.
          </p>
        </div>
      )}

      <div className="grid gap-1.5">
        {actions.map((action) => {
          const Icon = icons[action.type];

          return (
            <button
              key={action.type}
              type="button"
              onClick={() => onAction?.(action)}
              title={collapsed ? action.label : undefined}
              aria-label={action.label}
              className={`group flex min-h-10 items-center rounded-lg border border-sidebar-border bg-background/30 text-left transition-colors hover:border-cyber/50 hover:bg-cyber/5 ${
                collapsed
                  ? "justify-center p-2"
                  : "gap-2.5 px-2.5 py-2"
              }`}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-cyber/10 text-cyber">
                <Icon className="size-3.5" />
              </span>

              {!collapsed && (
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium leading-tight text-foreground">
                    {action.label}
                  </span>

                  <span className="mt-0.5 block truncate text-[9px] leading-tight text-muted-foreground">
                    {action.description}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}