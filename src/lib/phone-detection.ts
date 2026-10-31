export type VisionObjectCategory =
  "phone" | "wallet" | "calculator" | "notebook" | "id_card" | "other";

export type PhoneDetectionState =
  | "clear"
  | "possible_phone"
  | "phone_detected"
  | "wallet_detected"
  | "calculator_detected"
  | "notebook_detected"
  | "id_card_detected"
  | "other_object"
  | "uncertain";

export type PhoneDetectionConfig = {
  historyFrames: number;
  minPhoneDetections: number;
  minPhoneConfidence: number;
  minObjectClassConfidence: number;
  minClassifierConfidence: number;
  targetChangeDistance: number;
};

export const DEFAULT_PHONE_DETECTION_CONFIG: PhoneDetectionConfig = {
  historyFrames: 8,
  minPhoneDetections: 5,
  minPhoneConfidence: 0.3,
  minObjectClassConfidence: 0.55,
  minClassifierConfidence: 0.8,
  targetChangeDistance: 0.45,
};

export type VisionObjectCandidate = {
  label: string;
  confidence: number;
  detectorCategory?: VisionObjectCategory;
  detectorConfidence?: number;
  classifierCategory?: VisionObjectCategory;
  classifierConfidence?: number;
  center?: { x: number; y: number };
};

export type PhoneDetectionResult = {
  state: PhoneDetectionState;
  confirmed: boolean;
  held: boolean;
  confidence: number;
  phoneDetections: number;
};

export type NormalizedPoint = { x: number; y: number };
export type NormalizedBox = { x: number; y: number; width: number; height: number };

export function isHandNearObject(
  landmarks: NormalizedPoint[][],
  box: NormalizedBox | undefined,
  padding = 0.06,
): boolean {
  if (!box || box.width <= 0 || box.height <= 0) return false;
  const left = box.x - padding;
  const right = box.x + box.width + padding;
  const top = box.y - padding;
  const bottom = box.y + box.height + padding;
  return landmarks.some((hand) =>
    hand.some(
      (point) => point.x >= left && point.x <= right && point.y >= top && point.y <= bottom,
    ),
  );
}

export function classifyVisionObjectLabel(label: string): VisionObjectCategory {
  const normalized = label.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (
    ["cell phone", "cellphone", "mobile phone", "mobile", "smartphone", "phone"].includes(
      normalized,
    )
  ) {
    return "phone";
  }
  if (normalized === "wallet") return "wallet";
  if (normalized === "calculator") return "calculator";
  if (normalized === "notebook") return "notebook";
  if (["id card", "identity card"].includes(normalized)) return "id_card";
  return "other";
}

export class PhoneDetectionTracker {
  readonly config: PhoneDetectionConfig;
  private history: { isPhone: boolean; confidence: number }[] = [];
  private targetCenter: VisionObjectCandidate["center"];

  constructor(config: Partial<PhoneDetectionConfig> = {}) {
    this.config = { ...DEFAULT_PHONE_DETECTION_CONFIG, ...config };
    if (
      !Number.isInteger(this.config.historyFrames) ||
      !Number.isInteger(this.config.minPhoneDetections) ||
      this.config.historyFrames < 1 ||
      this.config.minPhoneDetections < 1 ||
      this.config.minPhoneDetections > this.config.historyFrames ||
      this.config.minPhoneConfidence < 0 ||
      this.config.minPhoneConfidence > 1 ||
      this.config.minObjectClassConfidence < 0 ||
      this.config.minObjectClassConfidence > 1 ||
      this.config.minClassifierConfidence < 0 ||
      this.config.minClassifierConfidence > 1 ||
      this.config.targetChangeDistance < 0
    ) {
      throw new RangeError("Invalid phone detection verification configuration.");
    }
  }

  record(candidate: VisionObjectCandidate | null, held = false): PhoneDetectionResult {
    const hasTrustedObjectClass =
      candidate?.detectorCategory !== undefined &&
      (candidate.detectorConfidence ?? 0) >= this.config.minObjectClassConfidence;
    const hasTrustedClassifier =
      candidate?.classifierCategory !== undefined &&
      (candidate.classifierConfidence ?? 0) >= this.config.minClassifierConfidence;
    const classifiersAgree =
      hasTrustedObjectClass &&
      hasTrustedClassifier &&
      candidate.detectorCategory === candidate.classifierCategory;
    const conflictingClassifications =
      hasTrustedObjectClass &&
      hasTrustedClassifier &&
      candidate.detectorCategory !== candidate.classifierCategory;
    const category = conflictingClassifications
      ? null
      : hasTrustedObjectClass
        ? candidate.detectorCategory
        : hasTrustedClassifier
          ? candidate.classifierCategory
          : null;
    const isPhone =
      classifiersAgree &&
      category === "phone" &&
      candidate !== null &&
      candidate.confidence >= this.config.minPhoneConfidence;

    if (conflictingClassifications || (category && category !== "phone")) {
      this.reset();
    } else if (candidate?.center && this.targetCenter) {
      const distance = Math.hypot(
        candidate.center.x - this.targetCenter.x,
        candidate.center.y - this.targetCenter.y,
      );
      if (distance > this.config.targetChangeDistance) this.reset();
    }

    if (category === "phone" && candidate?.center) this.targetCenter = candidate.center;
    this.history.push({
      isPhone,
      confidence: isPhone
        ? Math.min(
            candidate.confidence,
            candidate.detectorConfidence ?? 0,
            candidate.classifierConfidence ?? 0,
          )
        : 0,
    });
    if (this.history.length > this.config.historyFrames) this.history.shift();

    const phoneDetections = this.history.filter((frame) => frame.isPhone).length;
    const confirmed = phoneDetections >= this.config.minPhoneDetections;
    const confidence =
      phoneDetections === 0
        ? 0
        : this.history.reduce((sum, frame) => sum + frame.confidence, 0) / phoneDetections;
    const state: PhoneDetectionState = confirmed
      ? "phone_detected"
      : phoneDetections > 0
        ? "possible_phone"
        : candidate && (category === null || category === "phone")
          ? "uncertain"
          : category === "wallet"
            ? "wallet_detected"
            : category === "calculator"
              ? "calculator_detected"
              : category === "notebook"
                ? "notebook_detected"
                : category === "id_card"
                  ? "id_card_detected"
                  : category === "other"
                    ? "other_object"
                    : "clear";

    return { state, confirmed, held: confirmed && held, confidence, phoneDetections };
  }

  reset() {
    this.history = [];
    this.targetCenter = undefined;
  }
}
