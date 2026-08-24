import { useCallback, useEffect, useRef, useState } from "react";

/** Minimal typings — the Web Speech API isn't part of the default DOM lib. */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface Options {
  /** called with the final transcript once the user stops speaking */
  onResult: (transcript: string) => void;
  /** called with each interim transcript while speaking */
  onInterim?: (transcript: string) => void;
  lang?: string;
}

export function useSpeechRecognition({ onResult, onInterim, lang = "en-US" }: Options) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const finalText = useRef("");
  const cancelled = useRef(false);
  const cbResult = useRef(onResult);
  const cbInterim = useRef(onInterim);
  cbResult.current = onResult;
  cbInterim.current = onInterim;

  useEffect(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    setSupported(true);

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      finalText.current = "";
      cancelled.current = false;
      setError(null);
      setListening(true);
    };

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalText.current += text;
        else interim += text;
      }
      cbInterim.current?.((finalText.current + interim).trim());
    };

    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone access was blocked. Allow it in your browser to talk to Nova.");
      } else if (event.error === "no-speech") {
        setError("I didn't catch that — try again.");
      } else if (event.error !== "aborted") {
        setError("Speech recognition failed. You can still type.");
      }
      cancelled.current = true;
    };

    rec.onend = () => {
      setListening(false);
      const text = finalText.current.trim();
      finalText.current = "";
      if (cancelled.current) {
        cancelled.current = false;
        return;
      }
      if (text) cbResult.current(text);
    };

    recognition.current = rec;
    return () => {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.onstart = null;
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
      recognition.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    if (!recognition.current) return;
    try {
      recognition.current.start();
    } catch {
      /* already started */
    }
  }, []);

  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    recognition.current?.abort();
    setListening(false);
  }, []);

  return { supported, listening, error, start, stop, cancel };
}
