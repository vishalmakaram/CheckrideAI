export type ScoreRow = {
  id: number;
  created_at: string;
  score: number;
  total_questions: number;
  category: string;
};

export type CategoryStat = {
  category: string;
  correct: number;
  total: number;
  percentage: number;
};

export type ScorePoint = {
  id: number;
  label: string;
  category: string;
  percentage: number;
};

export type RepetitionItem = CategoryStat & {
  priority: number;
  reason: string;
};

export type OralSessionRow = {
  id: number;
  created_at: string;
  mode: string;
  question_count: number;
  summary: string;
  overall_score: number | null;
  readiness: string | null;
  aircraft_model: string | null;
  assessment?: { areasToReview?: { acsCode: string; acsArea: string }[] } | null;
};
