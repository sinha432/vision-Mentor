import Editor from "@monaco-editor/react";
import { Play, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CodeLanguage } from "@/interviewer/lib/interview-types";

const LANGUAGES: CodeLanguage[] = ["java", "python", "javascript", "sql"];

interface CodeEditorPanelProps {
  language: CodeLanguage;
  value: string;
  onChange: (value: string) => void;
  onLanguageChange: (language: CodeLanguage) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function CodeEditorPanel({
  language,
  value,
  onChange,
  onLanguageChange,
  onSubmit,
  disabled,
}: CodeEditorPanelProps) {
  return (
    <div className="flex h-full min-h-[22rem] flex-col overflow-hidden rounded-xl border border-border bg-[#0d1117]">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-secondary/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <Play className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">Coding round</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={language} onValueChange={(v) => onLanguageChange(v as CodeLanguage)}>
            <SelectTrigger className="h-8 w-[8.5rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l} value={l} className="text-xs">
                  {l.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8" onClick={onSubmit} disabled={disabled}>
            <Send className="mr-1.5 h-3.5 w-3.5" /> Submit code
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          theme="vs-dark"
          language={language === "sql" ? "sql" : language}
          value={value}
          onChange={(v) => onChange(v ?? "")}
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 12 },
            tabSize: 2,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
