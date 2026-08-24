import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, X, Save, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { useDemoAuth } from "@/contexts/DemoAuthContext";
import { createAssessment } from "@/lib/assessments.functions";
import { Shell } from "./index";

export const Route = createFileRoute("/_authenticated/company/new")({ component: NewAssessment });

type QType = "text" | "mcq" | "code";
type Choice = { id: string; text: string };
type TC = { input: string; expectedStdout: string };
type Q = {
  type: QType;
  text: string;
  weight: string;
  // text
  keywords: string;
  maxLength: string;
  // mcq
  choices: Choice[];
  correctChoiceId: string;
  // code
  starterCode: string;
  testCases: TC[];
};

const newCid = () => Math.random().toString(36).slice(2, 8);

const blankQ = (): Q => ({
  type: "text",
  text: "",
  weight: "1",
  keywords: "",
  maxLength: "",
  choices: [
    { id: newCid(), text: "" },
    { id: newCid(), text: "" },
  ],
  correctChoiceId: "",
  starterCode: `public class Main {\n    public static void main(String[] args) {\n        // read input, print output\n    }\n}\n`,
  testCases: [{ input: "", expectedStdout: "" }],
});

function NewAssessment() {
  const { user, signOut } = useDemoAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Q[]>([blankQ()]);
  const [busy, setBusy] = useState(false);

  if (user && user.role !== "company") { navigate({ to: "/" }); return null; }

  const addQ = () => setQuestions((qs) => [...qs, blankQ()]);
  const rmQ = (i: number) => setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  const setQ = (i: number, patch: Partial<Q>) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleaned = questions.map((q) => {
      const base = {
        type: q.type,
        text: q.text.trim(),
        weight: Number(q.weight) > 0 ? Number(q.weight) : 1,
      };
      if (q.type === "text") {
        return {
          ...base,
          keywords: q.keywords.split(",").map((s) => s.trim()).filter(Boolean),
          maxLength: q.maxLength.trim() ? Number(q.maxLength) : null,
        };
      }
      if (q.type === "mcq") {
        const choices = q.choices.map((c) => ({ id: c.id, text: c.text.trim() })).filter((c) => c.text);
        return { ...base, choices, correctChoiceId: q.correctChoiceId, keywords: [], maxLength: null };
      }
      // code
      const testCases = q.testCases.filter((t) => t.expectedStdout.trim() !== "" || t.input.trim() !== "");
      return { ...base, starterCode: q.starterCode, testCases, keywords: [], maxLength: null };
    }).filter((q) => q.text.length >= 3);

    // validate
    for (const q of cleaned as any[]) {
      if (q.type === "mcq") {
        if (!q.choices || q.choices.length < 2) return toast.error("MCQ needs at least 2 choices");
        if (!q.correctChoiceId || !q.choices.some((c: { id: string }) => c.id === q.correctChoiceId)) return toast.error("Pick the correct MCQ option");
      }
      if (q.type === "code" && (!q.testCases || q.testCases.length === 0)) return toast.error("Coding question needs at least 1 test case");
    }
    if (!cleaned.length) return toast.error("Add at least one question");

    setBusy(true);
    try {
      const rec = await createAssessment({ data: { companyUserId: user.id, title: title.trim(), questions: cleaned } });
      const link = `${window.location.origin}/a/${rec.code}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      toast.success(`Created · link copied: ${link}`);
      navigate({ to: "/dashboard/assessments" });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not create");
    } finally { setBusy(false); }
  };

  return (
    <Shell title="New Assessment" user={user?.name ?? ""} onSignOut={() => { signOut(); navigate({ to: "/auth" }); }}>
      <form onSubmit={onSubmit} className="glass-strong rounded-2xl p-6 space-y-6">
        <div>
          <h1 className="font-display text-xl text-gradient">Create an assessment</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Mix written, MCQ, and Java coding questions. Heuristic scoring on submit.
          </p>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Title</div>
          <div className="glass rounded-lg px-3">
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Frontend engineer screen" className="w-full bg-transparent outline-none py-3 text-sm" />
          </div>
        </div>

        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={i} className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Question {i + 1}</div>
                <div className="flex items-center gap-2">
                  <select
                    value={q.type}
                    onChange={(e) => setQ(i, { type: e.target.value as QType })}
                    className="glass rounded-md px-2 py-1 text-xs bg-transparent outline-none"
                  >
                    <option value="text">Text</option>
                    <option value="mcq">MCQ</option>
                    <option value="code">Code (Java)</option>
                  </select>
                  <label className="text-[10px] text-muted-foreground">Weight</label>
                  <input
                    type="number" min={0.1} step={0.1} value={q.weight}
                    onChange={(e) => setQ(i, { weight: e.target.value })}
                    className="glass rounded-md px-2 py-1 text-xs bg-transparent outline-none w-16"
                  />
                  {questions.length > 1 && (
                    <button type="button" onClick={() => rmQ(i)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <textarea
                required minLength={3} maxLength={2000}
                value={q.text}
                onChange={(e) => setQ(i, { text: e.target.value })}
                placeholder={q.type === "code" ? "Problem statement — e.g. Read an integer N and print N*N." : "Question text"}
                className="w-full glass rounded-md p-2 bg-transparent outline-none text-sm resize-y min-h-[72px]"
              />

              {q.type === "text" && (
                <div className="grid md:grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Keywords (comma-separated)</div>
                    <input value={q.keywords} onChange={(e) => setQ(i, { keywords: e.target.value })} placeholder="react, testing, performance" className="w-full glass rounded-md px-3 py-2 bg-transparent outline-none text-sm" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Max length hint (chars)</div>
                    <input type="number" min={20} max={5000} value={q.maxLength} onChange={(e) => setQ(i, { maxLength: e.target.value })} placeholder="300" className="w-full glass rounded-md px-3 py-2 bg-transparent outline-none text-sm" />
                  </div>
                </div>
              )}

              {q.type === "mcq" && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Choices (pick the correct one)</div>
                  {q.choices.map((c, ci) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <input
                        type="radio" name={`correct-${i}`} checked={q.correctChoiceId === c.id}
                        onChange={() => setQ(i, { correctChoiceId: c.id })}
                        className="accent-primary"
                      />
                      <input
                        value={c.text}
                        onChange={(e) => setQ(i, { choices: q.choices.map((x, xi) => xi === ci ? { ...x, text: e.target.value } : x) })}
                        placeholder={`Option ${ci + 1}`}
                        className="flex-1 glass rounded-md px-3 py-2 bg-transparent outline-none text-sm"
                      />
                      {q.choices.length > 2 && (
                        <button type="button" onClick={() => setQ(i, { choices: q.choices.filter((_, xi) => xi !== ci) })} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {q.choices.length < 8 && (
                    <button type="button" onClick={() => setQ(i, { choices: [...q.choices, { id: newCid(), text: "" }] })} className="text-xs text-primary inline-flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add choice
                    </button>
                  )}
                </div>
              )}

              {q.type === "code" && (
                <div className="space-y-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Starter code (Java)</div>
                    <textarea
                      value={q.starterCode}
                      onChange={(e) => setQ(i, { starterCode: e.target.value })}
                      className="w-full glass rounded-md p-2 bg-transparent outline-none text-xs font-mono resize-y min-h-[140px]"
                    />
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Test cases (stdin → expected stdout)</div>
                  {q.testCases.map((t, ti) => (
                    <div key={ti} className="grid md:grid-cols-2 gap-2 items-start">
                      <textarea
                        value={t.input}
                        onChange={(e) => setQ(i, { testCases: q.testCases.map((x, xi) => xi === ti ? { ...x, input: e.target.value } : x) })}
                        placeholder="stdin"
                        className="glass rounded-md p-2 bg-transparent outline-none text-xs font-mono resize-y min-h-[64px]"
                      />
                      <div className="flex gap-1 items-start">
                        <textarea
                          value={t.expectedStdout}
                          onChange={(e) => setQ(i, { testCases: q.testCases.map((x, xi) => xi === ti ? { ...x, expectedStdout: e.target.value } : x) })}
                          placeholder="expected stdout"
                          className="flex-1 glass rounded-md p-2 bg-transparent outline-none text-xs font-mono resize-y min-h-[64px]"
                        />
                        {q.testCases.length > 1 && (
                          <button type="button" onClick={() => setQ(i, { testCases: q.testCases.filter((_, xi) => xi !== ti) })} className="text-muted-foreground hover:text-destructive mt-2">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {q.testCases.length < 10 && (
                    <button type="button" onClick={() => setQ(i, { testCases: [...q.testCases, { input: "", expectedStdout: "" }] })} className="text-xs text-primary inline-flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add test case
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          <button type="button" onClick={addQ} className="glass rounded-lg w-full py-3 text-xs inline-flex items-center justify-center gap-2 hover:glow-cyber">
            <Plus className="w-4 h-4" /> Add question
          </button>
        </div>

        <Button type="submit" disabled={busy} className="w-full glow-primary" style={{ background: "var(--gradient-aurora)" }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Publish assessment</>}
        </Button>
      </form>
      <Toaster position="top-right" />
    </Shell>
  );
}
