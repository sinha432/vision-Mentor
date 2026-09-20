import { useCallback, useEffect, useRef, useState } from "react";
import {
  BANNED_OBJECTS,
  EMPTY_SIGNALS,
  type DetectionSample,
  type DetectionSignals,
  type DetectionSummary,
  type GazeDirection,
} from "@/interviewer/lib/detection-types";

/**
 * On-device detection engine.
 *
 * MediaPipe Tasks run entirely in the browser: a face landmarker (face count,
 * gaze, blinks, expression), a pose landmarker (posture, movement) and an
 * object detector (phone / second screen). A Web Audio analyser runs alongside
 * them to measure the candidate's voice against the room, which is how
 * background noise, background voices and real pauses are detected.
 *
 * Nothing leaves the device and no frame is uploaded. If the models fail to
 * load, `signals.degraded` is set and the caller keeps its heuristic fallback.
 */

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODELS = {
  face: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  pose: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  object:
    "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.task",
};

export type DetectionEventKind =
  | "multiple_people"
  | "face_missing"
  | "looking_away"
  | "device_visible"
  | "background_voice"
  | "background_noise"
  | "unusual_movement"
  | "hand_gesture";

export interface DetectionEvent {
  kind: DetectionEventKind;
  detail: string;
  confidence: number;
}

interface Options {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  active: boolean;
  /** Seconds since the interview started, for sample timestamps. */
  getElapsed: () => number;
  onEvent?: (event: DetectionEvent) => void;
}

interface Accum {
  samples: DetectionSample[];
  eye: number;
  posture: number;
  confidence: number;
  noise: number;
  count: number;
  blinks: number;
  noisySeconds: number;
  multiFaceSeconds: number;
  faceMissingSeconds: number;
  handGestureSeconds: number;
  handGestureEvents: number;
  deviceSeconds: number;
  backgroundVoiceEvents: number;
  multiFaceEvents: number;
  emotions: Map<string, number>;
  startedAt: number;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function blend(categories: { categoryName?: string; score: number }[] | undefined) {
  const map = new Map<string, number>();
  categories?.forEach((c) => {
    if (c.categoryName) map.set(c.categoryName, c.score);
  });
  return (name: string) => map.get(name) ?? 0;
}

export function useDetectionEngine({ videoRef, stream, active, getElapsed, onEvent }: Options) {
  const [signals, setSignals] = useState<DetectionSignals>(EMPTY_SIGNALS);
  const signalsRef = useRef(EMPTY_SIGNALS);
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;
  const elapsedRef = useRef(getElapsed);
  elapsedRef.current = getElapsed;

  const accumRef = useRef<Accum>({
    samples: [],
    eye: 0,
    posture: 0,
    confidence: 0,
    noise: 0,
    count: 0,
    blinks: 0,
    noisySeconds: 0,
    multiFaceSeconds: 0,
    faceMissingSeconds: 0,
    handGestureSeconds: 0,
    handGestureEvents: 0,
    deviceSeconds: 0,
    backgroundVoiceEvents: 0,
    multiFaceEvents: 0,
    emotions: new Map(),
    startedAt: Date.now(),
  });

  const patch = useCallback((next: Partial<DetectionSignals>) => {
    signalsRef.current = { ...signalsRef.current, ...next };
    setSignals(signalsRef.current);
  }, []);

  /* ------------------------------------------------------------------ */
  /* audio: candidate voice vs. the room                                 */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!active || !stream || !stream.getAudioTracks().length) return;
    let cancelled = false;
    let ctx: AudioContext | null = null;
    let raf = 0;

    const AudioCtx: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    ctx = new AudioCtx();
    void ctx.resume().catch(() => undefined);
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.45;
    source.connect(analyser);
    const time = new Float32Array(analyser.fftSize);
    const freq = new Float32Array(analyser.frequencyBinCount);
    const binHz = ctx.sampleRate / analyser.fftSize;

    let noiseFloor = 0.004;
    let calibratedNoise = 0.004;
    let calibrationMs = 0;
    let silentSince = Date.now();
    let voicedMs = 0;
    let pauses = 0;
    let longestPause = 0;
    let lastVoiceEvent = 0;
    let lastNoiseEvent = 0;
    let last = Date.now();

    const tick = () => {
      if (cancelled) return;
      raf = window.requestAnimationFrame(tick);
      const now = Date.now();
      if (now - last < 100) return;
      const dt = now - last;
      last = now;

      analyser.getFloatTimeDomainData(time);
      let sum = 0;
      for (let i = 0; i < time.length; i++) sum += time[i] * time[i];
      const rms = Math.sqrt(sum / time.length);

      // Energy in the speech band tells voices apart from hum and fan noise.
      analyser.getFloatFrequencyData(freq);
      let speechBand = 0;
      let speechBins = 0;
      for (let i = 0; i < freq.length; i++) {
        const hz = i * binHz;
        if (hz < 300 || hz > 3400) continue;
        speechBand += Math.max(0, (freq[i] + 100) / 100);
        speechBins++;
      }
      const speechEnergy = speechBins ? speechBand / speechBins : 0;

      if (calibrationMs < 1800) {
        calibratedNoise = calibratedNoise * 0.9 + rms * 0.1;
        calibrationMs += dt;
      }
      const baseline = Math.max(0.003, calibratedNoise);
      const speaking = rms > Math.max(0.012, baseline * 2.8);
      if (speaking) {
        voicedMs += dt;
        const gap = now - silentSince;
        if (gap > 1500) {
          pauses += 1;
          longestPause = Math.max(longestPause, Math.round(gap / 1000));
        }
        silentSince = now;
      } else {
        // Only quiet frames update the noise floor, so the room is measured
        // while the candidate is not talking.
        // Track only slow changes below the speech threshold. Do not absorb a
        // sustained fan, TV, or room conversation into the baseline.
        if (rms < baseline * 1.35) noiseFloor = noiseFloor * 0.995 + rms * 0.005;
      }

      const ambientRatio = rms / Math.max(0.003, noiseFloor);
      const noiseLevel = clamp(Math.round((ambientRatio - 1) * 38));
      const voiceLevel = clamp(Math.round(rms * 1600));
      // Speech-shaped energy while the candidate is silent = someone else.
      const backgroundVoice = !speaking && speechEnergy > 0.28 && rms > Math.max(0.01, noiseFloor * 1.5);

      if (backgroundVoice && now - lastVoiceEvent > 10_000) {
        lastVoiceEvent = now;
        accumRef.current.backgroundVoiceEvents += 1;
        eventRef.current?.({
          kind: "background_voice",
          detail: "Another voice was heard while you were not speaking.",
          confidence: clamp(Math.round(speechEnergy * 140)),
        });
      }
      if (!speaking && noiseLevel > 22 && now - lastNoiseEvent > 15_000) {
        lastNoiseEvent = now;
        eventRef.current?.({
          kind: "background_noise",
          detail: `Loud background noise in the room (${noiseLevel}/100). Move somewhere quieter.`,
          confidence: noiseLevel,
        });
      }

      const minutes = Math.max(0.25, (now - accumRef.current.startedAt) / 60_000);
      patch({
        noiseLevel,
        voiceLevel,
        speaking,
        backgroundVoice,
        pauses,
        longestPause,
        // Voiced seconds per minute, scaled to an approximate words-per-minute.
        speechPace: Math.round((voicedMs / 1000 / minutes) * 2.6),
      });
    };
    raf = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      void ctx?.close();
    };
  }, [active, stream, patch]);

  /* ------------------------------------------------------------------ */
  /* vision: face, pose and objects                                      */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let raf = 0;
    let faceLandmarker: { detectForVideo: (v: HTMLVideoElement, t: number) => unknown; close: () => void } | null = null;
    let poseLandmarker: { detectForVideo: (v: HTMLVideoElement, t: number) => unknown; close: () => void } | null = null;
    let objectDetector: { detectForVideo: (v: HTMLVideoElement, t: number) => unknown; close: () => void } | null = null;

    let lastFace = 0;
    let lastObject = 0;
    let lastStamp = -1;
    let blinkClosed = false;
    let prevPose: { x: number; y: number }[] | null = null;
    const lastEvent = new Map<DetectionEventKind, number>();
    let awayStreak = 0;
    let missingStreak = 0;
    let multiFaceStreak = 0;
    let gestureStreak = 0;

    const fire = (kind: DetectionEventKind, detail: string, confidence: number, throttle = 30_000) => {
      const now = Date.now();
      const previous = lastEvent.get(kind);
      if (previous && now - previous < throttle) return;
      lastEvent.set(kind, now);
      eventRef.current?.({ kind, detail, confidence });
    };

    async function boot() {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
        if (cancelled) return;
        faceLandmarker = (await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODELS.face, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 3,
          outputFaceBlendshapes: true,
        })) as never;
        poseLandmarker = (await vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODELS.pose, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        })) as never;
        objectDetector = (await vision.ObjectDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODELS.object, delegate: "GPU" },
          runningMode: "VIDEO",
          scoreThreshold: 0.42,
          maxResults: 6,
        })) as never;
        if (cancelled) return;
        patch({ ready: true, degraded: false });
        raf = window.requestAnimationFrame(loop);
      } catch {
        // No WebGL, offline, or blocked CDN — the caller keeps its heuristics.
        if (!cancelled) patch({ ready: false, degraded: true });
      }
    }

    function loop() {
      if (cancelled) return;
      raf = window.requestAnimationFrame(loop);
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return;
      const now = performance.now();
      // ~5fps for face/pose is plenty and keeps the main thread free.
      if (now - lastFace < 200) return;
      lastFace = now;
      const stamp = Math.max(lastStamp + 1, Math.round(now));
      lastStamp = stamp;

      try {
        const faceResult = faceLandmarker?.detectForVideo(video, stamp) as
          | {
              faceLandmarks: { x: number; y: number }[][];
              faceBlendshapes?: { categories: { categoryName?: string; score: number }[] }[];
            }
          | undefined;
        const faces = faceResult?.faceLandmarks?.length ?? 0;
        const primary = faceResult?.faceLandmarks?.[0];
        const shapes = blend(faceResult?.faceBlendshapes?.[0]?.categories);

        let eyeContact = signalsRef.current.eyeContact;
        let gaze: GazeDirection = "unknown";
        let expression = signalsRef.current.expression;

        if (primary?.length) {
          const h =
            (shapes("eyeLookOutLeft") + shapes("eyeLookInRight")) / 2 -
            (shapes("eyeLookInLeft") + shapes("eyeLookOutRight")) / 2;
          const v =
            (shapes("eyeLookUpLeft") + shapes("eyeLookUpRight")) / 2 -
            (shapes("eyeLookDownLeft") + shapes("eyeLookDownRight")) / 2;
          // Head turn: how off-centre the nose sits between the temples.
          const nose = primary[1];
          const left = primary[234];
          const right = primary[454];
          const yaw =
            left && right && nose
              ? Math.abs((nose.x - (left.x + right.x) / 2) / Math.max(0.05, Math.abs(right.x - left.x)))
              : 0;
          eyeContact = clamp(Math.round(100 - (Math.abs(h) + Math.abs(v)) * 150 - yaw * 190));
          const magnitude = Math.max(Math.abs(h), Math.abs(v));
          gaze =
            magnitude < 0.14 && yaw < 0.12
              ? "center"
              : Math.abs(h) >= Math.abs(v)
                ? h > 0
                  ? "left"
                  : "right"
                : v > 0
                  ? "up"
                  : "down";

          const closed = shapes("eyeBlinkLeft") > 0.5 && shapes("eyeBlinkRight") > 0.5;
          if (closed && !blinkClosed) accumRef.current.blinks += 1;
          blinkClosed = closed;

          expression =
            shapes("mouthSmileLeft") + shapes("mouthSmileRight") > 0.5
              ? "smiling"
              : shapes("browDownLeft") + shapes("browDownRight") > 0.7
                ? "tense"
                : shapes("jawOpen") > 0.35
                  ? "speaking"
                  : eyeContact > 70
                    ? "engaged"
                    : "neutral";
        }

        if (faces === 0) {
          missingStreak += 1;
          if (missingStreak === 8) {
            fire("face_missing", "Your face was not visible in the camera for several seconds.", 90);
          }
        } else {
          missingStreak = 0;
        }
        if (faces > 1) {
          // Require ~1.5s of sustained multi-face detection (frames run at ~5fps)
          // so a person briefly walking past the camera does not trip a strike.
          multiFaceStreak += 1;
          if (multiFaceStreak === 5) {
            accumRef.current.multiFaceEvents += 1;
            fire(
              "multiple_people",
              `${faces} people detected in the camera frame. Only the candidate may be present.`,
              92,
              10_000,
            );
          }
        } else {
          multiFaceStreak = 0;
        }
        if (gaze !== "center" && gaze !== "unknown" && faces === 1) {
          awayStreak += 1;
          if (awayStreak === 12) {
            fire(
              "looking_away",
              `You looked ${gaze} of the camera for a prolonged stretch — keep your eyes on the interviewer.`,
              78,
            );
          }
        } else {
          awayStreak = 0;
        }

        /* posture + movement */
        let posture = signalsRef.current.posture;
        let movement = signalsRef.current.movement;
        let handGesture: DetectionSignals["handGesture"] = "none";
        const poseResult = poseLandmarker?.detectForVideo(video, stamp) as
          | { landmarks: { x: number; y: number }[][] }
          | undefined;
        const pose = poseResult?.landmarks?.[0];
        if (pose?.length) {
          const ls = pose[11];
          const rs = pose[12];
          const le = pose[7];
          const re = pose[8];
          if (ls && rs) {
            const tilt = Math.abs(ls.y - rs.y) * 400;
            const shoulderMid = (ls.y + rs.y) / 2;
            const earMid = le && re ? (le.y + re.y) / 2 : shoulderMid - 0.18;
            // Head sunk toward the shoulders reads as slouching.
            const neck = clamp((shoulderMid - earMid) * 520, 0, 100);
            posture = clamp(Math.round(100 - tilt - Math.max(0, 55 - neck)));
          }
          if (prevPose) {
            let delta = 0;
            for (let i = 0; i < Math.min(pose.length, prevPose.length); i++) {
              delta += Math.abs(pose[i].x - prevPose[i].x) + Math.abs(pose[i].y - prevPose[i].y);
            }
            movement = clamp(Math.round((delta / pose.length) * 2600));
            if (movement > 78) {
              fire("unusual_movement", "A lot of movement away from the camera was detected.", movement, 60_000);
            }
          }
          const leftWrist = pose[15];
          const rightWrist = pose[16];
          const leftShoulder = pose[11];
          const rightShoulder = pose[12];
          const wristsVisible = [leftWrist, rightWrist].filter(Boolean).length;
          const raisedHands =
            (leftWrist && leftShoulder && leftWrist.y < leftShoulder.y - 0.08 ? 1 : 0) +
            (rightWrist && rightShoulder && rightWrist.y < rightShoulder.y - 0.08 ? 1 : 0);
          if (raisedHands > 0) {
            handGesture = "raised";
          } else if (wristsVisible > 0 && movement > 58) {
            handGesture = "active";
          }
          if (handGesture !== "none") {
            gestureStreak += 1;
            if (gestureStreak === 8) {
              accumRef.current.handGestureEvents += 1;
              fire(
                "hand_gesture",
                handGesture === "raised"
                  ? "A raised hand gesture was visible. Keep gestures within the camera frame."
                  : "Active hand movement was visible. Keep gestures deliberate and within the camera frame.",
                handGesture === "raised" ? 82 : 68,
                20_000,
              );
            }
          } else {
            gestureStreak = 0;
          }
          prevPose = pose.map((p) => ({ x: p.x, y: p.y }));
        }

        /* objects — heavier, so a slower cadence */
        let devices = signalsRef.current.devices;
        if (now - lastObject > 700) {
          lastObject = now;
          const objectResult = objectDetector?.detectForVideo(video, stamp) as
            | { detections: { categories: { categoryName?: string; score: number }[] }[] }
            | undefined;
          const found: { label: string; score: number }[] = [];
          objectResult?.detections?.forEach((d) => {
            const top = d.categories?.[0];
            const label = top?.categoryName?.toLowerCase();
            if (!label || !top) return;
            if (BANNED_OBJECTS.has(label)) found.push({ label, score: Math.round(top.score * 100) });
          });
          devices = found;
          if (found.length) {
            const best = found.reduce((a, b) => (b.score > a.score ? b : a));
            fire(
              "device_visible",
              `A ${best.label} is visible in the camera frame (${best.score}% confidence).`,
              best.score,
              25_000,
            );
          }
        }

        const attention = clamp(Math.round(100 - movement * 0.8));
        const confidence = clamp(
          Math.round(eyeContact * 0.4 + posture * 0.3 + attention * 0.2 + (expression === "smiling" ? 10 : 6)),
        );

        patch({
          faces,
          faceVisible: faces > 0,
          eyeContact,
          gaze,
          expression,
          posture,
          movement,
          handGesture,
          devices,
          blinkRate: Math.round(
            accumRef.current.blinks /
              Math.max(0.5, (Date.now() - accumRef.current.startedAt) / 60_000),
          ),
        });

        /* accumulate one sample per ~second for the report graphs */
        const a = accumRef.current;
        const t = elapsedRef.current();
        const lastSample = a.samples[a.samples.length - 1];
        if (!lastSample || t > lastSample.t) {
          a.samples.push({
            t,
            eyeContact,
            posture,
            attention,
            confidence,
            noise: signalsRef.current.noiseLevel,
            voice: signalsRef.current.voiceLevel,
            faces,
            emotion: expression,
          });
          if (a.samples.length > 3600) a.samples.shift();
          a.eye += eyeContact;
          a.posture += posture;
          a.confidence += confidence;
          a.noise += signalsRef.current.noiseLevel;
          a.count += 1;
          if (signalsRef.current.noiseLevel > 40) a.noisySeconds += 1;
          if (faces > 1) a.multiFaceSeconds += 1;
          if (faces === 0) a.faceMissingSeconds += 1;
          if (handGesture !== "none") a.handGestureSeconds += 1;
          if (devices.length) a.deviceSeconds += 1;
          a.emotions.set(expression, (a.emotions.get(expression) ?? 0) + 1);
        }
      } catch {
        /* a dropped frame is never fatal */
      }
    }

    void boot();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      faceLandmarker?.close();
      poseLandmarker?.close();
      objectDetector?.close();
    };
  }, [active, videoRef, patch]);

  const summarize = useCallback((): DetectionSummary => {
    const a = accumRef.current;
    const n = Math.max(1, a.count);
    let dominant = "neutral";
    let best = 0;
    a.emotions.forEach((count, emotion) => {
      if (count > best) {
        best = count;
        dominant = emotion;
      }
    });
    const s = signalsRef.current;
    return {
      samples: a.samples.slice(-1800),
      avgEyeContact: Math.round(a.eye / n),
      avgPosture: Math.round(a.posture / n),
      avgConfidence: Math.round(a.confidence / n),
      avgNoise: Math.round(a.noise / n),
      blinkRate: s.blinkRate,
      noisySeconds: a.noisySeconds,
      multiFaceSeconds: a.multiFaceSeconds,
      faceMissingSeconds: a.faceMissingSeconds,
      handGestureSeconds: a.handGestureSeconds,
      handGestureEvents: a.handGestureEvents,
      deviceSeconds: a.deviceSeconds,
      backgroundVoiceEvents: a.backgroundVoiceEvents,
      multiFaceEvents: a.multiFaceEvents,
      pauses: s.pauses,
      longestPause: s.longestPause,
      speechPace: s.speechPace,
      dominantEmotion: dominant,
      onDevice: a.count > 0 && !s.degraded,
    };
  }, []);

  return { signals, summarize };
}
