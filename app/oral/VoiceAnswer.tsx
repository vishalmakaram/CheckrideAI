"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square } from "lucide-react";

type RecognitionEvent = { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type RecognitionConstructor = new () => Recognition;
const subscribeToSupport = () => () => {};
const noServerSupport = () => false;
function hasSpeechRecognition() {
  const speechWindow = window as typeof window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return Boolean(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition);
}

export default function VoiceAnswer({ value, onChange, disabled, onRecordingChange }: {
  value: string; onChange: (value: string) => void; disabled: boolean; onRecordingChange: (recording: boolean) => void;
}) {
  const supported = useSyncExternalStore(subscribeToSupport, hasSpeechRecognition, noServerSupport);
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState("");
  const recognitionRef = useRef<Recognition | null>(null);
  const onChangeRef = useRef(onChange);
  const onRecordingRef = useRef(onRecordingChange);

  useEffect(() => { onChangeRef.current = onChange; onRecordingRef.current = onRecordingChange; }, [onChange, onRecordingChange]);
  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        recognition.onresult = null; recognition.onerror = null; recognition.onend = null;
        try { recognition.abort(); } catch { /* Some browsers throw after recognition ends. */ }
      }
      onRecordingRef.current(false);
    };
  }, []);

  function release(recognition: Recognition | null, abort = false) {
    if (recognitionRef.current !== recognition) return;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null; recognition.onerror = null; recognition.onend = null;
      if (abort) { try { recognition.abort(); } catch { /* The service may already have stopped. */ } }
    }
    setRecording(false);
    onRecordingRef.current(false);
  }

  function start() {
    if (recognitionRef.current) return;
    const speechWindow = window as typeof window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor) return;
    let recognition: Recognition;
    try { recognition = new Constructor(); } catch {
      setMessage("The microphone could not start. Try again or type your answer.");
      return;
    }
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
    const prefix = value.trim();
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      const transcript = Array.from(event.results).filter((result) => result.isFinal).map((result) => result[0].transcript).join(" ");
      onChangeRef.current([prefix, transcript.trim()].filter(Boolean).join(" ").slice(0, 3_000));
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      setMessage(event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone access was denied. Allow it in your browser settings or type your answer."
        : event.error === "no-speech" ? "No speech was detected. Try again or type your answer."
        : "Speech recognition is unavailable right now. Your transcript is still here; continue by typing.");
      // An error does not reliably deliver an end event in every browser.
      release(recognition, true);
    };
    recognition.onend = () => release(recognition);
    try {
      setMessage("");
      setRecording(true);
      onRecordingRef.current(true);
      recognition.start();
    } catch {
      setMessage("The microphone could not start. Try again or type your answer.");
      release(recognition, true);
    }
  }

  function stop() {
    const recognition = recognitionRef.current;
    try { recognition?.stop(); } catch {
      setMessage("Dictation stopped. Review your transcript and continue by typing.");
      release(recognition, true);
    }
  }

  return (
    <div className="mt-3">
      {supported ? <button type="button" disabled={disabled} onClick={() => recording ? stop() : start()} aria-pressed={recording} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50 ${recording ? "border-rose-300 bg-rose-50 text-rose-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}>
        {recording ? <Square size={15} /> : <Mic size={15} />}{recording ? "Stop dictation" : "Dictate answer"}
      </button> : <p className="text-xs text-slate-500">Voice dictation is unavailable in this browser. You can type your answer.</p>}
      <p role="status" className="mt-2 text-xs leading-5 text-slate-500">{message || (recording ? "Listening... Stop dictation to edit and submit your transcript." : supported ? "Review your transcript before submitting. Your browser's speech service may process audio online." : "")}</p>
    </div>
  );
}
