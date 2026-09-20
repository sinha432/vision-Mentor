import type {
  FaceLandmarker,
  ObjectDetector,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";

import {
  setVisionStatus,
  resetVisionStatus,
  type Level,
} from "./vision-status";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const OBJECT_MODEL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite";

// -----------------------------------------------------------------------------
// FACE MESH INDICES
// -----------------------------------------------------------------------------

const LEFT_IRIS = 468;
const RIGHT_IRIS = 473;

const LEFT_EYE_L = 33;
const LEFT_EYE_R = 133;

const RIGHT_EYE_L = 362;
const RIGHT_EYE_R = 263;

// -----------------------------------------------------------------------------
// EYE CONTACT
// -----------------------------------------------------------------------------

function evalEye(
  lm: Array<{ x: number; y: number }>,
): { text: string; level: Level } {
  const li = lm[LEFT_IRIS];
  const ri = lm[RIGHT_IRIS];

  const le1 = lm[LEFT_EYE_L];
  const le2 = lm[LEFT_EYE_R];

  const re1 = lm[RIGHT_EYE_L];
  const re2 = lm[RIGHT_EYE_R];

  if (!li || !ri || !le1 || !le2 || !re1 || !re2) {
    return {
      text: "No Face Detected",
      level: "bad",
    };
  }

  const leftWidth = Math.abs(le2.x - le1.x);
  const rightWidth = Math.abs(re2.x - re1.x);

  if (leftWidth < 0.001 || rightWidth < 0.001) {
    return {
      text: "No Face Detected",
      level: "bad",
    };
  }

  const leftRatio =
    (li.x - Math.min(le1.x, le2.x)) / leftWidth;

  const rightRatio =
    (ri.x - Math.min(re1.x, re2.x)) / rightWidth;

  const avg = (leftRatio + rightRatio) / 2;

  if (avg > 0.35 && avg < 0.65) {
    return {
      text: "Good — Looking at Camera",
      level: "good",
    };
  }

  if (avg > 0.2 && avg < 0.8) {
    return {
      text: "Partial — Slight Gaze Shift",
      level: "warn",
    };
  }

  return {
    text: "Poor — Looking Away",
    level: "bad",
  };
}

// -----------------------------------------------------------------------------
// POSTURE
// -----------------------------------------------------------------------------

function evalPosture(
  lm: Array<{ x: number; y: number }>,
): { text: string; level: Level } {
  const leftShoulder = lm[11];
  const rightShoulder = lm[12];
  const nose = lm[0];

  if (!leftShoulder || !rightShoulder || !nose) {
    return {
      text: "No Pose Detected",
      level: "bad",
    };
  }

  const shoulderDiff = Math.abs(
    leftShoulder.y - rightShoulder.y,
  );

  const midX =
    (leftShoulder.x + rightShoulder.x) / 2;

  const headOffset =
    Math.abs(nose.x - midX);

  const shoulderWidth =
    Math.abs(
      leftShoulder.x - rightShoulder.x,
    );

  const slouch =
    nose.y -
    Math.min(
      leftShoulder.y,
      rightShoulder.y,
    );

  if (shoulderWidth < 0.14) {
    return {
      text: "Too Far From Camera",
      level: "warn",
    };
  }

  if (shoulderWidth > 0.62) {
    return {
      text: "Too Close To Camera",
      level: "warn",
    };
  }

  if (slouch > -0.02) {
    return {
      text: "Slouching / Head Low",
      level: "warn",
    };
  }

  if (shoulderDiff > 0.05) {
    return {
      text: "Uneven Shoulders / Leaning",
      level: "warn",
    };
  }

  if (headOffset > 0.08) {
    return {
      text: "Head Off-Center",
      level: "warn",
    };
  }

  return {
    text: "Upright / Good",
    level: "good",
  };
}

// -----------------------------------------------------------------------------
// HANDS
// -----------------------------------------------------------------------------

function evalHand(
  lm: Array<{
    x: number;
    y: number;
    visibility?: number;
  }>,
  wristIndex: number,
  shoulderIndex: number,
): { text: string; level: Level } {
  const wrist = lm[wristIndex];
  const shoulder = lm[shoulderIndex];

  if (
    !wrist ||
    !shoulder ||
    (wrist.visibility ?? 1) < 0.45
  ) {
    return {
      text: "Not visible",
      level: "idle",
    };
  }

  if (wrist.y < shoulder.y - 0.04) {
    return {
      text: "Raised",
      level: "good",
    };
  }

  return {
    text: "Down",
    level: "idle",
  };
}

// -----------------------------------------------------------------------------
// GROOMING
// -----------------------------------------------------------------------------

function evalGrooming(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): { text: string; level: Level } {
  const ctx = canvas.getContext(
    "2d",
    {
      willReadFrequently: true,
    },
  );

  if (!ctx || !video.videoWidth) {
    return {
      text: "Waiting…",
      level: "idle",
    };
  }

  const width = 48;
  const height = 27;

  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(
    video,
    0,
    video.videoHeight * 0.62,
    video.videoWidth,
    video.videoHeight * 0.38,
    0,
    0,
    width,
    height,
  );

  const { data } = ctx.getImageData(
    0,
    0,
    width,
    height,
  );

  let sum = 0;
  let sumSq = 0;

  const total = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const luminance =
      0.299 * data[i]! +
      0.587 * data[i + 1]! +
      0.114 * data[i + 2]!;

    sum += luminance;
    sumSq += luminance * luminance;
  }

  const mean = sum / total;

  const variance = Math.max(
    0,
    sumSq / total - mean * mean,
  );

  const standardDeviation =
    Math.sqrt(variance);

  if (mean < 26) {
    return {
      text: "Too dark to assess attire",
      level: "warn",
    };
  }

  if (standardDeviation > 62) {
    return {
      text: "Busy / informal pattern detected",
      level: "warn",
    };
  }

  return {
    text: "Presentable / formal",
    level: "good",
  };
}

// -----------------------------------------------------------------------------
// VISION DETECTOR
// -----------------------------------------------------------------------------

export class VisionDetector {
  private face: FaceLandmarker | null = null;
  private pose: PoseLandmarker | null = null;
  private objects: ObjectDetector | null = null;

  private raf: number | null = null;

  private running = false;
  private initializing = false;

  private video: HTMLVideoElement | null = null;

  private canvas =
    typeof document !== "undefined"
      ? document.createElement("canvas")
      : null;

  // ---------------------------------------------------------------------------
  // DETECTOR TIMING
  //
  // Face       = ~5 FPS
  // Pose       = ~4 FPS
  // Objects    = ~3 FPS
  // Grooming   = ~1 FPS
  // UI         = ~2 FPS
  //
  // Object detection is faster now so phone detection reacts quickly,
  // but we don't run it every animation frame because that would cause lag.
  // ---------------------------------------------------------------------------

  private lastFace = 0;
  private lastPose = 0;
  private lastObjects = 0;
  private lastGrooming = 0;
  private lastEmit = 0;

  // ---------------------------------------------------------------------------
  // CACHED RESULTS
  // ---------------------------------------------------------------------------

  private lastFaceResult: any = null;
  private lastPoseResult: any = null;

  // ---------------------------------------------------------------------------
  // PEOPLE
  // ---------------------------------------------------------------------------

  private peopleDetected = 0;

  // ---------------------------------------------------------------------------
  // PHONE
  // ---------------------------------------------------------------------------

  private phoneDetected = false;

  private phoneMisses = 0;

  // ---------------------------------------------------------------------------
  // START
  // ---------------------------------------------------------------------------

  async start(video: HTMLVideoElement) {
    if (
      this.running ||
      this.initializing
    ) {
      return;
    }

    this.initializing = true;
    this.video = video;

    try {
      const vision =
        await import("@mediapipe/tasks-vision");

      if (!this.video) {
        this.initializing = false;
        return;
      }

      const fileset =
        await vision.FilesetResolver.forVisionTasks(
          WASM_BASE,
        );

      // -----------------------------------------------------------------------
      // FACE
      // -----------------------------------------------------------------------

      this.face =
        await vision.FaceLandmarker.createFromOptions(
          fileset,
          {
            baseOptions: {
              modelAssetPath: FACE_MODEL,
              delegate: "GPU",
            },

            runningMode: "VIDEO",

            // Individual mode only needs to identify the candidate and any
            // additional person in frame. Avoiding ten-face inference keeps
            // the main thread responsive.
            numFaces: 2,

            minFaceDetectionConfidence: 0.45,
            minFacePresenceConfidence: 0.45,
            minTrackingConfidence: 0.45,

            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
          },
        );

      // -----------------------------------------------------------------------
      // POSE
      // -----------------------------------------------------------------------

      this.pose =
        await vision.PoseLandmarker.createFromOptions(
          fileset,
          {
            baseOptions: {
              modelAssetPath: POSE_MODEL,
              delegate: "GPU",
            },

            runningMode: "VIDEO",

            numPoses: 1,
          },
        );

      // -----------------------------------------------------------------------
      // OBJECT DETECTOR
      //
      // IMPORTANT:
      //
      // Global threshold is lowered from 0.45 to 0.30.
      //
      // Why?
      //
      // If MediaPipe discards a phone at 0.35 before returning it,
      // our phone-specific code can never see that phone.
      //
      // We still require >= 0.45 for a phone below, so random objects
      // are not immediately treated as phones.
      // -----------------------------------------------------------------------

      try {
        this.objects =
          await vision.ObjectDetector.createFromOptions(
            fileset,
            {
              baseOptions: {
                modelAssetPath: OBJECT_MODEL,
                delegate: "GPU",
              },

              runningMode: "VIDEO",

              scoreThreshold: 0.30,

              maxResults: 5,
            },
          );
      } catch (error) {
        console.warn(
          "Object detector unavailable:",
          error,
        );

        this.objects = null;
      }

      this.running = true;
      this.initializing = false;

      this.loop();
    } catch (error) {
      console.warn(
        "VisionDetector init failed",
        error,
      );

      this.running = false;
      this.initializing = false;
    }
  }

  // ---------------------------------------------------------------------------
  // MAIN LOOP
  // ---------------------------------------------------------------------------

  private loop = () => {
    if (
      !this.running ||
      !this.video ||
      !this.face ||
      !this.pose
    ) {
      return;
    }

    const video = this.video;

    if (
      video.readyState >= 2 &&
      video.videoWidth > 0 &&
      !video.paused
    ) {
      const now = performance.now();

      try {
        // ---------------------------------------------------------------------
        // FACE
        // ---------------------------------------------------------------------

        if (
          now - this.lastFace >= 200
        ) {
          this.lastFace = now;

          this.lastFaceResult =
            this.face.detectForVideo(
              video,
              now,
            );
        }

        // ---------------------------------------------------------------------
        // POSE
        // ---------------------------------------------------------------------

        if (
          now - this.lastPose >= 250
        ) {
          this.lastPose = now;

          this.lastPoseResult =
            this.pose.detectForVideo(
              video,
              now,
            );
        }

        // ---------------------------------------------------------------------
        // OBJECT / PERSON / PHONE
        //
        // 200 ms = approximately 5 FPS.
        //
        // This is the important phone-detection improvement.
        // ---------------------------------------------------------------------

        if (
          this.objects &&
          now - this.lastObjects >= 350
        ) {
          this.lastObjects = now;

          const result =
            this.objects.detectForVideo(
              video,
              now,
            );

          const detections =
            result.detections ?? [];

          // -------------------------------------------------------------------
          // PERSON COUNT
          // -------------------------------------------------------------------

          let personCount = 0;

          for (
            const detection of detections
          ) {
            const category =
              detection.categories?.[0];

            const name =
              category?.categoryName
                ?.toLowerCase()
                .trim() ?? "";

            const score =
              category?.score ?? 0;

            if (
              name === "person" &&
              score >= 0.40
            ) {
              personCount += 1;
            }
          }

          const faceCount =
            this.lastFaceResult
              ?.faceLandmarks
              ?.length ?? 0;

          this.peopleDetected =
            Math.max(
              personCount,
              faceCount,
            );

          // -------------------------------------------------------------------
          // PHONE DETECTION
          // -------------------------------------------------------------------

          let detectedPhone = false;

          for (
            const detection of detections
          ) {
            const category =
              detection.categories?.[0];

            const name =
              category?.categoryName
                ?.toLowerCase()
                .trim() ?? "";

            const score =
              category?.score ?? 0;

            /*
             * Only accept actual phone classes.
             *
             * DO NOT include:
             * remote
             * laptop
             * bottle
             * cup
             * etc.
             */
            const isPhone =
              name === "cell phone" ||
              name === "mobile phone" ||
              name === "phone";

            /*
             * 0.45 is deliberately lower than the
             * old 0.65 threshold.
             *
             * The global detector threshold is 0.30,
             * so phone detections between 0.30 and 0.45
             * are available but are not strong enough
             * to trigger the warning.
             */
            if (
              isPhone &&
              score >= 0.45
            ) {
              detectedPhone = true;
              break;
            }
          }

          // -------------------------------------------------------------------
          // PHONE STABILITY
          // -------------------------------------------------------------------

          if (detectedPhone) {
            /*
             * Immediate detection.
             *
             * As soon as MediaPipe sees a phone
             * above the threshold, the status becomes true.
             */
            this.phoneDetected = true;

            this.phoneMisses = 0;
          } else {
            /*
             * Don't instantly remove the warning because
             * one frame may miss the phone.
             */
            this.phoneMisses += 1;

            /*
             * 2 misses at 200 ms each ≈ 400 ms.
             *
             * This prevents flicker while still
             * clearing the warning quickly.
             */
            if (
              this.phoneMisses >= 2
            ) {
              this.phoneDetected = false;
            }
          }
        }

        // ---------------------------------------------------------------------
        // UI STATUS
        // ---------------------------------------------------------------------

        if (
          now - this.lastEmit >= 500
        ) {
          this.lastEmit = now;

          const faceLandmarks =
            this.lastFaceResult
              ?.faceLandmarks ?? [];

          const poseLandmarks =
            this.lastPoseResult
              ?.landmarks ?? [];

          const face =
            faceLandmarks[0];

          const pose =
            poseLandmarks[0];

          const eye = face
            ? evalEye(face)
            : {
                text: "No Face Detected",
                level: "bad" as Level,
              };

          const posture = pose
            ? evalPosture(pose)
            : {
                text: "No Pose Detected",
                level: "bad" as Level,
              };

          // -------------------------------------------------------------------
          // GROOMING
          // -------------------------------------------------------------------

          let grooming:
            | {
                text: string;
                level: Level;
              }
            | undefined;

          if (
            this.canvas &&
            now - this.lastGrooming >= 1000
          ) {
            this.lastGrooming = now;

            grooming =
              evalGrooming(
                video,
                this.canvas,
              );
          }

          // -------------------------------------------------------------------
          // FINAL STATUS
          // -------------------------------------------------------------------

          const update:
            Parameters<
              typeof setVisionStatus
            >[0] = {
            people:
              this.peopleDetected,

            phone:
              this.phoneDetected,

            eye,

            posture,

            ...(grooming
              ? { grooming }
              : {}),

            // MediaPipe anatomical indices:
            //
            // 15 = left wrist
            // 11 = left shoulder
            //
            // 16 = right wrist
            // 12 = right shoulder

            leftHand: pose
              ? evalHand(
                  pose,
                  15,
                  11,
                )
              : {
                  text: "Not visible",
                  level: "idle" as Level,
                },

            rightHand: pose
              ? evalHand(
                  pose,
                  16,
                  12,
                )
              : {
                  text: "Not visible",
                  level: "idle" as Level,
                },
          };

          setVisionStatus(update);
        }
      } catch (error) {
        /*
         * Never let one bad frame
         * stop the camera system.
         */
        console.debug(
          "Vision frame skipped",
          error,
        );
      }
    }

    // -------------------------------------------------------------------------
    // NEXT FRAME
    // -------------------------------------------------------------------------

    this.raf =
      requestAnimationFrame(
        this.loop,
      );
  };

  // ---------------------------------------------------------------------------
  // STOP
  // ---------------------------------------------------------------------------

  stop() {
    this.running = false;
    this.initializing = false;

    if (
      this.raf !== null
    ) {
      cancelAnimationFrame(
        this.raf,
      );
    }

    this.raf = null;

    try {
      this.face?.close();
    } catch {
      // ignore
    }

    try {
      this.pose?.close();
    } catch {
      // ignore
    }

    try {
      this.objects?.close();
    } catch {
      // ignore
    }

    this.face = null;
    this.pose = null;
    this.objects = null;

    this.video = null;

    this.lastFaceResult = null;
    this.lastPoseResult = null;

    this.peopleDetected = 0;

    this.phoneDetected = false;
    this.phoneMisses = 0;

    this.lastFace = 0;
    this.lastPose = 0;
    this.lastObjects = 0;
    this.lastGrooming = 0;
    this.lastEmit = 0;

    resetVisionStatus();
  }
}