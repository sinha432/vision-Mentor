import { createFileRoute } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  Bot,
  Code2,
  Eye,
  Compass,
  FileText,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import novaAvatar from "@/assets/nova-cutout.png";

import { AuroraOrbs } from "@/components/shared/AuroraOrbs";
import { FeatureGrid } from "@/components/welcome/FeatureGrid";
import { StepFlow } from "@/components/welcome/StepFlow";
import { RoleCards } from "@/components/welcome/RoleCards";
import { StatsStrip } from "@/components/welcome/StatsStrip";
import { ClosingCta } from "@/components/welcome/ClosingCta";
import { SiteFooter } from "@/components/shared/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import { AboutPreview } from "@/components/welcome/AboutPreview";
import { Link } from "@tanstack/react-router";

const TITLE = "Master Every Interview with Vision Mentor X";
const DESCRIPTION =
  "AI conversation, computer vision, speech analysis and resume intelligence in one interview practice platform — with reports companies can share and score.";

const HERO_FEATURES = [
  { icon: FileText, title: "Resume Analysis", detail: "Get instant feedback." },
  { icon: MessageSquare, title: "Mock Interviews", detail: "Practice with AI." },
  { icon: Code2, title: "Coding Assessments", detail: "Solve real problems." },
  { icon: BrainCircuit, title: "Behavioral Analysis", detail: "Improve communication." },
  { icon: Compass, title: "Career Guidance", detail: "Plan your future." },
];

type ConnectorGeometry = {
  width: number;
  height: number;
  paths: { path: string; arrow: string; x: number; y: number }[];
};

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
  const reducedMotion = useReducedMotion();

  return (
    <>
      <main className="public-neon relative min-h-screen overflow-hidden bg-background">
        <SiteNav variant="welcome" />
        <AuroraOrbs dense />

        <section
          id="welcome-hero"
          className="relative isolate flex min-h-[100svh] scroll-mt-20 flex-col justify-center overflow-hidden bg-[#030815] text-white"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_68%_36%,rgba(0,186,255,0.2),transparent_42%),radial-gradient(ellipse_at_88%_88%,rgba(132,64,255,0.2),transparent_38%),linear-gradient(120deg,#030711_0%,#061a30_50%,#100c25_100%)]"
          />
          <div
            aria-hidden="true"
            className="grid-backdrop pointer-events-none absolute inset-0 opacity-30"
          />

          <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 pb-10 pt-28 sm:px-8 sm:pb-12 sm:pt-32 lg:px-12">
            <header className="relative z-10 mx-auto mb-8 max-w-4xl text-center sm:mb-10">
              <motion.span
                initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.5 }}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-slate-950/45 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200 backdrop-blur sm:text-xs"
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                AI Interview Preparation
              </motion.span>
              <motion.h1
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.15 } },
                }}
                className="mt-5 font-sans text-3xl font-semibold leading-[1.08] tracking-normal text-white sm:text-4xl lg:text-5xl"
              >
                <motion.span
                  variants={{
                    hidden: { opacity: 0, y: 18 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: reducedMotion ? 0 : 0.55 }}
                  className="block"
                >
                  Your AI Companion for a
                </motion.span>
                <motion.span
                  variants={{
                    hidden: { opacity: 0, y: 18 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: reducedMotion ? 0 : 0.55 }}
                  className="welcome-gradient mt-1 block"
                >
                  Brighter Career
                </motion.span>
              </motion.h1>
              <motion.p
                initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.5, delay: reducedMotion ? 0 : 0.35 }}
                className="mt-4 font-display text-sm text-cyan-100 sm:text-base"
              >
                Practice. Improve. Get hired.
              </motion.p>
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.5, delay: reducedMotion ? 0 : 0.45 }}
                className="mt-6 flex flex-wrap justify-center gap-3"
              >
                <Link
                  to="/demo"
                  className="group inline-flex items-center justify-center gap-2 rounded-lg bg-linear-to-r from-cyan-400 via-blue-500 to-violet-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_14px_38px_-16px_rgba(0,190,255,0.8)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                >
                  <Bot className="size-4" aria-hidden="true" />
                  Try Demo
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  to="/about"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-400/40 bg-slate-950/40 px-6 py-3 text-sm font-medium text-white backdrop-blur transition-colors hover:border-cyan-200/70 hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                >
                  <Eye className="size-4" aria-hidden="true" />
                  Learn More
                </Link>
              </motion.div>
            </header>

            <HeroFeatureDiagram reducedMotion={reducedMotion} />

            <a
              href="#features"
              className="relative z-10 mx-auto mt-5 inline-flex w-fit items-center gap-2 py-2 text-xs font-medium text-slate-300 transition-colors hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
            >
              Scroll to explore
              <ArrowDown className="size-4" aria-hidden="true" />
            </a>
          </div>
        </section>

        <div className="relative mx-auto w-full max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pt-16">
          <FeatureGrid />

          <div className="mt-16 sm:mt-24">
            <AboutPreview />
          </div>

          <div className="mt-16 sm:mt-24">
            <StepFlow />
          </div>

          <div id="welcome-roles" className="mt-16 scroll-mt-24 sm:mt-20">
            <RoleCards />
          </div>

          <div id="welcome-stats" className="mt-16 scroll-mt-24 sm:mt-20">
            <StatsStrip />
          </div>

          <div id="get-started" className="mt-16 scroll-mt-24 sm:mt-24">
            <ClosingCta />
          </div>

          <SiteFooter />
        </div>
      </main>
    </>
  );
}

function HeroFeatureDiagram({ reducedMotion }: { reducedMotion: boolean | null }) {
  const diagramRef = useRef<HTMLDivElement>(null);
  const novaPanelRef = useRef<HTMLElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [geometry, setGeometry] = useState<ConnectorGeometry | null>(null);

  useLayoutEffect(() => {
    const diagram = diagramRef.current;
    const novaPanel = novaPanelRef.current;
    if (!diagram || !novaPanel) return;

    const updateGeometry = () => {
      const diagramRect = diagram.getBoundingClientRect();
      const novaRect = novaPanel.getBoundingClientRect();
      const width = diagramRect.width;
      const height = diagramRect.height;
      if (!width || !height) return;

      const originX = novaRect.right - diagramRect.left + 2;
      const originY = novaRect.top - diagramRect.top + novaRect.height * 0.61;
      const paths = cardRefs.current.flatMap((card) => {
        if (!card) return [];
        const cardRect = card.getBoundingClientRect();
        const x = cardRect.left - diagramRect.left - 12;
        const y = cardRect.top - diagramRect.top + cardRect.height / 2;
        const curve = Math.max(30, (x - originX) * 0.42);

        return [
          {
            path: `M ${originX} ${originY} C ${originX + curve} ${originY}, ${x - curve} ${y}, ${x} ${y}`,
            arrow: `M ${x - 12} ${y - 7} L ${x} ${y} L ${x - 12} ${y + 7} Z`,
            x,
            y,
          },
        ];
      });

      setGeometry({ width, height, paths });
    };

    updateGeometry();
    const resizeObserver = new ResizeObserver(updateGeometry);
    resizeObserver.observe(diagram);
    resizeObserver.observe(novaPanel);
    cardRefs.current.forEach((card) => {
      if (card) resizeObserver.observe(card);
    });
    window.addEventListener("resize", updateGeometry);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateGeometry);
    };
  }, []);

  return (
    <div
      ref={diagramRef}
      className="relative grid w-full items-center gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-10"
    >
      {geometry && (
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 z-10 hidden size-full overflow-visible lg:block"
        >
          <defs>
            <filter id="nova-feature-connector-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {geometry.paths.map((connector, index) => {
            const pathId = `nova-feature-path-${index}`;
            const delay = reducedMotion ? 0 : 0.2 + index * 0.34;

            return (
              <g key={pathId}>
                <motion.path
                  id={pathId}
                  d={connector.path}
                  fill="none"
                  stroke="#20d9ff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  filter="url(#nova-feature-connector-glow)"
                  initial={reducedMotion ? false : { pathLength: 0, opacity: 0.3 }}
                  animate={{ pathLength: 1, opacity: 0.9 }}
                  transition={{
                    duration: reducedMotion ? 0 : 0.8,
                    delay,
                    ease: "easeOut",
                  }}
                />
                <motion.path
                  d={connector.arrow}
                  fill="#8cf3ff"
                  filter="url(#nova-feature-connector-glow)"
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: reducedMotion ? 0 : 0.22,
                    delay: delay + (reducedMotion ? 0 : 0.8),
                  }}
                  style={{ transformOrigin: `${connector.x}px ${connector.y}px` }}
                />
                {!reducedMotion && (
                  <circle r="4" fill="#b9fbff" filter="url(#nova-feature-connector-glow)">
                    <animateMotion dur="3.2s" begin={`${delay + 0.8}s`} repeatCount="indefinite">
                      <mpath href={`#${pathId}`} />
                    </animateMotion>
                  </circle>
                )}
              </g>
            );
          })}
        </svg>
      )}

      <div className="relative z-20 mx-auto h-[30rem] w-full max-w-[34rem] sm:h-[35rem] lg:h-[37rem] lg:max-w-none">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.55, delay: reducedMotion ? 0 : 0.2 }}
          className="absolute left-0 top-0 z-30 w-[min(22rem,84%)] rounded-2xl border border-cyan-300/70 bg-blue-950/90 px-5 py-4 text-left shadow-[0_0_34px_rgba(0,170,255,0.38)] backdrop-blur-xl"
          aria-label="Hi! I'm Nova. Let me show you how VisionMentor X works!"
        >
          <p className="flex items-center gap-2 text-base font-semibold text-white sm:text-lg">
            Hi! I'm Nova 👋
          </p>
          <p className="mt-1 text-sm leading-relaxed text-blue-100 sm:text-base">
            Let me show you how
            <br />
            VisionMentor X works!
          </p>
        </motion.div>

        <figure
          ref={novaPanelRef}
          className="glass-strong absolute inset-x-0 bottom-0 top-[6.5rem] overflow-hidden rounded-[2rem] border border-cyan-300/40 bg-slate-950/55 p-3 shadow-[0_0_48px_-14px_rgba(0,170,255,0.55),inset_0_0_42px_rgba(25,100,255,0.1)] backdrop-blur-sm"
        >
          <motion.img
            src={novaAvatar}
            alt="Nova, Vision Mentor X's AI interview companion"
            className="block size-full object-contain"
            fetchPriority="high"
            animate={reducedMotion ? undefined : { y: [0, -7, 0] }}
            transition={
              reducedMotion ? undefined : { duration: 5, repeat: Infinity, ease: "easeInOut" }
            }
          />
        </figure>
      </div>

      <div className="relative z-20 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:gap-3.5">
        {HERO_FEATURES.map(({ icon: Icon, title, detail }, index) => (
          <motion.div
            key={title}
            ref={(element) => {
              cardRefs.current[index] = element;
            }}
            initial={reducedMotion ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: reducedMotion ? 0 : 0.45,
              delay: reducedMotion ? 0 : 0.35 + index * 0.12,
            }}
            whileHover={reducedMotion ? undefined : { y: -3 }}
            className={`group flex min-h-[5.75rem] items-center gap-4 rounded-2xl border border-cyan-400/55 bg-[#031538]/85 px-4 py-3 shadow-[0_0_22px_-10px_rgba(0,190,255,0.7),inset_0_0_18px_rgba(0,125,255,0.1)] backdrop-blur-xl transition-[border-color,box-shadow] duration-300 hover:border-cyan-200/90 hover:shadow-[0_0_30px_-8px_rgba(0,190,255,0.78),inset_0_0_22px_rgba(0,125,255,0.16)] sm:min-h-[6.25rem] sm:px-5 lg:min-h-[6.4rem] lg:px-6`}
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-cyan-300/35 bg-blue-500/20 text-cyan-200 transition-colors group-hover:border-cyan-200/70 group-hover:bg-cyan-300/15 sm:size-14">
              <Icon className="size-5 sm:size-6" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold leading-tight text-white sm:text-base">
                {title}
              </span>
              <span className="mt-1 block text-xs leading-tight text-blue-100/90 sm:text-sm">
                {detail}
              </span>
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
