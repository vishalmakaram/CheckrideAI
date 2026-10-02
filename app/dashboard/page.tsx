"use client";

import { useState, useEffect } from "react";
import { buildCategoryStats, buildScoreSeries, buildSpacedRepetitionQueue } from "../../utils/analytics";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "../components/AuthProvider";
import ProtectedAppShell from "../components/ProtectedAppShell";
import CheckrideCountdown from "./CheckrideCountdown";
import OnboardingTour from "./OnboardingTour";
import { AnimatedDial, CategoryBar, CategoryMasteryTrend, OralSessionHistory, ScoreOverTimeChart, SpacedRepetitionQueue } from "./DashboardWidgets";
import type { CategoryStat, OralSessionRow, ScoreRow } from "./types";
import TodayStudyPlan from "./TodayStudyPlan";
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
  const [totalSessions, setTotalSessions] = useState(0);
  const [recentTrend, setRecentTrend] = useState<{ recent: number; previous: number } | null>(null);
  const [oralSessions, setOralSessions] = useState<OralSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inProgress, setInProgress] = useState<InProgressSession>(null);
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [checkrideDate, setCheckrideDate] = useState<string | null>(null);
  const [planUnavailable, setPlanUnavailable] = useState(false);

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

      if (scoresData) {
        const practiceSessions = scoresData.filter(
          (s) => s.category !== "Practice Exam" && s.category !== "Test Run"
        );
        setTotalSessions(practiceSessions.length);

        if (practiceSessions.length >= 2) {
          const half = Math.ceil(practiceSessions.length / 2);
          const recent = practiceSessions.slice(0, half);
          const previous = practiceSessions.slice(half);
          const recentAvg = recent.reduce((acc, s) => acc + (s.score / s.total_questions) * 100, 0) / recent.length;
          const previousAvg = previous.reduce((acc, s) => acc + (s.score / s.total_questions) * 100, 0) / previous.length;
          setRecentTrend({ recent: Math.round(recentAvg), previous: Math.round(previousAvg) });
        }
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

  const weakCategories = categoryStats.filter(s => s.percentage < 70);
  const strongCategories = categoryStats.filter(s => s.percentage >= 80);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  const displayScores = scores.filter(s => s.category !== "Test Run");
  const scoreSeries = buildScoreSeries(displayScores);
  const repetitionQueue = buildSpacedRepetitionQueue(categoryStats);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <OnboardingTour userId={user.id} />
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Track your progress toward checkride readiness.</p>
      </div>

      <CheckrideCountdown userId={user.id} />

      <TodayStudyPlan results={questionResults} categories={availableCategories} oralSessions={oralSessions} checkrideDate={checkrideDate} loading={loading} unavailable={planUnavailable} />

      {/* In-progress session banner */}
      {inProgress && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4">
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

      {/* Dials */}
      <div className="flex gap-4 mb-4">
        <AnimatedDial percentage={avgPractice} label="Avg Practice Score" color="#047857" count={practiceScores.length} />
        <AnimatedDial percentage={avgExam} label="Avg Exam Score" color="#334155" count={examScores.length} />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Questions Answered</p>
          <p className="text-3xl font-bold text-slate-900">{totalAnswered}</p>
          <p className="text-xs text-slate-400 mt-1">across all sessions</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Sessions Completed</p>
          <p className="text-3xl font-bold text-slate-900">{totalSessions}</p>
          <p className="text-xs text-slate-400 mt-1">practice sessions</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Score Trend</p>
          {recentTrend ? (
            <>
              <p className="text-3xl font-bold" style={{
                color: recentTrend.recent >= recentTrend.previous ? "#16a34a" : "#dc2626"
              }}>
                {recentTrend.recent >= recentTrend.previous ? "↑" : "↓"} {Math.abs(recentTrend.recent - recentTrend.previous)}%
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {recentTrend.recent}% recent vs {recentTrend.previous}% before
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-slate-400">Not enough data</p>
              <p className="text-xs text-slate-400 mt-1">more sessions needed</p>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        <ScoreOverTimeChart points={scoreSeries} />
        <CategoryMasteryTrend stats={categoryStats} />
      </div>

      <SpacedRepetitionQueue queue={repetitionQueue} />

      <OralSessionHistory sessions={oralSessions} formatDate={formatDate} />

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

      {/* Study Recommendations */}
      {(weakCategories.length > 0 || strongCategories.length > 0) && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-6">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Study Recommendations</h2>
            <p className="text-slate-400 text-xs mt-0.5">Based on your performance across all categories</p>
          </div>
          <div className="p-6 space-y-5">
            {weakCategories.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Needs Attention</p>
                  {weakCategories.length >= 2 && (
                    <a
                      href={`/practice?categories=${encodeURIComponent(weakCategories.slice(0, 3).map(c => c.category).join(","))}&autostart=true`}
                      className="text-xs font-semibold bg-rose-600 text-white px-3 py-1.5 rounded-lg hover:bg-rose-700 transition"
                    >
                      Focus on weak areas
                    </a>
                  )}
                </div>
                <div className="space-y-2.5">
                  {weakCategories.map((cat) => (
                    <div key={cat.category} className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-2 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">{cat.category}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {Math.round(cat.percentage)}% correct across {cat.total} questions.
                            {cat.percentage < 50
                              ? " Significant weak area. Prioritize it before your checkride."
                              : " A bit more review here will make a difference."}
                          </p>
                        </div>
                      </div>
                      <a
                        href={`/practice?categories=${encodeURIComponent(cat.category)}`}
                        className="text-xs font-medium text-rose-600 hover:text-rose-800 border border-rose-200 hover:border-rose-400 px-2.5 py-1 rounded-lg transition shrink-0"
                      >
                        Practice
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {strongCategories.length > 0 && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-emerald-700">Strong Areas</p>
                <div className="space-y-2.5">
                  {strongCategories.map((cat) => (
                    <div key={cat.category} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{cat.category}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {Math.round(cat.percentage)}% correct across {cat.total} questions.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
          <div className="divide-y divide-slate-100">
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
        )}
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
