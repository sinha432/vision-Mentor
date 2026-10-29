import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BarChart3, Cpu, Flag, Lightbulb, Search } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";

type Milestone = {
  number?: string;
  title: string;
  description: string;
  detail: string;
  icon: typeof Search;
  accent: string;
  placement: string;
  detailPlacement: string;
};

const milestones: Milestone[] = [
  {
    number: "01",
    title: "The Problem",
    description: "Interview anxiety,\nno proper guidance.",
    detail:
      "Many candidates experience interview anxiety and lack structured practice or timely feedback on their communication and delivery.",
    icon: Search,
    accent: "#00d9ff",
    placement: "journey-card-problem",
    detailPlacement: "journey-detail-problem",
  },
  {
    number: "02",
    title: "Our Solution",
    description: "AI-powered\nmentoring platform.",
    detail:
      "VisionMentor X combines conversational AI, resume intelligence, speech analysis, and computer vision to support interview preparation.",
    icon: Lightbulb,
    accent: "#a879ff",
    placement: "journey-card-solution",
    detailPlacement: "journey-detail-solution",
  },
  {
    number: "03",
    title: "How It Works",
    description: "AI + computer vision\n- NLP.",
    detail:
      "Candidates practise through AI-driven conversations and receive feedback based on their answers and the implemented speech and visual analysis features.",
    icon: Cpu,
    accent: "#168bff",
    placement: "journey-card-how",
    detailPlacement: "journey-detail-how",
  },
  {
    number: "04",
    title: "Our Impact",
    description: "Better preparation.\nBrighter careers.",
    detail:
      "The platform aims to help candidates understand their strengths, identify areas for improvement, and prepare more effectively for interviews.",
    icon: BarChart3,
    accent: "#a879ff",
    placement: "journey-card-impact",
    detailPlacement: "journey-detail-impact",
  },
  {
    number: "05",
    title: "Join the Journey",
    description: "Be job ready with\nVisionMentor X.",
    detail:
      "Explore VisionMentor X, practise with AI, review your feedback, and keep developing the skills needed for your career goals.",
    icon: Flag,
    accent: "#ffc857",
    placement: "journey-card-join",
    detailPlacement: "journey-detail-join",
  },
];

function ButterflyOrb() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 1000 800"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
    >
      <defs>
        <radialGradient id="orbit-ambient" cx="66%" cy="57%" r="52%">
          <stop stopColor="#0b4880" stopOpacity=".34" />
          <stop offset=".58" stopColor="#071832" stopOpacity=".16" />
          <stop offset="1" stopColor="#030a19" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="orb-glass" cx="36%" cy="23%" r="82%">
          <stop stopColor="#1c80a7" stopOpacity=".19" />
          <stop offset=".42" stopColor="#071c36" stopOpacity=".44" />
          <stop offset=".78" stopColor="#06132c" stopOpacity=".67" />
          <stop offset="1" stopColor="#2384b4" stopOpacity=".17" />
        </radialGradient>
        <linearGradient
          id="orb-rim"
          x1="309"
          y1="293"
          x2="615"
          y2="580"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#b6faff" stopOpacity=".88" />
          <stop offset=".26" stopColor="#00d9ff" stopOpacity=".78" />
          <stop offset=".62" stopColor="#168bff" stopOpacity=".34" />
          <stop offset=".83" stopColor="#a879ff" stopOpacity=".72" />
          <stop offset="1" stopColor="#00d9ff" stopOpacity=".62" />
        </linearGradient>
        <linearGradient
          id="wing-cyan"
          x1="382"
          y1="334"
          x2="492"
          y2="451"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#e9ffff" />
          <stop offset=".24" stopColor="#33edff" />
          <stop offset=".68" stopColor="#168bff" />
          <stop offset="1" stopColor="#1456bb" />
        </linearGradient>
        <linearGradient
          id="wing-violet"
          x1="470"
          y1="426"
          x2="514"
          y2="520"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#27cfff" />
          <stop offset=".52" stopColor="#527aff" />
          <stop offset="1" stopColor="#bd78ff" />
        </linearGradient>
        <linearGradient
          id="pedestal-metal"
          x1="436"
          y1="626"
          x2="570"
          y2="751"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#163453" />
          <stop offset=".48" stopColor="#071426" />
          <stop offset=".72" stopColor="#102d4b" />
          <stop offset="1" stopColor="#030813" />
        </linearGradient>
        <linearGradient
          id="pedestal-rim"
          x1="182"
          y1="720"
          x2="830"
          y2="754"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#00d9ff" stopOpacity=".08" />
          <stop offset=".22" stopColor="#00d9ff" stopOpacity=".9" />
          <stop offset=".55" stopColor="#168bff" stopOpacity=".34" />
          <stop offset=".82" stopColor="#a879ff" stopOpacity=".78" />
          <stop offset="1" stopColor="#00d9ff" stopOpacity=".18" />
        </linearGradient>
        <filter id="soft-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="butterfly-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path d="M0 0h1000v800H0z" fill="url(#orbit-ambient)" />

      <g className="journey-orbit-track journey-orbit-track-outer">
        <ellipse
          cx="450"
          cy="442"
          rx="422"
          ry="298"
          stroke="#168bff"
          strokeOpacity=".36"
          strokeWidth="1.5"
          strokeDasharray="1 12"
          strokeLinecap="round"
        />
        <path
          d="M738 200a327 327 0 0 1 101 210"
          stroke="#00d9ff"
          strokeOpacity=".82"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#soft-glow)"
        />
        <circle
          className="journey-orbit-planet journey-orbit-planet-cyan"
          cx="872"
          cy="442"
          r="7"
        />
      </g>
      <g className="journey-orbit-track journey-orbit-track-middle">
        <ellipse
          cx="450"
          cy="442"
          rx="380"
          ry="272"
          stroke="#168bff"
          strokeOpacity=".44"
          strokeWidth="1.5"
          strokeDasharray="2 11"
          strokeLinecap="round"
        />
        <path
          d="M234 276a325 325 0 0 1 191-157"
          stroke="#a879ff"
          strokeOpacity=".88"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#soft-glow)"
        />
        <circle
          className="journey-orbit-planet journey-orbit-planet-violet"
          cx="180"
          cy="442"
          r="6"
        />
      </g>
      <g className="journey-orbit-track journey-orbit-track-inner">
        <ellipse
          cx="450"
          cy="442"
          rx="298"
          ry="217"
          stroke="#2b8ab1"
          strokeOpacity=".48"
          strokeWidth="1.5"
        />
        <path
          d="M190 533a327 327 0 0 0 164 163"
          stroke="#168bff"
          strokeOpacity=".88"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#soft-glow)"
        />
        <circle
          className="journey-orbit-planet journey-orbit-planet-amber"
          cx="450"
          cy="225"
          r="5"
        />
      </g>

      <g opacity=".4" stroke="#1b628b">
        <circle cx="450" cy="442" r="385" strokeOpacity=".2" />
        <circle cx="450" cy="442" r="344" strokeOpacity=".22" />
        <ellipse cx="450" cy="442" rx="422" ry="298" strokeOpacity=".22" />
        <path d="M130 761h740M183 778h634" strokeOpacity=".22" />
        <path d="M567 752a326 326 0 0 0 202-127" stroke="#00d9ff" strokeOpacity=".7" />
      </g>
      <path
        d="M208 267a327 327 0 0 1 198-142"
        stroke="#b174ff"
        strokeOpacity=".9"
        strokeWidth="3"
        strokeLinecap="round"
        filter="url(#soft-glow)"
      />
      <path
        d="M730 210a327 327 0 0 1 112 231"
        stroke="#00d9ff"
        strokeOpacity=".85"
        strokeWidth="3"
        strokeLinecap="round"
        filter="url(#soft-glow)"
      />
      <path
        d="M190 533a327 327 0 0 0 164 163"
        stroke="#168bff"
        strokeOpacity=".8"
        strokeWidth="3"
        strokeLinecap="round"
        filter="url(#soft-glow)"
      />
      <path
        d="M547 754a327 327 0 0 0 241-135"
        stroke="#a879ff"
        strokeOpacity=".75"
        strokeWidth="3"
        strokeLinecap="round"
        filter="url(#soft-glow)"
      />
      <g fill="#bffaff" filter="url(#soft-glow)">
        <circle cx="207" cy="268" r="4" />
        <circle cx="841" cy="441" r="4" />
        <circle cx="355" cy="696" r="4" />
        <circle cx="788" cy="619" r="3.5" />
        <circle cx="190" cy="533" r="3" />
      </g>

      <ellipse cx="458" cy="742" rx="335" ry="25" fill="#001022" opacity=".8" />
      <ellipse
        cx="458"
        cy="743"
        rx="302"
        ry="13"
        fill="#00b8ed"
        opacity=".08"
        filter="url(#soft-glow)"
      />
      <path
        d="M408 580h94l26 134H382l26-134Z"
        fill="url(#pedestal-metal)"
        stroke="#3c8eb5"
        strokeOpacity=".48"
        strokeWidth="2"
      />
      <path d="M418 596h74" stroke="#31dfff" strokeOpacity=".46" strokeWidth="2" />
      <path d="M394 704h149" stroke="#00d9ff" strokeOpacity=".54" strokeWidth="2" />
      <ellipse cx="455" cy="715" rx="306" ry="43" fill="#030b18" stroke="#1a4161" strokeWidth="3" />
      <ellipse
        cx="455"
        cy="708"
        rx="318"
        ry="39"
        fill="#081629"
        stroke="url(#pedestal-rim)"
        strokeWidth="5"
      />
      <ellipse
        cx="455"
        cy="700"
        rx="281"
        ry="29"
        fill="#0b1c31"
        stroke="#236184"
        strokeOpacity=".65"
        strokeWidth="2"
      />
      <ellipse
        cx="455"
        cy="693"
        rx="225"
        ry="19"
        fill="#071325"
        stroke="#00d9ff"
        strokeOpacity=".25"
        strokeWidth="2"
      />
      <path
        d="M174 710c107 26 447 33 565-1"
        stroke="#29dfff"
        strokeOpacity=".5"
        strokeWidth="2"
        filter="url(#soft-glow)"
      />
      <path d="M237 744c134 19 307 18 438-2" stroke="#a879ff" strokeOpacity=".3" strokeWidth="2" />

      <circle cx="450" cy="405" r="183" fill="#0a2340" fillOpacity=".42" filter="url(#soft-glow)" />
      <circle
        cx="450"
        cy="405"
        r="180"
        fill="url(#orb-glass)"
        stroke="#94f4ff"
        strokeOpacity=".6"
        strokeWidth="2"
      />
      <circle cx="450" cy="405" r="173" stroke="url(#orb-rim)" strokeWidth="4" />
      <circle cx="450" cy="405" r="165" stroke="#8beaff" strokeOpacity=".15" strokeWidth="1.5" />
      <path
        d="M327 292a162 162 0 0 1 209-52"
        stroke="#d6ffff"
        strokeOpacity=".54"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M581 299a162 162 0 0 1 28 155"
        stroke="#00d9ff"
        strokeOpacity=".72"
        strokeWidth="3"
        strokeLinecap="round"
        filter="url(#soft-glow)"
      />
      <path
        d="M351 539a163 163 0 0 0 172 30"
        stroke="#a879ff"
        strokeOpacity=".68"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <ellipse
        cx="400"
        cy="310"
        rx="80"
        ry="26"
        fill="#b3faff"
        opacity=".06"
        transform="rotate(-36 400 310)"
      />

      <g filter="url(#butterfly-glow)" strokeLinejoin="round">
        <path
          d="M445 405c-31-55-104-103-142-70-34 30-7 99 30 126 36 27 81 9 112-30"
          fill="url(#wing-cyan)"
          fillOpacity=".9"
          stroke="#9cffff"
          strokeOpacity=".9"
          strokeWidth="3"
        />
        <path
          d="M455 405c31-55 104-103 142-70 34 30 7 99-30 126-36 27-81 9-112-30"
          fill="url(#wing-cyan)"
          fillOpacity=".9"
          stroke="#9cffff"
          strokeOpacity=".9"
          strokeWidth="3"
        />
        <path
          d="M445 414c-29 12-84 27-95 67-10 37 26 61 53 43 23-15 33-49 52-83"
          fill="url(#wing-violet)"
          fillOpacity=".94"
          stroke="#7eeaff"
          strokeOpacity=".86"
          strokeWidth="3"
        />
        <path
          d="M455 414c29 12 84 27 95 67 10 37-26 61-53 43-23-15-33-49-52-83"
          fill="url(#wing-violet)"
          fillOpacity=".94"
          stroke="#7eeaff"
          strokeOpacity=".86"
          strokeWidth="3"
        />
      </g>
      <path d="M450 373c-7 31-7 78 0 129" stroke="#06162d" strokeWidth="11" strokeLinecap="round" />
      <path
        d="M447 378c-13-19-23-24-36-28m42 28c13-19 23-24 36-28"
        stroke="#b8faff"
        strokeOpacity=".8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M378 360c22-8 43 8 55 27m189-27c-22-8-43 8-55 27"
        stroke="#e0ffff"
        strokeOpacity=".46"
        strokeWidth="2"
      />
    </svg>
  );
}

function MilestoneCard({
  milestone,
  index,
  active,
  onActivate,
  onDeactivate,
}: {
  milestone: Milestone;
  index: number;
  active: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const Icon = milestone.icon;

  return (
    <div
      className={`journey-card-motion ${milestone.placement}${active ? " is-active" : ""}`}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") onActivate();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") onDeactivate();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDeactivate();
      }}
    >
      <button
        type="button"
        className="journey-orbit-card group text-left"
        style={{ "--card-accent": milestone.accent } as CSSProperties}
        aria-expanded={active}
        aria-controls={`journey-detail-${index}`}
        onFocus={onActivate}
        onClick={(event) => {
          const touchClick =
            "pointerType" in event.nativeEvent && event.nativeEvent.pointerType === "touch";
          if (touchClick) {
            if (active) onDeactivate();
            else onActivate();
          } else if (!active) {
            onActivate();
          }
        }}
      >
        <span className="journey-orbit-icon" aria-hidden="true">
          <Icon className="size-6" strokeWidth={1.8} />
        </span>
        <span className="journey-card-copy min-w-0">
          <span className="flex items-center gap-2 text-[15px] font-semibold leading-tight text-[#f4f7ff]">
            {milestone.number && (
              <span className="font-bold" style={{ color: milestone.accent }}>
                {milestone.number}
              </span>
            )}
            {milestone.title}
          </span>
          <span className="journey-card-description mt-2 block whitespace-pre-line text-[13px] leading-[1.4] text-[#a0aec8]">
            {milestone.description}
          </span>
        </span>
      </button>
      <div
        id={`journey-detail-${index}`}
        className={`journey-detail-panel ${milestone.detailPlacement}${active ? " is-open" : ""}`}
        aria-hidden={!active}
        inert={!active}
      >
        <div className="journey-detail-heading">
          <Icon
            className="size-4 shrink-0"
            style={{ color: milestone.accent }}
            aria-hidden="true"
          />
          <h4>{milestone.title}</h4>
        </div>
        <p>{milestone.detail}</p>
      </div>
    </div>
  );
}

export function AboutJourney({
  headingLevel = "h2",
  variant = "page",
}: {
  headingLevel?: "h1" | "h2";
  variant?: "page" | "home";
}) {
  const [activeMilestone, setActiveMilestone] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  const Heading = headingLevel;

  return (
    <section
      id="about"
      aria-labelledby="about-journey-title"
      className={`about-orbit-hero about-orbit-${variant} relative isolate overflow-hidden border border-cyan-100/10 bg-[#030a19] shadow-[0_36px_110px_-52px_rgba(0,217,255,0.22)]`}
    >
      <div
        aria-hidden="true"
        className="about-orbit-ambient pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden="true"
        className="about-orbit-top-fragments pointer-events-none absolute inset-x-0 top-0"
      >
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="about-orbit-layout relative z-10 grid">
        <header className="about-orbit-copy relative z-20 flex flex-col justify-center">
          <p className="about-orbit-eyebrow mb-7 font-display text-sm font-bold tracking-[0.22em] text-[#00dceb] uppercase">
            About Us
          </p>
          <Heading
            id="about-journey-title"
            className="about-orbit-title about-orbit-home-title font-sans font-bold tracking-[-0.045em] text-[#f4f7ff]"
          >
            <span className="block">
              Why <span className="about-orbit-gradient whitespace-nowrap">VisionMentor X</span>
            </span>
            <span className="block">exists</span>
          </Heading>
          <p className="about-orbit-description about-orbit-home-description mt-7 text-[#c1cddf]">
            <span>VisionMentor X combines AI conversation,</span>
            <span>computer vision, speech analysis and resume</span>
            <span>intelligence into one interview practice platform —</span>
            <span>so you can see what is improving and what still</span>
            <span>needs work.</span>
          </p>
          <a
            href="#journey-map"
            className="about-orbit-cta about-orbit-home-cta mt-8 inline-flex items-center justify-between rounded-full border border-[#00d9ff]/70 bg-[#071426]/70 px-5 text-sm font-semibold tracking-wide text-[#31e7ff] shadow-[0_0_24px_-12px_rgba(0,217,255,0.9)] transition-[border-color,box-shadow,background-color,transform] hover:-translate-y-0.5 hover:border-[#8cf5ff] hover:bg-[#0a1a2e] hover:shadow-[0_0_32px_-8px_rgba(0,217,255,0.5)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
          >
            <span className="flex items-center gap-4">
              <span className="size-2.5 rounded-full bg-[#00d9ff] shadow-[0_0_12px_#00d9ff]" />
              Explore the Journey
            </span>
            <ArrowRight className="size-5" aria-hidden="true" />
          </a>
        </header>

        <div
          id="journey-map"
          className="about-orbit-stage relative isolate"
          aria-label="VisionMentor X journey milestones"
        >
          <ButterflyOrb />
          <div className="about-orbit-cards z-10">
            {milestones.map((milestone, index) => (
              <motion.div
                key={milestone.title}
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: reducedMotion ? 0 : 0.45,
                  delay: reducedMotion ? 0 : index * 0.08,
                }}
              >
                <MilestoneCard
                  milestone={milestone}
                  index={index}
                  active={activeMilestone === index}
                  onActivate={() => setActiveMilestone(index)}
                  onDeactivate={() =>
                    setActiveMilestone((current) => (current === index ? null : current))
                  }
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
