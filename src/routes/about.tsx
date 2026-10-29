import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, MessageCircle, Users } from "lucide-react";

import { AboutJourney } from "@/components/about/AboutJourney";
import { AboutSection } from "@/components/about/AboutSection";
import { ContactBlock } from "@/components/about/ContactBlock";
import { TeamStrip } from "@/components/about/TeamStrip";
import { AuroraOrbs } from "@/components/shared/AuroraOrbs";
import { SiteFooter } from "@/components/shared/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";

const TITLE = "About Vision Mentor X — mission, features and roadmap";
const DESCRIPTION =
  "Explore the mission behind Vision Mentor X and the journey from interview anxiety to more confident preparation.";

export const Route = createFileRoute("/about")({
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
  component: About,
});

function About() {
  return (
    <>
      <main className="public-neon relative min-h-screen overflow-hidden bg-background">
        <SiteNav variant="public" />
        <AuroraOrbs dense />

        <div className="relative mx-auto w-full max-w-[1760px] px-3 pb-16 pt-20 sm:px-6 sm:pt-24">
          <AboutJourney headingLevel="h1" />

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 px-2">
            <Link
              to="/welcome"
              className="reveal glass group relative inline-flex items-center gap-3 rounded-full border border-cyber/20 py-2.5 pr-5 pl-3 font-display text-sm text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-cyber/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-cyber focus-visible:outline-hidden"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-aurora text-primary-foreground">
                <ArrowLeft className="size-4" strokeWidth={1.75} />
              </span>
              Back to home
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_26px_-10px_rgba(0,200,255,0.8)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
            >
              Explore the demo
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-14 space-y-6 sm:mt-20">
            <AboutSection
              id="about-team"
              icon={Users}
              eyebrow="Who's building it"
              title="The project team"
            >
              <p>
                A small team working across product, AI engineering and experience design. Details
                below are placeholders.
              </p>
              <TeamStrip />
            </AboutSection>

            <AboutSection
              id="about-contact"
              icon={MessageCircle}
              eyebrow="Say hello"
              title="Get in touch"
            >
              <p>
                Questions, feedback or interest in trying the platform — the channels below show
                where those will land.
              </p>
              <ContactBlock />
            </AboutSection>
          </div>

          <SiteFooter />
        </div>
      </main>
    </>
  );
}
