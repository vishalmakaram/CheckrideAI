import type { SupabaseClient } from "@supabase/supabase-js";

export type QuizQuestion = { id: string; category: string; correct_answer: string };
export type SaveProgress = { resultsSaved: boolean; scoreSaved: boolean };

export function buildQuestionResultRows(questions: QuizQuestion[], answers: Record<number, string>, userId: string, sessionId: string) {
  return questions.map((question, index) => ({
    question_id: question.id,
    category: question.category,
    correct: answers[index] === question.correct_answer,
    session_id: sessionId,
    user_id: userId,
  }));
}

// Keep successful writes when retrying a partially saved attempt.
export async function saveQuizAttempt(supabase: Pick<SupabaseClient, "from">, questions: QuizQuestion[], answers: Record<number, string>, userId: string, sessionId: string, progress: SaveProgress, category: string, onProgress?: () => void) {
  if (!progress.resultsSaved) {
    const { error } = await supabase.from("question_results").insert(buildQuestionResultRows(questions, answers, userId, sessionId));
    if (error) throw new Error("Your answers could not be saved. Retry to connect them to future practice.");
    progress.resultsSaved = true;
    onProgress?.();
  }
  if (!progress.scoreSaved) {
    const { error } = await supabase.from("quiz_scores").insert({
      user_id: userId,
      category,
      total_questions: questions.length,
      score: questions.filter((question, index) => answers[index] === question.correct_answer).length,
    });
    if (error) throw new Error("Your answers were saved, but the score could not be saved. Retry saving your score.");
    progress.scoreSaved = true;
    onProgress?.();
  }
}

export function saveExamAttempt(supabase: Pick<SupabaseClient, "from">, questions: QuizQuestion[], answers: Record<number, string>, userId: string, sessionId: string, progress: SaveProgress) {
  return saveQuizAttempt(supabase, questions, answers, userId, sessionId, progress, "Practice Exam");
}
