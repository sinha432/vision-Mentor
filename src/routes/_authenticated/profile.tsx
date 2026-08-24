import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  School,
  BookOpen,
  Calendar,
  Hash,
  Briefcase,
  Linkedin,
  Github,
  Globe,
  Target,
  FileText,
  Upload,
  X,
  Sparkles,
  ArrowLeft,
  Save,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { useDemoAuth } from "@/contexts/DemoAuthContext";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

const DEGREES = [
  "B.Tech",
  "BCA",
  "B.Sc",
  "B.E",
  "B.Com",
  "B.A",
  "M.Tech",
  "MCA",
  "M.Sc",
  "MBA",
  "PhD",
  "Other",
];

const YEARS = ["1st", "2nd", "3rd", "4th", "5th"];

const GOALS = [
  "Interview prep",
  "Public speaking",
  "Viva / presentation practice",
  "General communication",
  "Other",
];

type ProfileData = {
  fullName: string;
  email: string;
  phone: string;
  photoName: string;
  photoPreview: string;

  college: string;
  degree: string;
  branch: string;
  year: string;
  gradYear: string;
  rollNo: string;

  targetRole: string;
  skills: string[];
  linkedin: string;
  github: string;
  portfolio: string;

  goal: string;
  resumeName: string;

  updatedAt: string;
};

function getStorageKey(email: string) {
  return `vmx_profile_${email.trim().toLowerCase()}`;
}

/**
 * Resize/compress the uploaded image before storing it.
 * This prevents localStorage from becoming too large.
 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const MAX_SIZE = 500;

        let width = image.width;
        let height = image.height;

        if (width > height && width > MAX_SIZE) {
          height = Math.round((height * MAX_SIZE) / width);
          width = MAX_SIZE;
        } else if (height >= width && height > MAX_SIZE) {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Could not process image"));
          return;
        }

        ctx.drawImage(image, 0, 0, width, height);

        const compressed = canvas.toDataURL("image/jpeg", 0.82);
        resolve(compressed);
      };

      image.onerror = () => reject(new Error("Invalid image"));
      image.src = String(reader.result);
    };

    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

function ProfilePage() {
  const { user } = useDemoAuth();

  // Identity
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");

  // Academic
  const [college, setCollege] = useState("");
  const [degree, setDegree] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [gradYear, setGradYear] = useState("");
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

  // UI
  const [savedAt, setSavedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);

  const photoInput = useRef<HTMLInputElement>(null);
  const resumeInput = useRef<HTMLInputElement>(null);

  /*
   * Load saved profile whenever the logged-in user changes.
   */
  useEffect(() => {
    if (!user?.email) return;

    const key = getStorageKey(user.email);

    try {
      const raw = localStorage.getItem(key);

      if (!raw) {
        setFullName(user.name ?? "");
        setPhone("");
        setPhotoName("");
        setPhotoPreview("");

        setCollege("");
        setDegree("");
        setBranch("");
        setYear("");
        setGradYear("");
        setRollNo("");

        setTargetRole("");
        setSkills([]);
        setSkillInput("");
        setLinkedin("");
        setGithub("");
        setPortfolio("");

        setGoal("");
        setResumeName("");

        setSavedAt("");
        setHasSavedProfile(false);

        return;
      }

      const profile = JSON.parse(raw) as Partial<ProfileData>;

      setFullName(profile.fullName ?? user.name ?? "");
      setPhone(profile.phone ?? "");
      setPhotoName(profile.photoName ?? "");
      setPhotoPreview(profile.photoPreview ?? "");

      setCollege(profile.college ?? "");
      setDegree(profile.degree ?? "");
      setBranch(profile.branch ?? "");
      setYear(profile.year ?? "");
      setGradYear(profile.gradYear ?? "");
      setRollNo(profile.rollNo ?? "");

      setTargetRole(profile.targetRole ?? "");
      setSkills(Array.isArray(profile.skills) ? profile.skills : []);
      setSkillInput("");
      setLinkedin(profile.linkedin ?? "");
      setGithub(profile.github ?? "");
      setPortfolio(profile.portfolio ?? "");

      setGoal(profile.goal ?? "");
      setResumeName(profile.resumeName ?? "");

      setSavedAt(profile.updatedAt ?? "");
      setHasSavedProfile(true);
    } catch (error) {
      console.error("[profile] failed to load saved profile:", error);
      toast.error("Could not load your saved profile.");
    }
  }, [user?.email, user?.name]);

  /*
   * Upload profile photo.
   *
   * Instead of URL.createObjectURL(), convert the image to a compressed
   * data URL so it can survive page reloads.
   */
  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Please select an image smaller than 10 MB.");
      return;
    }

    try {
      const compressedImage = await compressImage(file);

      setPhotoName(file.name);
      setPhotoPreview(compressedImage);

      toast.success("Profile photo updated.");
    } catch (error) {
      console.error("[profile] photo error:", error);
      toast.error("Could not process the selected image.");
    }

    // Allows selecting the same file again.
    e.target.value = "";
  };

  const onResume = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setResumeName(file.name);
    toast.success("Resume selected.");
  };

  const onSkillKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();

      const value = skillInput.trim().replace(/,$/, "");

      if (value && !skills.includes(value)) {
        setSkills((current) => [...current, value]);
      }

      setSkillInput("");
    } else if (e.key === "Backspace" && !skillInput && skills.length) {
      setSkills((current) => current.slice(0, -1));
    }
  };

  const removeSkill = (skill: string) => {
    setSkills((current) => current.filter((item) => item !== skill));
  };

  /*
   * Save complete profile.
   */
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!user?.email) {
      toast.error("You must be signed in to save your profile.");
      return;
    }

    setSaving(true);

    try {
      const profile: ProfileData = {
        fullName: fullName.trim(),
        email: user.email,
        phone: phone.trim(),
        photoName,
        photoPreview,

        college: college.trim(),
        degree,
        branch: branch.trim(),
        year,
        gradYear,
        rollNo: rollNo.trim(),

        targetRole: targetRole.trim(),
        skills,
        linkedin: linkedin.trim(),
        github: github.trim(),
        portfolio: portfolio.trim(),

        goal,
        resumeName,

        updatedAt: new Date().toISOString(),
      };

      const key = getStorageKey(user.email);

      localStorage.setItem(key, JSON.stringify(profile));

      // Also keep a simple reference for the current user's profile.
      localStorage.setItem("vmx_active_profile", JSON.stringify(profile));

      setSavedAt(profile.updatedAt);
      setHasSavedProfile(true);

      toast.success("Profile saved successfully.");
    } catch (error) {
      console.error("[profile] save error:", error);

      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        toast.error(
          "Storage is full. Please choose a smaller profile image.",
        );
      } else {
        toast.error("Could not save your profile.");
      }
    } finally {
      setSaving(false);
    }
  };

  const formattedSavedAt = savedAt
    ? new Date(savedAt).toLocaleString()
    : "";

  return (
    <div className="relative min-h-screen px-4 py-8 text-foreground">
      <div className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at top, var(--gradient-glow), transparent 70%)",
          }}
        />
        <div className="absolute inset-0 grid-bg opacity-40" />
      </div>

      <div className="max-w-3xl mx-auto">
        {/* TOP BAR */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>

          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center glow-primary"
              style={{ background: "var(--gradient-aurora)" }}
            >
              <Sparkles className="w-4 h-4 text-white" />
            </div>

            <span className="font-display text-sm text-gradient">
              VISION MENTOR X
            </span>
          </div>
        </div>

        <motion.form
          onSubmit={onSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-2xl p-6 md:p-8 shadow-2xl space-y-8"
        >
          {/* HEADER */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl text-gradient">
                  Your Profile
                </h1>

                <p className="text-xs text-muted-foreground mt-1">
                  Update your personal, academic and career information.
                  Changes are saved automatically to your profile storage.
                </p>
              </div>

              {hasSavedProfile && (
                <div className="hidden sm:flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved
                </div>
              )}
            </div>

            {formattedSavedAt && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Last saved: {formattedSavedAt}
              </p>
            )}
          </div>

          {/* PROFILE PREVIEW */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-muted border border-primary/30 shrink-0 flex items-center justify-center">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt={`${fullName || "Profile"} profile`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-7 h-7 text-muted-foreground" />
                )}
              </div>

              <div className="min-w-0">
                <p className="font-display text-lg truncate">
                  {fullName || "Your Name"}
                </p>

                <p className="text-xs text-muted-foreground truncate">
                  {targetRole || "Add your target role"}
                </p>

                <p className="text-xs text-muted-foreground truncate">
                  {user?.email || "No email"}
                </p>
              </div>

              {hasSavedProfile && (
                <div className="ml-auto hidden md:flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Profile Active
                </div>
              )}
            </div>
          </div>

          {/* IDENTITY */}
          <Section title="Identity">
            <div className="grid md:grid-cols-2 gap-3">
              <Field
                icon={<User className="w-4 h-4 text-muted-foreground" />}
                label="Full name"
              >
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="flex-1 bg-transparent outline-none py-3 text-sm"
                />
              </Field>

              <Field
                icon={<Mail className="w-4 h-4 text-muted-foreground" />}
                label="Email"
              >
                <input
                  readOnly
                  value={user?.email ?? ""}
                  className="flex-1 bg-transparent outline-none py-3 text-sm text-muted-foreground cursor-not-allowed"
                />
              </Field>

              <Field
                icon={<Phone className="w-4 h-4 text-muted-foreground" />}
                label="Phone"
              >
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 90000 00000"
                  className="flex-1 bg-transparent outline-none py-3 text-sm"
                />
              </Field>

              {/* PROFILE PHOTO */}
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Profile photo
                </div>

                <div className="glass rounded-lg flex items-center gap-3 px-3 py-2">
                  <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0 border border-primary/20">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Profile preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => photoInput.current?.click()}
                    className="text-xs text-primary hover:underline flex items-center gap-1 min-w-0"
                  >
                    <Upload className="w-3 h-3 shrink-0" />

                    <span className="truncate">
                      {photoName || "Upload image"}
                    </span>
                  </button>

                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/*"
                    onChange={onPhoto}
                    className="hidden"
                  />
                </div>

                {photoPreview && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Photo preview is ready and will be saved with your profile.
                  </p>
                )}
              </div>
            </div>
          </Section>

          {/* ACADEMIC */}
          <Section title="Academic">
            <div className="grid md:grid-cols-2 gap-3">
              <Field
                icon={<School className="w-4 h-4 text-muted-foreground" />}
                label="College / institute"
              >
                <input
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  placeholder="IIT Bombay"
                  className="flex-1 bg-transparent outline-none py-3 text-sm"
                />
              </Field>

              <Field
                icon={
                  <GraduationCap className="w-4 h-4 text-muted-foreground" />
                }
                label="Degree"
              >
                <select
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  className="flex-1 bg-transparent outline-none py-3 text-sm"
                >
                  <option value="">Select degree</option>

                  {DEGREES.map((item) => (
                    <option
                      key={item}
                      value={item}
                      className="bg-background"
                    >
                      {item}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                icon={<BookOpen className="w-4 h-4 text-muted-foreground" />}
                label="Branch / major"
              >
                <input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="Computer Science"
                  className="flex-1 bg-transparent outline-none py-3 text-sm"
                />
              </Field>

              <Field
                icon={<Calendar className="w-4 h-4 text-muted-foreground" />}
                label="Current year"
              >
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="flex-1 bg-transparent outline-none py-3 text-sm"
                >
                  <option value="">Select year</option>

                  {YEARS.map((item) => (
                    <option
                      key={item}
                      value={item}
                      className="bg-background"
                    >
                      {item} year
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                icon={<Calendar className="w-4 h-4 text-muted-foreground" />}
                label="Expected graduation year"
              >
                <input
                  type="number"
                  min={2024}
                  max={2035}
                  value={gradYear}
                  onChange={(e) => setGradYear(e.target.value)}
                  placeholder="2027"
                  className="flex-1 bg-transparent outline-none py-3 text-sm"
                />
              </Field>

              <Field
                icon={<Hash className="w-4 h-4 text-muted-foreground" />}
                label="Roll / enrollment ID (optional)"
              >
                <input
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  placeholder="21CS1234"
                  className="flex-1 bg-transparent outline-none py-3 text-sm"
                />
              </Field>
            </div>
          </Section>

          {/* CAREER */}
          <Section title="Career">
            <div className="grid md:grid-cols-2 gap-3">
              <Field
                icon={<Briefcase className="w-4 h-4 text-muted-foreground" />}
                label="Target role"
              >
                <input
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="SDE Intern"
                  className="flex-1 bg-transparent outline-none py-3 text-sm"
                />
              </Field>

              <Field
                icon={<Linkedin className="w-4 h-4 text-muted-foreground" />}
                label="LinkedIn (optional)"
              >
                <input
                  type="url"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/…"
                  className="flex-1 bg-transparent outline-none py-3 text-sm"
                />
              </Field>

              <Field
                icon={<Github className="w-4 h-4 text-muted-foreground" />}
                label="GitHub (optional)"
              >
                <input
                  type="url"
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  placeholder="https://github.com/…"
                  className="flex-1 bg-transparent outline-none py-3 text-sm"
                />
              </Field>

              <Field
                icon={<Globe className="w-4 h-4 text-muted-foreground" />}
                label="Portfolio (optional)"
              >
                <input
                  type="url"
                  value={portfolio}
                  onChange={(e) => setPortfolio(e.target.value)}
                  placeholder="https://you.dev"
                  className="flex-1 bg-transparent outline-none py-3 text-sm"
                />
              </Field>
            </div>

            {/* SKILLS */}
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                Key skills
              </div>

              <div className="glass rounded-lg px-3 py-2 flex flex-wrap items-center gap-2 min-h-[46px]">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-primary/15 text-primary"
                  >
                    {skill}

                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      aria-label={`Remove ${skill}`}
                      className="hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                <input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={onSkillKey}
                  placeholder={
                    skills.length
                      ? ""
                      : "Type a skill and press Enter"
                  }
                  className="flex-1 min-w-[140px] bg-transparent outline-none py-2 text-sm"
                />
              </div>
            </div>
          </Section>

          {/* APPLICATION */}
          <Section title="Application">
            <div className="grid md:grid-cols-2 gap-3">
              <Field
                icon={<Target className="w-4 h-4 text-muted-foreground" />}
                label="Practice goal"
              >
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="flex-1 bg-transparent outline-none py-3 text-sm"
                >
                  <option value="">Select goal</option>

                  {GOALS.map((item) => (
                    <option
                      key={item}
                      value={item}
                      className="bg-background"
                    >
                      {item}
                    </option>
                  ))}
                </select>
              </Field>

              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Resume (PDF / DOCX)
                </div>

                <div className="glass rounded-lg flex items-center gap-3 px-3 py-2">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />

                  <button
                    type="button"
                    onClick={() => resumeInput.current?.click()}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    {resumeName || "Upload resume"}
                  </button>

                  <input
                    ref={resumeInput}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={onResume}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* SAVED DETAILS */}
          {hasSavedProfile && (
            <div className="rounded-2xl border border-primary/20 bg-background/30 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-sm uppercase tracking-widest text-primary">
                    Saved Profile
                  </h2>

                  <p className="text-[10px] text-muted-foreground mt-1">
                    These are the details currently saved for this account.
                  </p>
                </div>

                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-muted border border-primary/20 flex items-center justify-center shrink-0">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Saved profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>

                <div>
                  <p className="font-medium">
                    {fullName || "Name not added"}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {user?.email}
                  </p>

                  {targetRole && (
                    <p className="text-xs text-primary mt-1">
                      {targetRole}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3 text-xs">
                <SavedDetail label="Phone" value={phone} />
                <SavedDetail label="College" value={college} />
                <SavedDetail label="Degree" value={degree} />
                <SavedDetail label="Branch" value={branch} />
                <SavedDetail label="Current year" value={year} />
                <SavedDetail
                  label="Graduation"
                  value={gradYear}
                />
                <SavedDetail
                  label="Roll / Enrollment"
                  value={rollNo}
                />
                <SavedDetail
                  label="Target role"
                  value={targetRole}
                />
                <SavedDetail
                  label="Practice goal"
                  value={goal}
                />
                <SavedDetail
                  label="Resume"
                  value={resumeName}
                />
              </div>

              {skills.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                    Skills
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(linkedin || github || portfolio) && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                    Links
                  </p>

                  <div className="space-y-1 text-xs">
                    {linkedin && (
                      <p className="truncate">
                        <span className="text-muted-foreground">
                          LinkedIn:
                        </span>{" "}
                        {linkedin}
                      </p>
                    )}

                    {github && (
                      <p className="truncate">
                        <span className="text-muted-foreground">
                          GitHub:
                        </span>{" "}
                        {github}
                      </p>
                    )}

                    {portfolio && (
                      <p className="truncate">
                        <span className="text-muted-foreground">
                          Portfolio:
                        </span>{" "}
                        {portfolio}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SAVE */}
          <div className="sticky bottom-4 pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="w-full glow-primary"
              style={{ background: "var(--gradient-aurora)" }}
            >
              {saving ? (
                <>
                  <span className="mr-2 h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Saving Profile...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </motion.form>
      </div>

      <Toaster position="top-right" />
    </div>
  );
}

function SavedDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  if (!value) return null;

  return (
    <div className="rounded-lg border border-border/40 bg-background/30 px-3 py-2">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 truncate text-foreground">
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h2 className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-3">
        {title}
      </h2>

      {children}
    </div>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </div>

      <div className="glass rounded-lg flex items-center px-3 gap-2">
        {icon}
        {children}
      </div>
    </div>
  );
}