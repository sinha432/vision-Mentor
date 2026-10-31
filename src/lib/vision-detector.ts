import type {
  FaceLandmarker,
  HandLandmarker,
  ImageClassifier,
  ObjectDetector,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import {
  classifyVisionObjectLabel,
  isHandNearObject,
  PhoneDetectionTracker,
  type PhoneDetectionConfig,
  type PhoneDetectionState,
  type VisionObjectCategory,
  type VisionObjectCandidate,
} from "./phone-detection";

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
const HANDHELD_OBJECT_DETECTOR_MODEL = "/models/visionmentor-handheld-detector.tflite";
const HANDHELD_CLASSIFIER_MODEL = "/models/visionmentor-handheld-classifier.tflite";

const OBJECT_DETECTION_INTERVAL_MS = 200;
const STATUS_EMIT_INTERVAL_MS = 250;
const HAND_DETECTION_INTERVAL_MS = 200;
const CLASSIFIER_DETECTION_INTERVAL_MS = OBJECT_DETECTION_INTERVAL_MS;
const OBJECT_CANDIDATE_LABELS = new Set([
  "cell phone",
  "cellphone",
  "mobile phone",
  "phone",
  "smartphone",
  "handbag",
  "suitcase",
  "book",
  "remote",
  "tablet",
  "calculator",
  "notebook",
  "id card",
  "identity card",
  "laptop",
  "keyboard",
  "monitor",
  "tv",
]);
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

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
  private hands: HandLandmarker | null = null;
  private handheldObjectDetector: ObjectDetector | null = null;
  private handheldClassifier: ImageClassifier | null = null;
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
  // Objects    = ~5 FPS
  // Grooming   = ~1 FPS
  // UI         = ~4 FPS
  //
  // Object detection is faster now so phone detection reacts quickly,
  // but we don't run it every animation frame because that would cause lag.
  // ---------------------------------------------------------------------------

  private lastFace = 0;
  private lastHands = 0;
  private lastPose = 0;
  private lastObjects = 0;
  private lastClassifier = 0;
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

  private readonly phoneTracker: PhoneDetectionTracker;
  private phoneDetected = false;
  private phoneState: PhoneDetectionState = "clear";
  private phoneConfidence = 0;
  private phoneHeld = false;
  private handInitializationStarted = false;
  private initializeHands: (() => void) | null = null;
  private classifierInitializationStarted = false;
  private initializeClassifier: (() => void) | null = null;
  private classifierLoadFailed = false;
  private handheldDetectorInitializationStarted = false;
  private initializeHandheldDetector: (() => void) | null = null;
  private handheldDetectorLoadFailed = false;
  private objectCropCanvas =
    typeof document !== "undefined" ? document.createElement("canvas") : null;
  private sessionGeneration = 0;

  constructor(phoneDetectionConfig: Partial<PhoneDetectionConfig> = {}) {
    this.phoneTracker = new PhoneDetectionTracker(phoneDetectionConfig);
  }

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
    const generation = ++this.sessionGeneration;
    this.phoneTracker.reset();
    this.phoneDetected = false;
    this.phoneState = "clear";
    this.phoneConfidence = 0;
    this.phoneHeld = false;
    this.handInitializationStarted = false;
    this.classifierInitializationStarted = false;
    this.classifierLoadFailed = false;
    this.handheldDetectorInitializationStarted = false;
    this.handheldDetectorLoadFailed = false;
    this.lastClassifier = 0;

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

      this.initializeHands = () => {
        if (this.handInitializationStarted) return;
        this.handInitializationStarted = true;
        void vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: HAND_MODEL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.45,
          minHandPresenceConfidence: 0.45,
          minTrackingConfidence: 0.45,
        }).then((landmarker) => {
          if (!this.running || this.sessionGeneration !== generation) {
            landmarker.close();
            return;
          }
          this.hands = landmarker;
        }).catch((error: unknown) => {
          console.warn("Hand landmark detector unavailable.", error);
        });
      };

      this.initializeClassifier = () => {
        if (this.classifierInitializationStarted || this.classifierLoadFailed) return;
        this.classifierInitializationStarted = true;
        void vision.ImageClassifier.createFromModelPath(
          fileset,
          HANDHELD_CLASSIFIER_MODEL,
        ).then((classifier) => {
          if (!this.running || this.sessionGeneration !== generation) {
            classifier.close();
            return;
          }
          this.handheldClassifier = classifier;
        }).catch((error: unknown) => {
          this.classifierLoadFailed = true;
          console.warn(
            "[Vision Mentor] Custom handheld classifier unavailable; phone detections will remain unconfirmed.",
            error,
          );
        });
      };

      this.initializeHandheldDetector = () => {
        if (
          this.handheldDetectorInitializationStarted ||
          this.handheldDetectorLoadFailed
        ) {
          return;
        }
        this.handheldDetectorInitializationStarted = true;
        void vision.ObjectDetector.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: HANDHELD_OBJECT_DETECTOR_MODEL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          scoreThreshold: 0.3,
          maxResults: 5,
        }).then((detector) => {
          if (!this.running || this.sessionGeneration !== generation) {
            detector.close();
            return;
          }
          this.handheldObjectDetector = detector;
        }).catch((error: unknown) => {
          this.handheldDetectorLoadFailed = true;
          console.warn(
            "[Vision Mentor] Custom handheld object detector unavailable; phone detections will remain unconfirmed.",
            error,
          );
        });
      };

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
      !this.face
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

         if (this.pose) {
  this.lastPoseResult =
    this.pose.detectForVideo(
      video,
      now,
    );
}
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
          now - this.lastObjects >= OBJECT_DETECTION_INTERVAL_MS
        ) {
          this.lastObjects = now;

          const result =
            this.objects.detectForVideo(
              video,
              now,
            );

          const detections =
            result.detections ?? [];

          if (import.meta.env.DEV) {
            for (const detection of detections) {
              console.debug(
                "[Vision Mentor][Nova object detector]",
                {
                  model: "EfficientDet Lite0 COCO",
                  categories: detection.categories.map((category) => ({
                    categoryName: category.categoryName,
                    categoryIndex: category.index,
                    confidence: category.score,
                  })),
                  boundingBox: detection.boundingBox
                    ? {
                        x: detection.boundingBox.originX,
                        y: detection.boundingBox.originY,
                        width: detection.boundingBox.width,
                        height: detection.boundingBox.height,
                      }
                    : null,
                },
              );
            }
          }

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

          let objectCandidate: VisionObjectCandidate | null = null;
          let objectBox:
            | { x: number; y: number; width: number; height: number }
            | undefined;
          let objectPixelBox:
            | { x: number; y: number; width: number; height: number }
            | undefined;

          for (const detection of detections) {
            const category = detection.categories?.[0];
            const label =
              category?.categoryName?.trim().toLowerCase().replace(/[_-]+/g, " ") ?? "";
            if (!label || !OBJECT_CANDIDATE_LABELS.has(label)) continue;

            const confidence = category?.score ?? 0;
            const isPhone = classifyVisionObjectLabel(label) === "phone";
            const currentIsPhone =
              objectCandidate !== null &&
              classifyVisionObjectLabel(objectCandidate.label) === "phone";
            if (
              !objectCandidate ||
              (isPhone && !currentIsPhone) ||
              (isPhone === currentIsPhone && confidence > objectCandidate.confidence)
            ) {
              const box = detection.boundingBox;
              objectCandidate = {
                label,
                confidence,
                ...(box
                  ? {
                      center: {
                        x: (box.originX + box.width / 2) / video.videoWidth,
                        y: (box.originY + box.height / 2) / video.videoHeight,
                      },
                    }
                  : {}),
              };
              objectBox = box
                ? {
                    x: box.originX / video.videoWidth,
                    y: box.originY / video.videoHeight,
                    width: box.width / video.videoWidth,
                    height: box.height / video.videoHeight,
                  }
                : undefined;
              objectPixelBox = box
                ? {
                    x: box.originX,
                    y: box.originY,
                    width: box.width,
                    height: box.height,
                  }
                : undefined;
            }
          }

          if (this.handheldObjectDetector) {
            const handheldResult =
              this.handheldObjectDetector.detectForVideo(video, now);
            const handheldDetections = handheldResult.detections ?? [];
            if (import.meta.env.DEV) {
              for (const detection of handheldDetections) {
                console.debug("[Vision Mentor][Nova handheld object detector]", {
                  model: HANDHELD_OBJECT_DETECTOR_MODEL,
                  categories: detection.categories.map((category) => ({
                    categoryName: category.categoryName,
                    categoryIndex: category.index,
                    confidence: category.score,
                  })),
                  boundingBox: detection.boundingBox
                    ? {
                        x: detection.boundingBox.originX,
                        y: detection.boundingBox.originY,
                        width: detection.boundingBox.width,
                        height: detection.boundingBox.height,
                      }
                    : null,
                });
              }
            }

            const customCandidate = handheldDetections.reduce<{
              label: string;
              category: VisionObjectCategory;
              confidence: number;
              index: number;
              box?: { originX: number; originY: number; width: number; height: number };
            } | null>((best, detection) => {
              const category = detection.categories[0];
              if (!category || (best && category.score <= best.confidence)) return best;
              return {
                label: category.categoryName,
                category: classifyVisionObjectLabel(category.categoryName),
                confidence: category.score,
                index: category.index,
                box: detection.boundingBox,
              };
            }, null);

            if (customCandidate) {
              const box = customCandidate.box;
              objectCandidate = {
                label: customCandidate.label,
                confidence: customCandidate.confidence,
                detectorCategory: customCandidate.category,
                detectorConfidence: customCandidate.confidence,
                ...(box
                  ? {
                      center: {
                        x: (box.originX + box.width / 2) / video.videoWidth,
                        y: (box.originY + box.height / 2) / video.videoHeight,
                      },
                    }
                  : {}),
              };
              objectBox = box
                ? {
                    x: box.originX / video.videoWidth,
                    y: box.originY / video.videoHeight,
                    width: box.width / video.videoWidth,
                    height: box.height / video.videoHeight,
                  }
                : undefined;
              objectPixelBox = box
                ? {
                    x: box.originX,
                    y: box.originY,
                    width: box.width,
                    height: box.height,
                  }
                : undefined;
              if (import.meta.env.DEV) {
                console.debug("[Vision Mentor][Nova handheld detector candidate]", {
                  categoryName: customCandidate.label,
                  categoryIndex: customCandidate.index,
                  confidence: customCandidate.confidence,
                });
              }
            }
          }

          if (objectCandidate) {
            this.initializeHands?.();
            this.initializeClassifier?.();
            this.initializeHandheldDetector?.();
          }

          let handNearby = false;
          if (this.hands && now - this.lastHands >= HAND_DETECTION_INTERVAL_MS) {
            this.lastHands = now;
            const handResult = this.hands.detectForVideo(video, now);
            handNearby = isHandNearObject(handResult.landmarks, objectBox);
          }

          if (
            objectCandidate &&
            objectPixelBox &&
            this.handheldClassifier &&
            this.objectCropCanvas &&
            now - this.lastClassifier >= CLASSIFIER_DETECTION_INTERVAL_MS
          ) {
            this.lastClassifier = now;
            const x = Math.max(0, Math.floor(objectPixelBox.x));
            const y = Math.max(0, Math.floor(objectPixelBox.y));
            const right = Math.min(
              video.videoWidth,
              Math.ceil(objectPixelBox.x + objectPixelBox.width),
            );
            const bottom = Math.min(
              video.videoHeight,
              Math.ceil(objectPixelBox.y + objectPixelBox.height),
            );
            const width = right - x;
            const height = bottom - y;
            const context = this.objectCropCanvas.getContext("2d");
            if (context && width > 0 && height > 0) {
              this.objectCropCanvas.width = width;
              this.objectCropCanvas.height = height;
              context.drawImage(video, x, y, width, height, 0, 0, width, height);
              try {
                const categories =
                  this.handheldClassifier.classify(this.objectCropCanvas).classifications[0]
                    ?.categories ?? [];
                const bestCategory = categories[0];
                if (bestCategory) {
                  const classifierCategory: VisionObjectCategory =
                    classifyVisionObjectLabel(bestCategory.categoryName);
                  objectCandidate = {
                    ...objectCandidate,
                    classifierCategory,
                    classifierConfidence: bestCategory.score,
                  };
                  if (import.meta.env.DEV) {
                    console.debug("[Vision Mentor][Nova handheld classifier]", {
                      model: HANDHELD_CLASSIFIER_MODEL,
                      categoryName: bestCategory.categoryName,
                      categoryIndex: bestCategory.index,
                      confidence: bestCategory.score,
                      detectorCategory: objectCandidate.label,
                      detectorConfidence: objectCandidate.confidence,
                      finalCategory: classifierCategory,
                    });
                  }
                }
              } catch (error) {
                console.warn("[Vision Mentor] Handheld crop classification failed.", error);
              }
            }
          }

          const verification = this.phoneTracker.record(
            objectCandidate,
            handNearby,
          );
          this.phoneDetected = verification.confirmed;
          this.phoneState = verification.state;
          this.phoneConfidence = verification.confidence;
          this.phoneHeld = verification.held;
          if (import.meta.env.DEV && objectCandidate) {
            console.debug("[Vision Mentor][Nova phone decision]", {
              detectorCategory: objectCandidate.label,
              detectorConfidence: objectCandidate.confidence,
              classifierCategory: objectCandidate.classifierCategory ?? null,
              classifierConfidence: objectCandidate.classifierConfidence ?? null,
              verifiedPhoneFrames: verification.phoneDetections,
              requiredPhoneFrames: this.phoneTracker.config.minPhoneDetections,
              finalDecision: verification.state,
              confirmed: verification.confirmed,
            });
          }
        }

        // ---------------------------------------------------------------------
        // UI STATUS
        // ---------------------------------------------------------------------

        if (
          now - this.lastEmit >= STATUS_EMIT_INTERVAL_MS
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
            phoneState: this.phoneState,
            phoneConfidence: this.phoneConfidence,
            phoneHeld: this.phoneHeld,

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
    this.sessionGeneration += 1;
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
      this.hands?.close();
    } catch {
      // ignore
    }

    try {
      this.handheldClassifier?.close();
    } catch {
      // ignore
    }

    try {
      this.handheldObjectDetector?.close();
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
    this.hands = null;
    this.handheldObjectDetector = null;
    this.handheldClassifier = null;
    this.pose = null;
    this.objects = null;

    this.video = null;

    this.lastFaceResult = null;
    this.lastPoseResult = null;

    this.peopleDetected = 0;

    this.phoneTracker.reset();
    this.phoneDetected = false;
    this.phoneState = "clear";
    this.phoneConfidence = 0;
    this.phoneHeld = false;
    this.handInitializationStarted = false;
    this.initializeHands = null;
    this.classifierInitializationStarted = false;
    this.initializeClassifier = null;
    this.classifierLoadFailed = false;
    this.handheldDetectorInitializationStarted = false;
    this.initializeHandheldDetector = null;
    this.handheldDetectorLoadFailed = false;

    this.lastFace = 0;
    this.lastHands = 0;
    this.lastClassifier = 0;
    this.lastPose = 0;
    this.lastObjects = 0;
    this.lastGrooming = 0;
    this.lastEmit = 0;

    resetVisionStatus();
  }
}