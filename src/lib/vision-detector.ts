import type {
  FaceLandmarker,
  ObjectDetector,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import { setVisionStatus, resetVisionStatus, type Level } from "./vision-status";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const OBJECT_MODEL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite";

const LEFT_IRIS = 468;
const RIGHT_IRIS = 473;
const LEFT_EYE_L = 33;
const LEFT_EYE_R = 133;
const RIGHT_EYE_L = 362;
const RIGHT_EYE_R = 263;

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
    return { text: "No Face Detected", level: "bad" };
  }

  const leftWidth = Math.abs(le2.x - le1.x);
  const rightWidth = Math.abs(re2.x - re1.x);

  if (leftWidth < 0.001 || rightWidth < 0.001) {
    return { text: "No Face Detected", level: "bad" };
  }

  const leftRatio =
    (li.x - Math.min(le1.x, le2.x)) / leftWidth;

  const rightRatio =
    (ri.x - Math.min(re1.x, re2.x)) / rightWidth;

  const avg = (leftRatio + rightRatio) / 2;

  if (avg > 0.35 && avg < 0.65) {
    return { text: "Good — Looking at Camera", level: "good" };
  }

  if (avg > 0.2 && avg < 0.8) {
    return { text: "Partial — Slight Gaze Shift", level: "warn" };
  }

  return { text: "Poor — Looking Away", level: "bad" };
}

function evalPosture(
  lm: Array<{ x: number; y: number }>,
): { text: string; level: Level } {
  const LS = lm[11];
  const RS = lm[12];
  const NOSE = lm[0];

  if (!LS || !RS || !NOSE) {
    return { text: "No Pose Detected", level: "bad" };
  }

  const shoulderDiff = Math.abs(LS.y - RS.y);
  const midX = (LS.x + RS.x) / 2;
  const headOffset = Math.abs(NOSE.x - midX);
  const shoulderWidth = Math.abs(LS.x - RS.x);
  const slouch = NOSE.y - Math.min(LS.y, RS.y);

  if (shoulderWidth < 0.14) {
    return { text: "Too Far From Camera", level: "warn" };
  }

  if (shoulderWidth > 0.62) {
    return { text: "Too Close To Camera", level: "warn" };
  }

  if (slouch > -0.02) {
    return { text: "Slouching / Head Low", level: "warn" };
  }

  if (shoulderDiff > 0.05) {
    return { text: "Uneven Shoulders / Leaning", level: "warn" };
  }

  if (headOffset > 0.08) {
    return { text: "Head Off-Center", level: "warn" };
  }

  return { text: "Upright / Good", level: "good" };
}

function evalHand(
  lm: Array<{ x: number; y: number; visibility?: number }>,
  wristIndex: number,
  shoulderIndex: number,
): { text: string; level: Level } {
  const wrist = lm[wristIndex];
  const shoulder = lm[shoulderIndex];

  if (!wrist || !shoulder || (wrist.visibility ?? 1) < 0.45) {
    return { text: "Not visible", level: "idle" };
  }

  if (wrist.y < shoulder.y - 0.04) {
    return { text: "Raised", level: "good" };
  }

  return { text: "Down", level: "idle" };
}

function evalGrooming(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): { text: string; level: Level } {
  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!ctx || !video.videoWidth) {
    return { text: "Waiting…", level: "idle" };
  }

  const w = 48;
  const h = 27;

  canvas.width = w;
  canvas.height = h;

  ctx.drawImage(
    video,
    0,
    video.videoHeight * 0.62,
    video.videoWidth,
    video.videoHeight * 0.38,
    0,
    0,
    w,
    h,
  );

  const { data } = ctx.getImageData(0, 0, w, h);

  let sum = 0;
  let sumSq = 0;
  const n = w * h;

  for (let i = 0; i < data.length; i += 4) {
    const lum =
      0.299 * data[i]! +
      0.587 * data[i + 1]! +
      0.114 * data[i + 2]!;

    sum += lum;
    sumSq += lum * lum;
  }

  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  const sd = Math.sqrt(variance);

  if (mean < 26) {
    return {
      text: "Too dark to assess attire",
      level: "warn",
    };
  }

  if (sd > 62) {
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

  // Detector schedules.
  private lastFace = 0;
  private lastPose = 0;
  private lastObjects = 0;
  private lastGrooming = 0;
  private lastEmit = 0;

  // Cached detection results.
  private lastFaceResult: any = null;
  private lastPoseResult: any = null;

  // Keep phone status stable between object-detector samples.
  private phoneDetected = false;
  private phoneMisses = 0;

  async start(video: HTMLVideoElement) {
    if (this.running || this.initializing) return;

    this.initializing = true;
    this.video = video;

    try {
      const vision = await import("@mediapipe/tasks-vision");

      if (!this.video) return;

      const fileset =
        await vision.FilesetResolver.forVisionTasks(WASM_BASE);

      this.face =
        await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: FACE_MODEL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 2,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });

      this.pose =
        await vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: POSE_MODEL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });

      // Object detection is the most expensive part.
      // Keep it optional so camera startup does not fail if it cannot load.
      try {
        this.objects =
          await vision.ObjectDetector.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: OBJECT_MODEL,
              delegate: "GPU",
            },
            runningMode: "VIDEO",

            // Higher threshold reduces false positives such as
            // cups, glasses and random rectangular objects.
            scoreThreshold: 0.60,

            maxResults: 3,
          });
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
      console.warn("VisionDetector init failed", error);

      this.running = false;
      this.initializing = false;
    }
  }

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

    // Keep requestAnimationFrame lightweight.
    // The actual AI inference is throttled below.
    if (
      video.readyState >= 2 &&
      video.videoWidth > 0 &&
      !video.paused
    ) {
      const now = performance.now();

      try {
        /*
         * FACE
         *
         * ~8 FPS.
         * Face/gaze is useful frequently, but doesn't need 30 FPS.
         */
        if (now - this.lastFace >= 125) {
          this.lastFace = now;

          this.lastFaceResult =
            this.face.detectForVideo(video, now);
        }

        /*
         * POSE
         *
         * ~5 FPS.
         * This substantially reduces CPU/GPU pressure.
         */
        if (now - this.lastPose >= 200) {
          this.lastPose = now;

          this.lastPoseResult =
            this.pose.detectForVideo(video, now);
        }

        /*
         * PHONE DETECTION
         *
         * ~2 FPS.
         *
         * This is deliberately slower because ObjectDetector is
         * the heaviest model.
         */
        if (
          this.objects &&
          now - this.lastObjects >= 500
        ) {
          this.lastObjects = now;

          const result =
            this.objects.detectForVideo(video, now);

          const detections = result.detections ?? [];

          let detectedPhone = false;

          for (const detection of detections) {
            const category = detection.categories?.[0];

            const name =
              category?.categoryName
                ?.toLowerCase()
                .trim() ?? "";

            const score = category?.score ?? 0;

            /*
             * IMPORTANT:
             *
             * Only accept explicit phone classes.
             *
             * Do NOT treat "remote", "object", "device",
             * "cup", "bottle", etc. as a phone.
             */
            const isPhone =
              name === "cell phone" ||
              name === "mobile phone" ||
              name === "phone";

            if (isPhone && score >= 0.60) {
              detectedPhone = true;
              break;
            }
          }

          if (detectedPhone) {
            this.phoneDetected = true;
            this.phoneMisses = 0;
          } else {
            this.phoneMisses += 1;

            /*
             * Require two consecutive misses before clearing
             * phone detection. This prevents flickering.
             */
            if (this.phoneMisses >= 2) {
              this.phoneDetected = false;
            }
          }
        }

        /*
         * STATUS UPDATE
         *
         * Only update React-facing status ~4 FPS.
         */
        if (now - this.lastEmit >= 250) {
          this.lastEmit = now;

          const faceLandmarks =
            this.lastFaceResult?.faceLandmarks ?? [];

          const poseLandmarks =
            this.lastPoseResult?.landmarks ?? [];

          const face = faceLandmarks[0];
          const pose = poseLandmarks[0];

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

          /*
           * Grooming is expensive because it reads pixels.
           * Run it only ~2 FPS.
           */
          let grooming:
            | { text: string; level: Level }
            | undefined;

          if (
            this.canvas &&
            now - this.lastGrooming >= 500
          ) {
            this.lastGrooming = now;

            grooming = evalGrooming(
              video,
              this.canvas,
            );
          }

          const update: Parameters<typeof setVisionStatus>[0] = {
            phone: this.phoneDetected,
            people: Math.max(
              faceLandmarks.length,
              this.lastFaceResult?.faceLandmarks?.length ?? 0,
            ),
            eye,
            posture,
            ...(grooming ? { grooming } : {}),
          leftHand: pose
  ? evalHand(pose, 15, 11)
  : {
      text: "Not visible",
      level: "idle" as Level,
    },

rightHand: pose
  ? evalHand(pose, 16, 12)
  : {
      text: "Not visible",
      level: "idle" as Level,
    },
          };

          setVisionStatus(update);
        }
      } catch (error) {
        // Never let one bad frame kill the camera loop.
        console.debug("Vision frame skipped", error);
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  stop() {
    this.running = false;
    this.initializing = false;

    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
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

    this.phoneDetected = false;
    this.phoneMisses = 0;

    resetVisionStatus();
  }
}
