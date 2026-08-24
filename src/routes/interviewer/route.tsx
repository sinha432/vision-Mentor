import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/interviewer")({
  head: () => ({
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  component: InterviewerLayout,
});

// Scoped theme wrapper: the AI Interviewer experience keeps its own dark
// recruiter-office design tokens (see .interviewer-theme in src/styles.css)
// without touching the host app's global theme.
function InterviewerLayout() {
  const navigate = useNavigate();

  return (
    <div className="interviewer-theme min-h-screen bg-background text-foreground">
      {/* Top bar: switching the toggle off leaves AI Interviewer Mode. */}
      <div className="sticky top-0 z-50 flex justify-end border-b border-border/60 bg-background/80 px-4 py-2 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 shadow-lg">
          <GraduationCap className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground">
            AI Interviewer Mode
          </span>
          <Switch
            checked
    onCheckedChange={() => navigate({ to: "/chatbot", replace: true })}
            aria-label="Exit AI Interviewer Mode"
            className="scale-75"
          />
        </div>
      </div>
      <Outlet />
    </div>
  );
}
