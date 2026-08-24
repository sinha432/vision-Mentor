import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Sparkles,
  Mail,
  Lock,
  Loader2,
  User,
  Calendar,
  Globe,
  KeyRound,
  Eye,
  EyeOff,
  Building2,
  UserCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  useDemoAuth,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_COMPANY_EMAIL,
  DEMO_COMPANY_PASSWORD,
  type UserRole,
} from "@/contexts/DemoAuthContext";

type AuthSearch = { redirect?: string };

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: AuthPage,
});

const COUNTRIES = [
  "United States",
  "India",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Japan",
  "Singapore",
  "Other",
];

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" }) as AuthSearch;
  const redirectTo = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/";
  const { user, ready, signIn, signUp } = useDemoAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [name, setName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");
  const [dob, setDob] = useState("");
  const [country, setCountry] = useState("");
  const [role, setRole] = useState<UserRole>("individual");
  const [agree, setAgree] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showSuPw, setShowSuPw] = useState(false);
  const [showSuConfirm, setShowSuConfirm] = useState(false);

  const enterAuthenticatedHome = useCallback(
    (role: UserRole) => {
      if (redirectTo !== "/") {
        navigate({ to: redirectTo });
        return;
      }
      if (role === "individual") {
        window.sessionStorage.setItem("vmx_auth_redirect", "1");
        navigate({ to: "/" });
      } else {
        navigate({ to: "/dashboard" });
      }
    },
    [navigate, redirectTo],
  );

  useEffect(() => {
    if (ready && user) enterAuthenticatedHome(user.role);
  }, [ready, user, enterAuthenticatedHome]);

  const fillDemo = (which: "individual" | "company") => {
    if (which === "company") {
      setEmail(DEMO_COMPANY_EMAIL);
      setPassword(DEMO_COMPANY_PASSWORD);
    } else {
      setEmail(DEMO_EMAIL);
      setPassword(DEMO_PASSWORD);
    }
  };

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const signedInUser = await signIn(email, password);
      toast.success("Welcome back");
      enterAuthenticatedHome(signedInUser.role);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (suPassword !== suConfirm) return toast.error("Passwords don't match");
    if (!agree) return toast.error("Please accept the Terms");
    setBusy(true);
    try {
      const createdUser = await signUp({
        name: name.trim(),
        email: suEmail,
        password: suPassword,
        role,
        dob: dob || undefined,
        country: country || undefined,
      });
      toast.success("Account created");
      enterAuthenticatedHome(createdUser.role);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 text-foreground">
      <div className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at top, var(--gradient-glow), transparent 70%)",
          }}
        />
        <div className="absolute inset-0 grid-bg opacity-40" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-strong rounded-2xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center text-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center glow-primary mb-3"
            style={{ background: "var(--gradient-aurora)" }}
          >
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display text-2xl text-gradient">VISION MENTOR X</h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
            {mode === "login" ? "Sign in to continue" : "Create your account"}
          </p>
        </div>

        <div className="flex gap-1 p-1 rounded-lg glass mb-6">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 text-xs uppercase tracking-widest font-display rounded-md transition-all ${
                mode === m
                  ? "bg-primary text-primary-foreground glow-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {mode === "login" ? (
          <>
            <div className="glass rounded-lg p-3 mb-4 text-xs">
              <div className="flex items-start gap-2">
                <KeyRound className="w-4 h-4 mt-0.5 text-cyber shrink-0" />
                <div className="flex-1">
                  <div className="font-display uppercase tracking-widest text-[10px] text-muted-foreground">
                    Demo accounts
                  </div>
                  <div className="font-mono mt-1 text-[11px] break-all">
                    {DEMO_EMAIL} <span className="text-muted-foreground">(individual)</span>
                  </div>
                  <div className="font-mono text-[11px] break-all">
                    {DEMO_COMPANY_EMAIL} <span className="text-muted-foreground">(company)</span>
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                    password: {DEMO_PASSWORD}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => fillDemo("individual")}
                  className="flex-1 text-primary text-[11px] hover:underline"
                >
                  Use individual
                </button>
                <button
                  onClick={() => fillDemo("company")}
                  className="flex-1 text-primary text-[11px] hover:underline"
                >
                  Use company
                </button>
              </div>
            </div>

            <form onSubmit={onSignIn} className="space-y-3">
              <Field icon={<Mail className="w-4 h-4 text-muted-foreground" />}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 bg-transparent outline-none py-3 text-sm"
                />
              </Field>
              <Field icon={<Lock className="w-4 h-4 text-muted-foreground" />}>
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 bg-transparent outline-none py-3 text-sm"
                />
                <PwToggle shown={showPw} onClick={() => setShowPw((v) => !v)} />
              </Field>
              <Button
                type="submit"
                disabled={busy}
                className="w-full glow-primary"
                style={{ background: "var(--gradient-aurora)" }}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
              </Button>
            </form>
          </>
        ) : (
          <form onSubmit={onSignUp} className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                Account type
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    v: "individual" as const,
                    label: "Individual",
                    icon: <UserCircle className="w-4 h-4" />,
                  },
                  {
                    v: "company" as const,
                    label: "Company",
                    icon: <Building2 className="w-4 h-4" />,
                  },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setRole(opt.v)}
                    className={`glass rounded-lg py-2.5 px-3 text-xs flex items-center justify-center gap-2 transition-all ${
                      role === opt.v
                        ? "border border-primary text-foreground glow-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.icon}
                    <span className="uppercase tracking-widest font-display">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <Field icon={<User className="w-4 h-4 text-muted-foreground" />}>
              <input
                required
                minLength={2}
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={role === "company" ? "Company name" : "Full name"}
                className="flex-1 bg-transparent outline-none py-3 text-sm"
              />
            </Field>
            <Field icon={<Mail className="w-4 h-4 text-muted-foreground" />}>
              <input
                type="email"
                required
                value={suEmail}
                onChange={(e) => setSuEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 bg-transparent outline-none py-3 text-sm"
              />
            </Field>
            <Field icon={<Lock className="w-4 h-4 text-muted-foreground" />}>
              <input
                type={showSuPw ? "text" : "password"}
                required
                minLength={8}
                value={suPassword}
                onChange={(e) => setSuPassword(e.target.value)}
                placeholder="Password (8+ chars, letter & number)"
                className="flex-1 bg-transparent outline-none py-3 text-sm"
              />
              <PwToggle shown={showSuPw} onClick={() => setShowSuPw((v) => !v)} />
            </Field>
            <Field icon={<Lock className="w-4 h-4 text-muted-foreground" />}>
              <input
                type={showSuConfirm ? "text" : "password"}
                required
                minLength={8}
                value={suConfirm}
                onChange={(e) => setSuConfirm(e.target.value)}
                placeholder="Confirm password"
                className="flex-1 bg-transparent outline-none py-3 text-sm"
              />
              <PwToggle shown={showSuConfirm} onClick={() => setShowSuConfirm((v) => !v)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field icon={<Calendar className="w-4 h-4 text-muted-foreground" />}>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="flex-1 bg-transparent outline-none py-3 text-sm"
                />
              </Field>
              <Field icon={<Globe className="w-4 h-4 text-muted-foreground" />}>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="flex-1 bg-transparent outline-none py-3 text-sm"
                >
                  <option value="">Country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c} className="bg-background">
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I agree to the <span className="text-primary">Terms</span> and{" "}
                <span className="text-primary">Privacy Policy</span>.
              </span>
            </label>
            <Button
              type="submit"
              disabled={busy}
              className="w-full glow-primary"
              style={{ background: "var(--gradient-aurora)" }}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center pt-1">
              Your account is saved privately in this browser — no server, no third party.
            </p>
          </form>
        )}
      </motion.div>

      <Toaster position="top-right" />
    </div>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass rounded-lg flex items-center px-3 gap-2">
      {icon}
      {children}
    </div>
  );
}

function PwToggle({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={shown ? "Hide password" : "Show password"}
      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
      tabIndex={-1}
    >
      {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}
