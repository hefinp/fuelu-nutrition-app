import { useState, useRef, useCallback, useEffect } from "react";

interface SpeechRecognitionResult {
  transcript: string;
  isListening: boolean;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionInstance) | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechRecognition(
  onTranscript: (text: string) => void,
): SpeechRecognitionResult {
  const isSupported = typeof window !== "undefined" && getSpeechRecognitionConstructor() !== null;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      if (recognitionRef.current !== recognition) return;
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      const combined = (finalTranscript + interimTranscript).trim();
      setTranscript(combined);
      onTranscriptRef.current(combined);
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = (event: any) => {
      if (recognitionRef.current !== recognition) return;
      if (event.error !== "aborted" && event.error !== "no-speech") {
        console.warn("Speech recognition error:", event.error);
      }
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setTranscript("");
    setIsListening(true);
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      recognitionRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  return { transcript, isListening, isSupported, start, stop, toggle };
}
