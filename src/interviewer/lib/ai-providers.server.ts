import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, generateText, NoObjectGeneratedError, Output } from "ai";
import type { z } from "zod";

/**
 * AI infrastructure.
 *
 * Groq is the only provider: one free key, one console, fast enough for a live
 * interview. Transient failures (rate limits, quota pauses, network blips) are
 * retried with exponential backoff rather than failed over, and everything
 * else is classified into a status the setup page can explain in plain words.
 *
 * Server-only: never import this from client code.
 */

export type ProviderId = "groq";

export interface ProviderSpec {
  id: ProviderId;
  label: string;
  /** Environment variable holding the key. */
  keyEnv: string;
  /** Where a user gets a free key. */
  keyUrl: string;
  baseURL: string;
  textModel: string;
  /** Model used when a webcam frame is attached. */
  visionModel: string;
  modelEnv: string;
  /** Whether the vision model above is actually reachable for this provider. */
  supportsVision: boolean;
  /** Whether the provider enforces json_schema response formats. */
  structuredOutputs: boolean;
  note: string;
}

export const PROVIDER_SPECS: ProviderSpec[] = [
  {
    id: "groq",
    label: "Groq",
    keyEnv: "GROQ_API_KEY",
    keyUrl: "https://console.groq.com/keys",
    baseURL: "https://api.groq.com/openai/v1",
    textModel: "openai/gpt-oss-120b",
    visionModel: "qwen/qwen3.6-27b",
    modelEnv: "GROQ_MODEL",
    supportsVision: true,
    structuredOutputs: true,
    note: "Free tier from console.groq.com — fast enough for live interviews.",
  },
];

/**
 * Keys entered through the in-app AI setup page. Kept in server memory only —
 * never written to disk and never sent to the browser. Restarting the server
 * clears them, which is why the setup page also tells users to persist the key
 * in their .env file.
 */
const runtimeKeys = new Map<ProviderId, string>();

export function setRuntimeKey(id: ProviderId, key: string) {
  const trimmed = key.trim();
  if (trimmed) runtimeKeys.set(id, trimmed);
  else runtimeKeys.delete(id);
}

export function clearRuntimeKey(id: ProviderId) {
  runtimeKeys.delete(id);
}

export function getSpec(id: ProviderId): ProviderSpec {
  return PROVIDER_SPECS.find((s) => s.id === id) ?? PROVIDER_SPECS[0];
}

export function keyFor(spec: ProviderSpec): string | null {
  return runtimeKeys.get(spec.id) ?? process.env[spec.keyEnv]?.trim() ?? null;
}

export function keySource(spec: ProviderSpec): "runtime" | "env" | "none" {
  if (runtimeKeys.has(spec.id)) return "runtime";
  if (process.env[spec.keyEnv]?.trim()) return "env";
  return "none";
}

/** Safe display form: never reveals more than the last 4 characters. */
export function maskKey(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 3)}••••${key.slice(-4)}`;
}

export function modelFor(spec: ProviderSpec, vision: boolean): string {
  if (vision) return process.env[`${spec.modelEnv}_VISION`]?.trim() || spec.visionModel;
  return process.env[spec.modelEnv]?.trim() || spec.textModel;
}

/** Providers with a usable key, in failover order. */
export function activeProviders(): ProviderSpec[] {
  return PROVIDER_SPECS.filter((spec) => Boolean(keyFor(spec)));
}

export function hasAnyProvider(): boolean {
  return activeProviders().length > 0;
}

/* ------------------------------------------------------------------ */
/* error classification                                                */
/* ------------------------------------------------------------------ */

export type AiStatusCode =
  | "connected"
  | "unverified"
  | "missing_key"
  | "invalid_key"
  | "auth_failed"
  | "rate_limited"
  | "quota_exceeded"
  | "model_unavailable"
  | "network_error"
  | "unknown_error";

export interface AiStatusInfo {
  code: AiStatusCode;
  title: string;
  /** Plain-language explanation of what happened and how to fix it. */
  fix: string;
}

const STATUS_TEXT: Record<AiStatusCode, { title: string; fix: string }> = {
  connected: { title: "Connected", fix: "This provider answered a live test request." },
  unverified: {
    title: "Key configured",
    fix: "A key is present but has not been tested yet. Run a test to confirm it works.",
  },
  missing_key: {
    title: "Missing API key",
    fix: "No key is configured for this provider. Paste one below, or add it to your .env file and restart the dev server.",
  },
  invalid_key: {
    title: "Invalid API key",
    fix: "The provider rejected this key. Copy it again from the provider console — keys are long and easy to truncate.",
  },
  auth_failed: {
    title: "Authentication failed",
    fix: "The key exists but is not authorised. It may have been revoked or belongs to a different project. Create a fresh key.",
  },
  rate_limited: {
    title: "Rate limit reached",
    fix: "Too many requests in a short window. Wait a minute and try again — meanwhile the app uses the next configured provider.",
  },
  quota_exceeded: {
    title: "Quota exceeded",
    fix: "This key has used up its free allowance for now. Wait for the quota to reset, or configure a fallback provider below.",
  },
  model_unavailable: {
    title: "Model unavailable",
    fix: "The configured model is not available to this key. Remove the model override so the default free model is used.",
  },
  network_error: {
    title: "Network error",
    fix: "The provider could not be reached. Check your internet connection or firewall and try again.",
  },
  unknown_error: {
    title: "Unexpected error",
    fix: "The provider returned an error we do not recognise. Try again; if it persists, switch to a fallback provider.",
  },
};

export function statusInfo(code: AiStatusCode, detail?: string): AiStatusInfo {
  const base = STATUS_TEXT[code];
  return { code, title: base.title, fix: detail ? `${base.fix} (${detail})` : base.fix };
}

export function classifyAiError(error: unknown): AiStatusInfo {
  if (APICallError.isInstance(error)) {
    const status = error.statusCode ?? 0;
    const body = `${error.responseBody ?? ""} ${error.message}`.toLowerCase();
    if (status === 401) return statusInfo("invalid_key");
    if (status === 403) return statusInfo("auth_failed");
    if (status === 429) {
      return statusInfo(/quota|insufficient|billing|credit/.test(body) ? "quota_exceeded" : "rate_limited");
    }
    if (status === 402) return statusInfo("quota_exceeded");
    if (status === 404 || /model.*(not found|does not exist|decommissioned)/.test(body)) {
      return statusInfo("model_unavailable");
    }
    if (status >= 500) return statusInfo("network_error", `provider returned ${status}`);
    return statusInfo("unknown_error", `HTTP ${status}`);
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/fetch failed|network|ENOTFOUND|ECONNREFUSED|timeout|aborted/i.test(message)) {
    return statusInfo("network_error");
  }
  return statusInfo("unknown_error", message.slice(0, 120));
}

/** Transient failures worth waiting out instead of giving up on. */
function isTransient(code: AiStatusCode): boolean {
  return code === "rate_limited" || code === "quota_exceeded" || code === "network_error";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ */
/* calling                                                             */
/* ------------------------------------------------------------------ */

function providerModel(spec: ProviderSpec, apiKey: string, vision: boolean) {
  const provider = createOpenAICompatible({
    name: spec.id,
    baseURL: spec.baseURL,
    // Without this the SDK sends response_format json_object and the schema is
    // never enforced — the model free-forms the shape and the app gets undefined fields.
    supportsStructuredOutputs: spec.structuredOutputs,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return provider(modelFor(spec, vision));
}

export class NoAiProviderError extends Error {
  readonly info: AiStatusInfo;
  constructor(info: AiStatusInfo) {
    super(
      `AI is not configured. ${info.fix} Open the AI setup page to add a free key (e.g. ${PROVIDER_SPECS[0].keyUrl}).`,
    );
    this.info = info;
  }
}

export interface StructuredRequest<T> {
  schema: z.ZodType<T>;
  system: string;
  prompt?: string;
  /** Multimodal message list; when present a vision-capable model is used. */
  images?: string[];
  vision?: boolean;
  /** Returned when every provider fails or every reply is unusable. */
  fallback?: T;
}

export interface StructuredResult<T> {
  value: T;
  provider: ProviderId | null;
  /** Set when no provider produced a schema-valid answer. */
  error: AiStatusInfo | null;
}

/**
 * One structured call. Schema misses are retried with the schema re-stated;
 * rate limits, quota pauses and network blips are retried with exponential
 * backoff so a long interview never dies on a transient failure.
 */
export async function runStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
  const vision = Boolean(request.vision || request.images?.length);
  const providers = activeProviders().filter((spec) => !vision || spec.supportsVision);
  if (!providers.length) {
    // Total misconfiguration is never silently degraded — the UI must say so.
    throw new NoAiProviderError(statusInfo("missing_key"));
  }

  let lastError: AiStatusInfo = statusInfo("unknown_error");
  const MAX_ATTEMPTS = 4;

  for (const spec of providers) {
    const apiKey = keyFor(spec);
    if (!apiKey) continue;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const promptText =
        attempt === 0
          ? (request.prompt ?? "")
          : `${request.prompt ?? ""}\n\nYour previous reply did not match the required JSON shape. Return every field of the schema exactly, with no extra or renamed keys.`;
      try {
        const { output } = await generateText({
          model: providerModel(spec, apiKey, vision),
          output: Output.object({ schema: request.schema }),
          system: request.system,
          ...(request.images?.length
            ? {
                messages: [
                  {
                    role: "user" as const,
                    content: [
                      { type: "text" as const, text: promptText || "Analyse the attached frame." },
                      ...request.images.map((image) => ({ type: "image" as const, image })),
                    ],
                  },
                ],
              }
            : { prompt: promptText }),
        });
        const parsed = request.schema.safeParse(output);
        if (parsed.success) return { value: parsed.data, provider: spec.id, error: null };
      } catch (error) {
        // Some providers wrap valid JSON in prose or fences — try to salvage it.
        if (NoObjectGeneratedError.isInstance(error) && error.text) {
          const salvaged = salvageJson(request.schema, error.text);
          if (salvaged.success) return { value: salvaged.data, provider: spec.id, error: null };
        }
        const info = classifyAiError(error);
        lastError = info;
        if (isTransient(info.code)) {
          // 0.8s, 1.6s, 3.2s — Groq's free-tier windows are short.
          if (attempt < MAX_ATTEMPTS - 1) await sleep(800 * 2 ** attempt);
          continue;
        }
        // Bad key, missing model: retrying cannot help.
        if (info.code === "invalid_key" || info.code === "auth_failed" || info.code === "model_unavailable") break;
      }
    }
  }

  if (request.fallback !== undefined) {
    return { value: request.fallback, provider: null, error: lastError };
  }
  throw new NoAiProviderError(lastError);
}

function salvageJson<T>(schema: z.ZodType<T>, text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return schema.safeParse(JSON.parse(candidate));
  } catch {
    return { success: false } as const;
  }
}

/* ------------------------------------------------------------------ */
/* connection testing                                                  */
/* ------------------------------------------------------------------ */

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  keyEnv: string;
  keyUrl: string;
  model: string;
  note: string;
  /** Where the key came from, so users know a pasted key is temporary. */
  source: "runtime" | "env" | "none";
  maskedKey: string | null;
  status: AiStatusInfo;
  latencyMs: number | null;
}

/** Real minimal completion against the provider — no mocking. */
export async function testProvider(id: ProviderId): Promise<ProviderStatus> {
  const spec = getSpec(id);
  const apiKey = keyFor(spec);
  const base: Omit<ProviderStatus, "status" | "latencyMs"> = {
    id: spec.id,
    label: spec.label,
    keyEnv: spec.keyEnv,
    keyUrl: spec.keyUrl,
    model: modelFor(spec, false),
    note: spec.note,
    source: keySource(spec),
    maskedKey: apiKey ? maskKey(apiKey) : null,
  };
  if (!apiKey) return { ...base, status: statusInfo("missing_key"), latencyMs: null };

  const started = Date.now();
  try {
    const { text } = await generateText({
      model: providerModel(spec, apiKey, false),
      prompt: "Reply with the single word: ready",
      maxOutputTokens: 8,
    });
    if (!text.trim()) throw new Error("empty response");
    return { ...base, status: statusInfo("connected"), latencyMs: Date.now() - started };
  } catch (error) {
    return { ...base, status: classifyAiError(error), latencyMs: Date.now() - started };
  }
}

export async function testAllProviders(): Promise<ProviderStatus[]> {
  return Promise.all(PROVIDER_SPECS.map((spec) => testProvider(spec.id)));
}

/** Cheap, no-network snapshot for banners and route loaders. */
export function providerOverview(): ProviderStatus[] {
  return PROVIDER_SPECS.map((spec) => {
    const apiKey = keyFor(spec);
    return {
      id: spec.id,
      label: spec.label,
      keyEnv: spec.keyEnv,
      keyUrl: spec.keyUrl,
      model: modelFor(spec, false),
      note: spec.note,
      source: keySource(spec),
      maskedKey: apiKey ? maskKey(apiKey) : null,
      status: apiKey ? statusInfo("unverified") : statusInfo("missing_key"),
      latencyMs: null,
    };
  });
}