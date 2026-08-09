"use client";

/**
 * SpeechInput: mic control via Web Speech API only.
 *
 * No MediaRecorder / remote-STT path — product never wired onAudioRecorded.
 * Browsers without SpeechRecognition get a clickable mic that surfaces onError.
 */

import { InputGroupButton } from "@/components/ui";
import { DotMatrixIcon, DotmSquare18 } from "@/components/dotmatrix";
import { cn } from "@/lib/utils";
import { ICON_GLYPH } from "@/lib/icon-tokens";
import { AnimatePresence, motion } from "motion/react";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void)
    | null;
  onerror:
    | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void)
    | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

type SpeechInputMode = "speech-recognition" | "none";

export type SpeechInputProps = Omit<
  ComponentProps<typeof InputGroupButton>,
  "children" | "onError"
> & {
  onTranscriptionChange?: (text: string) => void;
  lang?: string;
  /** Surface mic / speech errors to the product (e.g. toast). */
  onError?: (message: string) => void;
};

const BENIGN_SPEECH_ERRORS = new Set(["aborted", "no-speech"]);

function mapSpeechRecognitionError(code: string): string | null {
  if (BENIGN_SPEECH_ERRORS.has(code)) {
    return null;
  }
  switch (code) {
    case "not-allowed":
      return "Microphone permission denied.";
    case "service-not-allowed":
      return "Speech recognition is not allowed.";
    case "audio-capture":
      return "No microphone available.";
    case "network":
      return "Speech recognition network error.";
    default:
      return "Speech recognition failed.";
  }
}

const hasSpeechRecognition = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
};

export const SpeechInput = ({
  className,
  onTranscriptionChange,
  onError,
  lang = "en-US",
  size = "icon-sm",
  variant = "ghost",
  ...props
}: SpeechInputProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mode, setMode] = useState<SpeechInputMode>("none");
  const [isRecognitionReady, setIsRecognitionReady] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onTranscriptionChangeRef = useRef(onTranscriptionChange);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTranscriptionChangeRef.current = onTranscriptionChange;
    onErrorRef.current = onError;
  }, [onTranscriptionChange, onError]);

  // Browser-only capability detection — must run after mount to match SSR HTML.
  useEffect(() => {
    setMode(hasSpeechRecognition() ? "speech-recognition" : "none");
  }, []);

  useEffect(() => {
    if (mode !== "speech-recognition") {
      return;
    }

    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const speechRecognition = new SpeechRecognitionCtor();

    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = lang;

    const handleStart = () => {
      setIsListening(true);
    };

    const handleEnd = () => {
      setIsListening(false);
      setIsSpeaking(false);
    };

    const handleSoundStart = () => setIsSpeaking(true);
    const handleSoundEnd = () => setIsSpeaking(false);

    const handleResult = (event: Event) => {
      const speechEvent = event as SpeechRecognitionEvent;
      let finalTranscript = "";

      for (
        let i = speechEvent.resultIndex;
        i < speechEvent.results.length;
        i += 1
      ) {
        const result = speechEvent.results[i];
        if (result.isFinal) {
          finalTranscript += result[0]?.transcript ?? "";
        }
      }

      if (finalTranscript) {
        onTranscriptionChangeRef.current?.(finalTranscript);
      }
    };

    const handleError = (event: Event) => {
      setIsListening(false);
      const speechError = event as SpeechRecognitionErrorEvent;
      const message = mapSpeechRecognitionError(speechError.error);
      if (message) {
        onErrorRef.current?.(message);
      }
    };

    speechRecognition.addEventListener("start", handleStart);
    speechRecognition.addEventListener("end", handleEnd);
    speechRecognition.addEventListener("soundstart", handleSoundStart);
    speechRecognition.addEventListener("soundend", handleSoundEnd);
    speechRecognition.addEventListener("result", handleResult);
    speechRecognition.addEventListener("error", handleError);

    recognitionRef.current = speechRecognition;
    // Defer ready=true to avoid cascading setState-in-effect warnings.
    // Cancel on cleanup so unmount / Strict Mode does not setState after tear-down.
    let cancelled = false;
    const readyTimer = window.setTimeout(() => {
      if (!cancelled) {
        setIsRecognitionReady(true);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(readyTimer);
      speechRecognition.removeEventListener("start", handleStart);
      speechRecognition.removeEventListener("end", handleEnd);
      speechRecognition.removeEventListener("soundstart", handleSoundStart);
      speechRecognition.removeEventListener("soundend", handleSoundEnd);
      speechRecognition.removeEventListener("result", handleResult);
      speechRecognition.removeEventListener("error", handleError);
      speechRecognition.stop();
      recognitionRef.current = null;
      setIsRecognitionReady(false);
    };
  }, [mode, lang]);

  const handleListeningToggle = useCallback(() => {
    if (mode === "none") {
      onErrorRef.current?.("Speech not supported in this browser.");
      return;
    }
    if (!recognitionRef.current) {
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      return;
    }
    try {
      recognitionRef.current.start();
    } catch {
      onErrorRef.current?.("Could not start speech recognition.");
    }
  }, [mode, isListening]);

  // mode "none" stays clickable so onError can explain unsupported browsers.
  const isDisabled = mode === "speech-recognition" && !isRecognitionReady;

  return (
    <div className="relative inline-flex items-center justify-center">
      <InputGroupButton
        className={cn(
          "relative z-10 transition-all duration-300",
          className,
        )}
        disabled={isDisabled}
        onClick={handleListeningToggle}
        size={size}
        type="button"
        variant={variant}
        aria-label={isListening ? "Stop listening" : "Start voice input"}
        {...props}
      >
        <AnimatePresence mode="wait">
          {isListening ? (
            <motion.div
              key="listening"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex items-center justify-center"
            >
              <DotmSquare18
                size={ICON_GLYPH.toolbar}
                dotSize={2}
                color="currentColor"
                animated={isSpeaking}
              />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex items-center justify-center"
            >
              <DotMatrixIcon name="mic" size={ICON_GLYPH.toolbar} />
            </motion.div>
          )}
        </AnimatePresence>
      </InputGroupButton>
    </div>
  );
};
