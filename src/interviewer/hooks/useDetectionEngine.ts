import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  BANNED_OBJECTS,
  EMPTY_SIGNALS,
  type DetectionSample,
  type DetectionSignals,
  type DetectionSummary,
  type GazeDirection,
} from "@/interviewer/lib/detection-types";

/**
 * On-device interview detection engine.
 *
 * Core detectors:
 * - FaceLandmarker: face count, gaze, blink, expression
 * - PoseLandmarker: posture, movement, hand position
 * - ObjectDetector: phone / second-screen style objects
 * - Web Audio: candidate voice vs speech-shaped background audio
 *
 * The detectors are initialized independently. A failure in the object
 * detector must not prevent face detection from running.
 */

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";

const MODELS = {
  face:
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",

  pose:
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",

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
  audioActive?: boolean;
  audioMuted?: boolean;
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

function blend(
  categories:
    | { categoryName?: string; score: number }[]
    | undefined,
) {
  const map = new Map<string, number>();

  categories?.forEach((category) => {
    if (category.categoryName) {
      map.set(category.categoryName, category.score);
    }
  });

  return (name: string) => map.get(name) ?? 0;
}

export function useDetectionEngine({
  videoRef,
  stream,
  active,
  audioActive = active,
  audioMuted = false,
  getElapsed,
  onEvent,
}: Options) {
  const [signals, setSignals] =
    useState<DetectionSignals>(EMPTY_SIGNALS);

  const signalsRef = useRef<DetectionSignals>(EMPTY_SIGNALS);

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

  const patch = useCallback(
    (next: Partial<DetectionSignals>) => {
      signalsRef.current = {
        ...signalsRef.current,
        ...next,
      };

      setSignals(signalsRef.current);
    },
    [],
  );

  /*
   * ------------------------------------------------------------------
   * AUDIO
   * ------------------------------------------------------------------
   */

  useEffect(() => {
    if (
      audioMuted ||
      !audioActive ||
      !stream ||
      !stream.getAudioTracks().length
    ) {
      patch({
        speaking: false,
        backgroundVoice: false,
        voiceLevel: 0,
      });
      return;
    }

    let cancelled = false;
    let ctx: AudioContext | null = null;
    let raf = 0;

    const AudioCtx:
      | typeof AudioContext
      | undefined =
      window.AudioContext ??
      (
        window as unknown as {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioCtx) {
      console.warn(
        "[Vision Mentor] Web Audio is not supported by this browser.",
      );
      return;
    }

    const audioTracks = stream.getAudioTracks();

    console.info(
      "[Vision Mentor] Starting microphone monitoring.",
      {
        trackLabel: audioTracks[0]?.label,
        enabled: audioTracks[0]?.enabled,
        muted: audioTracks[0]?.muted,
      },
    );

    try {
      ctx = new AudioCtx();
    } catch (error) {
      console.error(
        "[Vision Mentor] Could not create AudioContext.",
        error,
      );
      return;
    }

    void ctx.resume().catch(() => undefined);

    let source: MediaStreamAudioSourceNode;

    try {
      source = ctx.createMediaStreamSource(stream);
    } catch (error) {
      console.error(
        "[Vision Mentor] Could not connect microphone stream to analyser.",
        error,
      );
      return;
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.25;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;

    source.connect(analyser);

    const time = new Float32Array(analyser.fftSize);
    const freq = new Float32Array(analyser.frequencyBinCount);
    const binHz = ctx.sampleRate / analyser.fftSize;

    let noiseFloor = 0.004;
    let calibrationMs = 0;
    let voicedMs = 0;
    let silentSince = Date.now();
    let pauses = 0;
    let longestPause = 0;
    let lastVoiceEvent = 0;
    let noisySince = 0;
    let lastNoiseEvent = 0;
    let last = Date.now();

    const tick = () => {
      if (cancelled) return;

      raf = window.requestAnimationFrame(tick);

      const now = Date.now();

      if (now - last < 80) {
        return;
      }

      const dt = now - last;
      last = now;

      if (ctx?.state === "suspended") {
        void ctx.resume().catch(() => undefined);
      }

      analyser.getFloatTimeDomainData(time);
      analyser.getFloatFrequencyData(freq);

      let sum = 0;

      for (let i = 0; i < time.length; i += 1) {
        sum += time[i] * time[i];
      }

      const rms = Math.sqrt(sum / time.length);

      let speechPower = 0;
      let totalPower = 0;
      let speechBins = 0;

      for (let i = 0; i < freq.length; i += 1) {
        const db = freq[i];
        const power = Math.pow(10, db / 20);
        const hz = i * binHz;

        totalPower += power;

        if (hz >= 120 && hz <= 4200) {
          speechPower += power;
          speechBins += 1;
        }
      }

      const speechRatio =
        totalPower > 0 && speechBins > 0
          ? speechPower / totalPower
          : 0;

      if (calibrationMs < 1500) {
        noiseFloor =
          noiseFloor * 0.92 + rms * 0.08;
        calibrationMs += dt;
      } else if (
        rms < Math.max(0.0025, noiseFloor * 1.25)
      ) {
        noiseFloor =
          noiseFloor * 0.985 + rms * 0.015;
      }

      const speakingThreshold = Math.max(
        0.0055,
        noiseFloor * 1.7,
      );

      const speechLike =
        speechRatio > 0.18 ||
        (rms > 0.006 && speechPower > 0.0015);

      const speaking =
        rms > speakingThreshold &&
        speechLike;

      if (speaking) {
        voicedMs += dt;

        const gap = now - silentSince;

        if (gap > 1500) {
          pauses += 1;
          longestPause = Math.max(
            longestPause,
            Math.round(gap / 1000),
          );
        }

        silentSince = now;
      }

      const backgroundVoice =
        !speaking &&
        rms > Math.max(0.006, noiseFloor * 1.25) &&
        speechRatio > 0.16 &&
        rms / Math.max(0.003, noiseFloor) >= 2.45;

      if (
        backgroundVoice &&
        now - lastVoiceEvent > 10_000
      ) {
        lastVoiceEvent = now;

        accumRef.current.backgroundVoiceEvents += 1;

        eventRef.current?.({
          kind: "background_voice",
          detail:
            "Speech-shaped background audio was detected while the candidate was not speaking.",
          confidence: clamp(
            Math.round(
              speechRatio * 100 +
                Math.min(35, rms * 1800),
            ),
          ),
        });
      }

      const ambientRatio =
        rms / Math.max(0.003, noiseFloor);

      const noiseLevel = clamp(
        Math.round((ambientRatio - 1) * 38),
      );

      if (noiseLevel >= 55 && !speaking) {
        noisySince ||= now;
        if (now - noisySince >= 1200 && now - lastNoiseEvent >= 10_000) {
          lastNoiseEvent = now;
          eventRef.current?.({
            kind: "background_noise",
            detail: "Sustained loud background noise was detected while you were not speaking.",
            confidence: noiseLevel,
          });
        }
      } else {
        noisySince = 0;
      }

      const voiceLevel = clamp(
        Math.round(rms * 1600),
      );

      const minutes = Math.max(
        0.25,
        (now - accumRef.current.startedAt) /
          60_000,
      );

      patch({
        noiseLevel,
        voiceLevel,
        speaking,
        backgroundVoice,
        pauses,
        longestPause,
        speechPace: Math.round(
          (voicedMs / 1000 / minutes) * 2.6,
        ),
      });
    };

    raf = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      void ctx?.close();
    };
  }, [
    audioActive,
    audioMuted,
    stream,
    patch,
  ]);

  /*
   * ------------------------------------------------------------------
   * VISION
   * ------------------------------------------------------------------
   */

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    let raf = 0;

    type VideoDetector = {
      detectForVideo: (
        video: HTMLVideoElement,
        timestamp: number,
      ) => unknown;

      close: () => void;
    };

    let faceLandmarker:
      | VideoDetector
      | null = null;

    let poseLandmarker:
      | VideoDetector
      | null = null;

    let objectDetector:
      | VideoDetector
      | null = null;

    let lastFace = 0;
    let lastObject = 0;
    let lastStamp = -1;

    let blinkClosed = false;

    let prevPose:
      | { x: number; y: number }[]
      | null = null;

    const lastEvent =
      new Map<DetectionEventKind, number>();

    let awayStreak = 0;
    let missingStreak = 0;
    let multiFaceStreak = 0;
    let gestureStreak = 0;

    const fire = (
      kind: DetectionEventKind,
      detail: string,
      confidence: number,
      throttle = 30_000,
    ) => {
      const now = Date.now();

      const previous = lastEvent.get(kind);

      if (
        previous &&
        now - previous < throttle
      ) {
        return;
      }

      lastEvent.set(kind, now);

      eventRef.current?.({
        kind,
        detail,
        confidence,
      });
    };

    async function createFace(
      vision: typeof import("@mediapipe/tasks-vision"),
      fileset: Awaited<
        ReturnType<
          typeof vision.FilesetResolver.forVisionTasks
        >
      >,
    ) {
      try {
        return (await vision.FaceLandmarker.createFromOptions(
          fileset,
          {
            baseOptions: {
              modelAssetPath: MODELS.face,
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numFaces: 3,
            outputFaceBlendshapes: true,
          },
        )) as unknown as VideoDetector;
      } catch (gpuError) {
        console.warn(
          "[Vision Mentor] Face GPU initialization failed. Retrying CPU.",
          gpuError,
        );

        try {
          return (await vision.FaceLandmarker.createFromOptions(
            fileset,
            {
              baseOptions: {
                modelAssetPath: MODELS.face,
                delegate: "CPU",
              },
              runningMode: "VIDEO",
              numFaces: 3,
              outputFaceBlendshapes: true,
            },
          )) as unknown as VideoDetector;
        } catch (cpuError) {
          console.error(
            "[Vision Mentor] Face detector failed on GPU and CPU.",
            cpuError,
          );

          return null;
        }
      }
    }

    async function createPose(
      vision: typeof import("@mediapipe/tasks-vision"),
      fileset: Awaited<
        ReturnType<
          typeof vision.FilesetResolver.forVisionTasks
        >
      >,
    ) {
      try {
        return (await vision.PoseLandmarker.createFromOptions(
          fileset,
          {
            baseOptions: {
              modelAssetPath: MODELS.pose,
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
          },
        )) as unknown as VideoDetector;
      } catch (gpuError) {
        console.warn(
          "[Vision Mentor] Pose GPU initialization failed. Retrying CPU.",
          gpuError,
        );

        try {
          return (await vision.PoseLandmarker.createFromOptions(
            fileset,
            {
              baseOptions: {
                modelAssetPath: MODELS.pose,
                delegate: "CPU",
              },
              runningMode: "VIDEO",
              numPoses: 1,
            },
          )) as unknown as VideoDetector;
        } catch (cpuError) {
          console.error(
            "[Vision Mentor] Pose detector failed on GPU and CPU.",
            cpuError,
          );

          return null;
        }
      }
    }

    async function createObjectDetector(
      vision: typeof import("@mediapipe/tasks-vision"),
      fileset: Awaited<
        ReturnType<
          typeof vision.FilesetResolver.forVisionTasks
        >
      >,
    ) {
      try {
        return (await vision.ObjectDetector.createFromOptions(
          fileset,
          {
            baseOptions: {
              modelAssetPath: MODELS.object,
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            scoreThreshold: 0.42,
            maxResults: 6,
          },
        )) as unknown as VideoDetector;
      } catch (gpuError) {
        console.warn(
          "[Vision Mentor] Object detector GPU initialization failed. Retrying CPU.",
          gpuError,
        );

        try {
          return (await vision.ObjectDetector.createFromOptions(
            fileset,
            {
              baseOptions: {
                modelAssetPath: MODELS.object,
                delegate: "CPU",
              },
              runningMode: "VIDEO",
              scoreThreshold: 0.42,
              maxResults: 6,
            },
          )) as unknown as VideoDetector;
        } catch (cpuError) {
          console.error(
            "[Vision Mentor] Object detector failed on GPU and CPU.",
            cpuError,
          );

          return null;
        }
      }
    }

    async function boot() {
      try {
        console.info(
          "[Vision Mentor] Starting MediaPipe vision engine...",
        );

        const vision =
          await import("@mediapipe/tasks-vision");

        console.info(
          "[Vision Mentor] MediaPipe package loaded.",
        );

        const fileset =
          await vision.FilesetResolver.forVisionTasks(
            WASM_BASE,
          );

        console.info(
          "[Vision Mentor] MediaPipe WASM loaded.",
        );

        if (cancelled) {
          return;
        }

        /*
         * Face is the core detector.
         */
        faceLandmarker = await createFace(
          vision,
          fileset,
        );

        if (cancelled) {
          return;
        }

        if (faceLandmarker) {
          console.info(
            "[Vision Mentor] Face detector ready.",
          );
        } else {
          console.error(
            "[Vision Mentor] Face detector could not be initialized.",
          );
        }

        /*
         * Pose is independent. A pose failure must not disable face
         * detection.
         */
        poseLandmarker = await createPose(
          vision,
          fileset,
        );

        if (poseLandmarker) {
          console.info(
            "[Vision Mentor] Pose detector ready.",
          );
        } else {
          console.warn(
            "[Vision Mentor] Pose detector unavailable.",
          );
        }

        /*
         * Object detector is optional. Phone/second-screen detection
         * can fail without disabling face and pose monitoring.
         */
        objectDetector =
          await createObjectDetector(
            vision,
            fileset,
          );

        if (objectDetector) {
          console.info(
            "[Vision Mentor] Object detector ready.",
          );
        } else {
          console.warn(
            "[Vision Mentor] Object detector unavailable.",
          );
        }

        if (cancelled) {
          return;
        }

        /*
         * The face detector is the core requirement for the monitoring
         * engine. If it works, start the vision loop.
         */
        if (faceLandmarker) {
          patch({
            ready: true,
            degraded:
              !poseLandmarker ||
              !objectDetector,
          });

          console.info(
            "[Vision Mentor] Vision engine LIVE.",
          );

          raf =
            window.requestAnimationFrame(loop);
        } else {
          patch({
            ready: false,
            degraded: true,
          });

          console.error(
            "[Vision Mentor] Vision engine could not start because the face detector failed.",
          );
        }
      } catch (error) {
        console.error(
          "[Vision Mentor] MediaPipe boot failed.",
          error,
        );

        if (!cancelled) {
          patch({
            ready: false,
            degraded: true,
          });
        }
      }
    }

    function loop() {
      if (cancelled) {
        return;
      }

      raf = window.requestAnimationFrame(loop);

      const video = videoRef.current;

      if (
        !video ||
        video.readyState < 2 ||
        !video.videoWidth
      ) {
        return;
      }

      const now = performance.now();

      /*
       * Approximately 5 FPS.
       */
      if (now - lastFace < 200) {
        return;
      }

      lastFace = now;

      const stamp = Math.max(
        lastStamp + 1,
        Math.round(now),
      );

      lastStamp = stamp;

      try {
        /*
         * ------------------------------------------------------------
         * FACE
         * ------------------------------------------------------------
         */

        const faceResult =
          faceLandmarker?.detectForVideo(
            video,
            stamp,
          ) as
            | {
                faceLandmarks: {
                  x: number;
                  y: number;
                }[][];

                faceBlendshapes?: {
                  categories: {
                    categoryName?: string;
                    score: number;
                  }[];
                }[];
              }
            | undefined;

        const faces =
          faceResult?.faceLandmarks?.length ?? 0;

        const primary =
          faceResult?.faceLandmarks?.[0];

        const shapes = blend(
          faceResult?.faceBlendshapes?.[0]
            ?.categories,
        );

        let eyeContact =
          signalsRef.current.eyeContact;

        let gaze: GazeDirection = "unknown";

        let expression =
          signalsRef.current.expression;

        if (primary?.length) {
          const h =
            (
              shapes("eyeLookOutLeft") +
              shapes("eyeLookInRight")
            ) /
              2 -
            (
              shapes("eyeLookInLeft") +
              shapes("eyeLookOutRight")
            ) /
              2;

          const v =
            (
              shapes("eyeLookUpLeft") +
              shapes("eyeLookUpRight")
            ) /
              2 -
            (
              shapes("eyeLookDownLeft") +
              shapes("eyeLookDownRight")
            ) /
              2;

          const nose = primary[1];
          const left = primary[234];
          const right = primary[454];

          const yaw =
            left && right && nose
              ? Math.abs(
                  (nose.x -
                    (left.x + right.x) / 2) /
                    Math.max(
                      0.05,
                      Math.abs(
                        right.x - left.x,
                      ),
                    ),
                )
              : 0;

          eyeContact = clamp(
            Math.round(
              100 -
                (Math.abs(h) +
                  Math.abs(v)) *
                  150 -
                yaw * 190,
            ),
          );

          const magnitude = Math.max(
            Math.abs(h),
            Math.abs(v),
          );

          gaze =
            magnitude < 0.14 &&
            yaw < 0.12
              ? "center"
              : Math.abs(h) >=
                  Math.abs(v)
                ? h > 0
                  ? "left"
                  : "right"
                : v > 0
                  ? "up"
                  : "down";

          const closed =
            shapes("eyeBlinkLeft") > 0.5 &&
            shapes("eyeBlinkRight") > 0.5;

          if (closed && !blinkClosed) {
            accumRef.current.blinks += 1;
          }

          blinkClosed = closed;

          expression =
            shapes("mouthSmileLeft") +
              shapes("mouthSmileRight") >
            0.5
              ? "smiling"
              : shapes("browDownLeft") +
                    shapes(
                      "browDownRight",
                    ) >
                  0.7
                ? "tense"
                : shapes("jawOpen") >
                    0.35
                  ? "speaking"
                  : eyeContact > 70
                    ? "engaged"
                    : "neutral";
        }

        /*
         * Face missing.
         */
        if (faces === 0) {
          missingStreak += 1;

          if (missingStreak === 8) {
            fire(
              "face_missing",
              "Your face was not visible in the camera for several seconds.",
              90,
            );
          }
        } else {
          missingStreak = 0;
        }

        /*
         * Multiple faces.
         */
        if (faces > 1) {
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

        /*
         * Looking away.
         */
        if (
          gaze !== "center" &&
          gaze !== "unknown" &&
          faces === 1
        ) {
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

        /*
         * ------------------------------------------------------------
         * POSE
         * ------------------------------------------------------------
         */

        let posture =
          signalsRef.current.posture;

        let movement =
          signalsRef.current.movement;

        let handGesture:
          DetectionSignals["handGesture"] =
          "none";

        const poseResult =
          poseLandmarker?.detectForVideo(
            video,
            stamp,
          ) as
            | {
                landmarks: {
                  x: number;
                  y: number;
                }[][];
              }
            | undefined;

        const pose =
          poseResult?.landmarks?.[0];

        if (pose?.length) {
          const ls = pose[11];
          const rs = pose[12];
          const le = pose[7];
          const re = pose[8];

          if (ls && rs) {
            const tilt =
              Math.abs(ls.y - rs.y) *
              400;

            const shoulderMid =
              (ls.y + rs.y) / 2;

            const earMid =
              le && re
                ? (le.y + re.y) / 2
                : shoulderMid - 0.18;

            const neck = clamp(
              (shoulderMid - earMid) *
                520,
              0,
              100,
            );

            posture = clamp(
              Math.round(
                100 -
                  tilt -
                  Math.max(
                    0,
                    55 - neck,
                  ),
              ),
            );
          }

          if (prevPose) {
            let delta = 0;

            for (
              let i = 0;
              i <
              Math.min(
                pose.length,
                prevPose.length,
              );
              i += 1
            ) {
              delta +=
                Math.abs(
                  pose[i].x -
                    prevPose[i].x,
                ) +
                Math.abs(
                  pose[i].y -
                    prevPose[i].y,
                );
            }

            movement = clamp(
              Math.round(
                (delta / pose.length) *
                  2600,
              ),
            );

            if (movement > 78) {
              fire(
                "unusual_movement",
                "A lot of movement away from the camera was detected.",
                movement,
                60_000,
              );
            }
          }

          const leftWrist = pose[15];
          const rightWrist = pose[16];

          const leftShoulder = pose[11];
          const rightShoulder = pose[12];

          const wristsVisible = [
            leftWrist,
            rightWrist,
          ].filter(Boolean).length;

          const raisedHands =
            (leftWrist &&
            leftShoulder &&
            leftWrist.y <
              leftShoulder.y - 0.08
              ? 1
              : 0) +
            (rightWrist &&
            rightShoulder &&
            rightWrist.y <
              rightShoulder.y - 0.08
              ? 1
              : 0);

          if (raisedHands > 0) {
            handGesture = "raised";
          } else if (
            wristsVisible > 0 &&
            movement > 58
          ) {
            handGesture = "active";
          }

          if (handGesture !== "none") {
            gestureStreak += 1;

            if (gestureStreak === 8) {
              accumRef.current.handGestureEvents +=
                1;

              fire(
                "hand_gesture",
                handGesture === "raised"
                  ? "A raised hand gesture was visible. Keep gestures within the camera frame."
                  : "Active hand movement was visible. Keep gestures deliberate and within the camera frame.",
                handGesture ===
                "raised"
                  ? 82
                  : 68,
                20_000,
              );
            }
          } else {
            gestureStreak = 0;
          }

          prevPose = pose.map(
            (point) => ({
              x: point.x,
              y: point.y,
            }),
          );
        }

        /*
         * ------------------------------------------------------------
         * OBJECTS
         * ------------------------------------------------------------
         */

        let devices =
          signalsRef.current.devices;

        if (
          objectDetector &&
          now - lastObject > 500
        ) {
          lastObject = now;

          const objectResult =
            objectDetector.detectForVideo(
              video,
              stamp,
            ) as
              | {
                  detections: {
                    categories: {
                      categoryName?: string;
                      score: number;
                    }[];
                  }[];
                }
              | undefined;

          const found: {
            label: string;
            score: number;
          }[] = [];

          objectResult?.detections?.forEach(
            (detection) => {
              const top =
                detection.categories?.[0];

              if (!top) {
                return;
              }

              const rawLabel =
                top.categoryName
                  ?.trim()
                  .toLowerCase();

              if (!rawLabel) {
                return;
              }

              const label =
                rawLabel === "cell phone" ||
                rawLabel === "mobile phone"
                  ? "phone"
                  : rawLabel;

              const score = Math.round(
                top.score * 100,
              );

              const isPhone =
                label === "phone" ||
                label.includes("cell phone") ||
                label.includes("mobile");

              const isSecondScreen =
                label === "laptop" ||
                label === "monitor" ||
                label === "tv" ||
                label === "screen";

              if (
                isPhone ||
                isSecondScreen ||
                BANNED_OBJECTS.has(rawLabel)
              ) {
                found.push({
                  label,
                  score,
                });
              }
            },
          );

          devices = found;

          if (found.length) {
            const best = found.reduce(
              (current, candidate) =>
                candidate.score >
                current.score
                  ? candidate
                  : current,
            );

            fire(
              "device_visible",
              best.label === "phone"
                ? `A phone was detected in the camera frame (${best.score}% confidence).`
                : `A possible second-screen/device object (${best.label}) was detected in the camera frame (${best.score}% confidence).`,
              best.score,
              10_000,
            );
          }
        }

        /*
         * ------------------------------------------------------------
         * AGGREGATE SIGNALS
         * ------------------------------------------------------------
         */

        const attention = clamp(
          Math.round(
            100 - movement * 0.8,
          ),
        );

        const confidence = clamp(
          Math.round(
            eyeContact * 0.4 +
              posture * 0.3 +
              attention * 0.2 +
              (expression ===
              "smiling"
                ? 10
                : 6),
          ),
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
              Math.max(
                0.5,
                (Date.now() -
                  accumRef.current
                    .startedAt) /
                  60_000,
              ),
          ),
        });

        /*
         * ------------------------------------------------------------
         * ONE-SECOND REPORT SAMPLE
         * ------------------------------------------------------------
         */

        const a = accumRef.current;

        const t = elapsedRef.current();

        const lastSample =
          a.samples[a.samples.length - 1];

        if (
          !lastSample ||
          t > lastSample.t
        ) {
          a.samples.push({
            t,
            eyeContact,
            posture,
            attention,
            confidence,
            noise:
              signalsRef.current
                .noiseLevel,
            voice:
              signalsRef.current
                .voiceLevel,
            faces,
            emotion: expression,
          });

          if (a.samples.length > 3600) {
            a.samples.shift();
          }

          a.eye += eyeContact;
          a.posture += posture;
          a.confidence += confidence;
          a.noise +=
            signalsRef.current
              .noiseLevel;

          a.count += 1;

          if (
            signalsRef.current
              .noiseLevel > 40
          ) {
            a.noisySeconds += 1;
          }

          if (faces > 1) {
            a.multiFaceSeconds += 1;
          }

          if (faces === 0) {
            a.faceMissingSeconds += 1;
          }

          if (handGesture !== "none") {
            a.handGestureSeconds += 1;
          }

          if (devices.length) {
            a.deviceSeconds += 1;
          }

          a.emotions.set(
            expression,
            (a.emotions.get(
              expression,
            ) ?? 0) + 1,
          );
        }
      } catch (error) {
        /*
         * A bad frame must never kill the entire monitoring loop.
         */
        console.warn(
          "[Vision Mentor] Detection frame failed.",
          error,
        );
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

  /*
   * ------------------------------------------------------------------
   * SUMMARY
   * ------------------------------------------------------------------
   */

  const summarize = useCallback(
    (): DetectionSummary => {
      const a = accumRef.current;

      const n = Math.max(
        1,
        a.count,
      );

      let dominant = "neutral";
      let best = 0;

      a.emotions.forEach(
        (count: number, emotion: string) => {
          if (count > best) {
            best = count;
            dominant = emotion;
          }
        },
      );

      const s = signalsRef.current;

      return {
        samples: a.samples.slice(-1800),

        avgEyeContact: Math.round(
          a.eye / n,
        ),

        avgPosture: Math.round(
          a.posture / n,
        ),

        avgConfidence: Math.round(
          a.confidence / n,
        ),

        avgNoise: Math.round(
          a.noise / n,
        ),

        blinkRate: s.blinkRate,

        noisySeconds:
          a.noisySeconds,

        multiFaceSeconds:
          a.multiFaceSeconds,

        faceMissingSeconds:
          a.faceMissingSeconds,

        handGestureSeconds:
          a.handGestureSeconds,

        handGestureEvents:
          a.handGestureEvents,

        deviceSeconds:
          a.deviceSeconds,

        backgroundVoiceEvents:
          a.backgroundVoiceEvents,

        multiFaceEvents:
          a.multiFaceEvents,

        pauses: s.pauses,

        longestPause:
          s.longestPause,

        speechPace:
          s.speechPace,

        dominantEmotion:
          dominant,

        onDevice:
          a.count > 0 &&
          !s.degraded,
      };
    },
    [],
  );

  return {
    signals,
    summarize,
  };
}