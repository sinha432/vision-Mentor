import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Brain,
  Code2,
  Eye,
  FileText,
  Gauge,
  Mic,
  Sparkles,
  Building2,
  LineChart,
} from "lucide-react";
import { AIInterviewer } from "@/interviewer/components/interview/AIInterviewer";
import { SiteHeader } from "@/interviewer/components/vmx/SiteHeader";
import { Button } from "@/components/ui/button";
import { COMPANIES } from "@/interviewer/lib/companies";

export const Route = createFileRoute("/interviewer/")({
  head: () => ({
    meta: [
      { title: "Vision Mentor X — Real AI Interviewer for Interview Prep" },
      {
        name: "description",
        content:
          "Face a realistic AI recruiter that speaks, listens, adapts its questions and scores your technical, coding, communication and confidence performance.",
      },
      { property: "og:title", content: "Vision Mentor X — Real AI Interviewer for Interview Prep" },
      {
        property: "og:description",
        content:
          "Face a realistic AI recruiter that speaks, listens, adapts its questions and scores your technical, coding, communication and confidence performance.",
      },
    ],
  }),
  component: Landing,
});

const CAPABILITIES = [
  {
    icon: Brain,
    title: "Adaptive AI brain",
    body: "Every interview is generated live. Strong answers raise the difficulty, weak answers earn hints, follow-ups and topic switches.",
  },
  {
    icon: Mic,
    title: "Natural voice interview",
    body: "The interviewer speaks with emotion-aware speech and transcribes your spoken answers with speech-to-text.",
  },
  {
    icon: FileText,
    title: "Resume interrogation",
    body: "Upload your resume and get grilled on your own projects — why that algorithm, which dataset, what accuracy.",
  },
  {
    icon: Code2,
    title: "Live coding round",
    body: "Java, Python, JavaScript and SQL in an in-browser editor, reviewed for correctness, complexity and clarity.",
  },
  {
    icon: Eye,
    title: "Presence analysis",
    body: "Camera-based framing, attention and posture signals plus speaking pace, pauses and filler-word tracking.",
  },
  {
    icon: Gauge,
    title: "Hiring-probability report",
    body: "Scores for technical, coding, communication and confidence, plus skill gaps and recommended practice.",
  },
];

const FLOW = [
  "Resume upload",
  "Company & role",
  "Camera + mic",
  "Live AI interview",
  "Coding round",
  "Performance report",
];

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteHeader
        right={
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              onClick={() => window.sessionStorage.setItem("vmx_auth_redirect", "1")}
            >
              <Link to="/">Back to Nova</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/interviewer/setup">Start interview</Link>
            </Button>
          </div>
        }
      />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 grid-lines opacity-30" />
          <div className="absolute left-1/2 top-[-10rem] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-primary/12 blur-[100px]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
            <div className="animate-rise">
              <span className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Real AI interviewer · not a chatbot
              </span>
              <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-6xl">
                Sit across from an AI recruiter that
                <span className="text-signal"> actually interviews you</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Vision Mentor X simulates a real company interview end to end — greeting, resume
                deep-dive, technical questioning, a coding round, behavioural and HR rounds — then
                hands you a recruiter-grade performance report.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link to="/interviewer/setup">
                    Start a mock interview <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/interviewer/dashboard">View dashboard</Link>
                </Button>
              </div>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
                {[
                  { k: "13", v: "Company modes" },
                  { k: "7", v: "Interview rounds" },
                  { k: "18+", v: "Scored signals" },
                ].map((s) => (
                  <div key={s.v} className="rounded-xl glass px-4 py-3">
                    <dt className="font-display text-2xl font-semibold text-primary">{s.k}</dt>
                    <dd className="mt-0.5 text-xs text-muted-foreground">{s.v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="animate-fade-in">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-border glass panel-glow sm:aspect-square lg:aspect-[4/5]">
                <AIInterviewer mouth={0} speaking={false} listening mood="smile" />
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Waist-up interviewer with blinking, head movement, lip sync and gestures
              </p>
            </div>
          </div>
        </section>

        {/* Flow */}
        <section className="border-y border-border/70 bg-card/30">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
            <ol className="flex flex-wrap items-center gap-x-3 gap-y-3 text-sm">
              {FLOW.map((step, i) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="flex items-center gap-2 rounded-full bg-secondary/60 px-3 py-1.5">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/20 text-[11px] font-semibold text-primary">
                      {i + 1}
                    </span>
                    {step}
                  </span>
                  {i < FLOW.length - 1 && (
                    <ArrowRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Capabilities */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">
            One platform, the whole interview stack
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Conversation intelligence, resume analysis, coding assessment and presence analytics
            working together in a single session.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((c) => (
              <article
                key={c.title}
                className="group rounded-2xl glass p-6 transition-transform duration-300 hover:-translate-y-1"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12">
                  <c.icon className="h-5 w-5 text-primary" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Companies */}
        <section className="border-t border-border/70 bg-card/30">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="flex items-end justify-between gap-6">
              <div>
                <h2 className="font-display text-3xl font-semibold">Company interview modes</h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  Each mode changes the question mix, difficulty curve, behavioural lens and the way
                  the interviewer talks to you.
                </p>
              </div>
              <Building2 className="hidden h-8 w-8 text-muted-foreground md:block" />
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {COMPANIES.map((c) => (
                <div key={c.id} className="rounded-xl glass p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-semibold">{c.name}</span>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      L{c.difficulty}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{c.tagline}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.focus.slice(0, 3).map((f) => (
                      <span
                        key={f}
                        className="rounded-full bg-secondary/70 px-2 py-0.5 text-[10px] text-secondary-foreground"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="relative overflow-hidden rounded-3xl glass p-8 text-center sm:p-14">
            <div className="absolute inset-0 office-bg opacity-70" />
            <div className="relative">
              <LineChart className="mx-auto h-8 w-8 text-primary" />
              <h2 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">
                Find out if you would get the offer
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                Run a full interview now and get your hiring probability, weak topics and a practice
                plan in minutes.
              </p>
              <Button asChild size="lg" className="mt-8">
                <Link to="/interviewer/setup">
                  Begin interview <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <span>Vision Mentor X — AI interview preparation platform</span>
          <span>
            Presence and voice signals are heuristic estimates, not clinical measurements.
          </span>
        </div>
      </footer>
    </div>
  );
}
