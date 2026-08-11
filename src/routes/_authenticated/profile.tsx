import { useState, useRef, type ChangeEvent, type KeyboardEvent, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  User, Mail, Phone, GraduationCap, School, BookOpen, Calendar, Hash,
  Briefcase, Linkedin, Github, Globe, Target, FileText, Upload, X,
  Sparkles, ArrowLeft, Save,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { useDemoAuth } from "@/contexts/DemoAuthContext";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

const DEGREES = ["B.Tech", "BCA", "B.Sc", "B.Com", "B.A", "M.Tech", "MCA", "M.Sc", "MBA", "PhD", "Other"];
const YEARS = ["1st", "2nd", "3rd", "4th", "5th"];
const GOALS = ["Interview prep", "Public speaking", "Viva / presentation practice", "General communication", "Other"];

function ProfilePage() {
  const { user } = useDemoAuth();

  // Identity
  const [fullName, setFullName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string>("");

  // Academic
  const [college, setCollege] = useState("");
  const [degree, setDegree] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [gradYear, setGradYear] = useState<string>("");
  const [rollNo, setRollNo] = useState("");

  // Career
  const [targetRole, setTargetRole] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [portfolio, setPortfolio] = useState("");

  // Application
  const [goal, setGoal] = useState("");
  const [resumeName, setResumeName] = useState("");

  const photoInput = useRef<HTMLInputElement>(null);
  const resumeInput = useRef<HTMLInputElement>(null);

  const onPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoName(f.name);
    const url = URL.createObjectURL(f);
    setPhotoPreview(url);
  };

  const onResume = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setResumeName(f.name);
  };

  const onSkillKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const v = skillInput.trim().replace(/,$/, "");
      if (v && !skills.includes(v)) setSkills([...skills, v]);
      setSkillInput("");
    } else if (e.key === "Backspace" && !skillInput && skills.length) {
      setSkills(skills.slice(0, -1));
    }
  };

  const removeSkill = (s: string) => setSkills(skills.filter((x) => x !== s));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      fullName, email: user?.email, phone, photoName,
      college, degree, branch, year, gradYear, rollNo,
      targetRole, skills, linkedin, github, portfolio,
      goal, resumeName,
    };
    // eslint-disable-next-line no-console
    console.log("[profile] submit payload →", payload);
    toast.success("Saved locally — connect MongoDB to persist.");
  };

  return (
    <div className="relative min-h-screen px-4 py-8 text-foreground">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at top, var(--gradient-glow), transparent 70%)" }} />
        <div className="absolute inset-0 grid-bg opacity-40" />
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center glow-primary" style={{ background: "var(--gradient-aurora)" }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-display text-sm text-gradient">VISION MENTOR X</span>
          </div>
        </div>

        <motion.form
          onSubmit={onSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-2xl p-6 md:p-8 shadow-2xl space-y-8"
        >
          <div>
            <h1 className="font-display text-2xl text-gradient">Your Profile</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Storage not wired yet — values won't persist across reloads. Hook up MongoDB later.
            </p>
          </div>

          {/* IDENTITY */}
          <Section title="Identity">
            <div className="grid md:grid-cols-2 gap-3">
              <Field icon={<User className="w-4 h-4 text-muted-foreground" />} label="Full name">
                <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" className="flex-1 bg-transparent outline-none py-3 text-sm" />
              </Field>
              <Field icon={<Mail className="w-4 h-4 text-muted-foreground" />} label="Email">
                <input readOnly value={user?.email ?? ""} className="flex-1 bg-transparent outline-none py-3 text-sm text-muted-foreground cursor-not-allowed" />
              </Field>
              <Field icon={<Phone className="w-4 h-4 text-muted-foreground" />} label="Phone">
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 90000 00000" className="flex-1 bg-transparent outline-none py-3 text-sm" />
              </Field>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Profile photo</div>
                <div className="glass rounded-lg flex items-center gap-3 px-3 py-2">
                  <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
                    {photoPreview ? (
                      <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <button type="button" onClick={() => photoInput.current?.click()} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Upload className="w-3 h-3" /> {photoName || "Upload image"}
                  </button>
                  <input ref={photoInput} type="file" accept="image/*" onChange={onPhoto} className="hidden" />
                </div>
              </div>
            </div>
          </Section>

          {/* ACADEMIC */}
          <Section title="Academic">
            <div className="grid md:grid-cols-2 gap-3">
              <Field icon={<School className="w-4 h-4 text-muted-foreground" />} label="College / institute">
                <input value={college} onChange={(e) => setCollege(e.target.value)} placeholder="IIT Bombay" className="flex-1 bg-transparent outline-none py-3 text-sm" />
              </Field>
              <Field icon={<GraduationCap className="w-4 h-4 text-muted-foreground" />} label="Degree">
                <select value={degree} onChange={(e) => setDegree(e.target.value)} className="flex-1 bg-transparent outline-none py-3 text-sm">
                  <option value="">Select degree</option>
                  {DEGREES.map((d) => <option key={d} value={d} className="bg-background">{d}</option>)}
                </select>
              </Field>
              <Field icon={<BookOpen className="w-4 h-4 text-muted-foreground" />} label="Branch / major">
                <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Computer Science" className="flex-1 bg-transparent outline-none py-3 text-sm" />
              </Field>
              <Field icon={<Calendar className="w-4 h-4 text-muted-foreground" />} label="Current year">
                <select value={year} onChange={(e) => setYear(e.target.value)} className="flex-1 bg-transparent outline-none py-3 text-sm">
                  <option value="">Select year</option>
                  {YEARS.map((y) => <option key={y} value={y} className="bg-background">{y} year</option>)}
                </select>
              </Field>
              <Field icon={<Calendar className="w-4 h-4 text-muted-foreground" />} label="Expected graduation year">
                <input type="number" min={2024} max={2035} value={gradYear} onChange={(e) => setGradYear(e.target.value)} placeholder="2027" className="flex-1 bg-transparent outline-none py-3 text-sm" />
              </Field>
              <Field icon={<Hash className="w-4 h-4 text-muted-foreground" />} label="Roll / enrollment ID (optional)">
                <input value={rollNo} onChange={(e) => setRollNo(e.target.value)} placeholder="21CS1234" className="flex-1 bg-transparent outline-none py-3 text-sm" />
              </Field>
            </div>
          </Section>

          {/* CAREER */}
          <Section title="Career">
            <div className="grid md:grid-cols-2 gap-3">
              <Field icon={<Briefcase className="w-4 h-4 text-muted-foreground" />} label="Target role">
                <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="SDE Intern" className="flex-1 bg-transparent outline-none py-3 text-sm" />
              </Field>
              <Field icon={<Linkedin className="w-4 h-4 text-muted-foreground" />} label="LinkedIn (optional)">
                <input type="url" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/…" className="flex-1 bg-transparent outline-none py-3 text-sm" />
              </Field>
              <Field icon={<Github className="w-4 h-4 text-muted-foreground" />} label="GitHub (optional)">
                <input type="url" value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/…" className="flex-1 bg-transparent outline-none py-3 text-sm" />
              </Field>
              <Field icon={<Globe className="w-4 h-4 text-muted-foreground" />} label="Portfolio (optional)">
                <input type="url" value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="https://you.dev" className="flex-1 bg-transparent outline-none py-3 text-sm" />
              </Field>
            </div>
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Key skills</div>
              <div className="glass rounded-lg px-3 py-2 flex flex-wrap items-center gap-2 min-h-[46px]">
                {skills.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-primary/15 text-primary">
                    {s}
                    <button type="button" onClick={() => removeSkill(s)} aria-label={`Remove ${s}`} className="hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={onSkillKey}
                  placeholder={skills.length ? "" : "Type a skill and press Enter"}
                  className="flex-1 min-w-[140px] bg-transparent outline-none py-2 text-sm"
                />
              </div>
            </div>
          </Section>

          {/* APPLICATION */}
          <Section title="Application">
            <div className="grid md:grid-cols-2 gap-3">
              <Field icon={<Target className="w-4 h-4 text-muted-foreground" />} label="Practice goal">
                <select value={goal} onChange={(e) => setGoal(e.target.value)} className="flex-1 bg-transparent outline-none py-3 text-sm">
                  <option value="">Select goal</option>
                  {GOALS.map((g) => <option key={g} value={g} className="bg-background">{g}</option>)}
                </select>
              </Field>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Resume (PDF / DOCX)</div>
                <div className="glass rounded-lg flex items-center gap-3 px-3 py-2">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <button type="button" onClick={() => resumeInput.current?.click()} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Upload className="w-3 h-3" /> {resumeName || "Upload resume"}
                  </button>
                  <input ref={resumeInput} type="file" accept=".pdf,.doc,.docx" onChange={onResume} className="hidden" />
                </div>
              </div>
            </div>
          </Section>

          <div className="sticky bottom-4 pt-2">
            <Button type="submit" className="w-full glow-primary" style={{ background: "var(--gradient-aurora)" }}>
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </div>
        </motion.form>
      </div>

      <Toaster position="top-right" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className="glass rounded-lg flex items-center px-3 gap-2">
        {icon}
        {children}
      </div>
    </div>
  );
}
