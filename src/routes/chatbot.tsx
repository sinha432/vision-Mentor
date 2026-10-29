import { createFileRoute, redirect } from "@tanstack/react-router";
import { VisionMentor } from "./_authenticated/index";

export const Route = createFileRoute("/chatbot")({
  ssr: false,
  beforeLoad: () => {
    if (typeof window === "undefined") return;

    let isAuthenticated = false;
    try {
      const raw = window.localStorage.getItem("vmx_user");
      const user = raw ? (JSON.parse(raw) as { email?: unknown; role?: unknown }) : null;
      isAuthenticated =
        typeof user?.email === "string" && (user.role === "individual" || user.role === "company");
    } catch {
      isAuthenticated = false;
    }

    if (!isAuthenticated) throw redirect({ to: "/auth" });
  },
  component: VisionMentor,
});
