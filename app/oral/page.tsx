"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, CircleHelp, Lightbulb, Send, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  buildAssessmentFromEvaluations,
  type OralAssessment,
  type OralEvaluation,
  type OralMode,
} from "@/lib/oral-exam";
import { useAuth, useAuthState } from "../components/AuthProvider";
import ProtectedAppShell from "../components/ProtectedAppShell";
import AssessmentCard from "./AssessmentCard";

import VoiceAnswer from "./VoiceAnswer";
import { oralStorageKey, restoreOralSession, type PublicQuestion, type SavedSession, type SessionEntry } from "@/lib/oral-session";

const modeInfo: Record<OralMode, { label: string; description: string }> = {
  beginner: {
    label: "Guided practice",
    description: "Hints are available and feedback explains the most important correction after each answer.",
  },
  intermediate: {
    label: "Standard practice",
    description: "A balanced ACS review with concise feedback and one clarifying follow-up when useful.",
  },
  checkride: {
    label: "Checkride simulation",
    description: "No hints or answer feedback during the session. Review the complete scorecard at the end.",
  },
};

function verdictLabel(verdict: OralEvaluation["verdict"]) {
  return ({ strong: "Strong", acceptable: "Acceptable", partial: "Needs detail", incorrect: "Review needed" })[verdict];
}

function OralPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const storageKey = oralStorageKey(user.id);
  const [screen, setScreen] = useState<SavedSession["screen"]>("select");
  const [mode, setMode] = useState<OralMode>("intermediate");
  const [questionCount, setQuestionCount] = useState(10);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [sessionKey, setSessionKey] = useState("");
  const [aircraftModel, setAircraftModel] = useState("your preferred aircraft");
  const [assessment, setAssessment] = useState<OralAssessment | null>(null);
  const [input, setInput] = useState("");
  const [originalAnswer, setOriginalAnswer] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [scoringFailed, setScoringFailed] = useState(false);
  const [restored, setRestored] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const [storageError, setStorageError] = useState("");
  const [saveStatus, setSaveStatus] = useState<SavedSession["saveStatus"]>("idle");
  const [saveError, setSaveError] = useState("");
  const [recording, setRecording] = useState(false);
  const savingRef = useRef(false);
  const submittingRef = useRef(false);

  const currentQuestion = questions[entries.length];
  const progress = questions.length ? (entries.length / questions.length) * 100 : 0;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = restoreOralSession(raw, user.id);
      if (saved) {
        setScreen(saved.screen);
        setMode(saved.mode);
        setQuestionCount(saved.questionCount);
        setQuestions(saved.questions);
        setEntries(saved.entries);
        setSessionKey(saved.sessionKey);
        setAircraftModel(saved.aircraftModel);
        setAssessment(saved.assessment);
        setInput(saved.input);
        setOriginalAnswer(saved.originalAnswer);
        setFollowUpQuestion(saved.followUpQuestion);
        setHintVisible(saved.hintVisible);
        setFeedbackVisible(saved.feedbackVisible);
        setScoringFailed(saved.scoringFailed);
        setSaveStatus(saved.saveStatus);
        setRecoveryNotice("Your saved session has been restored, including your draft answer.");
      } else {
        if (raw) { localStorage.removeItem(storageKey); setRecoveryNotice("The saved session could not be restored. Start a new session."); }
        const requestedMode = searchParams.get("mode");
        if (requestedMode === "beginner" || requestedMode === "intermediate" || requestedMode === "checkride") setMode(requestedMode);
        const requestedCount = Number(searchParams.get("count"));
        if (Number.isInteger(requestedCount) && requestedCount >= 5 && requestedCount <= 30) setQuestionCount(requestedCount);
      }
    } catch {
      setStorageError("Browser storage is unavailable. Keep this tab open to preserve your session.");
    }
    setRestored(true);
  }, [storageKey, user.id, searchParams]);

  useEffect(() => {
    if (!restored) return;
    const saved: SavedSession = {
      version: 3, userId: user.id,
      screen, mode, questionCount, questions, entries, sessionKey, aircraftModel, assessment,
      input, originalAnswer, followUpQuestion, hintVisible, feedbackVisible, scoringFailed, saveStatus,
    };
    try {
      if (screen === "select") localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {
      setStorageError("Your browser could not save this session. Keep this tab open to preserve your work.");
    }
  }, [restored, storageKey, user.id, screen, mode, questionCount, questions, entries, sessionKey, aircraftModel, assessment, input, originalAnswer, followUpQuestion, hintVisible, feedbackVisible, scoringFailed, saveStatus]);

  const latestEntry = entries.at(-1);
  const shownFeedback = useMemo(() => {
    if (!latestEntry || mode === "checkride" || !feedbackVisible) return null;
    return latestEntry.evaluation;
  }, [feedbackVisible, latestEntry, mode]);

  async function postExam(body: object) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The oral examiner could not respond.");
    return data;
  }

  async function startSession() {
    const nextSessionKey = crypto.randomUUID();
    setIsLoading(true);
    setError("");
    setScoringFailed(false);
    try {
      const focus = searchParams.get("focus");
      const focusCodes = focus && /^PA\.[IVX]+\.[A-Z](?:\.[KRS]\d+[a-z]?)?$/.test(focus) ? [focus] : undefined;
      const data = await postExam({ action: "start", mode, questionCount, sessionKey: nextSessionKey, focusCodes });
      setSessionKey(nextSessionKey);
      setQuestions(data.questions);
      setEntries([]);
      setAircraftModel(data.aircraftModel);
      setAssessment(null);
      setInput("");
      setOriginalAnswer(null);
      setFollowUpQuestion(null);
      setHintVisible(false);
      setFeedbackVisible(false);
      setSaveStatus("idle");
      setSaveError("");
      setRecoveryNotice("");
      setScreen("exam");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The session could not start.");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveCompletedSession(finalEntries: SessionEntry[], finalAssessment: OralAssessment) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveStatus("pending");
    setSaveError("");
    const row = {
      user_id: user.id,
      session_key: sessionKey,
      mode,
      question_count: questions.length,
      transcript: finalEntries,
      summary: finalAssessment.summary,
      overall_score: finalAssessment.overallScore,
      readiness: finalAssessment.readiness,
      assessment: finalAssessment,
      aircraft_model: aircraftModel,
      acs_version: "FAA-S-ACS-6C",
    };
    try {
      // The database uses a partial unique index for session_key, so look up
      // the owned session instead of relying on ON CONFLICT inference.
      const existing = await supabase.from("oral_sessions").select("id").eq("user_id", user.id).eq("session_key", sessionKey).maybeSingle();
      if (existing.error) throw existing.error;
      const result = existing.data
        ? await supabase.from("oral_sessions").update(row).eq("id", existing.data.id).eq("user_id", user.id)
        : await supabase.from("oral_sessions").insert(row);
      if (result.error) throw result.error;
      setSaveStatus("saved");
    } catch {
      setSaveStatus("failed");
      setSaveError("Your scorecard could not be saved to your account. Retry when you are connected.");
    } finally {
      savingRef.current = false;
    }
  }

  async function recordEvaluation(evaluation: OralEvaluation, displayedAnswer: string, showFeedback = true) {
    if (!currentQuestion) return;
    const finalEntries = [...entries, { question: currentQuestion, answer: displayedAnswer, evaluation }];
    setEntries(finalEntries);
    setInput("");
    setOriginalAnswer(null);
    setFollowUpQuestion(null);
    setHintVisible(false);

    if (finalEntries.length === questions.length) {
      const finalAssessment = buildAssessmentFromEvaluations(finalEntries.map((entry) => entry.evaluation));
      setAssessment(finalAssessment);
      setScreen("results");
      await saveCompletedSession(finalEntries, finalAssessment);
      return;
    }

    setFeedbackVisible(showFeedback && mode !== "checkride");
  }

  async function submitAnswer() {
    const answer = input.trim();
    if (!answer || !currentQuestion || isLoading || recording || submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);
    setError("");
    setScoringFailed(false);
    try {
      const data = await postExam({
        action: "evaluate",
        mode,
        sessionKey,
        questionId: currentQuestion.id,
        answer,
        previousAnswer: originalAnswer,
        followUpQuestion,
        attempt: followUpQuestion ? 1 : 0,
      });
      const evaluation = data.evaluation as OralEvaluation;
      if (evaluation.needsFollowUp && evaluation.followUpQuestion && !followUpQuestion) {
        setOriginalAnswer(answer);
        setFollowUpQuestion(evaluation.followUpQuestion);
        setInput("");
      } else {
        const displayedAnswer = originalAnswer ? `${originalAnswer}\nFollow-up: ${answer}` : answer;
        await recordEvaluation(evaluation, displayedAnswer);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your answer could not be scored.");
      setScoringFailed(true);
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  }

  async function markUnknown() {
    if (!currentQuestion || isLoading || recording || submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);
    setError("");
    try {
      const data = await postExam({ action: "unknown", mode, sessionKey, questionId: currentQuestion.id });
      await recordEvaluation(data.evaluation as OralEvaluation, "I don't know");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The answer could not be recorded.");
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  }

  async function continueWithoutScore() {
    const answer = input.trim();
    if (!answer || !currentQuestion || isLoading || recording || submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);
    const displayedAnswer = originalAnswer ? `${originalAnswer}\nFollow-up: ${answer}` : answer;
    setError("");
    setScoringFailed(false);
    try {
      await recordEvaluation({
        questionId: currentQuestion.id,
        acsArea: currentQuestion.acsArea,
        acsCode: currentQuestion.acsCode,
        topic: currentQuestion.topic,
        reference: currentQuestion.reference,
        answer: displayedAnswer,
        score: 0,
        verdict: "partial",
        feedback: "This answer was not scored because the scoring service was unavailable.",
        demonstrated: [],
        missing: [],
        needsFollowUp: false,
        followUpQuestion: null,
        scored: false,
      }, displayedAnswer, false);
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  }

  function continueAfterFeedback() {
    setFeedbackVisible(false);
    setScoringFailed(false);
  }

  function resetSession() {
    if (isLoading || savingRef.current || recording) return;
    try { localStorage.removeItem(storageKey); } catch { /* In-memory reset still works. */ }
    setScreen("select");
    setQuestions([]);
    setEntries([]);
    setAssessment(null);
    setSessionKey("");
    setInput("");
    setOriginalAnswer(null);
    setFollowUpQuestion(null);
    setFeedbackVisible(false);
    setError("");
    setSaveStatus("idle");
    setSaveError("");
    setRecoveryNotice("");
  }

  if (screen === "select") {
    return (
      <div className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
          <ArrowLeft size={16} /> Dashboard
        </Link>
        <div className="mt-8 max-w-2xl">
          <p className="text-xs font-bold uppercase text-slate-500">FAA-S-ACS-6C practice</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">AI oral examiner</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
            Rehearse scenario-based questions mapped to the Private Pilot Airplane ACS. Your answers are scored against a defined rubric and used to focus future sessions.
          </p>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {(Object.keys(modeInfo) as OralMode[]).map((option) => {
            const selected = option === mode;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                className={`min-h-40 rounded-lg border p-5 text-left transition ${selected ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900 hover:border-slate-400"}`}
              >
                <span className="flex items-center justify-between text-sm font-bold">
                  {modeInfo[option].label}
                  {selected && <Check size={17} />}
                </span>
                <span className={`mt-3 block text-sm leading-6 ${selected ? "text-slate-300" : "text-slate-500"}`}>{modeInfo[option].description}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 max-w-2xl rounded-lg border border-slate-200 bg-white p-5">
          {recoveryNotice && <p role="status" className="mb-4 text-sm text-slate-600">{recoveryNotice}</p>}
          {storageError && <p role="status" className="mb-4 text-sm text-amber-800">{storageError}</p>}
          <div className="flex items-center justify-between">
            <label htmlFor="question-count" className="text-sm font-bold text-slate-800">Session length</label>
            <span className="text-sm font-bold text-slate-950">{questionCount} questions</span>
          </div>
          <input id="question-count" type="range" min="5" max="30" value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} className="mt-4 w-full accent-slate-950" />
          <button type="button" onClick={startSession} disabled={isLoading} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
            {isLoading ? "Preparing your ACS session..." : "Begin oral practice"}<ChevronRight size={17} />
          </button>
          {error && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
        </div>
      </div>
    );
  }

  if (screen === "results" && assessment) {
    return (
      <div className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><ArrowLeft size={16} /> Dashboard</Link>
            <p className="mt-6 text-xs font-bold uppercase text-slate-500">{aircraftModel} · FAA-S-ACS-6C</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">Oral practice scorecard</h1>
          </div>
          <button type="button" onClick={resetSession} disabled={saveStatus === "pending"} className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">Start another session</button>
        </div>
        {storageError && <p role="status" className="mb-4 text-sm text-amber-800">{storageError}</p>}
        <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600" role="status">
          {saveStatus === "saved" ? "Scorecard saved to your account." : saveStatus === "pending" ? "Saving your scorecard..." : saveError || "Your scorecard is available here. Save it to your account to update your study history."}
          {(saveStatus === "failed" || saveStatus === "idle") && <button type="button" onClick={() => saveCompletedSession(entries, assessment)} className="ml-3 font-semibold text-emerald-800 underline">Retry saving scorecard</button>}
        </div>
        <AssessmentCard assessment={assessment} />
      </div>
    );
  }

  if (!currentQuestion) return null;
  const displayedQuestion = shownFeedback && latestEntry ? latestEntry.question : currentQuestion;
  const displayedIndex = shownFeedback ? entries.length : entries.length + 1;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard" aria-label="Return to dashboard" title="Dashboard" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-950"><ArrowLeft size={18} /></Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950">AI oral examiner</p>
              <p className="truncate text-xs text-slate-500">{aircraftModel} · {modeInfo[mode].label}</p>
            </div>
          </div>
          <button type="button" onClick={resetSession} disabled={isLoading || recording} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-950" aria-label="End session" title="End session"><X size={18} /></button>
        </div>
      </header>

      <div className="h-1 bg-slate-200"><div className="h-full bg-slate-950 transition-colors" style={{ width: `${progress}%` }} /></div>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
        {recoveryNotice && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{recoveryNotice}</p>}
        {storageError && <p role="status" className="mb-4 text-sm text-amber-800">{storageError}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-950 px-2 py-1 text-xs font-bold text-white">{displayedQuestion.acsCode}</span>
            <span className="text-xs font-semibold text-slate-500">{displayedQuestion.topic}</span>
          </div>
          <span className="text-xs font-semibold text-slate-500">Question {displayedIndex} of {questions.length}</span>
        </div>

        <section className="mt-5 border-y border-slate-200 py-7 sm:py-9" aria-labelledby="oral-question">
          <p className="text-xs font-bold uppercase text-slate-500">Examiner</p>
          <h1 id="oral-question" className="mt-3 max-w-3xl text-xl font-semibold leading-8 text-slate-950 sm:text-2xl sm:leading-9">
            {followUpQuestion ?? displayedQuestion.prompt}
          </h1>
          {followUpQuestion && <p className="mt-4 text-sm leading-6 text-slate-500">Your original answer: {originalAnswer}</p>}
          {hintVisible && !followUpQuestion && (
            <div className="mt-5 flex max-w-2xl gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <Lightbulb className="mt-0.5 shrink-0" size={17} /><p><strong>Think about:</strong> {currentQuestion.hint}</p>
            </div>
          )}
        </section>

        {shownFeedback ? (
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5" aria-live="polite">
            <p className="mb-4 whitespace-pre-line text-sm leading-6 text-slate-600"><strong className="text-slate-800">Your answer:</strong> {latestEntry?.answer}</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-950">{verdictLabel(shownFeedback.verdict)}</p>
              <span className="text-sm font-bold text-slate-700">{shownFeedback.score}/100</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{shownFeedback.feedback}</p>
            {shownFeedback.missing.length > 0 && <p className="mt-3 text-xs leading-5 text-slate-500"><strong className="text-slate-700">Study next:</strong> {shownFeedback.missing[0]}</p>}
            <button type="button" onClick={continueAfterFeedback} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">Next question <ChevronRight size={16} /></button>
          </section>
        ) : (
          <div className="mt-auto pt-8">
            <label htmlFor="oral-answer" className="text-sm font-bold text-slate-800">Your answer</label>
            <textarea
              id="oral-answer"
              value={input}
              maxLength={3_000}
              readOnly={recording || isLoading}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitAnswer(); } }}
              rows={4}
              placeholder="Explain your decision and reasoning..."
              className="mt-2 w-full resize-none rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
            />
            <VoiceAnswer key={`${sessionKey}:${currentQuestion.id}:${Boolean(followUpQuestion)}`} value={input} onChange={setInput} disabled={isLoading} onRecordingChange={setRecording} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {mode !== "checkride" && !followUpQuestion && <button type="button" onClick={() => setHintVisible(true)} disabled={hintVisible || isLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"><Lightbulb size={16} /> Hint</button>}
                <button type="button" onClick={markUnknown} disabled={isLoading || recording} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"><CircleHelp size={16} /> I don&apos;t know</button>
              </div>
              <button type="button" onClick={submitAnswer} disabled={!input.trim() || isLoading || recording} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">{isLoading ? "Scoring..." : scoringFailed ? "Retry scoring" : "Submit answer"}<Send size={16} /></button>
            </div>
            {error && (
              <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <p className="font-medium">{error}</p>
                {scoringFailed && (
                  <button type="button" onClick={continueWithoutScore} disabled={isLoading || recording} className="mt-3 rounded-md border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-50">
                    Continue without score
                  </button>
                )}
              </div>
            )}
            <p className="mt-5 text-center text-xs text-slate-400">Practice only. Verify aircraft-specific information with the applicable POH or AFM.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function OralPage() {
  const { user } = useAuthState();
  return <ProtectedAppShell focus><Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading oral practice...</p>}><OralPageContent key={user?.id} /></Suspense></ProtectedAppShell>;
}
