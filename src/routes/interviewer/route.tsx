import { createFileRoute, Outlet } from "@tanstack/react-router";

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
  return (
    <div className="interviewer-theme min-h-screen bg-background text-foreground">
      <Outlet />
    </div>
  );
}
