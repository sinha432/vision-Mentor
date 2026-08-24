import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("vmx_demo_user");
    if (!raw) throw redirect({ to: "/welcome" });
  },
  component: () => <Outlet />,
});
