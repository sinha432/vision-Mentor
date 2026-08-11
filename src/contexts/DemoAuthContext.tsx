import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { createDemoUser, verifyDemoUser } from "@/lib/demo-users.functions";

export type UserRole = "individual" | "company";
export type DemoUser = { id: string; email: string; name: string; role: UserRole };

const STORAGE_KEY = "vmx_demo_user";

export const DEMO_EMAIL = "demo@visionmentor.ai";
export const DEMO_PASSWORD = "demo1234";
export const DEMO_COMPANY_EMAIL = "company@visionmentor.ai";
export const DEMO_COMPANY_PASSWORD = "demo1234";

const DEMO_USER: DemoUser = { id: "demo", email: DEMO_EMAIL, name: "Demo User", role: "individual" };
const DEMO_COMPANY: DemoUser = { id: "demo-company", email: DEMO_COMPANY_EMAIL, name: "Demo Company", role: "company" };

type SignUpPayload = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  dob?: string;
  country?: string;
};

type Ctx = {
  user: DemoUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<DemoUser>;
  signUp: (payload: SignUpPayload) => Promise<DemoUser>;
  signOut: () => void;
};

const DemoAuthCtx = createContext<Ctx | null>(null);

function readStored(): DemoUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as DemoUser;
    if (!u.role) u.role = "individual";
    return u;
  } catch {
    return null;
  }
}

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(readStored());
    setReady(true);
  }, []);

  const persist = useCallback((u: DemoUser | null) => {
    setUser(u);
    if (typeof window === "undefined") return;
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const e = email.trim().toLowerCase();
    if (e === DEMO_EMAIL && password === DEMO_PASSWORD) { persist(DEMO_USER); return DEMO_USER; }
    if (e === DEMO_COMPANY_EMAIL && password === DEMO_COMPANY_PASSWORD) { persist(DEMO_COMPANY); return DEMO_COMPANY; }
    const u = await verifyDemoUser({ data: { email: e, password } });
    if (!u) throw new Error("Invalid email or password");
    persist(u);
    return u;
  }, [persist]);

  const signUp = useCallback(async (payload: SignUpPayload) => {
    const u = await createDemoUser({
      data: { ...payload, email: payload.email.trim().toLowerCase() },
    });
    persist(u);
    return u;
  }, [persist]);

  const signOut = useCallback(() => persist(null), [persist]);

  return (
    <DemoAuthCtx.Provider value={{ user, ready, signIn, signUp, signOut }}>
      {children}
    </DemoAuthCtx.Provider>
  );
}

export function useDemoAuth() {
  const ctx = useContext(DemoAuthCtx);
  if (!ctx) throw new Error("useDemoAuth must be used within DemoAuthProvider");
  return ctx;
}
