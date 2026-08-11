import { useState } from "react";
import { Check, Clipboard, Download, Loader2, Sparkles, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ResumeCorrection } from "@/interviewer/lib/interview-types";
import { cn } from "@/lib/utils";

const SECTION_LABEL: Record<ResumeCorrection["section"], string> = {
  summary: "Summary",
  experience: "Experience",
  skills: "Skills",
  education: "Education",
  projects: "Projects",
  other: "Other",
};

/**
 * Review panel for Groq's proposed resume rewrites: a side-by-side original vs
 * fully rewritten resume ("Apply full rewrite"), plus per-line accept/reject
 * ("Apply all corrections") for candidates who want to keep more of the
 * original wording. Either path re-scores the resume from the updated text.
 */
export function ResumeCorrectionsPanel({
  loading,
  originalText,
  fullText,
  corrections,
  onGenerate,
  onApplyAll,
  onApplyFullRewrite,
  className,
}: {
  loading: boolean;
  originalText: string;
  fullText: string | null;
  corrections: ResumeCorrection[];
  onGenerate: () => void;
  onApplyAll: (accepted: ResumeCorrection[]) => void;
  onApplyFullRewrite: (fullText: string) => void;
  className?: string;
}) {
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});

  function toggle(id: string, value: boolean) {
    setDecisions((prev) => ({ ...prev, [id]: value }));
  }

  const accepted = corrections.filter((c) => decisions[c.id] !== false);
  const hasResult = Boolean(fullText) || corrections.length > 0;

  async function copyFullText() {
    if (!fullText) return;
    try {
      await navigator.clipboard.writeText(fullText);
      toast.success("Corrected resume copied to clipboard");
    } catch {
      toast.error("Could not copy — select and copy the text manually.");
    }
  }

  function downloadFullText() {
    if (!fullText) return;
    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "corrected-resume.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className={cn("animate-rise rounded-xl border border-border bg-secondary/25 p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Auto-correct my resume
        </h3>
        <Button size="sm" variant="secondary" onClick={onGenerate} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wand2 className="mr-1.5 h-3.5 w-3.5" />
          )}
          {hasResult ? "Regenerate corrections" : "Auto-correct my resume"}
        </Button>
      </div>

      {!loading && !hasResult && (
        <p className="mt-3 text-xs text-muted-foreground">
          Rewrite this resume for a 100/100 ATS score, then review it side-by-side against the
          original, accept or reject each line change, and apply everything in one click.
        </p>
      )}

      {fullText && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold">Original vs. ATS-optimised rewrite</h4>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={copyFullText}>
                <Clipboard className="mr-1.5 h-3.5 w-3.5" /> Copy
              </Button>
              <Button size="sm" variant="ghost" onClick={downloadFullText}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download
              </Button>
            </div>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="max-h-72 overflow-y-auto rounded-md border border-border/60 bg-background/40 p-3">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Original</span>
              <pre className="mt-1.5 whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-muted-foreground">
                {originalText}
              </pre>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border border-success/25 bg-success/5 p-3">
              <span className="text-[10px] uppercase tracking-widest text-success/80">
                Corrected (target: 100/100 ATS)
              </span>
              <pre className="mt-1.5 whitespace-pre-wrap font-sans text-[11px] leading-relaxed">{fullText}</pre>
            </div>
          </div>
          <Button className="mt-3" size="sm" onClick={() => onApplyFullRewrite(fullText)}>
            <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Apply full rewrite
          </Button>
        </div>
      )}

      {corrections.length > 0 && (
        <>
          <h4 className="mt-5 text-xs font-semibold">Or apply individual line changes</h4>
          <ul className="mt-3 space-y-3">
            {corrections.map((c) => {
              const isAccepted = decisions[c.id] !== false;
              return (
                <li
                  key={c.id}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    isAccepted ? "border-primary/30 bg-primary/5" : "border-border/60 bg-background/40 opacity-60",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-secondary/70 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {SECTION_LABEL[c.section]}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggle(c.id, true)}
                        className={cn(
                          "rounded-full p-1.5",
                          isAccepted ? "bg-success/20 text-success" : "text-muted-foreground hover:bg-secondary/60",
                        )}
                        aria-label="Accept"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle(c.id, false)}
                        className={cn(
                          "rounded-full p-1.5",
                          !isAccepted ? "bg-destructive/20 text-destructive" : "text-muted-foreground hover:bg-secondary/60",
                        )}
                        aria-label="Reject"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-destructive/25 bg-destructive/5 p-2">
                      <span className="text-[10px] uppercase tracking-widest text-destructive/80">Original</span>
                      <p className="mt-1 text-[11px] leading-relaxed line-through decoration-destructive/40">
                        {c.original}
                      </p>
                    </div>
                    <div className="rounded-md border border-success/25 bg-success/5 p-2">
                      <span className="text-[10px] uppercase tracking-widest text-success/80">Corrected</span>
                      <p className="mt-1 text-[11px] leading-relaxed">{c.corrected}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">{c.rationale}</p>
                </li>
              );
            })}
          </ul>
          <Button className="mt-4" size="sm" variant="secondary" onClick={() => onApplyAll(accepted)} disabled={accepted.length === 0}>
            <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Apply all corrections ({accepted.length})
          </Button>
        </>
      )}
    </section>
  );
}
