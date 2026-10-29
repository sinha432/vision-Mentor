import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, Cpu, Flag, Lightbulb, TriangleAlert } from "lucide-react";
import { useState } from "react";

const milestones = [
  {
    icon: TriangleAlert,
    title: "The Problem",
    short: "Interview anxiety, no proper guidance.",
    detail:
      "Many candidates struggle with interview anxiety and lack structured, realistic practice. Traditional preparation often provides limited feedback on communication, confidence, and delivery, leaving candidates uncertain about their readiness.",
    color: "#21cfff",
    position: "left-[10%] top-[78%]",
    panel: "left-full top-0 md:ml-3",
  },
  {
    icon: Lightbulb,
    title: "Our Solution",
    short: "AI-powered mentoring platform.",
    detail:
      "VisionMentor X brings conversational AI, resume analysis, speech analysis, and computer vision into one interview preparation platform. Candidates can practise, receive feedback, and identify areas for improvement in one place.",
    color: "#168bff",
    position: "left-[31%] top-[63%]",
    panel: "left-full top-0 md:ml-3",
  },
  {
    icon: Cpu,
    title: "How It Works",
    short: "AI + computer vision + NLP.",
    detail:
      "The platform combines AI-driven conversations with resume intelligence, speech analysis, and visual signals to support interview practice. Candidates can receive feedback on answers and interview delivery.",
    color: "#4ca9ff",
    position: "left-[48%] top-[48%]",
    panel: "left-full top-0 md:ml-3",
  },
  {
    icon: BarChart3,
    title: "Our Impact",
    short: "Better preparation. Brighter careers.",
    detail:
      "VisionMentor X aims to help students and professionals prepare more effectively, understand their strengths and weaknesses, improve interview confidence, and work toward better career opportunities.",
    color: "#a879ff",
    position: "left-[68%] top-[30%]",
    panel: "right-full top-0 md:mr-3",
  },
  {
    icon: Flag,
    title: "Join the Journey",
    short: "Be job ready with VisionMentor X.",
    detail:
      "Take the next step in your interview preparation journey. Explore the platform, practise with AI, review your feedback, and continue building the skills needed for your career goals.",
    color: "#ffb45c",
    position: "left-[85%] top-[12%]",
    panel: "right-full top-0 md:mr-3",
  },
] as const;

function MountainBackdrop() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <defs>
        <linearGradient id="journey-sky" x1="800" y1="0" x2="800" y2="900">
          <stop stopColor="#050a1b" />
          <stop offset=".52" stopColor="#101a3c" />
          <stop offset=".76" stopColor="#46234b" />
          <stop offset="1" stopColor="#08152d" />
        </linearGradient>
        <linearGradient id="journey-horizon" x1="430" y1="545" x2="1350" y2="545">
          <stop stopColor="#ff8e72" stopOpacity="0" />
          <stop offset=".5" stopColor="#ff9b86" stopOpacity=".4" />
          <stop offset="1" stopColor="#a879ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="journey-trail" x1="340" y1="775" x2="1360" y2="165">
          <stop stopColor="#168bff" />
          <stop offset=".55" stopColor="#21cfff" />
          <stop offset="1" stopColor="#bd8aff" />
        </linearGradient>
        <filter id="journey-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="journey-sun">
          <stop stopColor="#ffcf9c" stopOpacity=".62" />
          <stop offset="1" stopColor="#ff9b86" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path fill="url(#journey-sky)" d="M0 0h1600v900H0z" />
      <circle cx="1120" cy="500" r="220" fill="url(#journey-sun)" />
      <path d="M0 565h1600" stroke="url(#journey-horizon)" strokeWidth="2" />
      <path
        d="m0 600 145-155 106 86 173-220 144 205 171-260 210 274 154-191 165 210 151-151 181 202v300H0V600Z"
        fill="#121d3b"
        fillOpacity=".88"
      />
      <path
        d="m0 666 205-168 135 111 195-199 173 209 185-156 169 139 175-186 187 166 176-111v329H0V666Z"
        fill="#0b1832"
      />
      <path
        d="M0 737c174-75 276-21 420-84 119-52 225-1 343-74 133-82 267-35 378-101 158-94 284-52 459-125v647H0V737Z"
        fill="#071328"
      />
      <path
        d="M0 814c150-49 270-23 397-55s217 15 350-29 242-22 362-54 276-2 491-72v296H0V814Z"
        fill="#050d1e"
      />
      <path
        d="M0 694c215-84 365-8 510-93 126-74 270-11 400-103 119-84 294-24 420-125"
        stroke="#25bde8"
        strokeOpacity=".13"
        strokeWidth="2"
      />
      <path
        d="M360 780c68-69 132-37 184-103 48-61 106-39 153-97 46-58 105-53 155-111 54-61 108-56 157-115 40-48 103-45 155-91"
        stroke="#21cfff"
        strokeOpacity=".22"
        strokeWidth="20"
        filter="url(#journey-glow)"
      />
      <path
        d="M360 780c68-69 132-37 184-103 48-61 106-39 153-97 46-58 105-53 155-111 54-61 108-56 157-115 40-48 103-45 155-91"
        stroke="url(#journey-trail)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="9 10"
      />
      <g fill="#a5eaff" opacity=".65">
        <circle cx="160" cy="285" r="1.5" />
        <circle cx="355" cy="212" r="1" />
        <circle cx="630" cy="302" r="1.5" />
        <circle cx="945" cy="192" r="1" />
        <circle cx="1372" cy="314" r="1.5" />
        <circle cx="1490" cy="180" r="1" />
      </g>
      <g stroke="#09101c" strokeWidth="8" strokeLinecap="round">
        <path d="M134 789v-47m-14 17 14-13 13 13m-13-23-9 9m9-9 10 8" />
        <path d="M1530 801v-58m-17 18 17-17 16 17m-16-30-11 11m11-11 12 10" />
      </g>
    </svg>
  );
}

function JourneyStudent() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 200"
      className="h-36 w-24 drop-shadow-[0_0_24px_rgba(33,207,255,0.18)] sm:h-44 sm:w-28"
      fill="none"
    >
      <ellipse cx="60" cy="193" rx="38" ry="5" fill="#030916" opacity=".72" />
      <path
        d="M34 82c-9 4-14 15-12 28l7 31 14-2-4-32 10-12"
        fill="#6c4a69"
        stroke="#1b2440"
        strokeWidth="4"
      />
      <path
        d="M43 69c-7 5-12 19-13 36l-4 36 25 7 11-43 13 43 23-6-12-52c-3-13-13-22-25-24l-18 3Z"
        fill="#173454"
        stroke="#6b9bc2"
        strokeOpacity=".65"
        strokeWidth="3"
      />
      <path d="m50 101 10 15 13-16-4-11-17 1-2 11Z" fill="#11253d" />
      <path
        d="m51 144-3 34c0 6 6 10 14 10h10l4-45-25 1Z"
        fill="#19233c"
        stroke="#7193b5"
        strokeOpacity=".5"
        strokeWidth="3"
      />
      <path
        d="m75 143 5 35c1 6 7 9 15 8l9-1-8-47-21 5Z"
        fill="#19233c"
        stroke="#7193b5"
        strokeOpacity=".5"
        strokeWidth="3"
      />
      <path
        d="M49 31c0-14 9-23 22-23 14 0 23 10 22 25l-3 20c-2 12-10 20-21 20-12 0-19-9-20-21l0-21Z"
        fill="#b87967"
        stroke="#f0b293"
        strokeOpacity=".55"
        strokeWidth="3"
      />
      <path
        d="M48 33c-3-17 7-30 23-30 14 0 23 8 25 20-10-1-18-8-22-13-5 8-14 13-25 15l-1 8Z"
        fill="#172238"
      />
      <path
        d="m46 83 11 8 5-9m14 1 6 9 12-9"
        stroke="#45b7e9"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="m35 92-8 8m64-9 8 8" stroke="#7ab0d4" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function AboutJourney({ headingLevel = "h2" }: { headingLevel?: "h1" | "h2" }) {
  const [activeMilestone, setActiveMilestone] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  const Heading = headingLevel;

  return (
    <section
      id="about"
      aria-labelledby="about-journey-title"
      className="relative isolate min-h-[calc(100svh-5rem)] overflow-hidden rounded-[2rem] border border-cyan-100/10 bg-[#050a1b] shadow-[0_36px_110px_-52px_rgba(0,217,255,0.3)]"
    >
      <MountainBackdrop />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,27,0.94)_0%,rgba(5,10,27,0.82)_28%,rgba(5,10,27,0.25)_55%,rgba(5,10,27,0.08)_100%)]"
      />
      <div className="relative mx-auto grid min-h-[calc(100svh-5rem)] max-w-[1600px] gap-4 px-5 pb-10 pt-16 sm:px-8 sm:pt-20 lg:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.55fr)] lg:items-stretch lg:px-12 lg:pb-12 lg:pt-24">
        <header className="relative z-10 max-w-xl lg:pt-10">
          <p className="font-display text-xs font-semibold tracking-[0.32em] text-cyan-200 uppercase">
            About us
          </p>
          <Heading
            id="about-journey-title"
            className="mt-4 font-sans text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl xl:text-6xl"
          >
            Why <span className="welcome-gradient">VisionMentor X</span> exists
          </Heading>
          <p className="mt-5 max-w-lg text-sm leading-7 text-slate-300 sm:text-base">
            VisionMentor X combines AI conversation, computer vision, speech analysis and resume
            intelligence into one interview practice platform — so you can see what is improving and
            what still needs work.
          </p>
          <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-slate-950/45 px-3 py-2 text-[10px] font-medium tracking-[0.16em] text-cyan-100/75 uppercase backdrop-blur-md">
            <span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#21cfff]" />
            Explore the journey
          </div>
        </header>

        <div className="relative min-h-[620px] lg:min-h-0">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden size-full overflow-visible md:block"
            viewBox="0 0 900 700"
            preserveAspectRatio="none"
            fill="none"
          >
            <defs>
              <linearGradient
                id="journey-route"
                x1="90"
                y1="610"
                x2="820"
                y2="75"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#168bff" />
                <stop offset=".55" stopColor="#21cfff" />
                <stop offset="1" stopColor="#bd8aff" />
              </linearGradient>
              <filter id="journey-route-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path
              d="M54 610 C130 580 145 526 234 500 S320 445 390 410 S492 355 540 310 S648 245 680 195 S755 125 820 76"
              stroke="#21cfff"
              strokeOpacity=".28"
              strokeWidth="13"
              filter="url(#journey-route-glow)"
            />
            <path
              d="M54 610 C130 580 145 526 234 500 S320 445 390 410 S492 355 540 310 S648 245 680 195 S755 125 820 76"
              stroke="url(#journey-route)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="7 9"
            />
            {!reducedMotion && (
              <motion.circle
                r="5"
                fill="#d9faff"
                filter="url(#journey-route-glow)"
                initial={{ offsetDistance: "0%" }}
                animate={{ offsetDistance: "100%" }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                style={{
                  offsetPath:
                    'path("M54 610 C130 580 145 526 234 500 S320 445 390 410 S492 355 540 310 S648 245 680 195 S755 125 820 76")',
                }}
              />
            )}
          </svg>

          <div className="absolute bottom-1 left-0 z-[1] hidden items-end gap-2 md:flex lg:-left-24">
            <JourneyStudent />
            <div className="mb-12 max-w-36 -rotate-2 rounded-md border border-amber-100/30 bg-[#513827]/90 px-3 py-2 text-center shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
              <p className="text-[10px] font-semibold leading-relaxed tracking-wide text-amber-50">
                Your Journey
                <br />
                Starts Here
              </p>
            </div>
          </div>

          <div className="relative z-10 flex flex-col gap-3 pb-8 md:absolute md:inset-0 md:block md:pb-0">
            {milestones.map((milestone, index) => {
              const Icon = milestone.icon;
              const isActive = activeMilestone === index;

              return (
                <div
                  key={milestone.title}
                  className={`group relative md:absolute md:-translate-x-1/2 md:-translate-y-1/2 ${milestone.position}`}
                  onPointerEnter={(event) => {
                    if (event.pointerType !== "touch") {
                      setActiveMilestone(index);
                    }
                  }}
                  onPointerLeave={() => setActiveMilestone(null)}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setActiveMilestone(null);
                    }
                  }}
                >
                  <motion.button
                    type="button"
                    aria-expanded={isActive}
                    aria-controls={`journey-detail-${index}`}
                    onFocus={() => setActiveMilestone(index)}
                    onClick={() => setActiveMilestone(index)}
                    whileHover={reducedMotion ? undefined : { scale: 1.04 }}
                    whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                    className={`flex w-full items-center gap-3 rounded-2xl border bg-[#07142a]/90 p-3 text-left shadow-[0_14px_36px_rgba(1,7,22,0.42)] backdrop-blur-xl transition-[border-color,box-shadow,background-color] duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200 md:w-[218px] ${
                      isActive
                        ? "border-cyan-200/70 bg-[#07142a]/95 shadow-[0_0_30px_rgba(33,207,255,0.2)]"
                        : "border-cyan-100/20 hover:border-cyan-100/45"
                    }`}
                    style={{ borderColor: isActive ? milestone.color : undefined }}
                  >
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-full border bg-slate-950/80 transition-shadow duration-300"
                      style={{
                        borderColor: `${milestone.color}90`,
                        color: milestone.color,
                        boxShadow: isActive ? `0 0 22px ${milestone.color}55` : undefined,
                      }}
                    >
                      <Icon className="size-5" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-50">
                        {milestone.title}
                      </span>
                      <span className="mt-1 block text-[10px] leading-relaxed text-slate-300/80">
                        {milestone.short}
                      </span>
                    </span>
                    {index === milestones.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-2 right-3 h-5 w-3 border-l-2 border-amber-200"
                      >
                        <span className="absolute -left-px top-0 h-2.5 w-4 bg-amber-300 [clip-path:polygon(0_0,100%_0,72%_100%,0_100%)]" />
                      </span>
                    )}
                  </motion.button>

                  <div
                    id={`journey-detail-${index}`}
                    aria-hidden={!isActive}
                    className={`z-30 mt-2 rounded-xl border bg-[#07142a]/95 p-4 shadow-[0_20px_52px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-[opacity,transform] duration-300 motion-reduce:transition-none md:absolute md:mt-0 md:w-[270px] ${
                      milestone.panel
                    } ${
                      isActive
                        ? "block visible translate-y-0 scale-100 opacity-100 pointer-events-auto md:pointer-events-auto border-cyan-100/30"
                        : "hidden invisible translate-y-2 scale-[.98] opacity-0 pointer-events-none md:block md:visible md:pointer-events-none"
                    }`}
                    style={{
                      borderColor: isActive ? `${milestone.color}65` : undefined,
                      boxShadow: isActive
                        ? `0 18px 50px rgba(0,0,0,.45), 0 0 24px ${milestone.color}18`
                        : undefined,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="size-4" style={{ color: milestone.color }} />
                      <h3 className="text-xs font-semibold text-white">{milestone.title}</h3>
                    </div>
                    <p className="mt-2 text-[11px] font-medium leading-relaxed text-cyan-50/90">
                      {milestone.short}
                    </p>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
                      {milestone.detail}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveMilestone(null)}
                      className="mt-3 rounded-md border border-cyan-100/20 px-2.5 py-1 text-[10px] font-medium text-cyan-100 transition-colors hover:border-cyan-100/50 hover:bg-cyan-100/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                    >
                      Close details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
