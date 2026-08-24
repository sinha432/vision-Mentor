import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Volume2,
  VolumeX,
  Eye,
  Activity,
  Keyboard,
} from "lucide-react";
import { toast } from "sonner";
import { AIInterviewer } from "@/interviewer/components/interview/AIInterviewer";
import { VoicePicker } from "@/interviewer/components/vmx/VoicePicker";
import {
  analyzeProctoringFrame,
  analyzeProctoringAudio,
  type ProctoringVisionResult,
  type ProctoringAudioResult,
} from "@/interviewer/lib/proctoring.functions";
import { blobToBase64, type StrikeKind } from "@/interviewer/lib/detection-types";
import { useDetectionEngine, type DetectionEvent } from "@/interviewer/hooks/useDetectionEngine";
import { ProctorDebugPanel } from "@/interviewer/components/vmx/ProctorDebugPanel";
import { CodeEditorPanel } from "@/interviewer/components/interview/CodeEditorPanel";
import { Brand } from "@/interviewer/components/vmx/SiteHeader";
import { PresenceCoach } from "@/interviewer/components/vmx/PresenceCoach";
import { IntegrityStrip } from "@/interviewer/components/vmx/IntegrityStrip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRecorder } from "@/interviewer/hooks/useRecorder";
import { useSpeaker } from "@/interviewer/hooks/useSpeaker";
import { useVisionMetrics } from "@/interviewer/hooks/useVisionMetrics";
import { useSessionRecorder } from "@/interviewer/hooks/useSessionRecorder";
import { saveRecording } from "@/interviewer/lib/recording-store";
import { getCompany } from "@/interviewer/lib/companies";
import { coachPresenceNow, nextInterviewTurn } from "@/interviewer/lib/interview.functions";
import {
  EMPTY_VOICE,
  PHASE_LABELS,
  PHASE_ORDER,
  type CoachingEvent,
  type CodeLanguage,
  type InterviewConfig,
  type InterviewPhase,
  type InterviewSession,
  type PresenceSample,
  type ProctorEvent,
  type ProctorKind,
  type RecordingMeta,
  type Turn,
  type VoiceMetrics,
} from "@/interviewer/lib/interview-types";
import { AnswerScoreCard } from "@/interviewer/components/vmx/AnswerScoreCard";
import { pickSpokenCorrection, proctorSeverity } from "@/interviewer/lib/coach-priority";
import { loadDraftConfig, newId, saveSession } from "@/interviewer/lib/session-store";
import { candidateNameMatchesResume } from "@/interviewer/lib/resume-sentences";
import { useDemoAuth } from "@/contexts/DemoAuthContext";
import { syncInterviewToMongoDB } from "@/lib/mongodb-sync";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/interviewer/interview")({
  head: () => ({
    meta: [
      { title: "Interview room — Vision Mentor X" },
      {
        name: "description",
        content:
          "Live AI interview room with a speaking interviewer, voice answers, coding editor and real-time presence analytics.",
      },
      { property: "og:title", content: "Interview room — Vision Mentor X" },
      {
        property: "og:description",
        content: "Answer a real AI interviewer by voice, text or code in a live interview room.",
      },
    ],
  }),
  component: InterviewRoom,
});

function InterviewRoom() {
  const navigate = useNavigate();
  const { user } = useDemoAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const answerRef = useRef<HTMLTextAreaElement | null>(null);
  const startedRef = useRef(false);
  const elapsedRef = useRef(0);

  const [config, setConfig] = useState<InterviewConfig | null>(null);
  const [sessionId] = useState(() => newId());
  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<InterviewPhase>("greeting");
  const [thinking, setThinking] = useState(false);
  const [answer, setAnswer] = useState("");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<CodeLanguage>("python");
  const [voice, setVoice] = useState<VoiceMetrics>(EMPTY_VOICE);
  const [camOn, setCamOn] = useState(false);
  const [clipAudio, setClipAudio] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [coaching, setCoaching] = useState<CoachingEvent[]>([]);
  const [coachChecking, setCoachChecking] = useState(false);
  const [proctor, setProctor] = useState<ProctorEvent[]>([]);
  const [tabWarnings, setTabWarnings] = useState(0);
  const [phoneWarnings, setPhoneWarnings] = useState(0);
  const phoneWarningsRef = useRef(0);
  const [totalStrikes, setTotalStrikes] = useState(0);
  const [multiPeopleBanner, setMultiPeopleBanner] = useState(false);
  const [phoneBanner, setPhoneBanner] = useState(false);
  const [qaOpen, setQaOpen] = useState(false);
  const [lastVisionResult, setLastVisionResult] = useState<ProctoringVisionResult | null>(null);
  const [lastAudioResult, setLastAudioResult] = useState<ProctoringAudioResult | null>(null);
  const [endReason, setEndReason] = useState<string | null>(null);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const phoneBannerTimeoutRef = useRef<number | null>(null);
  const multiPeopleTimeoutRef = useRef<number | null>(null);
  const strikesRef = useRef<Record<StrikeKind, number>>({
    second_voice: 0,
    phone: 0,
    multiple_faces: 0,
    left_frame: 0,
    left_tab: 0,
  });
  const multiFaceStreakRef = useRef(0);
  const lastVisionCheckRef = useRef(0);
  const presenceRef = useRef<PresenceSample[]>([]);
  const recordingRef = useRef<RecordingMeta | null>(null);
  const pendingCoachRef = useRef<CoachingEvent[]>([]);
  const endedEarlyRef = useRef(false);
  const endingRef = useRef(false);
  /** Latest endInterview, so background proctoring can terminate the session. */
  const endInterviewRef = useRef<((reason?: string) => Promise<void>) | null>(null);

  const speaker = useSpeaker();
  const recorder = useRecorder();
  const clipRecorder = useSessionRecorder();
  const sampleTick = useCallback(
    (sample: { eyeContact: number; posture: number; attention: number }) => {
      const track = presenceRef.current;
      // ~1 sample/second, capped so a long session cannot bloat localStorage.
      if (track.length >= 1800) return;
      track.push({ t: elapsedRef.current, ...sample });
    },
    [],
  );
  const vision = useVisionMetrics(videoRef, camOn, sampleTick);

  /** Log an integrity flag once — repeats of the same kind are throttled. */
  const seenProctorRef = useRef(new Map<ProctorKind, number>());
  const flagIntegrity = useCallback(
    (kind: ProctorKind, detail: string, throttleMs = 60_000, confidence?: number) => {
      const now = Date.now();
      const last = seenProctorRef.current.get(kind);
      if (last && now - last < throttleMs) return;
      seenProctorRef.current.set(kind, now);
      setProctor((prev) =>
        [
          ...prev,
          {
            t: elapsedRef.current,
            kind,
            detail,
            confidence,
            severity: proctorSeverity(kind),
          },
        ].slice(-40),
      );
    },
    [],
  );

  /** Generalised two-strike rule shared by every violation kind. */
  const escalate = useCallback(
    (kind: StrikeKind, label: string, endedDetail: string) => {
      const n = (strikesRef.current[kind] ?? 0) + 1;
      strikesRef.current[kind] = n;
      const total = Object.values(strikesRef.current).reduce((a, b) => a + b, 0);
      setTotalStrikes(total);
      if (n === 1) {
        flagIntegrity("warning_issued", `Warning 1 of 2 — ${label}`, 0);
        toast.warning(`Warning 1 of 2 — ${label}`);
      } else if (n === 2) {
        flagIntegrity("warning_issued", `Warning 2 of 2 (final) — ${label}`, 0);
        toast.warning(`Final warning — ${label}. The next detection will end this interview.`);
      } else {
        flagIntegrity("ended_early", endedDetail, 0);
        setEndReason(endedDetail);
        void endInterviewRef.current?.(endedDetail);
      }
    },
    [flagIntegrity],
  );

  /** Maps on-device detection events into the shared strike/banner pipeline. */
  const handleDetectionEvent = useCallback(
    (event: DetectionEvent) => {
      switch (event.kind) {
        case "device_visible":
          setPhoneBanner(true);
          if (phoneBannerTimeoutRef.current) window.clearTimeout(phoneBannerTimeoutRef.current);
          phoneBannerTimeoutRef.current = window.setTimeout(() => setPhoneBanner(false), 6000);
          flagIntegrity("device_visible", event.detail, 20_000, event.confidence);
          escalate(
            "phone",
            `a phone or second screen was detected (${event.confidence}% confidence).`,
            "Interview ended — phone use continued after two warnings.",
          );
          break;
        case "multiple_people":
          setMultiPeopleBanner(true);
          if (multiPeopleTimeoutRef.current) window.clearTimeout(multiPeopleTimeoutRef.current);
          multiPeopleTimeoutRef.current = window.setTimeout(
            () => setMultiPeopleBanner(false),
            5000,
          );
          flagIntegrity("multiple_people", event.detail, 20_000, event.confidence);
          escalate(
            "multiple_faces",
            "more than one person was seen in the camera frame.",
            "Interview ended — multiple people stayed in frame after two warnings.",
          );
          break;
        case "background_voice":
          flagIntegrity("multiple_voices", event.detail, 20_000, event.confidence);
          if (event.confidence >= 65) {
            escalate(
              "second_voice",
              "background music or a second voice was heard while you were silent.",
              "Interview ended — a second voice or background audio kept recurring after two warnings.",
            );
          }
          break;
        case "background_noise":
          flagIntegrity("background_noise", event.detail, 45_000, event.confidence);
          break;
        case "face_missing":
          flagIntegrity("face_missing", event.detail, 60_000);
          break;
        case "looking_away":
          flagIntegrity("looking_away", event.detail, 60_000);
          break;
        case "unusual_movement":
          flagIntegrity("unusual_movement", event.detail, 60_000, event.confidence);
          break;
        default:
          break;
      }
    },
    [flagIntegrity, escalate],
  );

  const detection = useDetectionEngine({
    videoRef,
    stream: liveStream,
    active: camOn,
    getElapsed: () => elapsedRef.current,
    onEvent: handleDetectionEvent,
  });

  const current = turns[turns.length - 1] ?? null;
  const question = current?.question ?? null;
  const isCoding = question?.kind === "coding";
  const company = useMemo(() => (config ? getCompany(config.companyId) : null), [config]);

  // Load draft config
  useEffect(() => {
    const draft = loadDraftConfig<InterviewConfig>();
    if (!draft) {
      navigate({ to: "/interviewer/setup" });
      return;
    }
    if (
      !draft.resume ||
      !draft.resume.name ||
      !candidateNameMatchesResume(draft.candidateName, draft.resume.name)
    ) {
      navigate({ to: "/interviewer/setup" });
      return;
    }
    setConfig(draft);
  }, [navigate]);

  // Camera + microphone for the local replay clip (audio makes the replay audible).
  useEffect(() => {
    let cancelled = false;
    const attach = (stream: MediaStream) => {
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setLiveStream(stream);
      setClipAudio(stream.getAudioTracks().length > 0);
      clipRecorder.start(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => {});
      }
      setCamOn(stream.getVideoTracks().length > 0);
    };
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then(attach)
      .catch(() =>
        // Mic denied or busy — still record video so the replay timeline works.
        navigator.mediaDevices
          ?.getUserMedia({ video: true })
          .then(attach)
          .catch(() => setCamOn(false)),
      );
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Timer
  useEffect(() => {
    const id = window.setInterval(
      () =>
        setElapsed((e) => {
          elapsedRef.current = e + 1;
          return e + 1;
        }),
      1000,
    );

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, thinking]);

  useEffect(() => {
    if (!thinking && !speaker.speaking && !isCoding) answerRef.current?.focus();
  }, [thinking, speaker.speaking, isCoding]);

  const advance = useCallback(
    async (history: Turn[], cfg: InterviewConfig) => {
      setThinking(true);
      try {
        const payload = await nextInterviewTurn({
          data: {
            config: cfg,
            turns: history.map((t) => ({
              id: t.id,
              phase: t.phase,
              say: t.say,
              mood: t.mood,
              question: t.question,
              bankId: t.bankId ?? null,
              answer: t.answer,
              evaluation: t.evaluation,
              askedAt: t.askedAt,
            })),
          },
        });

        let updated = history;
        const evalOfPrevious = payload.evaluationOfPrevious;
        if (evalOfPrevious && evalOfPrevious.verdict !== "none" && history.length) {
          const evaluation = {
            score: evalOfPrevious.score,
            verdict: evalOfPrevious.verdict as "strong" | "adequate" | "weak",
            note: evalOfPrevious.note ?? "",
            matched: evalOfPrevious.matched ?? [],
            missed: evalOfPrevious.missed ?? [],
            verified: evalOfPrevious.verified ?? false,
          };
          updated = history.map((t, i) => (i === history.length - 1 ? { ...t, evaluation } : t));
        }

        const question = payload.question
          ? {
              kind: payload.question.kind,
              prompt: payload.question.prompt ?? "",
              topic: payload.question.topic ?? "General",
              difficulty: payload.question.difficulty ?? 3,
              options: payload.question.options ?? [],
              language: payload.question.language ?? "none",
              starterCode: payload.question.starterCode ?? "",
            }
          : null;

        const turn: Turn = {
          id: newId(),
          phase: payload.phase ?? "technical",
          say: payload.say ?? "",
          mood: payload.mood ?? "neutral",
          question,
          bankId: payload.question?.bankId ?? null,
          askedAt: Date.now(),
        };
        const next = [...updated, turn];
        setTurns(next);
        setPhase(turn.phase);
        setCode(question?.starterCode ?? "");
        if (question?.language && question.language !== "none") {
          setLanguage(question.language);
        }
        // Speak any pending presentation correction first, then the question —
        // never mid-answer.
        const top = pickSpokenCorrection(pendingCoachRef.current);
        pendingCoachRef.current = [];
        const nudge = top
          ? `Before we continue — ${top.instruction.charAt(0).toLowerCase()}${top.instruction.slice(1)}`
          : "";
        const spoken = [nudge, turn.say, question?.prompt]
          .filter((part) => Boolean(part?.trim()))
          .join(" ");
        if (spoken.trim()) void speaker.speak(spoken);
        if (payload.done || turn.phase === "complete" || !question) {
          setFinishing(true);
        }
        return next;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "The interviewer could not respond. Try again.",
        );
        return history;
      } finally {
        setThinking(false);
      }
    },
    [speaker],
  );

  // Kick off the interview
  useEffect(() => {
    if (!config || startedRef.current) return;
    startedRef.current = true;
    void advance([], config);
  }, [config, advance]);

  // Real-time presence coaching: one quiet frame check every ~35s.
  const coachStateRef = useRef({
    live: vision.live,
    voice,
    busy: false,
    seen: new Map<string, number>(),
  });
  coachStateRef.current.live = vision.live;
  coachStateRef.current.voice = voice;

  useEffect(() => {
    if (!camOn || !config) return;
    let cancelled = false;

    async function runCheck() {
      const state = coachStateRef.current;
      if (state.busy || cancelled) return;
      const frame = vision.grabFrame();
      if (!frame) return;
      state.busy = true;
      setCoachChecking(true);
      try {
        const result = await coachPresenceNow({
          data: {
            dataUrl: frame,
            companyId: config!.companyId,
            role: config!.role,
            signals: {
              eyeContact: state.live.eyeContact,
              attention: state.live.attention,
              posture: state.live.posture,
              wordsPerMinute: state.voice.wordsPerMinute,
              fillerWords: state.voice.fillerWords,
            },
          },
        });
        if (cancelled) return;

        // Proctoring signals from the same frame.
        const integrity = result.integrity;
        if (integrity) {
          if (!integrity.faceVisible)
            flagIntegrity("face_missing", "Your face was not visible in the camera.");
          if (integrity.lookingAway)
            flagIntegrity("looking_away", "You were reading something away from the camera.");
          if (integrity.people > 1) {
            multiFaceStreakRef.current += 1;
            flagIntegrity(
              "multiple_people",
              `${integrity.people} people detected in the camera frame.`,
              60_000,
              integrity.peopleConfidence,
            );
            setMultiPeopleBanner(true);
            if (multiFaceStreakRef.current >= 2) {
              escalate(
                "multiple_faces",
                "more than one person was seen in the camera frame.",
                "Interview ended — multiple people stayed in frame after two warnings.",
              );
            }
          } else {
            multiFaceStreakRef.current = 0;
            setMultiPeopleBanner(false);
          }
          if (integrity.deviceVisible) {
            const detail = integrity.deviceReason || "A phone, notes or second screen was visible.";
            flagIntegrity("device_visible", detail, 30_000, integrity.deviceConfidence);
            // Policy: two explicit warnings, then the session is terminated.
            if (integrity.deviceConfidence >= 70) {
              phoneWarningsRef.current += 1;
              setPhoneWarnings(phoneWarningsRef.current);
              escalate(
                "phone",
                `a phone or second screen was detected (${integrity.deviceConfidence}% confidence). ${detail}`,
                `Interview ended — phone use continued after two warnings. ${detail}`,
              );
            }
          }
        }

        if (!result.items.length) return;
        const now = Date.now();
        const fresh = result.items.filter((item) => {
          const last = state.seen.get(item.area);
          // Don't repeat the same area within 90s — nudge, never nag.
          if (last && now - last < 90_000) return false;
          state.seen.set(item.area, now);
          return true;
        });
        if (!fresh.length) return;
        const events: CoachingEvent[] = fresh.map((item) => ({
          t: elapsedRef.current,
          area: item.area,
          instruction: item.instruction,
          confidence: item.confidence,
          reason: item.reason,
          severity: item.severity,
        }));
        // The interviewer voices the most important of these before the next question.
        pendingCoachRef.current.push(...events);
        setCoaching((prev) => [...prev, ...events].slice(-30));
      } catch {
        /* coaching is best-effort — never interrupt the interview */
      } finally {
        state.busy = false;
        if (!cancelled) setCoachChecking(false);
      }
    }

    const first = window.setTimeout(() => void runCheck(), 12_000);
    const id = window.setInterval(() => void runCheck(), 35_000);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [camOn, config, vision, flagIntegrity, escalate]);

  // Groq vision phone check: samples a frame every ~6s while the candidate is
  // answering, on top of the continuous on-device object detector.
  useEffect(() => {
    if (!camOn || !config || !recorder.recording) return;
    let cancelled = false;
    async function checkPhone() {
      const frame = vision.grabFrame();
      if (!frame) return;
      try {
        const result = await analyzeProctoringFrame({ data: { dataUrl: frame } });
        if (cancelled) return;
        setLastVisionResult(result);
        if (result.phoneVisible && result.phoneConfidence >= 55) {
          setPhoneBanner(true);
          if (phoneBannerTimeoutRef.current) window.clearTimeout(phoneBannerTimeoutRef.current);
          phoneBannerTimeoutRef.current = window.setTimeout(() => setPhoneBanner(false), 6000);
          flagIntegrity(
            "device_visible",
            result.notes || "A phone was visible during your answer.",
            15_000,
            result.phoneConfidence,
          );
          escalate(
            "phone",
            `a phone was detected (${result.phoneConfidence}% confidence).`,
            "Interview ended — phone use continued after two warnings.",
          );
        }
      } catch {
        /* best-effort */
      }
    }
    const id = window.setInterval(() => void checkPhone(), 6000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [camOn, config, recorder.recording, vision, flagIntegrity, escalate]);

  // Rolling ~10s audio chunks while answering, checked for music/second voice.
  useEffect(() => {
    if (!recorder.recording) return;
    const stream = liveStream;
    if (!stream || !stream.getAudioTracks().length || typeof MediaRecorder === "undefined") return;
    let cancelled = false;
    let chunks: Blob[] = [];
    let mr: MediaRecorder | null = null;
    try {
      const mime = MediaRecorder.isTypeSupported?.("audio/webm") ? "audio/webm" : undefined;
      mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      return;
    }
    mr.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    const flush = async () => {
      if (!chunks.length) return;
      const blob = new Blob(chunks, { type: mr!.mimeType || "audio/webm" });
      chunks = [];
      try {
        const audioBase64 = await blobToBase64(blob);
        const check = await analyzeProctoringAudio({ data: { audioBase64, mimeType: blob.type } });
        if (cancelled) return;
        setLastAudioResult(check);
        if (check.secondSpeaker || check.musicOrTv) {
          flagIntegrity(
            check.secondSpeaker ? "multiple_voices" : "background_noise",
            check.notes ||
              (check.secondSpeaker
                ? "A second speaker was heard."
                : "Background music or TV was heard."),
            20_000,
            check.confidence,
          );
          if (check.secondSpeaker) {
            escalate(
              "second_voice",
              "another voice was heard alongside yours.",
              "Interview ended — a second voice kept answering after two warnings.",
            );
          }
        }
      } catch {
        /* best-effort */
      }
    };
    try {
      mr.start();
    } catch {
      return;
    }
    const id = window.setInterval(() => {
      try {
        mr?.requestData();
      } catch {
        /* not all browsers support requestData mid-stream */
      }
      void flush();
    }, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      try {
        mr?.stop();
      } catch {
        /* already stopped */
      }
    };
  }, [recorder.recording, liveStream, flagIntegrity, escalate]);

  const persist = useCallback(
    (allTurns: Turn[], completed: boolean) => {
      if (!config) return;
      const session: InterviewSession = {
        id: sessionId,
        createdAt: Date.now() - elapsed * 1000,
        completedAt: completed ? Date.now() : undefined,
        config,
        turns: allTurns,
        vision: vision.summarize(),
        voice,
        report: undefined,
        // One webcam frame, used once on the report to review dress and hair.
        snapshot: vision.getSnapshot(),
        coaching,
        presence: presenceRef.current.slice(-1800),
        proctor,
        endedEarly: endedEarlyRef.current,
        recording: recordingRef.current,
        detection: detection.summarize(),
        endReason,
        strikeLog: strikesRef.current,
      };
      saveSession(session);

           // Sync interview to MongoDB if user is logged in
      if (user?.email) {
        const mongoInterview = {
          sessionId,
          email: user.email,
          userId: user.email,

          assessmentCode: config.companyId,

          config: {
            companyId: config.companyId,
            role: config.role,
            experience: config.experience,
            candidateName: config.candidateName,
          },

          phases: allTurns.map((t) => t.phase),

          turns: allTurns.map((t) => ({
            questionId: t.bankId ?? null,
            question: t.question?.prompt ?? t.say,
            answer: t.answer ?? "",

            code:
              t.question?.kind === "coding"
                ? t.answer ?? ""
                : "",

            language: t.question?.language ?? "none",

            score: t.evaluation?.score ?? null,
          })),

          startedAt: new Date(session.createdAt).toISOString(),

          completedAt: completed
            ? new Date().toISOString()
            : undefined,

          status: completed
            ? ("completed" as const)
            : ("in_progress" as const),

          recording: recordingRef.current,

          createdAt: new Date(session.createdAt).toISOString(),

          updatedAt: new Date().toISOString(),
        };

        void syncInterviewToMongoDB(mongoInterview);
      }
    },
    [config, sessionId, elapsed, vision, voice, coaching, proctor, detection, endReason, user],
  );

  const submitAnswer = useCallback(
    async (text: string) => {
      if (!config || !text.trim() || thinking) return;
      speaker.stop();
      const withAnswer = turns.map((t, i) =>
        i === turns.length - 1 ? { ...t, answer: text.trim() } : t,
      );
      setTurns(withAnswer);
      setAnswer("");
      const next = await advance(withAnswer, config);
      persist(next, false);
    },
    [config, turns, thinking, speaker, advance, persist],
  );

  async function toggleRecording() {
    if (recorder.recording) {
      const result = await recorder.stopAndTranscribe();
      if (!result || !result.text) {
        toast.error("Nothing was picked up — try again or type your answer.");
        return;
      }
      if (result.multipleVoices) {
        flagIntegrity(
          "multiple_voices",
          "More than one speaker was detected while you were answering.",
          30_000,
        );
        escalate(
          "second_voice",
          "another voice was detected while you were answering.",
          "Interview ended — a second voice kept answering after two warnings.",
        );
      }
      if (result.audioBlob) {
        void (async () => {
          try {
            const audioBase64 = await blobToBase64(result.audioBlob!);
            const check = await analyzeProctoringAudio({
              data: { audioBase64, mimeType: result.audioBlob!.type || "audio/wav" },
            });
            if (check.secondSpeaker || check.musicOrTv) {
              flagIntegrity(
                check.secondSpeaker ? "multiple_voices" : "background_noise",
                check.notes ||
                  (check.secondSpeaker
                    ? "A second speaker was heard."
                    : "Background music or TV was heard."),
                30_000,
                check.confidence,
              );
              if (check.secondSpeaker) {
                escalate(
                  "second_voice",
                  "another voice was heard alongside yours.",
                  "Interview ended — a second voice kept answering after two warnings.",
                );
              }
            }
          } catch {
            /* audio proctoring is best-effort */
          }
        })();
      }
      setVoice((v) => {
        const samples = v.samples + 1;
        const wpm = Math.round((v.wordsPerMinute * v.samples + result.wordsPerMinute) / samples);
        const energy = Math.round((v.energy * v.samples + result.energy) / samples);
        const fillerWords = v.fillerWords + result.fillerWords;
        const pauseCount = v.pauseCount + result.pauseCount;
        const paceScore = Math.max(0, 100 - Math.abs(wpm - 140) * 0.8);
        const fluency = Math.round(
          Math.max(0, Math.min(100, paceScore - fillerWords * 2.5 - pauseCount * 1.2)),
        );
        return { wordsPerMinute: wpm, fillerWords, pauseCount, energy, fluency, samples };
      });
      await submitAnswer(result.text);
    } else {
      speaker.stop();
      await recorder.start();
    }
  }

  const endInterview = useCallback(
    async (reason?: string) => {
      if (endingRef.current) return;
      endingRef.current = true;
      speaker.stop();
      recorder.cancel();
      if (reason) endedEarlyRef.current = true;

      const clip = await clipRecorder.stop();
      if (clip) {
        const id = `${sessionId}-clip`;
        const stored = await saveRecording(id, clip.blob);
        if (stored) {
          recordingRef.current = { id, duration: clip.duration, mimeType: clip.mimeType };
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      persist(turns, true);
      if (reason) toast.error(reason);
      navigate({ to: "/interviewer/report/$sessionId", params: { sessionId } });
    },
    [clipRecorder, navigate, persist, recorder, sessionId, speaker, turns],
  );

  useEffect(() => {
    endInterviewRef.current = endInterview;
  }, [endInterview]);

  // Tab / window switching: warn once, then end the interview.
  useEffect(() => {
    function leave(detail: string) {
      if (endingRef.current) return;
      flagIntegrity("tab_switch", detail, 4000);
      setTabWarnings((n) => n + 1);
      escalate(
        "left_tab",
        "you left the interview tab.",
        "Interview ended — you left the interview tab during the session.",
      );
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") leave("You switched away from the interview tab.");
    };
    const onBlur = () => {
      if (document.visibilityState === "visible") return;
      leave("The interview window lost focus.");
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [endInterview, flagIntegrity, escalate]);

  // The interviewer reacts to how the candidate actually did on the last answer.
  const lastEvaluated = [...turns].reverse().find((t) => t.evaluation)?.evaluation ?? null;
  const reactionMood =
    lastEvaluated && Date.now() - (current?.askedAt ?? 0) < 6000
      ? lastEvaluated.verdict === "strong"
        ? "smile"
        : lastEvaluated.verdict === "weak"
          ? "curious"
          : "nod"
      : null;
  const mood = thinking ? "thinking" : (reactionMood ?? current?.mood ?? "neutral");
  const phaseIndex = PHASE_ORDER.indexOf(phase);

  return (
    <div className="flex min-h-screen flex-col office-bg">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[100rem] items-center justify-between gap-4 px-4 sm:px-6">
          <Brand />
          <div className="hidden items-center gap-1.5 md:flex">
            {PHASE_ORDER.filter((p) => p !== "complete").map((p, i) => (
              <span
                key={p}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] transition-colors",
                  i === phaseIndex
                    ? "bg-primary/20 text-primary"
                    : i < phaseIndex
                      ? "bg-secondary/60 text-muted-foreground"
                      : "text-muted-foreground/50",
                )}
              >
                {PHASE_LABELS[p]}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <VoicePicker
              preference={speaker.voicePref}
              onChange={speaker.setVoicePref}
              fallbackNote={speaker.resolvedVoice().fallbackReason}
              resolvedName={speaker.resolvedVoice().voice?.name ?? null}
            />
            <Button
              variant={qaOpen ? "default" : "ghost"}
              size="sm"
              className="text-xs"
              onClick={() => setQaOpen((v) => !v)}
            >
              QA
            </Button>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
              <Circle className="h-2 w-2 fill-destructive text-destructive" />
              {formatTime(elapsed)}
            </span>
            <Button variant="destructive" size="sm" onClick={() => void endInterview()}>
              <PhoneOff className="mr-1.5 h-3.5 w-3.5" /> End & report
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[100rem] flex-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[1.35fr_0.65fr]">
        {/* Left: interviewer + answer */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="relative overflow-hidden rounded-2xl border border-border glass panel-glow">
            <div className="aspect-video w-full">
              <AIInterviewer
                mouth={speaker.mouth}
                viseme={speaker.viseme}
                speaking={speaker.speaking}
                listening={recorder.recording}
                mood={mood}
              />
            </div>
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs backdrop-blur">
              <span className="font-medium">Vera Kapoor</span>
              <span className="text-muted-foreground">
                · {company?.name ?? "Interviewer"} · {PHASE_LABELS[phase]}
              </span>
            </div>
            <div className="absolute right-4 top-4 flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9"
                onClick={() => speaker.setMuted(!speaker.muted)}
                aria-label={speaker.muted ? "Unmute interviewer" : "Mute interviewer"}
              >
                {speaker.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
            </div>
            {(thinking || speaker.speaking) && (
              <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs backdrop-blur">
                {thinking ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Thinking…
                  </>
                ) : (
                  <>
                    <Activity className="h-3.5 w-3.5 text-primary" /> Speaking
                  </>
                )}
              </div>
            )}
            <div className="absolute bottom-4 right-4 w-32 overflow-hidden rounded-lg border border-border/80 bg-background/70 sm:w-44">
              <video
                ref={videoRef}
                muted
                playsInline
              className="aspect-video w-full object-cover"
              />
            </div>
          </div>

          {/* Question + answer */}
          <div className="rounded-2xl glass p-5">
            {question ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">
                    {question.topic}
                  </span>
                  <span>difficulty {question.difficulty}/5</span>
                  <span>{question.kind}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed">
                  {question.prompt}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {finishing
                  ? "The interview is complete. Generate your report to see the results."
                  : "Waiting for the interviewer…"}
              </p>
            )}

            {question?.kind === "mcq" && question.options.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {question.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={thinking}
                    onClick={() => void submitAnswer(opt)}
                    className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-secondary/60 disabled:opacity-50"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {isCoding ? (
              <div className="mt-4 h-[24rem]">
                <CodeEditorPanel
                  language={language}
                  value={code}
                  onChange={setCode}
                  onLanguageChange={setLanguage}
                  disabled={thinking || !code.trim()}
                  onSubmit={() => void submitAnswer(`Here is my ${language} solution:\n\n${code}`)}
                />
              </div>
            ) : (
              question && (
                <div className="mt-4 space-y-3">
                  <Textarea
                    ref={answerRef}
                    rows={4}
                    maxLength={4000}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Speak your answer with the mic, or type it here…"
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submitAnswer(answer);
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant={recorder.recording ? "destructive" : "secondary"}
                      onClick={() => void toggleRecording()}
                      disabled={thinking || recorder.transcribing}
                    >
                      {recorder.transcribing ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : recorder.recording ? (
                        <MicOff className="mr-1.5 h-4 w-4" />
                      ) : (
                        <Mic className="mr-1.5 h-4 w-4" />
                      )}
                      {recorder.recording
                        ? "Stop & send"
                        : recorder.transcribing
                          ? "Transcribing…"
                          : "Answer by voice"}
                    </Button>
                    <Button
                      onClick={() => void submitAnswer(answer)}
                      disabled={thinking || !answer.trim()}
                    >
                      <Send className="mr-1.5 h-4 w-4" /> Send answer
                    </Button>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Keyboard className="h-3.5 w-3.5" /> Ctrl/⌘ + Enter to send
                    </span>
                    {recorder.recording && (
                      <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-primary transition-[width] duration-100"
                            style={{ width: `${Math.round(recorder.level * 100)}%` }}
                          />
                        </span>
                        recording
                      </span>
                    )}
                  </div>
                  {recorder.recording && recorder.liveText && (
                    <p className="mt-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      {recorder.liveText}
                    </p>
                  )}
                </div>
              )
            )}

            {finishing && (
              <Button className="mt-4" size="lg" onClick={() => void endInterview()}>
                Generate performance report
              </Button>
            )}
          </div>
        </div>

        {/* Right: transcript + live metrics */}
        <aside className="flex min-w-0 flex-col gap-5">
          <PresenceCoach events={coaching} checking={coachChecking} enabled={camOn} />

          <AnswerScoreCard turns={turns} />

          {phoneBanner && (
            <div className="animate-pulse rounded-2xl border-2 border-destructive bg-destructive/15 p-4 text-center text-sm font-semibold text-destructive">
              Put your phone away — using a phone ends the interview.
            </div>
          )}
          {multiPeopleBanner && (
            <div className="rounded-2xl border-2 border-destructive bg-destructive/15 p-4 text-center text-sm font-semibold text-destructive">
              Multiple people detected — only the candidate may be in frame.
            </div>
          )}

          <IntegrityStrip events={proctor} enabled={camOn} warnings={tabWarnings + phoneWarnings} />

          {qaOpen && (
            <ProctorDebugPanel
              signals={detection.signals}
              strikes={strikesRef.current}
              endReason={endReason}
              lastVision={lastVisionResult}
              lastAudio={lastAudioResult}
            />
          )}

          <section className="rounded-2xl glass p-4">
            <h2 className="font-display text-sm font-semibold">Live signals</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Metric icon={Eye} label="Eye contact" value={vision.live.eyeContact} suffix="%" />
              <Metric icon={Activity} label="Attention" value={vision.live.attention} suffix="%" />
              <Metric icon={Mic} label="Pace" value={voice.wordsPerMinute} suffix=" wpm" />
              <Metric icon={Activity} label="Fillers" value={voice.fillerWords} />
            </div>
            {!camOn && (
              <p className="mt-3 text-xs text-muted-foreground">
                Camera off — presence analytics are disabled for this session.
              </p>
            )}
            {camOn && !clipAudio && (
              <p className="mt-3 text-xs text-muted-foreground">
                Microphone not available for the replay clip — the replay will have no audio.
              </p>
            )}
          </section>

          <section className="flex min-h-[18rem] flex-1 flex-col rounded-2xl glass p-4">
            <h2 className="font-display text-sm font-semibold">Transcript</h2>
            <div ref={transcriptRef} className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
              {turns.length === 0 && !thinking && (
                <p className="text-xs text-muted-foreground">The interview is about to begin…</p>
              )}
              {turns.map((t) => (
                <div key={t.id} className="space-y-2">
                  <div className="rounded-lg bg-secondary/40 p-3 text-xs leading-relaxed">
                    <span className="mb-1 block text-[10px] uppercase tracking-widest text-primary">
                      Vera
                    </span>
                    {t.say}
                    {t.question && (
                      <span className="mt-1.5 block text-foreground/90">{t.question.prompt}</span>
                    )}
                  </div>
                  {t.answer && (
                    <div className="rounded-lg border border-border/70 p-3 text-xs leading-relaxed">
                      <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
                        You
                      </span>
                      {t.answer.length > 400 ? `${t.answer.slice(0, 400)}…` : t.answer}
                      {t.evaluation && (
                        <span
                          className={cn(
                            "mt-2 block text-[11px]",
                            t.evaluation.verdict === "strong"
                              ? "text-success"
                              : t.evaluation.verdict === "weak"
                                ? "text-warning"
                                : "text-muted-foreground",
                          )}
                        >
                          {t.evaluation.score}/100 · {t.evaluation.note}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {thinking && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Vera is thinking…
                </p>
              )}
            </div>
            <Link
              to="/interviewer/dashboard"
              className="mt-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Leave and keep progress
            </Link>
          </section>
        </aside>
      </main>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  suffix = "",
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg bg-secondary/35 px-3 py-2">
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </span>
      <span className="mt-0.5 block font-display text-lg font-semibold tabular-nums">
        {Math.round(value)}
        {suffix}
      </span>
    </div>
  );
}

function formatTime(total: number) {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
