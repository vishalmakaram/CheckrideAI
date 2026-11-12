"use client";

import { useState, useEffect } from "react";
import { buildCategoryStats, buildScoreSeries } from "../../utils/analytics";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "../components/AuthProvider";
import ProtectedAppShell from "../components/ProtectedAppShell";
import CheckrideCountdown from "./CheckrideCountdown";
import OnboardingTour from "./OnboardingTour";
import { AnimatedDial, CategoryBar, OralSessionHistory, ScoreOverTimeChart } from "./DashboardWidgets";
import type { CategoryStat, OralSessionRow, ScoreRow } from "./types";
import TodayStudyPlan from "./TodayStudyPlan";
import StudyRecommendations from "./StudyRecommendations";
import type { QuestionResult } from "@/lib/study-plan";
import { readQuestionHistory } from "@/lib/question-history";
import { ListSkeleton, Skeleton } from "../components/Skeleton";

type InProgressSession = {
  currentIndex: number;
  questions: { category: string }[];
  answers: Record<number, string>;
  selectedCategories: string[];
  questionCount: number;
} | null;

function DashboardContent() {
  const { user } = useAuth();
  const practiceSessionKey = `practice_session:${user.id}`;
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [oralSessions, setOralSessions] = useState<OralSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inProgress, setInProgress] = useState<InProgressSession>(null);
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [checkrideDate, setCheckrideDate] = useState<string | null>(null);
  const [planUnavailable, setPlanUnavailable] = useState(false);
  const [recommendationsUnavailable, setRecommendationsUnavailable] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = sessionStorage.getItem(practiceSessionKey);
        if (raw) {
          const s = JSON.parse(raw);
          if (s.screen === "quiz" && s.questions?.length > 0) {
            setInProgress(s);
          }
        }
      } catch { /* ignore */ }
    });
  }, [practiceSessionKey]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: scoresData, error: scoresError } = await supabase
        .from("quiz_scores")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (scoresError) console.error(scoresError);

      const { data: resultsData, error: resultsError } = await readQuestionHistory(supabase, user.id);
      if (resultsError) console.error(resultsError);
      setRecommendationsUnavailable(Boolean(resultsError));

      const { data: oralData, error: oralError } = await supabase
        .from("oral_sessions")
        .select("id, created_at, mode, question_count, summary, overall_score, readiness, aircraft_model, assessment")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3);
      if (oralError) console.error(oralError);

      const [profileResult, categoriesResult] = await Promise.all([
        supabase.from("profiles").select("checkride_date").eq("id", user.id).maybeSingle(),
        supabase.from("questions").select("category"),
      ]);
      setCheckrideDate(profileResult.data?.checkride_date ?? null);
      setAvailableCategories([...new Set<string>((categoriesResult.data ?? []).map((item) => item.category))]);
      setPlanUnavailable(Boolean(resultsError || oralError || categoriesResult.error));

      if (scoresData) setScores(scoresData);
      if (oralData) setOralSessions(oralData);

      if (resultsData) {
        setQuestionResults(resultsData);
        setTotalAnswered(resultsData.length);
        setCategoryStats(buildCategoryStats(resultsData));
      }

      setLoading(false);
    };

    fetchData();
  }, [user.id]);

  const practiceScores = scores.filter(s => s.category !== "Practice Exam" && s.category !== "Test Run");
  const examScores = scores.filter(s => s.category === "Practice Exam");

  const avgPractice = practiceScores.length > 0
    ? practiceScores.reduce((acc, s) => acc + (s.score / s.total_questions) * 100, 0) / practiceScores.length
    : 0;

  const avgExam = examScores.length > 0
    ? examScores.reduce((acc, s) => acc + (s.score / s.total_questions) * 100, 0) / examScores.length
    : 0;

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  const displayScores = scores.filter(s => s.category !== "Test Run");
  const scoreSeries = buildScoreSeries(displayScores);

  return (
    <div className="min-h-screen bg-[#fbfcfa] px-5 py-8 sm:px-10 sm:py-10 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <OnboardingTour userId={user.id} />
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Dashboard</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">A clear next step toward your checkride.</p>
        </header>

        {/* In-progress session banner */}
        {inProgress && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-950">Practice session in progress</p>
                <p className="mt-0.5 text-xs text-emerald-800">
                  {inProgress.selectedCategories.join(", ")} · Question {inProgress.currentIndex + 1} of {inProgress.questions.length} · {Object.keys(inProgress.answers).length} answered
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { sessionStorage.removeItem(practiceSessionKey); setInProgress(null); }}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-950"
              >
                Discard
              </button>
              <a
                href="/practice"
                className="text-xs font-semibold bg-slate-950 text-white px-4 py-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                Continue
              </a>
            </div>
          </div>
        )}

        <div className="mb-9 grid grid-cols-2 divide-x divide-slate-200/80 border-y border-slate-200/80 py-3 sm:mb-10" role="group" aria-label="Average scores">
          <AnimatedDial percentage={avgPractice} label="Avg Practice Score" color="#047857" count={practiceScores.length} />
          <AnimatedDial percentage={avgExam} label="Avg Exam Score" color="#334155" count={examScores.length} />
        </div>

        <div className="mb-10 grid items-start gap-10 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:gap-12">
          <StudyRecommendations stats={categoryStats} loading={loading} unavailable={recommendationsUnavailable} />
          <TodayStudyPlan results={questionResults} categories={availableCategories} oralSessions={oralSessions} checkrideDate={checkrideDate} loading={loading} unavailable={planUnavailable} />
        </div>

        <CheckrideCountdown userId={user.id} />

        <details className="border-t border-slate-200/80">
          <summary className="cursor-pointer py-5 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
            Progress details &amp; session history
            <span className="mt-1 block text-xs font-normal text-slate-500">Charts, all category scores, and past practice, exam, and oral sessions</span>
          </summary>
          <div className="space-y-6 border-t border-slate-200/80 pt-6">
            <div className="mb-6">
              <ScoreOverTimeChart points={scoreSeries} />
            </div>

            {/* Performance by Category */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-6">
              <div className="px-6 py-5 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-900">Performance by Category</h2>
                <p className="text-slate-400 text-xs mt-0.5">{totalAnswered} questions answered across all sessions</p>
              </div>

              {loading ? (
                <div className="px-6 py-2"><ListSkeleton rows={5} /></div>
              ) : categoryStats.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">Complete a practice session to see category performance.</div>
              ) : (
                <div className="px-6 py-1 divide-y divide-slate-100">
                  {categoryStats.map((stat) => (
                    <CategoryBar key={stat.category} stat={stat} />
                  ))}
                </div>
              )}
            </div>

            <OralSessionHistory sessions={oralSessions} formatDate={formatDate} />

            {/* Score History */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-900">Score History</h2>
                <p className="text-slate-400 text-xs mt-0.5">Recent practice sessions and exams</p>
              </div>
              {loading ? (
                <div className="space-y-3 px-6 py-5" role="status" aria-label="Loading score history">
                  {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-8 w-full" />)}
                </div>
              ) : displayScores.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">No scores yet. Complete a practice set to see your history.</div>
              ) : (
                <div className="overflow-x-auto" role="region" aria-label="Practice and exam score history" tabIndex={0}>
                  <div className="min-w-[560px] divide-y divide-slate-100">
                    <div className="grid grid-cols-4 px-6 py-3 bg-slate-50">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Date</span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Category</span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Questions</span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Score</span>
                    </div>
                    {displayScores.map((s) => {
                      const pct = Math.round((s.score / s.total_questions) * 100);
                      const isPassing = pct >= 70;
                      return (
                        <div key={s.id} className="grid grid-cols-4 px-6 py-3.5 items-center hover:bg-slate-50 transition-colors">
                          <span className="text-sm text-slate-500">{formatDate(s.created_at)}</span>
                          <span className="text-sm text-slate-700 font-medium">{s.category}</span>
                          <span className="text-sm text-slate-500">{s.total_questions} questions</span>
                          <div className="flex items-center gap-2.5">
                            <span className="text-sm font-semibold text-slate-800">{s.score}/{s.total_questions}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                              isPassing ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
                            }`}>
                              {pct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
export default function Dashboard() {
  return (
    <ProtectedAppShell>
      <DashboardContent />
    </ProtectedAppShell>
  );
}
