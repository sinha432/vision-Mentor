import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useTheme } from "@/contexts/ThemeContext";
import { Camera, Mic, Sun, Moon, Monitor, Volume2, LogOut, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoAuth } from "@/contexts/DemoAuthContext";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

type PermState = "granted" | "denied" | "prompt" | "unknown";

export type SettingsValues = {
  cameraEnabled: boolean;
  micEnabled: boolean;
  voiceReplies: boolean;
};

export function SettingsPanel({
  open,
  onOpenChange,
  values,
  onChange,
  userEmail,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  values: SettingsValues;
  onChange: (v: SettingsValues) => void;
  userEmail?: string | null;
}) {
  const { theme, setTheme } = useTheme();
  const [cam, setCam] = useState<PermState>("unknown");
  const [mic, setMic] = useState<PermState>("unknown");
  const navigate = useNavigate();

  useEffect(() => {
    if (!open || !navigator.permissions) return;
    let canceled = false;
    const refresh = async () => {
      try {
        const c = await navigator.permissions.query({ name: "camera" as PermissionName });
        const m = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (canceled) return;
        setCam(c.state as PermState);
        setMic(m.state as PermState);
        c.onchange = () => setCam(c.state as PermState);
        m.onchange = () => setMic(m.state as PermState);
      } catch {/* unsupported */}
    };
    refresh();
    return () => { canceled = true; };
  }, [open]);

  const requestCam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
      setCam("granted");
      toast.success("Camera access granted");
    } catch { toast.error("Camera access denied"); setCam("denied"); }
  };
  const requestMic = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      setMic("granted");
      toast.success("Microphone access granted");
    } catch { toast.error("Microphone access denied"); setMic("denied"); }
  };

  const { signOut: doSignOut } = useDemoAuth();
  const signOut = async () => {
    doSignOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="glass-strong border-l border-border w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-xl text-gradient">Settings</SheetTitle>
          <SheetDescription>Manage permissions, appearance, and your account.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Permissions */}
          <Section title="Permissions">
            <PermRow
              icon={<Camera className="w-4 h-4" />}
              label="Camera"
              state={cam}
              enabled={values.cameraEnabled}
              onToggle={(v) => onChange({ ...values, cameraEnabled: v })}
              onRequest={requestCam}
            />
            <PermRow
              icon={<Mic className="w-4 h-4" />}
              label="Microphone"
              state={mic}
              enabled={values.micEnabled}
              onToggle={(v) => onChange({ ...values, micEnabled: v })}
              onRequest={requestMic}
            />
          </Section>

          {/* Appearance */}
          <Section title="Appearance">
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "light", icon: <Sun className="w-4 h-4" />, label: "Light" },
                { key: "dark", icon: <Moon className="w-4 h-4" />, label: "Dark" },
                { key: "system", icon: <Monitor className="w-4 h-4" />, label: "System" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setTheme(opt.key as any)}
                  className={`glass rounded-lg p-3 flex flex-col items-center gap-1.5 transition-all ${
                    theme === opt.key ? "ring-2 ring-primary glow-primary" : "hover:bg-foreground/5"
                  }`}
                >
                  {opt.icon}
                  <span className="text-[10px] uppercase tracking-widest">{opt.label}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* Voice */}
          <Section title="Voice">
            <Row icon={<Volume2 className="w-4 h-4" />} label="AI voice replies">
              <Toggle checked={values.voiceReplies} onChange={(v) => onChange({ ...values, voiceReplies: v })} />
            </Row>
          </Section>

          {/* Account */}
          <Section title="Account">
            <div className="glass rounded-lg p-3 space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Signed in as</div>
                <div className="text-sm font-medium truncate">{userEmail ?? "—"}</div>
              </div>
              <Button onClick={signOut} variant="outline" className="w-full">
                <LogOut className="w-4 h-4" /> Sign out
              </Button>
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-lg p-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2"><span className="text-cyber">{icon}</span><span className="text-sm">{label}</span></div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

function PermRow({
  icon, label, state, enabled, onToggle, onRequest,
}: {
  icon: React.ReactNode; label: string; state: PermState;
  enabled: boolean; onToggle: (v: boolean) => void; onRequest: () => void;
}) {
  const badge = {
    granted: { text: "Granted", cls: "text-emerald-500", Icon: ShieldCheck },
    denied: { text: "Denied", cls: "text-destructive", Icon: ShieldAlert },
    prompt: { text: "Prompt", cls: "text-amber-500", Icon: ShieldQuestion },
    unknown: { text: "Unknown", cls: "text-muted-foreground", Icon: ShieldQuestion },
  }[state];
  const B = badge.Icon;
  return (
    <div className="glass rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><span className="text-cyber">{icon}</span><span className="text-sm">{label}</span></div>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-1.5 text-[11px] ${badge.cls}`}>
          <B className="w-3.5 h-3.5" /> {badge.text}
        </div>
        {state !== "granted" && (
          <button onClick={onRequest} className="text-[11px] text-primary hover:underline">Request access</button>
        )}
      </div>
    </div>
  );
}
