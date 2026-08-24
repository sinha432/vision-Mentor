import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { Loader2, Send, Sparkles, LogIn, Building2, Camera, CameraOff, Mic, Play, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { useDemoAuth } from "@/contexts/DemoAuthContext";
import { getAssessmentByCode, submitAttempt } from "@/lib/assessments.functions";
import { runJavaCode } from "@/lib/code-runner.functions";
import { VisionDetector } from "@/lib/vision-detector";
import { useVisionStatus, type Level } from "@/lib/vision-status";
import Editor from "@monaco-editor/react";

export const Route = createFileRoute("/a/$code")({
  ssr: false,
  component: PublicAssessmentPage,
});

type Assessment = Awaited<ReturnType<typeof getAssessmentByCode>>;
type Answers = Record<string, {
  type: "text" | "mcq" | "code";
  textAnswer?: string;
  choiceId?: string;
  code?: string;
  runResults?: { passed: number; total: number; cases: { ok: boolean; actual: string; stderr?: string }[] } | null;
}>;

function PublicAssessmentPage() {
  const { code } = Route.useParams();
  const { user, ready } = useDemoAuth();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | undefined | null>(undefined);
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAssessmentByCode({ data: { code } })
      .then((a) => setAssessment(a))
      .catch(() => setAssessment(null));
  }, [code]);

  if (assessment === undefined || !ready) {
    return <Frame><div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div></Frame>;
  }
  if (assessment === null) {
    return <Frame><div className="text-center text-sm text-muted-foreground py-8">Assessment not found for code <span className="font-mono">{code}</span>.</div></Frame>;
  }

  if (!user) {
    return (
      <Frame>
        <div className="text-center space-y-4">
          <div className="font-display text-xl text-gradient">{assessment.title}</div>
          <p className="text-xs text-muted-foreground">
            {assessment.questions.length} question{assessment.questions.length === 1 ? "" : "s"} · sign in as an Individual to answer.
          </p>
          <Link to="/auth" search={{ redirect: `/a/${code}` }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white glow-primary" style={{ background: "var(--gradient-aurora)" }}>
            <LogIn className="w-4 h-4" /> Sign in / Sign up
          </Link>
        </div>
      </Frame>
    );
  }

  if (user.role === "company") {
    const own = user.id === assessment.companyUserId;
    return (
      <Frame>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="w-4 h-4" /> {own ? "Preview of your assessment" : "Company account — read-only preview."}
          </div>
          <div className="font-display text-xl text-gradient">{assessment.title}</div>
          <ol className="space-y-3 list-decimal list-inside">
            {assessment.questions.map((q) => (
              <li key={q.id} className="glass rounded-xl p-3 text-sm">
                <span className="text-[10px] mr-2 px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">{q.type}</span>
                {q.text}
              </li>
            ))}
          </ol>
        </div>
      </Frame>
    );
  }

  if (assessment.status === "closed") {
    return (
      <Frame>
        <div className="text-center space-y-2 py-4">
          <div className="font-display text-lg text-gradient">{assessment.title}</div>
          <p className="text-sm text-muted-foreground">
            This assessment is closed and no longer accepting submissions.
          </p>
        </div>
      </Frame>
    );
  }

  const onSubmit = async (e: FormEvent, vision: { avgEye: number; avgPosture: number; avgVoice: number | null; samples: number } | null) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await submitAttempt({ data: { code, individualUserId: user.id, answers, vision } });
      toast.success("Submitted");
      navigate({ to: "/report/$id", params: { id: res.reportId } });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not submit");
    } finally { setBusy(false); }
  };

  return (
    <Frame>
      <SessionRunner
        assessment={assessment}
        answers={answers}
        setAnswers={setAnswers}
        busy={busy}
        onSubmit={onSubmit}
      />
    </Frame>
  );
}

function levelToScore(l: Level): number {
  if (l === "good") return 1;
  if (l === "warn") return 0.5;
  return 0;
}

function SessionRunner({
  assessment, answers, setAnswers, busy, onSubmit,
}: {
  assessment: NonNullable<Assessment>;
  answers: Answers;
  setAnswers: (a: Answers | ((prev: Answers) => Answers)) => void;
  busy: boolean;
  onSubmit: (e: FormEvent, vision: { avgEye: number; avgPosture: number; avgVoice: number | null; samples: number } | null) => void;
}) {
  const [phase, setPhase] = useState<"intro" | "requesting" | "active">("intro");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<VisionDetector | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const voiceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [camState, setCamState] = useState<"idle" | "on" | "denied">("idle");
  const [micState, setMicState] = useState<"idle" | "on" | "denied">("idle");
  const [camError, setCamError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [voiceLevel, setVoiceLevel] = useState(0); // 0-1, rolling instantaneous level
  const status = useVisionStatus();
  const rollRef = useRef({ eyeSum: 0, postSum: 0, voiceSum: 0, voiceSamples: 0, samples: 0 });

  const startSession = async () => {
    if (phase !== "active") setPhase("requesting");
    setCamError(null);
    setMicError(null);

    // Request camera + mic together in one prompt where possible, so the
    // user sees one combined permission dialog rather than two. Falls back
    // to requesting each independently if the combined request fails, so a
    // partial grant (e.g. camera only) still works.
    let stream: MediaStream | null = null;
    let lastCamErr: any = null;
    let lastMicErr: any = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      lastCamErr = err;
      lastMicErr = err;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        lastCamErr = null;
      } catch (videoErr) {
        lastCamErr = videoErr;
      }
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        if (stream) audioStream.getAudioTracks().forEach((t) => stream!.addTrack(t));
        else stream = audioStream;
        lastMicErr = null;
      } catch (audioErr) {
        lastMicErr = audioErr;
      }
    }

    streamRef.current = stream;
    const hasVideo = !!stream?.getVideoTracks().length;
    const hasAudio = !!stream?.getAudioTracks().length;

    if (hasVideo && videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
      try {
        const det = new VisionDetector();
        detectorRef.current = det;
        await det.start(videoRef.current);
        setCamState("on");
      } catch (detErr: any) {
        // Camera stream opened fine, but the vision model itself failed to
        // start (e.g. model files didn't load) — surface that distinctly
        // rather than silently leaving state stuck.
        console.error("Vision detector failed to start:", detErr);
        setCamError(`Vision model failed to start: ${detErr?.message ?? String(detErr)}`);
        setCamState("denied");
      }
    } else {
      console.error("Camera access failed:", lastCamErr);
      setCamError(lastCamErr ? `${lastCamErr.name ?? "Error"}: ${lastCamErr.message ?? String(lastCamErr)}` : "No camera stream returned");
      setCamState("denied");
    }

    if (hasAudio) {
      try {
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(new MediaStream(stream!.getAudioTracks()));
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        audioCtxRef.current = ctx;
        setMicState("on");

        const buffer = new Uint8Array(analyser.frequencyBinCount);
        voiceIntervalRef.current = setInterval(() => {
          analyser.getByteTimeDomainData(buffer);
          let sumSquares = 0;
          for (let i = 0; i < buffer.length; i++) {
            const centered = (buffer[i] - 128) / 128;
            sumSquares += centered * centered;
          }
          const rms = Math.sqrt(sumSquares / buffer.length); // ~0-1
          const level = Math.min(1, rms * 4); // scale up since normal speech RMS is small
          setVoiceLevel(level);
          rollRef.current.voiceSum += level;
          rollRef.current.voiceSamples += 1;
        }, 300);
      } catch (audioCtxErr: any) {
        console.error("Mic analyser failed to start:", audioCtxErr);
        setMicError(`${audioCtxErr?.name ?? "Error"}: ${audioCtxErr?.message ?? String(audioCtxErr)}`);
        setMicState("denied");
      }
    } else {
      console.error("Microphone access failed:", lastMicErr);
      setMicError(lastMicErr ? `${lastMicErr.name ?? "Error"}: ${lastMicErr.message ?? String(lastMicErr)}` : "No mic stream returned");
      setMicState("denied");
    }

    setPhase("active");
  };

  useEffect(() => {
    return () => {
      detectorRef.current?.stop();
      if (voiceIntervalRef.current) clearInterval(voiceIntervalRef.current);
      audioCtxRef.current?.close().catch(() => {});
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Sample vision status every ~300ms as it changes.
  useEffect(() => {
    if (camState !== "on") return;
    if (status.eye.level === "idle" && status.posture.level === "idle") return;
    rollRef.current.eyeSum += levelToScore(status.eye.level);
    rollRef.current.postSum += levelToScore(status.posture.level);
    rollRef.current.samples += 1;
  }, [status, camState]);

  const setAns = (qid: string, patch: Answers[string]) =>
    setAnswers((a) => ({ ...a, [qid]: { ...(a[qid] ?? { type: patch.type }), ...patch } }));

  const runCode = async (qid: string, source: string, cases: { input: string; expectedStdout: string }[]) => {
    setAns(qid, { type: "code", code: source, runResults: null });
    toast.loading("Running Java…", { id: `run-${qid}` });
    try {
      const res = await runJavaCode({ data: { sourceCode: source, cases } });
      if (!res.configured) {
        toast.error("Java runner not configured (JUDGE0_RAPIDAPI_KEY missing).", { id: `run-${qid}` });
        setAns(qid, { type: "code", code: source, runResults: { passed: 0, total: cases.length, cases: [] } });
        return;
      }
      setAns(qid, { type: "code", code: source, runResults: { passed: res.passed, total: res.total, cases: res.cases } });
      toast.success(`Passed ${res.passed}/${res.total}`, { id: `run-${qid}` });
    } catch (e: any) {
      toast.error(e?.message ?? "Run failed", { id: `run-${qid}` });
    }
  };

  const submit = (e: FormEvent) => {
    const hasAnySample = rollRef.current.samples > 0 || rollRef.current.voiceSamples > 0;
    const v = hasAnySample
      ? {
          avgEye: rollRef.current.samples > 0 ? rollRef.current.eyeSum / rollRef.current.samples : 0,
          avgPosture: rollRef.current.samples > 0 ? rollRef.current.postSum / rollRef.current.samples : 0,
          avgVoice: rollRef.current.voiceSamples > 0 ? rollRef.current.voiceSum / rollRef.current.voiceSamples : null,
          samples: Math.max(rollRef.current.samples, rollRef.current.voiceSamples),
        }
      : null;
    onSubmit(e, v);
  };

  if (phase === "intro" || phase === "requesting") {
    return (
      <div className="space-y-4 text-center">
        <div className="font-display text-xl text-gradient">{assessment.title}</div>
        <p className="text-xs text-muted-foreground">
          {assessment.questions.length} question{assessment.questions.length === 1 ? "" : "s"}
        </p>
        <div className="glass rounded-xl p-4 text-left text-xs text-muted-foreground space-y-2">
          <div className="flex items-center gap-2 text-foreground font-display text-sm">
            <Camera className="w-4 h-4 text-cyber" /> Camera & microphone access
          </div>
          <p>
            This assessment uses your camera and microphone for session integrity — eye contact, posture,
            and voice activity. No video or audio is recorded or stored; only aggregate scores are saved
            with your submission, and they're shown to you and the company on the same report.
          </p>
          <p>You'll be asked to allow access when you click the button below. You can still take the test if you decline — those metrics just won't be included.</p>
        </div>
        <Button
          onClick={startSession}
          disabled={phase === "requesting"}
          className="w-full glow-primary"
          style={{ background: "var(--gradient-aurora)" }}
        >
          {phase === "requesting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4 mr-2" /> Take the Test</>}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <div className="font-display text-xl text-gradient">{assessment.title}</div>
        <p className="text-[11px] text-muted-foreground mt-1">Camera/mic are on for session integrity. Nothing is recorded — only eye/posture/voice averages.</p>
      </div>

      <div className="glass rounded-xl p-3 flex items-center gap-3">
        <video ref={videoRef} muted playsInline className="w-28 h-20 rounded-lg object-cover bg-black/40" />
        <div className="text-[11px] flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            {camState === "on" ? <Camera className="w-3.5 h-3.5 text-cyber" /> : <CameraOff className="w-3.5 h-3.5 text-destructive" />}
            <span className="uppercase tracking-widest text-muted-foreground text-[10px]">
              {camState === "on" ? "Session integrity active" : "Camera denied — will submit without vision"}
            </span>
          </div>
          {camError && camState !== "on" && (
            <div className="text-[10px] text-destructive/80">{camError}</div>
          )}
          {micError && micState !== "on" && (
            <div className="text-[10px] text-destructive/80">{micError}</div>
          )}
          {(camState === "denied" || micState === "denied") && (
            <button
              type="button"
              onClick={startSession}
              className="text-[10px] text-primary hover:underline"
            >
              Retry camera/mic access
            </button>
          )}
          <div>Eye: <span style={{ color: `var(--${status.eye.level === "good" ? "cyber" : status.eye.level === "warn" ? "primary" : "destructive"})` }}>{status.eye.text}</span></div>
          <div>Posture: <span style={{ color: `var(--${status.posture.level === "good" ? "cyber" : status.posture.level === "warn" ? "primary" : "destructive"})` }}>{status.posture.text}</span></div>
          <div className="flex items-center gap-2">
            <Mic className={`w-3.5 h-3.5 ${micState === "on" ? "text-cyber" : "text-destructive"}`} />
            <span>{micState === "on" ? `Voice: ${voiceLevel > 0.15 ? "Speaking" : "Quiet"}` : "Mic denied — no voice data"}</span>
          </div>
        </div>
      </div>

      {assessment.questions.map((q, i) => (
        <div key={q.id} className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Q{i + 1}</div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">{q.type}</span>
            <span className="text-[10px] text-muted-foreground">weight {q.weight ?? 1}</span>
          </div>
          <div className="text-sm whitespace-pre-wrap">{q.text}</div>

          {(q.type ?? "text") === "text" && (
            <textarea
              value={answers[q.id]?.textAnswer ?? ""}
              onChange={(e) => setAns(q.id, { type: "text", textAnswer: e.target.value })}
              placeholder="Type your answer…"
              className="w-full glass rounded-lg p-3 bg-transparent outline-none text-sm resize-y min-h-[96px]"
            />
          )}

          {q.type === "mcq" && (
            <div className="space-y-1">
              {(q.choices ?? []).map((c) => (
                <label key={c.id} className="flex items-center gap-2 glass rounded-md px-3 py-2 text-sm cursor-pointer">
                  <input
                    type="radio" name={`q-${q.id}`}
                    checked={answers[q.id]?.choiceId === c.id}
                    onChange={() => setAns(q.id, { type: "mcq", choiceId: c.id })}
                    className="accent-primary"
                  />
                  <span>{c.text}</span>
                </label>
              ))}
            </div>
          )}

          {q.type === "code" && (
            <CodeQuestion
              value={answers[q.id]?.code ?? q.starterCode ?? ""}
              onChange={(v) => setAns(q.id, { type: "code", code: v })}
              onRun={(src) => runCode(q.id, src, q.testCases ?? [])}
              run={answers[q.id]?.runResults ?? null}
              caseCount={(q.testCases ?? []).length}
            />
          )}
        </div>
      ))}

      <Button type="submit" disabled={busy} className="w-full glow-primary" style={{ background: "var(--gradient-aurora)" }}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Submit</>}
      </Button>
    </form>
  );
}

function CodeQuestion({ value, onChange, onRun, run, caseCount }: {
  value: string;
  onChange: (v: string) => void;
  onRun: (src: string) => void;
  run: { passed: number; total: number; cases: { ok: boolean; actual: string; stderr?: string }[] } | null;
  caseCount: number;
}) {
  return (
    <div className="space-y-2">
      <div className="rounded-lg overflow-hidden border border-border/50" style={{ height: 280 }}>
        <ClientOnly fallback={<div className="p-3 text-xs text-muted-foreground">Loading editor…</div>}>
          <Editor
            height="280px"
            defaultLanguage="java"
            theme="vs-dark"
            value={value}
            onChange={(v) => onChange(v ?? "")}
            options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false }}
          />
        </ClientOnly>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onRun(value)} className="glass px-3 py-1.5 rounded-md text-xs inline-flex items-center gap-1 hover:glow-cyber">
          <Play className="w-3.5 h-3.5" /> Run ({caseCount} case{caseCount === 1 ? "" : "s"})
        </button>
        {run && <span className="text-xs text-muted-foreground">Passed {run.passed}/{run.total}</span>}
      </div>
      {run && run.cases.length > 0 && (
        <div className="space-y-1">
          {run.cases.map((c, ci) => (
            <div key={ci} className="glass rounded-md px-3 py-1.5 text-[11px] flex items-start gap-2">
              {c.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-cyber shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <div>Test {ci + 1}: {c.ok ? "Pass" : "Fail"}</div>
                {!c.ok && <div className="font-mono text-muted-foreground truncate">got: {c.actual || "(empty)"}{c.stderr ? ` · ${c.stderr.split("\n")[0]}` : ""}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen px-4 py-8 text-foreground">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at top, var(--gradient-glow), transparent 70%)" }} />
        <div className="absolute inset-0 grid-bg opacity-40" />
      </div>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-4 justify-center">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center glow-primary" style={{ background: "var(--gradient-aurora)" }}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-sm text-gradient">VISION MENTOR X</span>
        </div>
        <div className="glass-strong rounded-2xl p-6">{children}</div>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
