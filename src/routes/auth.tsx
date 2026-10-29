import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChartNoAxesColumnIncreasing,
  Sparkles,
  Mail,
  Lock,
  Loader2,
  User,
  Calendar,
  Globe,
  Eye,
  EyeOff,
  Building2,
  UserCircle,
  ArrowLeft,
  ShieldCheck,
  MessageSquareText,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useDemoAuth, type UserRole } from "@/contexts/DemoAuthContext";
import novaAvatar from "@/assets/nova-cutout.png";

type AuthSearch = {
  redirect?: string;
};

type RecoveryStep = "email" | "otp" | "password";

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
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" }) as AuthSearch;

  const redirectTo = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/";

  const { user, ready, signIn, signUp } = useDemoAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);

  /* Login */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginRole, setLoginRole] = useState<UserRole>("individual");

  /* Signup */
  const [name, setName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");
  const [dob, setDob] = useState("");
  const [country, setCountry] = useState("");
  const [role, setRole] = useState<UserRole>("individual");
  const [agree, setAgree] = useState(false);

  /* Password visibility */
  const [showPw, setShowPw] = useState(false);
  const [showSuPw, setShowSuPw] = useState(false);
  const [showSuConfirm, setShowSuConfirm] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);

  /* Forgot password */
  const [forgotMode, setForgotMode] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>("email");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const enterAuthenticatedHome = useCallback(
    (authenticatedRole: UserRole) => {
      if (redirectTo !== "/") {
        navigate({ to: redirectTo });
        return;
      }

      if (authenticatedRole === "company") {
        navigate({ to: "/dashboard", replace: true });
        return;
      }

      navigate({ to: "/interviewer", replace: true });
    },
    [navigate, redirectTo],
  );

  useEffect(() => {
    if (ready && user) {
      enterAuthenticatedHome(user.role);
    }
  }, [ready, user, enterAuthenticatedHome]);

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = window.setInterval(() => {
      setResendCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    setBusy(true);

    try {
      const signedInUser = await signIn(email, password, loginRole);

      if (signedInUser.role !== loginRole) {
        throw new Error(
          `This account is registered as ${signedInUser.role}. Please select ${signedInUser.role} to sign in.`,
        );
      }

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

    if (suPassword !== suConfirm) {
      toast.error("Passwords don't match");
      return;
    }

    if (suPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (!/[A-Za-z]/.test(suPassword) || !/\d/.test(suPassword)) {
      toast.error("Password must contain at least one letter and one number");
      return;
    }

    if (!agree) {
      toast.error("Please accept the Terms");
      return;
    }

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

      toast.success("Account created successfully");

      enterAuthenticatedHome(createdUser.role);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    const normalizedEmail = recoveryEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error("Enter your registered email");
      return;
    }

    if (!normalizedEmail.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          purpose: "password_reset",
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not send OTP");
      }

      setRecoveryEmail(normalizedEmail);
      setRecoveryStep("otp");
      setOtp("");
      setResendCooldown(60);

      toast.success("OTP sent to your email");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(otp.trim())) {
      toast.error("Enter the 6-digit OTP");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: recoveryEmail,
          code: otp.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Invalid OTP");
      }

      if (!data?.resetToken) {
        throw new Error("OTP verified, but no reset token was returned");
      }

      setResetToken(data.resetToken);
      setRecoveryStep("password");
      toast.success("Email verified");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!resetToken) {
      toast.error("Please verify your OTP first");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error("Passwords don't match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      toast.error("Password must contain at least one letter and one number");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: recoveryEmail,
          password: newPassword,
          resetToken,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not reset password");
      }

      toast.success("Password updated successfully");

      setResetToken("");
      setForgotMode(false);
      setRecoveryStep("email");
      setRecoveryEmail("");
      setOtp("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setPassword("");
      setLoginRole("individual");
      setMode("login");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    if (resendCooldown > 0 || resendBusy) return;

    setResendBusy(true);

    try {
      const response = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: recoveryEmail,
          purpose: "password_reset",
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not resend OTP");
      }

      setResendCooldown(60);
      setOtp("");

      toast.success("A new OTP has been sent");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not resend OTP");
    } finally {
      setResendBusy(false);
    }
  };

  const openForgotPassword = () => {
    setForgotMode(true);
    setRecoveryStep("email");
    setRecoveryEmail(email.trim().toLowerCase());
    setOtp("");
    setResetToken("");
    setNewPassword("");
    setNewPasswordConfirm("");
  };

  const closeForgotPassword = () => {
    setForgotMode(false);
    setRecoveryStep("email");
    setOtp("");
    setResetToken("");
    setNewPassword("");
    setNewPasswordConfirm("");
  };

  return (
    <main className="auth-page relative min-h-screen overflow-x-hidden bg-[#050A1B] px-4 py-8 text-[#F4F7FF] sm:px-6 lg:py-10">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_18%_36%,rgba(0,170,255,0.13),transparent_35%),radial-gradient(ellipse_at_76%_68%,rgba(113,64,226,0.12),transparent_38%),linear-gradient(115deg,#050A1B_0%,#07142B_52%,#090D22_100%)]" />
        <div className="absolute inset-x-[4%] top-[7%] hidden h-[72%] rounded-[50%] border border-cyan-300/[0.06] shadow-[inset_0_0_90px_rgba(0,115,190,0.04)] xl:block" />
        <svg
          viewBox="0 0 1640 420"
          preserveAspectRatio="xMidYMax slice"
          className="absolute inset-x-0 bottom-0 h-[38%] w-full opacity-55"
        >
          <defs>
            <linearGradient id="auth-sky" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#263c74" stopOpacity=".08" />
              <stop offset=".58" stopColor="#264878" stopOpacity=".32" />
              <stop offset="1" stopColor="#081226" stopOpacity=".7" />
            </linearGradient>
            <linearGradient id="auth-mountain" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#3b5f9a" stopOpacity=".42" />
              <stop offset="1" stopColor="#131e3e" stopOpacity=".82" />
            </linearGradient>
          </defs>
          <path d="M0 72H1640V420H0Z" fill="url(#auth-sky)" />
          <path
            d="M0 268 110 226 222 249 360 151 470 224 599 119 740 239 890 151 1018 225 1156 125 1305 234 1446 163 1542 211 1640 177V420H0Z"
            fill="url(#auth-mountain)"
          />
          <path
            d="m0 318 155-53 126 36 173-92 154 92 143-39 177 70 154-105 180 89 167-83 211 63v124H0Z"
            fill="#09152b"
            fillOpacity=".76"
          />
          <path d="M0 370H1640" stroke="#52d9ff" strokeOpacity=".2" />
        </svg>
        <div className="absolute inset-x-0 bottom-0 h-[16%] bg-[linear-gradient(180deg,transparent,rgba(0,8,23,0.76))]" />
        <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(72,152,205,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(72,152,205,0.12)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,transparent,black_45%,transparent)]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-5rem)] w-full max-w-[1540px] items-center gap-8 xl:grid-cols-[minmax(18rem,1fr)_minmax(15rem,0.82fr)_minmax(22rem,1fr)] xl:gap-8">
        <section className="mx-auto w-full max-w-xl xl:mx-0">
          <Link
            to="/welcome"
            className="mb-7 inline-flex items-center gap-2 text-xs font-medium text-[#9AAAC7] transition-colors hover:text-cyan-200"
          >
            <ArrowLeft className="size-4" /> Back to VisionMentor X
          </Link>

          <Link to="/welcome" className="mb-10 flex w-fit items-center gap-3">
            <BrandLogo className="size-11 rounded-xl border border-cyan-200/25 bg-slate-950/60 shadow-[0_0_22px_-8px_rgba(0,217,255,0.75)]" />
            <span>
              <span className="block font-display text-sm tracking-[0.16em] text-white">
                VISION MENTOR <span className="text-[#BD55F5]">X</span>
              </span>
              <span className="mt-1 block text-xs text-[#9AAAC7]">Your AI Career Companion</span>
            </span>
          </Link>

          <p className="mb-4 flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-[#00D9FF] uppercase sm:text-xs">
            <Sparkles className="size-4" /> Your next interview starts here
          </p>
          <h2 className="max-w-xl font-sans text-4xl font-semibold leading-[1.08] tracking-tight text-[#F4F7FF] sm:text-5xl 2xl:text-[3.6rem]">
            <span className="block">Practice with</span>
            <span className="block text-[#168BFF]">purpose. Show up</span>
            <span className="block bg-linear-to-r from-[#49dfff] to-[#BD55F5] bg-clip-text text-transparent">
              with confidence.
            </span>
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-[#9AAAC7] sm:text-base">
            Step into realistic interview practice with thoughtful feedback on your answers,
            delivery, and progress.
          </p>

          <div className="mt-8 grid max-w-lg grid-cols-3 gap-3 sm:gap-4">
            {[
              { icon: MessageSquareText, label: "AI interview practice" },
              { icon: FileText, label: "Resume insights" },
              { icon: ChartNoAxesColumnIncreasing, label: "Progress reports" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center text-center">
                <span className="grid size-11 place-items-center rounded-xl border border-[#12365A] bg-[#09142B]/80 text-[#00D9FF] shadow-[0_0_18px_-12px_rgba(0,217,255,0.8)]">
                  <Icon className="size-5" />
                </span>
                <span className="mt-2 text-[10px] leading-snug text-[#B5C5DE] sm:text-xs">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="relative mx-auto flex h-[300px] w-full max-w-[390px] items-end justify-center sm:h-[390px] xl:h-[min(72vh,700px)] xl:max-w-none">
          <div
            aria-hidden="true"
            className="absolute bottom-[5%] left-1/2 h-8 w-[82%] -translate-x-1/2 rounded-[50%] border border-cyan-300/25 bg-cyan-300/10 shadow-[0_0_38px_8px_rgba(0,190,255,0.18)]"
          />
          <motion.img
            src={novaAvatar}
            alt="Nova, your friendly VisionMentor X AI career companion"
            initial={reducedMotion ? false : { opacity: 0, y: 14 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: [0, -5, 0] }}
            transition={{
              opacity: { duration: reducedMotion ? 0 : 0.6 },
              y: {
                duration: reducedMotion ? 0 : 5,
                repeat: reducedMotion ? 0 : Infinity,
                ease: "easeInOut",
              },
            }}
            className="relative z-10 h-full max-h-[700px] w-full object-contain drop-shadow-[0_18px_40px_rgba(0,155,255,0.18)]"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 mx-auto w-full max-w-[420px] rounded-[26px] border border-[#12365A] bg-[#09142B]/95 p-6 shadow-[0_24px_80px_-32px_rgba(0,170,255,0.42)] backdrop-blur-2xl sm:p-8 xl:mx-0"
        >
          <div className="mb-6 flex flex-col items-center text-center">
            <BrandLogo className="mb-3 size-14 rounded-2xl shadow-[0_0_28px_-8px_rgba(0,217,255,0.8)]" />

            <h1 className="font-display text-xl tracking-[0.12em] text-white">
              VISION MENTOR <span className="text-[#BD55F5]">X</span>
            </h1>

            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#9AAAC7]">
              {forgotMode
                ? "Reset your password"
                : mode === "login"
                  ? "Sign in to continue"
                  : "Create your account"}
            </p>
          </div>

          {forgotMode ? (
            <ForgotPasswordView
              step={recoveryStep}
              email={recoveryEmail}
              setEmail={setRecoveryEmail}
              otp={otp}
              setOtp={setOtp}
              newPassword={newPassword}
              setNewPassword={setNewPassword}
              newPasswordConfirm={newPasswordConfirm}
              setNewPasswordConfirm={setNewPasswordConfirm}
              showNewPw={showNewPw}
              setShowNewPw={setShowNewPw}
              showNewConfirm={showNewConfirm}
              setShowNewConfirm={setShowNewConfirm}
              busy={busy}
              resendBusy={resendBusy}
              resendCooldown={resendCooldown}
              sendOtp={sendOtp}
              verifyOtp={verifyOtp}
              resetPassword={resetPassword}
              resendOtp={resendOtp}
              onBack={closeForgotPassword}
            />
          ) : (
            <>
              <div className="mb-6 flex gap-1 rounded-xl border border-[#12365A] bg-[#050A1B] p-1">
                {(["login", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`flex-1 py-2 text-xs uppercase tracking-widest font-display rounded-md transition-all ${
                      mode === m
                        ? "bg-[#00D9FF] text-[#04101D] shadow-[0_0_18px_-8px_rgba(0,217,255,0.8)]"
                        : "text-[#9AAAC7] hover:text-white"
                    }`}
                  >
                    {m === "login" ? "Sign In" : "Create Account"}
                  </button>
                ))}
              </div>

              {mode === "login" ? (
                <form onSubmit={onSignIn} className="space-y-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                      Sign in as
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
                          onClick={() => setLoginRole(opt.v)}
                          className={`flex items-center justify-center gap-2 rounded-xl border bg-[#050A1B] px-3 py-2.5 text-xs transition-all ${
                            loginRole === opt.v
                              ? "border-[#00D9FF] text-white shadow-[0_0_20px_-10px_rgba(0,217,255,0.8)]"
                              : "border-[#12365A] text-[#9AAAC7] hover:text-white"
                          }`}
                          aria-pressed={loginRole === opt.v}
                        >
                          {opt.icon}
                          <span className="uppercase tracking-widest font-display">
                            {opt.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Field icon={<Mail className="w-4 h-4 text-muted-foreground" />}>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="flex-1 bg-transparent outline-none py-3 text-sm"
                      autoComplete="email"
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
                      autoComplete="current-password"
                    />
                    <PwToggle shown={showPw} onClick={() => setShowPw((v) => !v)} />
                  </Field>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={openForgotPassword}
                      className="text-xs text-[#00D9FF] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <Button
                    type="submit"
                    disabled={busy}
                    className="w-full border-0 font-semibold text-[#04101D] shadow-[0_0_28px_-10px_rgba(0,217,255,0.8)]"
                    style={{
                      background: "linear-gradient(105deg,#00D9FF 0%,#168BFF 55%,#BD55F5 100%)",
                    }}
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
                  </Button>
                </form>
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
                          className={`flex items-center justify-center gap-2 rounded-xl border bg-[#050A1B] px-3 py-2.5 text-xs transition-all ${
                            role === opt.v
                              ? "border-[#00D9FF] text-white shadow-[0_0_20px_-10px_rgba(0,217,255,0.8)]"
                              : "border-[#12365A] text-[#9AAAC7] hover:text-white"
                          }`}
                        >
                          {opt.icon}
                          <span className="uppercase tracking-widest font-display">
                            {opt.label}
                          </span>
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
                      autoComplete="name"
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
                      autoComplete="email"
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
                      autoComplete="new-password"
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
                      autoComplete="new-password"
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
                    className="w-full border-0 font-semibold text-[#04101D] shadow-[0_0_28px_-10px_rgba(0,217,255,0.8)]"
                    style={{
                      background: "linear-gradient(105deg,#00D9FF 0%,#168BFF 55%,#BD55F5 100%)",
                    }}
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
                  </Button>

                  <p className="text-[10px] text-muted-foreground text-center pt-1">
                    Your account is securely stored in MongoDB.
                  </p>
                </form>
              )}
            </>
          )}
        </motion.div>
      </div>

      <Toaster position="top-right" />
    </main>
  );
}

function ForgotPasswordView({
  step,
  email,
  setEmail,
  otp,
  setOtp,
  newPassword,
  setNewPassword,
  newPasswordConfirm,
  setNewPasswordConfirm,
  showNewPw,
  setShowNewPw,
  showNewConfirm,
  setShowNewConfirm,
  busy,
  resendBusy,
  resendCooldown,
  sendOtp,
  verifyOtp,
  resetPassword,
  resendOtp,
  onBack,
}: {
  step: RecoveryStep;
  email: string;
  setEmail: (value: string) => void;
  otp: string;
  setOtp: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  newPasswordConfirm: string;
  setNewPasswordConfirm: (value: string) => void;
  showNewPw: boolean;
  setShowNewPw: (value: boolean) => void;
  showNewConfirm: boolean;
  setShowNewConfirm: (value: boolean) => void;
  busy: boolean;
  resendBusy: boolean;
  resendCooldown: number;
  sendOtp: () => Promise<void>;
  verifyOtp: () => Promise<void>;
  resetPassword: () => Promise<void>;
  resendOtp: () => Promise<void>;
  onBack: () => void;
}) {
  if (step === "email") {
    return (
      <div className="space-y-4">
        <div className="text-center mb-5">
          <div className="mx-auto w-12 h-12 rounded-full glass flex items-center justify-center mb-3">
            <Mail className="w-5 h-5 text-primary" />
          </div>

          <h2 className="font-display text-lg">Reset Password</h2>

          <p className="text-xs text-muted-foreground mt-1">
            Enter the email registered with Vision Mentor X.
          </p>
        </div>

        <Field icon={<Mail className="w-4 h-4 text-muted-foreground" />}>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 bg-transparent outline-none py-3 text-sm"
            autoComplete="email"
          />
        </Field>

        <Button
          type="button"
          disabled={busy}
          onClick={() => void sendOtp()}
          className="w-full glow-primary"
          style={{
            background: "var(--gradient-aurora)",
          }}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send OTP"}
        </Button>

        <BackButton onClick={onBack} />
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className="space-y-4">
        <div className="text-center mb-5">
          <div className="mx-auto w-12 h-12 rounded-full glass flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>

          <h2 className="font-display text-lg">Verify Your Email</h2>

          <p className="text-xs text-muted-foreground mt-1">
            We sent a 6-digit verification code to
          </p>

          <p className="text-xs font-medium mt-1 break-all">{email}</p>
        </div>

        <Field icon={<ShieldCheck className="w-4 h-4 text-muted-foreground" />}>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoFocus
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit OTP"
            className="flex-1 bg-transparent outline-none py-3 text-center tracking-[0.4em] text-lg font-mono"
          />
        </Field>

        <Button
          type="button"
          disabled={busy}
          onClick={() => void verifyOtp()}
          className="w-full glow-primary"
          style={{
            background: "var(--gradient-aurora)",
          }}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify OTP"}
        </Button>

        <div className="text-center">
          <button
            type="button"
            disabled={resendCooldown > 0 || resendBusy}
            onClick={() => void resendOtp()}
            className="text-xs text-primary hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {resendBusy
              ? "Sending..."
              : resendCooldown > 0
                ? `Resend OTP in ${resendCooldown}s`
                : "Resend OTP"}
          </button>
        </div>

        <BackButton onClick={onBack} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-5">
        <div className="mx-auto w-12 h-12 rounded-full glass flex items-center justify-center mb-3">
          <Lock className="w-5 h-5 text-primary" />
        </div>

        <h2 className="font-display text-lg">Create New Password</h2>

        <p className="text-xs text-muted-foreground mt-1">Your email has been verified.</p>
      </div>

      <Field icon={<Lock className="w-4 h-4 text-muted-foreground" />}>
        <input
          type={showNewPw ? "text" : "password"}
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
          className="flex-1 bg-transparent outline-none py-3 text-sm"
          autoComplete="new-password"
        />

        <PwToggle shown={showNewPw} onClick={() => setShowNewPw(!showNewPw)} />
      </Field>

      <Field icon={<Lock className="w-4 h-4 text-muted-foreground" />}>
        <input
          type={showNewConfirm ? "text" : "password"}
          required
          minLength={8}
          value={newPasswordConfirm}
          onChange={(e) => setNewPasswordConfirm(e.target.value)}
          placeholder="Confirm new password"
          className="flex-1 bg-transparent outline-none py-3 text-sm"
          autoComplete="new-password"
        />

        <PwToggle shown={showNewConfirm} onClick={() => setShowNewConfirm(!showNewConfirm)} />
      </Field>

      <p className="text-[10px] text-muted-foreground">
        Minimum 8 characters with at least one letter and one number.
      </p>

      <Button
        type="button"
        disabled={busy}
        onClick={() => void resetPassword()}
        className="w-full glow-primary"
        style={{
          background: "var(--gradient-aurora)",
        }}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
      </Button>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground py-2"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      Back to Sign In
    </button>
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
