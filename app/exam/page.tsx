"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "../components/AuthProvider";
import ProtectedAppShell from "../components/ProtectedAppShell";
import { practiceLink } from "@/lib/study-plan";
import { saveExamAttempt, type SaveProgress } from "@/lib/quiz-attempt";

type Question = {
  id: string;
  category: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  correct_answer: string;
  explanation: string;
  image_url: string | null;
};

const EXAM_QUESTIONS = 60;
const EXAM_DURATION = 2.5 * 60 * 60; // 2.5 hours in seconds

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ExamPageContent() {
  const { user } = useAuth();
  const [screen, setScreen] = useState<"intro" | "exam" | "results">("intro");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [optionOrders, setOptionOrders] = useState<Record<number, ("option_a" | "option_b" | "option_c")[]>>({});
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [score, setScore] = useState(0);
  const [questionNavOpen, setQuestionNavOpen] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);
  const savingRef = useRef(false);
  const sessionIdRef = useRef("");
  const saveProgressRef = useRef<SaveProgress>({ resultsSaved: false, scoreSaved: false });
  const [saveError, setSaveError] = useState("");

  const toggleFlag = (i: number) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

  const persistExam = useCallback(async (finalAnswers: Record<number, string>, qs: Question[]) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    setSaveError("");
    try {
      await saveExamAttempt(supabase, qs, finalAnswers, user.id, sessionIdRef.current, saveProgressRef.current);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Your exam could not be saved. Please retry.");
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [user.id]);

  const submitExam = useCallback(async (finalAnswers: Record<number, string>, qs: Question[]) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    const finalScore = qs.reduce((acc, q, i) => finalAnswers[i] === q.correct_answer ? acc + 1 : acc, 0);
    setScore(finalScore);
    setScreen("results");
    await persistExam(finalAnswers, qs);
  }, [persistExam]);

  useEffect(() => {
    if (screen !== "exam") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          submitExam(answers, questions);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [screen, answers, questions, submitExam]);

  const startExam = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("questions").select("*");
    if (error || !data || data.length === 0) { setLoading(false); return; }

    const shuffled = data.sort(() => Math.random() - 0.5).slice(0, EXAM_QUESTIONS);
    setQuestions(shuffled);

    const orders: Record<number, ("option_a" | "option_b" | "option_c")[]> = {};
    shuffled.forEach((_, i) => {
      orders[i] = (["option_a", "option_b", "option_c"] as const).slice().sort(() => Math.random() - 0.5);
    });
    setOptionOrders(orders);
    setAnswers({});
    sessionIdRef.current = crypto.randomUUID();
    submittedRef.current = false;
    saveProgressRef.current = { resultsSaved: false, scoreSaved: false };
    setSaveError("");
    setFlagged(new Set());
    setCurrentIndex(0);
    setTimeLeft(EXAM_DURATION);
    setLoading(false);
    setScreen("exam");
  };

  const handleAnswer = (opt: string) => {
    setAnswers((prev) => ({ ...prev, [currentIndex]: opt }));
  };

  const question = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const timerWarning = timeLeft < 900; // under 15 min

  // ── Intro Screen ──────────────────────────────────────────────────────────
  if (screen === "intro") {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950"><ArrowLeft size={16} /> Dashboard</Link>
        <div className="mb-7">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">FAA Knowledge Test</span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Private Pilot Practice Exam</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Start a timed 60-question practice test.</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 w-full max-w-2xl p-6">

          <div className="space-y-3 mb-7">
            {[
              ["Questions", "60 questions drawn from all categories"],
              ["Time Limit", "2 hours 30 minutes"],
              ["Passing Score", "70% or higher (42 of 60 correct)"],
              ["No Feedback", "Answers are not revealed until after submission"],
              ["Navigation", "You may flag questions and return to them"],
            ].map(([label, desc]) => (
              <div key={label} className="flex gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                <div>
                  <span className="text-sm font-semibold text-slate-800">{label}: </span>
                  <span className="text-sm text-slate-500">{desc}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={startExam}
            disabled={loading}
            className="w-full bg-slate-950 text-white font-semibold py-3 rounded-lg hover:bg-slate-800 transition disabled:opacity-50 text-sm"
          >
            {loading ? "Loading questions..." : "Begin Examination"}
          </button>
        </div>
      </div>
    );
  }

  // ── Results Screen ────────────────────────────────────────────────────────
  if (screen === "results") {
    const pct = Math.round((score / questions.length) * 100);
    const passed = pct >= 70;

    // Group missed questions by category
    const missed = questions.filter((q, i) => answers[i] !== q.correct_answer);
    const missedByCategory: Record<string, number> = {};
    missed.forEach(q => { missedByCategory[q.category] = (missedByCategory[q.category] ?? 0) + 1; });

    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950"><ArrowLeft size={16} /> Dashboard</Link>
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-slate-900">Exam Results</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Review your practice exam performance.</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 w-full max-w-2xl p-8">
          <div className={`text-center pb-6 mb-6 border-b border-slate-100`}>
            <span className={`inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-4 ${passed ? "bg-green-50 text-green-700" : "bg-rose-50 text-rose-700"}`}>
              {passed ? "PASS" : "NOT PASSING"}
            </span>
            <div className="text-5xl font-bold text-slate-900 mb-1">{pct}%</div>
            <p className="text-slate-500 text-sm">{score} of {questions.length} correct</p>
            <p className="text-xs text-slate-400 mt-1">Passing score: 70% (42/60)</p>
          </div>

          {Object.keys(missedByCategory).length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Missed by Category</p>
              <div className="space-y-2">
                {Object.entries(missedByCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, count]) => (
                    <div key={cat} className="flex justify-between items-center">
                      <span className="text-sm text-slate-700">{cat}</span>
                      <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">{count} missed</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {flagged.size > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">Flagged for Review ({flagged.size})</p>
              <div className="flex flex-wrap gap-1.5">
                {[...flagged].sort((a, b) => a - b).map(i => (
                  <span key={i} className="text-xs font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                    Q{i + 1} · {questions[i]?.category}
                  </span>
                ))}
              </div>
            </div>
          )}

          {isSaving ? (
            <p className="text-xs text-center text-slate-400 mb-4">Saving score...</p>
          ) : saveError ? (
            <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <p>{saveError}</p>
              <button type="button" onClick={() => persistExam(answers, questions)} className="mt-2 font-semibold underline">Retry saving</button>
            </div>
          ) : (
            <p className="text-xs text-center text-green-600 font-medium mb-4">Score and answers saved to your study history</p>
          )}

          {missed.length > 0 && (
            <section className="mb-6 border-t border-slate-100 pt-5" aria-labelledby="missed-questions-title">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 id="missed-questions-title" className="text-sm font-bold text-slate-900">Review your missed questions</h2>
                <Link href={practiceLink({ questionIds: missed.map((item) => item.id), count: missed.length })} className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800">Practise missed questions</Link>
              </div>
              <div className="space-y-3">
                {questions.map((item, index) => answers[index] !== item.correct_answer && (
                  <details key={item.id} className="rounded-lg border border-slate-200 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-800">Q{index + 1}: {item.question_text}</summary>
                    <p className="mt-3 text-xs text-slate-500">Your answer: {item[answers[index] as "option_a" | "option_b" | "option_c"] ?? "Unanswered"}</p>
                    <p className="mt-2 text-sm font-semibold text-emerald-800">Correct answer: {item[item.correct_answer as "option_a" | "option_b" | "option_c"]}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.explanation}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setScreen("intro"); setAnswers({}); setQuestions([]); }}
              disabled={isSaving}
              className="flex-1 border border-slate-200 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition text-sm"
            >
              Back
            </button>
            <button
              onClick={startExam}
              disabled={isSaving || loading}
              className="flex-1 bg-slate-950 text-white font-semibold py-2.5 rounded-lg hover:bg-slate-800 transition text-sm"
            >
              Retake Exam
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Exam Screen ───────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* Question navigator sidebar */}
      {questionNavOpen ? <aside className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="flex items-start justify-between border-b border-slate-100 p-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Progress</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">{answeredCount} / {questions.length} answered</p>
          </div>
          <button type="button" onClick={() => setQuestionNavOpen(false)} aria-label="Hide question navigator" title="Hide question navigator" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950"><PanelLeftClose size={17} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {flagged.size > 0 && (
            <div className="px-2 pb-2">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1.5">Flagged ({flagged.size})</p>
              <div className="flex flex-wrap gap-1">
                {[...flagged].sort((a, b) => a - b).map(i => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition"
                  >
                    Q{i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-5 gap-1 px-2">
            {questions.map((_, i) => {
              const answered = answers[i] !== undefined;
              const isCurrent = i === currentIndex;
              const isFlagged = flagged.has(i);
              return (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`relative aspect-square rounded-md text-xs font-semibold transition-colors ${
                    isCurrent
                      ? "bg-emerald-700 text-white"
                      : answered
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {i + 1}
                  {isFlagged && (
                    <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => submitExam(answers, questions)}
            className="w-full bg-slate-950 text-white text-xs font-semibold py-2 rounded-lg hover:bg-slate-800 transition"
          >
            Submit Exam
          </button>
        </div>
      </aside> : <div className="shrink-0 border-r border-slate-200 bg-white p-2"><button type="button" onClick={() => setQuestionNavOpen(true)} aria-label="Show question navigator" title="Show question navigator" className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950"><PanelLeftOpen size={18} /></button></div>}

      {/* Main exam area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header with timer */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" aria-label="Save and return to dashboard" title="Save and return to dashboard" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-950"><ArrowLeft size={17} /></Link>
              <div>
              <p className="text-xs text-slate-400">FAA Private Pilot Knowledge Test</p>
              <p className="text-sm font-semibold text-slate-800">Question {currentIndex + 1} of {questions.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
            <button
              onClick={() => toggleFlag(currentIndex)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition ${
                flagged.has(currentIndex)
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-slate-200 bg-slate-50 text-slate-500 hover:border-amber-300 hover:text-amber-600"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill={flagged.has(currentIndex) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                <path d="M2 1.5V12M2 1.5H10L8 5.5H10L8 9.5H2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {flagged.has(currentIndex) ? "Flagged" : "Flag"}
            </button>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${timerWarning ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-slate-50"}`}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={timerWarning ? "text-rose-500" : "text-slate-400"}>
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M7 4V7L9 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <span className={`text-sm font-bold tabular-nums ${timerWarning ? "text-rose-600" : "text-slate-700"}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
            </div>
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto">
            <div className="mb-2">
              <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">{question?.category}</span>
            </div>

            {question?.image_url && (
              <div className="my-4">
                <Image
                  src={question.image_url}
                  alt="Question reference"
                  width={900}
                  height={500}
                  unoptimized
                  className="rounded-lg border border-slate-200 max-w-full max-h-72 object-contain"
                />
              </div>
            )}

            <h2 className="text-base font-semibold text-slate-900 leading-relaxed mt-3 mb-6">
              {question?.question_text}
            </h2>

            <div className="space-y-3">
              {(optionOrders[currentIndex] ?? ["option_a", "option_b", "option_c"]).map((opt, i) => {
                const label = ["A", "B", "C"][i];
                const isSelected = answers[currentIndex] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(opt)}
                    className={`w-full p-4 border-2 rounded-lg text-left transition-colors text-sm ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50 text-emerald-950"
                        : "border-slate-200 hover:border-emerald-400 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className="font-semibold text-slate-400 mr-2.5">{label}.</span>
                    {question ? question[opt] : ""}
                  </button>
                );
              })}
            </div>

            {answers[currentIndex] !== undefined && (
              <p className="text-xs text-slate-400 text-center mt-4">Answer recorded. Explanations shown after submission.</p>
            )}
          </div>
        </div>

        {/* Footer navigation */}
        <div className="bg-white border-t border-slate-200 px-6 py-3 shrink-0">
          <div className="max-w-2xl mx-auto flex justify-between">
            <button
              onClick={() => setCurrentIndex(i => i - 1)}
              disabled={currentIndex === 0}
              className="px-5 py-2 border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition disabled:opacity-30 text-sm"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentIndex(i => i + 1)}
              disabled={currentIndex === questions.length - 1}
              className="px-5 py-2 bg-slate-950 text-white font-medium rounded-lg hover:bg-slate-800 transition disabled:opacity-30 text-sm"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExamPage() {
  return (
    <ProtectedAppShell focus>
      <ExamPageContent />
    </ProtectedAppShell>
  );
}
