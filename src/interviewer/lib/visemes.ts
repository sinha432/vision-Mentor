/**
 * Text → viseme (mouth shape) mapping used for lip sync. The spoken text is
 * converted to a sequence of coarse phoneme groups; the speaker hook walks the
 * sequence in step with audio playback progress so mouth shapes match the
 * sounds instead of only the loudness.
 */
export type Viseme = "rest" | "MBP" | "FV" | "AI" | "E" | "O" | "U" | "L" | "S" | "TH";

/** Relative mouth geometry per viseme: openness and width multipliers. */
export const VISEME_SHAPE: Record<Viseme, { open: number; width: number }> = {
  rest: { open: 0.05, width: 1 },
  MBP: { open: 0.02, width: 0.94 },
  FV: { open: 0.18, width: 0.96 },
  AI: { open: 1, width: 1.04 },
  E: { open: 0.55, width: 1.12 },
  O: { open: 0.7, width: 0.78 },
  U: { open: 0.4, width: 0.68 },
  L: { open: 0.45, width: 1 },
  S: { open: 0.22, width: 1.06 },
  TH: { open: 0.3, width: 1.02 },
};

function visemeForChar(c: string): Viseme | null {
  switch (c) {
    case "a":
    case "á":
      return "AI";
    case "i":
    case "y":
      return "E";
    case "e":
      return "E";
    case "o":
      return "O";
    case "u":
    case "w":
      return "U";
    case "m":
    case "b":
    case "p":
      return "MBP";
    case "f":
    case "v":
      return "FV";
    case "l":
    case "r":
    case "n":
    case "d":
    case "t":
      return "L";
    case "s":
    case "z":
    case "c":
    case "j":
    case "g":
    case "k":
    case "x":
    case "q":
      return "S";
    case "h":
      return "TH";
    default:
      return null;
  }
}

/**
 * Builds a viseme sequence for a sentence. Punctuation and word gaps become
 * short rests so the mouth closes between phrases, which is what makes speech
 * read as human rather than a constantly flapping jaw.
 */
export function buildVisemeTrack(text: string): Viseme[] {
  const track: Viseme[] = [];
  const lower = text.toLowerCase();
  let previous: Viseme | null = null;

  for (const char of lower) {
    if (/[.,;:!?]/.test(char)) {
      track.push("rest", "rest");
      previous = "rest";
      continue;
    }
    if (/\s/.test(char)) {
      if (previous !== "rest") track.push("rest");
      previous = "rest";
      continue;
    }
    const viseme = visemeForChar(char);
    if (!viseme) continue;
    // Double vowels hold longer, matching how they are actually voiced.
    track.push(viseme);
    if (viseme === "AI" || viseme === "O") track.push(viseme);
    previous = viseme;
  }

  return track.length ? track : ["rest"];
}
