import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  VOICE_LANGUAGES,
  listVoiceAvailability,
  type VoiceGender,
  type VoicePreference,
} from "@/interviewer/lib/voice-catalog";

interface Props {
  preference: VoicePreference;
  onChange: (pref: VoicePreference) => void;
  fallbackNote: string | null;
  resolvedName: string | null;
}

function currentVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}

/** Language + gender picker for the interviewer's speaking voice. */
export function VoicePicker({ preference, onChange, fallbackNote, resolvedName }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-1.5">
          <Volume2 className="h-3.5 w-3.5" /> Interviewer voice
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div>
          <p className="text-xs font-medium">Interviewer voice</p>
          <p className="text-[11px] text-muted-foreground">
            Choose the language and gender Vera speaks with. Saved for future interviews.
          </p>
        </div>
        <div className="space-y-2">
          <Select
            value={preference.language}
            onValueChange={(language) => onChange({ ...preference, language })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICE_LANGUAGES.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={preference.gender}
            onValueChange={(gender) => onChange({ ...preference, gender: gender as VoiceGender })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg bg-secondary/40 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {resolvedName ? (
            <>
              Using <span className="font-medium text-foreground">{resolvedName}</span>. Applies immediately.
            </>
          ) : (
            "No speech voices found on this browser."
          )}
          {fallbackNote && <div className="mt-1 text-warning">{fallbackNote}</div>}
        </div>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2 text-[10.5px]">
          <p className="mb-1 font-medium text-foreground/80">Availability by language</p>
          {listVoiceAvailability(currentVoices()).map((entry) => (
            <div
              key={`${entry.language.id}-${entry.gender}`}
              className="flex items-center justify-between gap-2 text-muted-foreground"
            >
              <span>
                {entry.language.label} · {entry.gender}
              </span>
              <span className={entry.available ? "text-success" : "text-warning"}>
                {entry.available ? "available" : "fallback"}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
