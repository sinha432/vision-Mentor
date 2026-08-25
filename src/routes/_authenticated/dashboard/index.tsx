import {
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { NovaConsole } from "@/components/nova/NovaConsole";
import { useDemoAuth } from "@/contexts/DemoAuthContext";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({
    meta: [
      { title: "Nova — Company Dashboard" },
      {
        name: "description",
        content:
          "Talk with Nova, your AI interview companion, from the company dashboard.",
      },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const { user, ready } = useDemoAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;

    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }

    if (user.role === "individual") {
      sessionStorage.setItem("vmx_auth_redirect", "1");
      navigate({ to: "/", replace: true });
    }
  }, [ready, user, navigate]);

  if (!ready || !user) {
    return (
      <div className="flex h-[calc(100vh-6rem)] w-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading company profile...
        </p>
      </div>
    );
  }

  if (user.role !== "company") {
    return null;
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] w-full min-h-0 flex-col">
      <header className="mb-4 shrink-0 animate-fade-in">
        <h1 className="text-aurora font-display text-2xl font-bold sm:text-3xl">
          Nova
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Your AI interview companion — ask about assessments,
          candidates, or practise interviewing.
        </p>
      </header>

      <NovaConsole
        className="min-h-0"
        companyUserId={user.id}
      />
    </div>
  );
}