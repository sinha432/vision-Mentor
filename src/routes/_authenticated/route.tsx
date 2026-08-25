import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,

  beforeLoad: () => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem("vmx_user");

    if (!raw) {
      throw redirect({ to: "/welcome" });
    }

    try {
      const user = JSON.parse(raw) as {
        id?: string;
        email?: string;
        name?: string;
        role?: string;
      };

      if (
        !user ||
        typeof user.email !== "string" ||
        (user.role !== "individual" && user.role !== "company")
      ) {
        window.localStorage.removeItem("vmx_user");
        throw redirect({ to: "/welcome" });
      }
    } catch {
      window.localStorage.removeItem("vmx_user");
      throw redirect({ to: "/welcome" });
    }
  },

  component: () => <Outlet />,
});