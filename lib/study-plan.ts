import { daysUntilDate } from "./profile";

export type QuestionResult = {
  question_id: string;
  category: string;
  correct: boolean;
  created_at: string;
  session_id?: string;
  id?: number;
};

export type ReviewQuestion = {
  questionId: string;
  category: string;
  missed: boolean;
  dueAt: string;
};

// Repeated successes lengthen the interval; a mistake resets it. Work from
// question-level history so correcting an old mistake removes it from retries.
export function buildQuestionReviewQueue(results: QuestionResult[], now = new Date()): ReviewQuestion[] {
  const byQuestion = new Map<string, QuestionResult[]>();
  for (const result of results) {
    if (!Number.isFinite(Date.parse(result.created_at))) continue;
    const history = byQuestion.get(result.question_id) ?? [];
    history.push(result);
    byQuestion.set(result.question_id, history);
  }
  return [...byQuestion.entries()].flatMap(([questionId, history]) => {
    history.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || (b.id ?? 0) - (a.id ?? 0));
    const latest = history[0];
    let streak = 0;
    for (const result of history) {
      if (!result.correct) break;
      streak += 1;
    }
    const intervalDays = latest.correct ? Math.min(21, 3 * 2 ** Math.min(streak - 1, 3)) : 0;
    const dueAt = new Date(Date.parse(latest.created_at) + intervalDays * 86_400_000).toISOString();
    if (Date.parse(dueAt) > now.getTime()) return [];
    return [{ questionId, category: latest.category, missed: !latest.correct, dueAt }];
  }).sort((a, b) => Number(b.missed) - Number(a.missed) || Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

export function practiceLink(options: { categories?: string[]; questionIds?: string[]; count?: number }) {
  const params = new URLSearchParams({ autostart: "true", count: String(options.count ?? 10) });
  if (options.questionIds?.length) params.set("questionIds", options.questionIds.join(","));
  if (options.categories?.length) params.set("categories", options.categories.join(","));
  return `/practice?${params}`;
}

type OralHistory = {
  created_at: string;
  assessment?: { areasToReview?: { acsCode: string; acsArea: string }[] } | null;
};

export type StudyStep = { title: string; reason: string; minutes: number; href: string; action: string };

export function buildTodayStudyPlan({ results, categories, oralSessions, checkrideDate, minutes, now = new Date() }: {
  results: QuestionResult[];
  categories: string[];
  oralSessions: OralHistory[];
  checkrideDate: string | null;
  minutes: number;
  now?: Date;
}): { steps: StudyStep[]; daysRemaining: number | null } {
  const budget = Math.max(10, Math.min(45, minutes));
  const daysRemaining = daysUntilDate(checkrideDate, now);
  const review = buildQuestionReviewQueue(results, now);
  const quizMinutes = Math.max(5, Math.min(budget - 5, Math.floor(budget * 0.6)));
  const count = Math.max(5, Math.floor(quizMinutes / 0.75));
  const steps: StudyStep[] = [];
  if (review.length) {
    const chosen = review.slice(0, count);
    const misses = chosen.filter((item) => item.missed).length;
    steps.push({
      title: misses ? "Revisit your missed questions" : "Refresh questions due for review",
      reason: misses ? `${misses} question${misses === 1 ? "" : "s"} still need a correct answer.` : "Your review interval is up. Check what you still remember.",
      minutes: Math.max(1, Math.ceil(chosen.length * 0.75)),
      href: practiceLink({ questionIds: chosen.map((item) => item.questionId), count: chosen.length }),
      action: "Start review",
    });
  } else {
    const stats = new Map<string, { total: number; correct: number }>();
    for (const result of results) {
      const stat = stats.get(result.category) ?? { total: 0, correct: 0 };
      stat.total += 1;
      stat.correct += Number(result.correct);
      stats.set(result.category, stat);
    }
    const available = [...new Set(categories)].sort((a, b) => {
      const aStat = stats.get(a), bStat = stats.get(b);
      const priority = (stat: typeof aStat) => stat ? 100 - stat.correct / stat.total * 100 + Math.max(0, 5 - stat.total) * 5 : 130;
      return priority(bStat) - priority(aStat) || a.localeCompare(b);
    });
    const focus = available[0];
    steps.push({
      title: focus ? `Build confidence in ${focus}` : "Start with a written practice set",
      reason: results.length ? "A focused set balances weaker topics with areas you have practised less." : "Establish a baseline so tomorrow's plan can use your results.",
      minutes: quizMinutes,
      href: focus ? practiceLink({ categories: [focus], count }) : "/practice",
      action: "Start practice",
    });
  }
  const recentOral = [...oralSessions].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  const oralGap = recentOral?.assessment?.areasToReview?.[0];
  const oralParams = new URLSearchParams({ count: "5", mode: daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7 ? "checkride" : "intermediate" });
  if (oralGap) oralParams.set("focus", oralGap.acsCode);
  steps.push({
    title: oralGap ? `Explain ${oralGap.acsArea.toLowerCase()} aloud` : "Practise explaining your decisions",
    reason: oralGap ? "Revisit a gap from your latest oral scorecard." : "Work through five scenarios and explain the reasoning behind each decision.",
    minutes: 5,
    href: `/oral?${oralParams}`,
    action: "Start oral practice",
  });
  return { steps, daysRemaining };
}
