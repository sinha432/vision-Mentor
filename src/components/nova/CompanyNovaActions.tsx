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
  onAction,
}: CompanyNovaActionsProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Nova Hiring Copilot
        </h3>

        <p className="mt-1 text-xs text-muted-foreground">
          Choose a hiring task or ask Nova directly.
        </p>
      </div>

      <div className="grid gap-2">
        {actions.map((action) => {
          const Icon = icons[action.type];

          return (
            <button
              key={action.type}
              type="button"
              onClick={() => onAction?.(action)}
              className="group flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-cyber/50 hover:bg-cyber/5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyber/10 text-cyber">
                <Icon className="size-4" />
              </span>

              <span className="min-w-0">
                <span className="block text-xs font-medium text-foreground">
                  {action.label}
                </span>

                <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">
                  {action.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}