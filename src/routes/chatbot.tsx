import { createFileRoute, redirect } from "@tanstack/react-router";
import { VisionMentor } from "./_authenticated/index";

export const Route = createFileRoute("/chatbot")({
  ssr: false,
  beforeLoad: () => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem("vmx_demo_user");

    if (!raw) {
      throw redirect({ to: "/welcome" });
    }
  },
  component: VisionMentor,
});
