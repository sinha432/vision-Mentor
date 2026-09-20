import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  Mic,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { readMicEnabled } from "@/interviewer/lib/media-settings";
import { SiteHeader } from "@/interviewer/components/vmx/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMPANIES, EXPERIENCE_LEVELS, ROLES, getCompany } from "@/interviewer/lib/companies";
import { computeAts } from "@/interviewer/lib/ats";
import {
  analyzeResumeSentences,
  candidateNameMatchesResume,
  type SentenceInsight,
} from "@/interviewer/lib/resume-sentences";
import { AtsMeter } from "@/interviewer/components/vmx/AtsMeter";
import { ResumeSentenceReview } from "@/interviewer/components/vmx/ResumeSentenceReview";
import { CompanyBrief } from "@/interviewer/components/vmx/CompanyBrief";

import {
  analyzeResume,
  analyzeResumeFit,
  analyzeShortlistLikelihood,
  generateResumeCorrections,
  getAiStatus,
} from "@/interviewer/lib/interview.functions";
import { ResumeFitCard } from "@/interviewer/components/vmx/ResumeFitCard";
import { ResumeCorrectionsPanel } from "@/interviewer/components/vmx/ResumeCorrectionsPanel";
import { ShortlistLikelihoodCard } from "@/interviewer/components/vmx/ShortlistLikelihoodCard";
import type {
  InterviewConfig,
  ResumeCorrection,
  ResumeFit,
  ResumeInsights,
  ShortlistLikelihood,
} from "@/interviewer/lib/interview-types";
import { saveDraftConfig } from "@/interviewer/lib/session-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/interviewer/setup")({
  head: () => ({
    meta: [
      { title: "Set up your interview — Vision Mentor X" },
      {
        name: "description",
        content:
          "Upload your resume, choose a company, role and experience level, then grant camera and microphone access to start your AI interview.",
      },
      { property: "og:title", content: "Set up your interview — Vision Mentor X" },
      {
        property: "og:description",
        content: "Resume analysis, company mode, role and device checks before your AI interview.",
      },
    ],
  }),
  component: SetupPage,
});

const MAX_FILE = 8 * 1024 * 1024;

function SetupPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("google");
  const [role, setRole] = useState<string>(ROLES[0]);
  const [experience, setExperience] = useState<string>(EXPERIENCE_LEVELS[1].label);
  const [resumeText, setResumeText] = useState("");
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [undoText, setUndoText] = useState<string | null>(null);

  const [resume, setResume] = useState<ResumeInsights | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [fit, setFit] = useState<ResumeFit | null>(null);
  const [fitLoading, setFitLoading] = useState(false);
  const [corrections, setCorrections] = useState<ResumeCorrection[]>([]);
  const [correctedFullText, setCorrectedFullText] = useState<string | null>(null);
  const [correctionsLoading, setCorrectionsLoading] = useState(false);
  const [reanalyzingCorrection, setReanalyzingCorrection] = useState(false);
  const [likelihood, setLikelihood] = useState<ShortlistLikelihood | null>(null);
  const [likelihoodLoading, setLikelihoodLoading] = useState(false);
  const [camOk, setCamOk] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [checking, setChecking] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const [aiReady, setAiReady] = useState(true);

  // Surfaces a friendly notice instead of a raw server error when GROQ_API_KEY is absent.
  useEffect(() => {
    let active = true;
    getAiStatus()
      .then((status) => {
        if (active) setAiReady(status.configured);
      })
      .catch(() => {
        if (active) setAiReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedCompany = useMemo(() => getCompany(companyId), [companyId]);
  const deferredResumeText = useDeferredValue(resumeText);
  // Deterministic, instant ATS scoring — recomputes as the resume text is edited.
  const ats = useMemo(
    () => computeAts(resumeText, selectedCompany, role, experience),
    [resumeText, selectedCompany, role, experience],
  );
  // Sentence-level validation + per-line rewrite suggestions for this company.
  const sentenceAnalysis = useMemo(
    () => analyzeResumeSentences(resumeText, selectedCompany, role),
    [resumeText, selectedCompany, role],
  );

  async function reanalyzeCorrectedResume(nextText: string) {
    setReanalyzingCorrection(true);
    setResume(null);
    setFit(null);
    try {
      const insights = (await analyzeResume({ data: { text: nextText } })) as ResumeInsights;
      setResumeText(insights.resumeText ?? nextText);
      setResume(insights);
      toast.success("Corrected resume analysed again");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not re-analyse the corrected resume");
    } finally {
      setReanalyzingCorrection(false);
    }
  }

  async function applyRewrite(insight: SentenceInsight) {
    if (!insight.rewrite) return;
    if (!resumeText.includes(insight.text)) {
      toast.error("That line changed — re-check the resume text.");
      return;
    }
    const nextText = resumeText.replace(insight.text, insight.rewrite);
    setUndoText(resumeText);
    setResumeText(nextText);
    await reanalyzeCorrectedResume(nextText);
    toast.success("Line rewritten — ATS score updated");
  }

  function undoRewrite() {
    if (undoText === null) return;
    setResumeText(undoText);
    setUndoText(null);
  }

  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  // Fit is company-specific: debounce expensive AI analysis so it only runs after typing settles.
  useEffect(() => {
    if (!resume) {
      setFit(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setFitLoading(true);
      analyzeResumeFit({ data: { resume, companyId, role, experience } })
        .then((result) => {
          if (!cancelled) setFit(result as ResumeFit);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setFit(null);
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not check your resume against this company",
          );
        })
        .finally(() => {
          if (!cancelled) setFitLoading(false);
        });
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [resume, companyId, role, experience]);

  // Shortlist likelihood: delay AI work until the user pauses typing, and skip tiny resumes.
  useEffect(() => {
    if (deferredResumeText.trim().length < 60) {
      setLikelihood(null);
      setLikelihoodLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLikelihoodLoading(true);
      analyzeShortlistLikelihood({
        data: { resumeText: deferredResumeText, companyId, role, experience },
      })
        .then((result) => {
          if (!cancelled) setLikelihood(result as ShortlistLikelihood);
        })
        .catch(() => {
          if (!cancelled) setLikelihood(null);
        })
        .finally(() => {
          if (!cancelled) setLikelihoodLoading(false);
        });
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [deferredResumeText, companyId, role, experience]);

  async function generateCorrections() {
    setCorrectionsLoading(true);
    try {
      const result = (await generateResumeCorrections({
        data: { resumeText, companyId, role },
      })) as { fullText: string; corrections: ResumeCorrection[] };
      setCorrections(result.corrections ?? []);
      setCorrectedFullText(result.fullText ?? null);
      if ((result.corrections ?? []).length === 0) {
        toast.info(
          "No further line changes found — the rewrite above still targets a 100/100 ATS score.",
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate corrections");
    } finally {
      setCorrectionsLoading(false);
    }
  }

  async function applyAllCorrections(accepted: ResumeCorrection[]) {
    if (accepted.length === 0) return;
    setUndoText(resumeText);
    let next = resumeText;
    for (const c of accepted) {
      if (next.includes(c.original)) next = next.replace(c.original, c.corrected);
    }
    setResumeText(next);
    setCorrections([]);
    setCorrectedFullText(null);
    await reanalyzeCorrectedResume(next);
    toast.success(`Applied ${accepted.length} correction(s) — resume re-analysed.`);
  }

  async function applyFullRewrite(fullText: string) {
    setUndoText(resumeText);
    setResumeText(fullText);
    setCorrections([]);
    setCorrectedFullText(null);
    await reanalyzeCorrectedResume(fullText);
    toast.success("Applied the full ATS-optimised rewrite — resume re-analysed.");
  }

  async function requestDevices() {
    setChecking(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, min: 15 },
        },
        audio: readMicEnabled(),
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCamOk(stream.getVideoTracks().length > 0);
      setMicOk(stream.getAudioTracks().length > 0);
      toast.success("Camera and microphone ready");
    } catch {
      toast.error("Permission denied. You can still interview by typing your answers.");
      setCamOk(false);
      setMicOk(false);
    } finally {
      setChecking(false);
    }
  }

  async function handleFile(file: File) {
    if (file.size > MAX_FILE) {
      toast.error("Please upload a resume under 8 MB.");
      return;
    }
    // Only real resume documents — reject images, sheets, archives, code files.
    if (!/\.(pdf|docx?|txt|md|rtf)$/i.test(file.name)) {
      const message = "Please upload your resume as a PDF, DOCX or TXT file.";
      setResumeError(message);
      toast.error(message);
      return;
    }
    setResumeError(null);
    setAnalyzing(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      const insights = (await analyzeResume({
        data: { fileName: file.name, mimeType: file.type, dataUrl },
      })) as ResumeInsights;
      setResumeText(insights.resumeText ?? "");
      setResume(insights);
      toast.success("Resume analysed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resume analysis failed";
      setResume(null);
      setResumeError(message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function analyzePasted() {
    if (resumeText.trim().length < 60) {
      toast.error("Paste a bit more of your resume first.");
      return;
    }
    setAnalyzing(true);
    try {
      setResumeError(null);
      const insights = (await analyzeResume({ data: { text: resumeText } })) as ResumeInsights;
      setResumeText(insights.resumeText ?? resumeText);
      setResume(insights);
      toast.success("Resume analysed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resume analysis failed";
      setResume(null);
      setResumeError(message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  }

  function start() {
    if (!name.trim()) {
      setStartError("Enter your name before entering the interview room.");
      return;
    }
    if (!resume) {
      setStartError("Analyse your resume before entering the interview room.");
      return;
    }
    if (!resume.name || !candidateNameMatchesResume(name, resume.name)) {
      setStartError(
        resume.name
          ? `The name does not match the uploaded resume name (${resume.name}). Enter the name exactly as it appears on your resume.`
          : "We could not verify a candidate name in the resume. Upload a resume with your name clearly shown.",
      );
      return;
    }
    setStartError(null);
    const config: InterviewConfig = {
      companyId,
      role,
      experience,
      candidateName: name.trim(),
      resume,
      resumeFit: fit,
    };
    saveDraftConfig(config);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    navigate({ to: "/interviewer/interview" });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Interview setup</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Four quick steps. Everything you provide shapes the questions the interviewer asks you.
        </p>

        {!aiReady && (
          <div className="mt-6 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
            <p className="font-medium text-warning">AI is not configured yet</p>
            <p className="mt-1 text-muted-foreground">
              Add <code className="font-mono">GROQ_API_KEY</code> to your{" "}
              <code className="font-mono">.env</code> file and restart the dev server. Resume ATS
              scoring works without it; live interviews and reports need it.
            </p>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            {/* Step 1 — candidate */}
            <section className="rounded-2xl glass p-6">
              <StepTitle n={1} icon={UserRound} title="Candidate profile" />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Your name</Label>
                  <Input
                    id="name"
                    value={name}
                    maxLength={60}
                    placeholder="e.g. Aditi Sharma"
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Experience level</Label>
                  <Select value={experience} onValueChange={setExperience}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPERIENCE_LEVELS.map((l) => (
                        <SelectItem key={l.id} value={l.label}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Target role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Step 2 — resume */}
            <section className="rounded-2xl glass p-6">
              <StepTitle n={2} icon={FileText} title="Resume analysis" optional />
              <div className="mt-5 space-y-4">
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-4 transition-colors hover:bg-secondary/50">
                  <span className="flex items-center gap-3 text-sm">
                    <Upload className="h-4 w-4 text-primary" />
                    Upload PDF, DOCX or TXT resume
                  </span>
                  <span className="text-xs text-muted-foreground">max 8 MB</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.md"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFile(file);
                    }}
                  />
                </label>
                <div className="space-y-2">
                  <Label htmlFor="resume-text">…or paste your resume text</Label>
                  <Textarea
                    id="resume-text"
                    rows={5}
                    maxLength={20000}
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    placeholder="Skills, projects, experience, education…"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={analyzePasted}
                    disabled={analyzing}
                  >
                    {analyzing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                    Analyse resume
                  </Button>
                </div>

                {resumeError && (
                  <p className="animate-rise rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {resumeError}
                  </p>
                )}

                {resume && (
                  <div className="animate-rise rounded-xl border border-primary/25 bg-primary/5 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        {resume.name || "Resume"} · {resume.headline || "parsed"}
                      </span>
                      <span className="text-xs text-primary">ATS {resume.atsScore}/100</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {resume.skills.slice(0, 12).map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-secondary/70 px-2 py-0.5 text-[11px]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    {resume.projects.length > 0 && (
                      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                        {resume.projects.slice(0, 4).map((p) => (
                          <li key={p.title}>
                            <span className="text-foreground">{p.title}</span> — {p.summary}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {resumeText.trim().length >= 60 && (
                  <>
                    <AtsMeter ats={ats} companyName={selectedCompany.name} />
                    <ResumeSentenceReview
                      analysis={sentenceAnalysis}
                      companyName={selectedCompany.name}
                      onApply={applyRewrite}
                      onUndo={undoRewrite}
                      canUndo={undoText !== null}
                    />
                    <ResumeCorrectionsPanel
                      loading={correctionsLoading || reanalyzingCorrection}
                      originalText={resumeText}
                      fullText={correctedFullText}
                      corrections={corrections}
                      onGenerate={generateCorrections}
                      onApplyAll={applyAllCorrections}
                      onApplyFullRewrite={applyFullRewrite}
                    />
                    <ShortlistLikelihoodCard
                      likelihood={likelihood}
                      loading={likelihoodLoading}
                      companyName={selectedCompany.name}
                    />
                  </>
                )}

                {(resume || fitLoading) && (
                  <ResumeFitCard
                    fit={fit}
                    companyName={selectedCompany.name}
                    loading={fitLoading}
                  />
                )}
              </div>
            </section>

            {/* Step 3 — company */}
            <section className="rounded-2xl glass p-6">
              <StepTitle n={3} icon={ArrowRight} title="Company interview mode" />
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {COMPANIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCompanyId(c.id)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all",
                      companyId === c.id
                        ? "border-primary/60 bg-primary/10 panel-glow"
                        : "border-border bg-secondary/25 hover:bg-secondary/45",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-semibold">{c.name}</span>
                      {companyId === c.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{c.tagline}</p>
                  </button>
                ))}
              </div>
              <CompanyBrief company={selectedCompany} role={role} />
            </section>
          </div>

          {/* Step 4 — devices */}
          <aside className="space-y-6">
            <section className="rounded-2xl glass p-6">
              <StepTitle n={4} icon={Camera} title="Camera & microphone" />
              <div className="mt-5 overflow-hidden rounded-xl border border-border bg-background/60">
                <video
                  ref={videoRef}
                  muted
                  playsInline
            className="aspect-video w-full object-cover"
                />
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <DeviceRow icon={Camera} label="Camera" ok={camOk} />
                <DeviceRow icon={Mic} label="Microphone" ok={micOk} />
              </div>
              <Button
                variant="secondary"
                className="mt-4 w-full"
                onClick={requestDevices}
                disabled={checking}
              >
                {checking ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                {camOk || micOk ? "Re-check devices" : "Allow camera & microphone"}
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                Camera powers presence analytics. We prefer the Mac front-facing camera so your
                face, posture and gestures stay visible. Without it you can still speak or type
                your answers.
              </p>
            </section>

            <section className="rounded-2xl glass p-6">
              <h3 className="font-display text-base font-semibold">You are about to interview</h3>
              <dl className="mt-4 space-y-2 text-sm">
                <SummaryRow
                  k="Company"
                  v={COMPANIES.find((c) => c.id === companyId)?.name ?? "—"}
                />
                <SummaryRow k="Role" v={role} />
                <SummaryRow k="Experience" v={experience} />
                <SummaryRow k="Resume" v={resume ? "Analysed" : "Not provided"} />
                <SummaryRow
                  k="Company fit"
                  v={fit ? `${fit.verdict} · ${fit.score}/100` : fitLoading ? "checking…" : "—"}
                />
              </dl>
              {startError && (
                <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {startError}
                </p>
              )}
              <Button className="mt-6 w-full" size="lg" onClick={start}>
                Enter interview room <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function StepTitle({
  n,
  icon: Icon,
  title,
  optional,
}: {
  n: number;
  icon: React.ElementType;
  title: string;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-sm font-semibold text-primary">
        {n}
      </span>
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h2>
      {optional && <span className="text-xs text-muted-foreground">optional</span>}
    </div>
  );
}

function DeviceRow({
  icon: Icon,
  label,
  ok,
}: {
  icon: React.ElementType;
  label: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </span>
      <span className={cn("text-xs font-medium", ok ? "text-success" : "text-muted-foreground")}>
        {ok ? "Ready" : "Not granted"}
      </span>
    </div>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
