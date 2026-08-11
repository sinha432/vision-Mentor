import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useDemoAuth } from "@/contexts/DemoAuthContext";

import { AuroraOrbs } from "@/components/shared/AuroraOrbs";
import { HeroAvatar } from "@/components/welcome/HeroAvatar";
import { FeatureGrid } from "@/components/welcome/FeatureGrid";
import { StepFlow } from "@/components/welcome/StepFlow";
import { RoleCards } from "@/components/welcome/RoleCards";
import { StatsStrip } from "@/components/welcome/StatsStrip";
import { WelcomeCTAs } from "@/components/welcome/WelcomeCTAs";
import { ClosingCta } from "@/components/welcome/ClosingCta";
import { SiteFooter } from "@/components/shared/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import { AboutPreview } from "@/components/welcome/AboutPreview";

const TITLE = "Master Every Interview with Vision Mentor X";
const DESCRIPTION =
  "AI conversation, computer vision, speech analysis and resume intelligence in one interview practice platform — with reports companies can share and score.";

export const Route = createFileRoute("/welcome")({
  ssr: false,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const { user, ready } = useDemoAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && user) navigate({ to: "/" });
  }, [ready, user, navigate]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <SiteNav />
      <AuroraOrbs dense />

      <div className="relative mx-auto w-full max-w-6xl px-5 pt-28 pb-16 sm:pt-32">
        <header className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="text-center lg:text-left">
            <span
              className="reveal inline-flex items-center gap-2 rounded-full border border-cyber/25 bg-surface/60 px-4 py-1.5 text-xs tracking-[0.22em] text-cyber uppercase backdrop-blur-md"
              style={{ animationDelay: "0s" }}
            >
              AI interview preparation
            </span>

            <h1
              className="reveal mt-7 font-display text-4xl leading-[1.06] tracking-[0.04em] text-gradient sm:text-5xl lg:text-6xl"
              style={{ animationDelay: "0.1s" }}
            >
              Master Every Interview with Vision Mentor X
            </h1>

            <p
              className="reveal mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0"
              style={{ animationDelay: "0.2s" }}
            >
              {DESCRIPTION}
            </p>

            <div className="reveal mt-10" style={{ animationDelay: "0.3s" }}>
              <WelcomeCTAs />
            </div>
          </div>

          <div className="reveal" style={{ animationDelay: "0.4s" }}>
            <HeroAvatar />
          </div>
        </header>

        <div className="mt-24 sm:mt-32">
          <FeatureGrid />
        </div>

        <div className="mt-16 sm:mt-24">
          <AboutPreview />
        </div>



        <div className="mt-16 sm:mt-24">
          <StepFlow />
        </div>

        <div className="mt-16 sm:mt-20">
          <RoleCards />
        </div>

        <div className="mt-16 sm:mt-20">
          <StatsStrip />
        </div>

        <div className="mt-16 sm:mt-24">
          <ClosingCta />
        </div>

        <SiteFooter />
      </div>
    </main>
  );
}
