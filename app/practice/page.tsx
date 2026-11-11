"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth, useAuthState } from "../components/AuthProvider";
import ProtectedAppShell from "../components/ProtectedAppShell";
import { ListSkeleton, Skeleton } from "../components/Skeleton";
import { saveQuizAttempt, type SaveProgress } from "@/lib/quiz-attempt";

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

function PracticeQuizContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const practiceSessionKey = `practice_session:${user.id}`;
  const [sessionReady, setSessionReady] = useState(false);
  const handledParamsRef = useRef("");
  const savingRef = useRef(false);
  const finishedRef = useRef(false);
  const sessionIdRef = useRef("");
  const saveProgressRef = useRef<SaveProgress>({ resultsSaved: false, scoreSaved: false });
  const [screen, setScreen] = useState<"select" | "quiz" | "results">("select");
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [score, setScore] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "pending" | "saving-score" | "saved" | "failed">("idle");
  const [saveError, setSaveError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [loading, setLoading] = useState(true);
  const [questionCount, setQuestionCount] = useState(20);
  const [optionOrders, setOptionOrders] = useState<Record<number, ("option_a" | "option_b" | "option_c")[]>>({});
  const [questionNavOpen, setQuestionNavOpen] = useState(true);
  const [startError, setStartError] = useState("");

  // Restore session from sessionStorage after mount (client-only)
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = sessionStorage.getItem(practiceSessionKey);
        if (raw) {
          const s = JSON.parse(raw);
          if (s.screen) setScreen(s.screen);
          if (s.selectedCategories) setSelectedCategories(s.selectedCategories);
          if (s.questions) setQuestions(s.questions);
          if (s.currentIndex !== undefined) setCurrentIndex(s.currentIndex);
          if (s.answers) setAnswers(s.answers);
          if (s.score !== undefined) setScore(s.score);
          if (s.questionCount) setQuestionCount(s.questionCount);
          if (s.optionOrders) setOptionOrders(s.optionOrders);
          sessionIdRef.current = typeof s.sessionId === "string" && s.sessionId ? s.sessionId : crypto.randomUUID();
          saveProgressRef.current = { resultsSaved: s.saveProgress?.resultsSaved === true, scoreSaved: s.saveProgress?.scoreSaved === true };
          if (s.screen === "results") {
            finishedRef.current = true;
            setSaveStatus(saveProgressRef.current.resultsSaved && saveProgressRef.current.scoreSaved ? "saved" : "failed");
          }
        }
      } catch { setStorageError("Browser storage is unavailable. Keep this tab open to preserve your practice set."); }
      setSessionReady(true);
    });
  }, [practiceSessionKey]);

  // Persist session state to sessionStorage whenever it changes
  useEffect(() => {
    if (!sessionReady) return;
    try {
      sessionStorage.setItem(practiceSessionKey, JSON.stringify({
        screen, selectedCategories, questions, currentIndex, answers, score, questionCount, optionOrders,
        sessionId: sessionIdRef.current, saveProgress: saveProgressRef.current, saveStatus,
      }));
    } catch { setStorageError("Your browser could not save this practice set. Keep this tab open to preserve your work."); }
  }, [sessionReady, practiceSessionKey, screen, selectedCategories, questions, currentIndex, answers, score, questionCount, optionOrders, saveStatus]);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase.from("questions").select("category");
      if (error) { setStartError("Question categories could not be loaded. Refresh to try again."); setLoading(false); return; }
      const unique = [...new Set(data.map((q) => q.category))];
      setCategories(unique);
      setLoading(false);
    };
    fetchCategories();
  }, []);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const startQuiz = useCallback(async (overrideCategories?: string[], options?: { questionIds?: string[]; count?: number }) => {
    const cats = overrideCategories ?? selectedCategories;
    setStartError("");
    let query = supabase.from("questions").select("*");
    if (options?.questionIds?.length) query = query.in("id", options.questionIds);
    else query = query.in("category", cats);
    const { data, error } = await query;
    if (error || !data || data.length === 0) { setStartError("These questions are unavailable. Choose another practice set or retry."); return; }
    const count = options?.count ?? questionCount;
    const shuffled = data.sort(() => Math.random() - 0.5).slice(0, count);
    setQuestions(shuffled);
    setQuestionCount(count);
    setSelectedCategories([...new Set<string>(shuffled.map((item) => item.category))]);

    // Builds a shuffled option order for each question
    const orders: Record<number, ("option_a" | "option_b" | "option_c")[]> = {};
    shuffled.forEach((_, i) => {
      orders[i] = (["option_a", "option_b", "option_c"] as const)
        .slice()
        .sort(() => Math.random() - 0.5);
    });
    setOptionOrders(orders);
    setCurrentIndex(0);
    setAnswers({});
    setScore(0);
    sessionIdRef.current = crypto.randomUUID();
    saveProgressRef.current = { resultsSaved: false, scoreSaved: false };
    finishedRef.current = false;
    setSaveStatus("idle");
    setSaveError("");
    setScreen("quiz");
    // Consume the start link. Reload resumes this set; opening a new start
    // link later can create another set with the same category and count.
    router.replace("/practice", { scroll: false });
  }, [selectedCategories, questionCount, router]);

  // Handle URL params: ?categories=X,Y&autostart=true
  useEffect(() => {
    if (!sessionReady) return;
    const cats = searchParams.get("categories");
    const questionIds = searchParams.get("questionIds")?.split(",").filter(Boolean).slice(0, 100);
    const autostart = searchParams.get("autostart");
    const paramsKey = searchParams.toString();
    if (!paramsKey) { handledParamsRef.current = ""; return; }
    if ((cats || questionIds?.length) && handledParamsRef.current !== paramsKey) {
      handledParamsRef.current = paramsKey;
      const parsed = (cats ?? "").split(",").map((c) => c.trim()).filter(Boolean);
      const requestedCount = Number(searchParams.get("count"));
      const count = Number.isInteger(requestedCount) && requestedCount >= 1 && requestedCount <= 100 ? requestedCount : undefined;
      queueMicrotask(() => {
        if (autostart === "true") {
          try { sessionStorage.removeItem(practiceSessionKey); } catch { /* In-memory practice still works. */ }
          setScreen("select");
        }
        setSelectedCategories(parsed);
        if (autostart === "true") void startQuiz(parsed, { questionIds, count });
      });
    }
  }, [sessionReady, practiceSessionKey, searchParams, startQuiz]);

  const handleAnswer = (answer: string) => {
    if (answers[currentIndex] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [currentIndex]: answer }));
  };

  const persistPractice = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    setSaveStatus("pending");
    setSaveError("");
    try {
      await saveQuizAttempt(supabase, questions, answers, user.id, sessionIdRef.current, saveProgressRef.current, selectedCategories.join(", "), () => {
        // Persist acknowledged answers before waiting for the score write.
        setSaveStatus(saveProgressRef.current.scoreSaved ? "saved" : "saving-score");
      });
      setSaveStatus("saved");
    } catch (caught) {
      setSaveStatus("failed");
      setSaveError(caught instanceof Error ? caught.message : "Your practice set could not be saved. Please retry.");
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleFinish = async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const finalScore = questions.reduce((acc, q, i) => {
      return answers[i] === q.correct_answer ? acc + 1 : acc;
    }, 0);
    setScore(finalScore);
    setScreen("results");
    await persistPractice();
  };

  const question = questions[currentIndex];
  const selectedAnswer = answers[currentIndex];
  const isCorrect = selectedAnswer === question?.correct_answer;
  const isLast = currentIndex === questions.length - 1;
  const allAnswered = questions.length > 0 && Object.keys(answers).length === questions.length;

  // Category Selection Screen
  if (screen === "select") {
    const allSelected = selectedCategories.length === categories.length;
    const estimatedMinutes = Math.round(questionCount * 0.75);

    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950"><ArrowLeft size={16} /> Dashboard</Link>
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-slate-900">Practice Questions</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Pick which categories you want to practice.</p>
        </div>

        <div className="bg-white p-6 rounded-lg w-full max-w-2xl border border-slate-200">

          {loading ? (
            <div className="py-1"><ListSkeleton rows={6} /></div>
          ) : (
            <>
              {/* Select All */}
              <label className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors mb-3 ${
                allSelected ? "border-emerald-700 bg-emerald-50" : "border-slate-200 hover:border-emerald-400"
              }`}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    allSelected
                      ? setSelectedCategories([])
                      : setSelectedCategories([...categories])
                  }
                  className="h-5 w-5 accent-emerald-700"
                />
                <span className="font-bold text-slate-700">Select All Categories</span>
              </label>

              <div className="flex flex-col space-y-3 mb-8">
                {categories.map((cat) => (
                  <label
                    key={cat}
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedCategories.includes(cat)
                        ? "border-emerald-700 bg-emerald-50"
                        : "border-slate-200 hover:border-emerald-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                      className="h-5 w-5 accent-emerald-700"
                    />
                    <span className="font-semibold text-slate-700">{cat}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {/* Question Count Slider */}
          {startError && <p role="alert" className="mb-4 text-sm text-rose-700">{startError}</p>}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-bold text-slate-700">Number of Questions</label>
              <span className="text-sm font-semibold text-emerald-800">
                {questionCount} questions (~{estimatedMinutes} min)
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              step={1}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-full accent-emerald-700"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>5</span>
              <span>100</span>
            </div>
          </div>

          <button
            onClick={() => startQuiz()}
            disabled={selectedCategories.length === 0}
            className="w-full bg-slate-950 text-white font-semibold py-3 rounded-lg hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Start Practice Set
          </button>
        </div>
      </div>
    );
  }

  // Results Screen
  if (screen === "results") {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950"><ArrowLeft size={16} /> Dashboard</Link>
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-slate-900">Practice Complete</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Review your score and choose what to do next.</p>
        </div>

        <div className="bg-white p-8 rounded-lg text-center border border-slate-200 w-full max-w-md">
          <div className="my-8">
            <span className="text-6xl font-black text-emerald-700">{score}</span>
            <span className="text-2xl text-slate-400 font-bold"> / {questions.length}</span>
          </div>
          {isSaving ? (
            <p role="status" className="text-sm font-bold text-amber-700 animate-pulse mb-6">Saving score and answers...</p>
          ) : saveStatus === "saved" ? (
            <p role="status" className="text-sm font-bold text-emerald-700 mb-6">Score and answers saved to your study history.</p>
          ) : <div role="alert" className="mb-6 text-sm text-rose-700">
            <p>{saveError || "This practice set has not finished saving. Retry to update your study history."}</p>
            <button type="button" onClick={persistPractice} className="mt-2 font-semibold underline">Retry saving practice</button>
          </div>}
          {storageError && <p role="status" className="mb-4 text-sm text-amber-800">{storageError}</p>}
          <button
            onClick={() => { try { sessionStorage.removeItem(practiceSessionKey); } catch { /* In-memory reset still works. */ } setScreen("select"); setQuestions([]); setAnswers({}); setCurrentIndex(0); setScore(0); }}
            disabled={isSaving}
            className="w-full bg-slate-950 text-white px-6 py-3 rounded-lg hover:bg-slate-800 font-semibold transition disabled:opacity-50"
          >
            Practice Again
          </button>
        </div>
      </div>
    );
  }

  // Quiz Screen
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-slate-50 md:h-screen md:flex-row">

      {/* Question Sidebar */}
      {questionNavOpen ? (
        <aside className="flex max-h-52 w-full shrink-0 flex-col border-b border-slate-200 bg-white md:max-h-none md:w-56 md:border-b-0 md:border-r">
          <div className="flex items-start justify-between border-b border-slate-200 p-4">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">Questions</p>
              <p className="mt-1 text-sm text-slate-500">{Object.keys(answers).length} of {questions.length} answered</p>
            </div>
            <button type="button" onClick={() => setQuestionNavOpen(false)} aria-label="Hide question navigator" title="Hide question navigator" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950"><PanelLeftClose size={17} /></button>
          </div>
          <div className="grid grid-cols-8 gap-1.5 overflow-y-auto p-3 sm:grid-cols-10 md:grid-cols-5">
            {questions.map((q, i) => {
              const answered = answers[i] !== undefined;
              const correct = answers[i] === q.correct_answer;
              const isCurrent = i === currentIndex;
              const statusStyle = isCurrent
                ? "bg-slate-950 text-white"
                : answered && correct
                  ? "bg-emerald-100 text-emerald-800"
                  : answered
                    ? "bg-rose-100 text-rose-800"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200";
              return <button key={q.id} type="button" onClick={() => setCurrentIndex(i)} aria-label={`Question ${i + 1}: ${q.category}`} className={`aspect-square rounded-md text-xs font-bold ${statusStyle}`}>{i + 1}</button>;
            })}
          </div>
        </aside>
      ) : (
        <div className="shrink-0 border-b border-slate-200 bg-white p-2 md:border-b-0 md:border-r">
          <button type="button" onClick={() => setQuestionNavOpen(true)} aria-label="Show question navigator" title="Show question navigator" className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950"><PanelLeftOpen size={18} /></button>
        </div>
      )}

      {/* Main Quiz Area */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="w-full max-w-3xl mx-auto">

          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Practice Questions</h1>
              <p className="text-slate-500 mt-0.5 text-sm">{selectedCategories.join(", ")}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                Save & Quit
              </Link>
              <div className="bg-white px-4 py-2 rounded-lg border border-slate-200">
                <span className="text-slate-600 font-bold text-sm">
                  Question {currentIndex + 1} of {questions.length}
                </span>
              </div>
            </div>
          </div>

          <div className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-white p-4 sm:p-8">
            <span className="rounded-md bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800">
              {question.category}
            </span>
            
            {question.image_url && (
                <div className="mb-6 mt-4">
                  <Image
                    src={question.image_url}
                    alt="Question reference image"
                    width={900}
                    height={500}
                    unoptimized
                    className="rounded-lg border border-slate-200 max-w-full max-h-96 object-contain"
                  />
                </div>
            )}

            <h2 className="mb-8 mt-4 text-xl font-semibold leading-8 text-slate-800">
              {question.question_text}
            </h2>

            <div className="flex flex-col space-y-4">
              {(optionOrders[currentIndex] ?? ["option_a", "option_b", "option_c"]).map((opt, i) => {
                const label = ["A", "B", "C"][i];
                const isSelected = selectedAnswer === opt;
                const isRight = opt === question.correct_answer;
                let style = "border-slate-200 hover:border-emerald-400 text-slate-700 hover:bg-slate-50";
                if (selectedAnswer !== undefined) {
                  if (isRight) style = "border-green-500 bg-green-50 text-green-900";
                  else if (isSelected) style = "border-rose-500 bg-rose-50 text-rose-900";
                  else style = "border-slate-200 text-slate-400";
                }
                return (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(opt)}
                    disabled={selectedAnswer !== undefined}
                    className={`p-5 border-2 rounded-lg text-left transition-colors font-medium ${style}`}
                  >
                    <span className="font-bold mr-2 text-slate-400">{label})</span>
                    {question[opt]}
                </button>
               );
              })}
            </div>

            {selectedAnswer !== undefined && (
              <div className="mt-8">
                <div className={`p-6 rounded-lg ${isCorrect ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"}`}>
                  <h3 className={`font-extrabold text-lg ${isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
                    {isCorrect ? "Correct" : "Incorrect"}
                  </h3>
                  <p className={`mt-2 font-medium leading-relaxed ${isCorrect ? "text-emerald-900" : "text-rose-900"}`}>
                    {question.explanation}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <button
              onClick={() => setCurrentIndex((i) => i - 1)}
              disabled={currentIndex === 0}
              className="rounded-lg border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition-colors hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Previous
            </button>

            <div className="flex flex-wrap gap-3">
              {allAnswered && (
                <button
                  onClick={handleFinish}
                  className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition"
                >
                  Finish and save score
                </button>
              )}
              <button
                onClick={() => setCurrentIndex((i) => i + 1)}
                disabled={isLast}
                className="px-6 py-3 bg-slate-950 text-white font-semibold rounded-lg hover:bg-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next Question ➔
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function PracticeQuiz() {
  const { user } = useAuthState();
  return (
    <ProtectedAppShell>
      <Suspense fallback={<div className="mx-auto max-w-4xl p-8"><Skeleton className="h-7 w-48" /><div className="mt-8 border-y border-slate-300 py-2"><ListSkeleton rows={6} /></div></div>}>
        <PracticeQuizContent key={user?.id} />
      </Suspense>
    </ProtectedAppShell>
  );
}
