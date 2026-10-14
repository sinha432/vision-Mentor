import { createHmac, timingSafeEqual } from "node:crypto";

export interface AuthSession {
  id: string;
  email: string;
  name: string;
  role: "individual" | "company";
  expiresAt: number;
}

const COOKIE_NAME = "vmx_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.MONGODB_URI;
  if (!secret) throw new Error("AUTH_SESSION_SECRET or MONGODB_URI must be configured");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

function cookieAttributes(maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export function createSessionCookie(
  user: Omit<AuthSession, "expiresAt">,
): string {
  const payload = Buffer.from(
    JSON.stringify({ ...user, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 }),
  ).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  return `${COOKIE_NAME}=${token}; ${cookieAttributes(SESSION_TTL_SECONDS)}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; ${cookieAttributes(0)}`;
}

export function getAuthSession(request: Request): AuthSession | null {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  try {
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthSession;
    if (
      typeof session.id !== "string" ||
      typeof session.email !== "string" ||
      typeof session.name !== "string" ||
      (session.role !== "individual" && session.role !== "company") ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Date.now()
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}