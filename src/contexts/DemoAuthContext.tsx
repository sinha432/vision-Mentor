import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";

export type UserRole = "individual" | "company";

export type DemoUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

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
signIn: (
  email: string,
  password: string,
  role: UserRole,
) => Promise<DemoUser>;
  signUp: (payload: SignUpPayload) => Promise<DemoUser>;
  signOut: () => void;
};

const STORAGE_KEY = "vmx_user";

const DemoAuthCtx = createContext<Ctx | null>(null);

function readStored(): DemoUser | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return null;

    const user = JSON.parse(raw) as DemoUser;

    if (
      !user ||
      typeof user.email !== "string" ||
      typeof user.role !== "string"
    ) {
      return null;
    }

    if (user.role !== "individual" && user.role !== "company") {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export function DemoAuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Remove all legacy demo authentication data.
    localStorage.removeItem("vmx_demo_user");

    const stored = readStored();

    setUser(stored);
    setReady(true);
  }, []);

  const persist = useCallback((nextUser: DemoUser | null) => {
    setUser(nextUser);

    if (typeof window === "undefined") return;

    if (nextUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      localStorage.removeItem("vmx_demo_user");
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("vmx_demo_user");
    }
  }, []);

  const signIn = useCallback(
async (
  email: string,
  password: string,
  role: UserRole,
): Promise<DemoUser> => {
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail || !password) {
        throw new Error("Email and password are required");
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
       body: JSON.stringify({
  email: normalizedEmail,
  password,
  role,
}),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Invalid email or password",
        );
      }

      const apiUser = data?.user;

      if (!apiUser) {
        throw new Error("Authentication response was invalid");
      }

      const authenticatedUser: DemoUser = {
        id: String(apiUser.id ?? apiUser.email ?? normalizedEmail),
        email: String(apiUser.email ?? normalizedEmail),
        name: String(apiUser.name ?? ""),
        role: apiUser.role === "company" ? "company" : "individual",
      };

      persist(authenticatedUser);

      return authenticatedUser;
    },
    [persist],
  );

  const signUp = useCallback(
    async (payload: SignUpPayload): Promise<DemoUser> => {
      const normalizedEmail = payload.email.trim().toLowerCase();

      if (!payload.name.trim()) {
        throw new Error("Name is required");
      }

      if (!normalizedEmail) {
        throw new Error("Email is required");
      }

      if (!payload.password) {
        throw new Error("Password is required");
      }

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: payload.name.trim(),
          email: normalizedEmail,
          password: payload.password,
          role: payload.role,
          dob: payload.dob,
          country: payload.country,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Account creation failed",
        );
      }

      const apiUser = data?.user;

      const authenticatedUser: DemoUser = {
        id: String(apiUser?.id ?? apiUser?.email ?? normalizedEmail),
        email: String(apiUser?.email ?? normalizedEmail),
        name: String(apiUser?.name ?? payload.name.trim()),
        role:
          apiUser?.role === "company"
            ? "company"
            : payload.role === "company"
              ? "company"
              : "individual",
      };

      persist(authenticatedUser);

      return authenticatedUser;
    },
    [persist],
  );

  const signOut = useCallback(() => {
    persist(null);
  }, [persist]);

  return (
    <DemoAuthCtx.Provider
      value={{
        user,
        ready,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </DemoAuthCtx.Provider>
  );
}

export function useDemoAuth() {
  const ctx = useContext(DemoAuthCtx);

  if (!ctx) {
    throw new Error(
      "useDemoAuth must be used within DemoAuthProvider",
    );
  }

  return ctx;
}