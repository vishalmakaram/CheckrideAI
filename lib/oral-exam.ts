import { z } from "zod";

export const ORAL_MODEL = "claude-haiku-4-5-20251001";
export const ACS_VERSION = "FAA-S-ACS-6C";
export const AI_REQUESTS_PER_MINUTE = 12;
export const AI_REQUESTS_PER_DAY = 150;

export const oralModeSchema = z.enum(["beginner", "intermediate", "checkride"]);

const requestBase = {
  mode: oralModeSchema,
  sessionKey: z.string().uuid(),
};

export const oralRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    ...requestBase,
    questionCount: z.number().int().min(5).max(30),
    focusCodes: z.array(z.string().regex(/^PA\.[IVX]+\.[A-Z](?:\.[KRS]\d+[a-z]?)?$/)).max(3).optional(),
  }),
  z.object({
    action: z.literal("evaluate"),
    ...requestBase,
    questionId: z.string().min(1).max(100),
    answer: z.string().trim().min(1).max(3_000),
    previousAnswer: z.string().trim().max(3_000).nullable().default(null),
    followUpQuestion: z.string().trim().max(600).nullable().default(null),
    attempt: z.number().int().min(0).max(1),
  }),
  z.object({
    action: z.literal("unknown"),
    ...requestBase,
    questionId: z.string().min(1).max(100),
  }),
]);

export const modelEvaluationSchema = z.object({
  score: z.number().int().min(0).max(100),
  verdict: z.enum(["strong", "acceptable", "partial", "incorrect"]),
  feedback: z.string().max(420),
  demonstrated: z.array(z.string().max(120)).max(2),
  missing: z.array(z.string().max(120)).max(2),
  needsFollowUp: z.boolean(),
  followUpQuestion: z.string().max(400).nullable(),
});

export const oralEvaluationSchema = modelEvaluationSchema.extend({
  questionId: z.string(),
  acsArea: z.string(),
  acsCode: z.string(),
  topic: z.string(),
  reference: z.string(),
  answer: z.string(),
  scored: z.boolean().optional(),
});

export const reviewAreaSchema = z.object({
  acsArea: z.string(),
  acsCode: z.string(),
  score: z.number().int().min(0).max(100),
  finding: z.string(),
  studyRecommendation: z.string(),
  reference: z.string(),
});

export const oralAssessmentSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  readiness: z.enum(["building-foundation", "developing", "nearly-ready", "checkride-ready"]),
  summary: z.string(),
  strengths: z.array(z.string()).max(6),
  areasToReview: z.array(reviewAreaSchema).max(10),
});

export type OralMode = z.infer<typeof oralModeSchema>;
export type OralEvaluation = z.infer<typeof oralEvaluationSchema>;
export type OralAssessment = z.infer<typeof oralAssessmentSchema>;

export function buildEvaluationSystemPrompt(mode: OralMode, aircraftModel: string) {
  const feedbackRule = mode === "checkride"
    ? "Give concise examiner-style feedback on this answer, including the most important correction."
    : mode === "beginner"
      ? "Give one encouraging sentence and one concrete correction or improvement."
      : "Give no more than two concise sentences of direct feedback.";

  return `You score one answer in a Private Pilot airplane oral-practice session aligned to FAA-S-ACS-6C. This is practice, not an official FAA evaluation.

Score only against the supplied question and rubric. Credit correct equivalent wording and sound aeronautical judgment. Do not require trivia beyond the rubric. Penalize unsafe advice, unsupported certainty, and failure to use the applicable POH/AFM when configuration-specific facts are required.

The student's aircraft is ${aircraftModel}. Never invent model-specific limitations, speeds, quantities, or checklist steps.

${feedbackRule}

Use a follow-up only when one short question could resolve a partially complete answer. If the score is 75 or higher, do not request a follow-up. Never request a second follow-up. Keep feedback under 55 words. Return at most two demonstrated points and two missing points, each under 12 words. Keep the follow-up to one sentence. Do not use Markdown.`;
}

export function buildAssessmentFromEvaluations(evaluations: OralEvaluation[]): OralAssessment {
  const scoredEvaluations = evaluations.filter((item) => item.scored !== false);
  const overallScore = scoredEvaluations.length
    ? Math.round(scoredEvaluations.reduce((sum, item) => sum + item.score, 0) / scoredEvaluations.length)
    : 0;
  const readiness = overallScore >= 90
    ? "checkride-ready"
    : overallScore >= 80
      ? "nearly-ready"
      : overallScore >= 65
        ? "developing"
        : "building-foundation";

  const byArea = new Map<string, OralEvaluation[]>();
  for (const evaluation of scoredEvaluations) {
    const items = byArea.get(evaluation.acsArea) ?? [];
    items.push(evaluation);
    byArea.set(evaluation.acsArea, items);
  }

  const areaScores = [...byArea.entries()].map(([acsArea, items]) => ({
    acsArea,
    score: Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length),
    items,
  })).sort((a, b) => a.score - b.score);

  const strengths = areaScores
    .filter((area) => area.score >= 80)
    .slice(-6)
    .reverse()
    .map((area) => `${area.acsArea}: ${area.score}%`);
  const areasToReview = areaScores
    .filter((area) => area.score < 75)
    .slice(0, 10)
    .map((area) => {
      const weakest = [...area.items].sort((a, b) => a.score - b.score)[0];
      return {
        acsArea: area.acsArea,
        acsCode: weakest.acsCode,
        score: area.score,
        finding: weakest.missing[0] ?? weakest.feedback,
        studyRecommendation: `Review ${weakest.topic}, then run a focused practice set for ${area.acsArea}.`,
        reference: weakest.reference,
      };
    });

  return {
    overallScore,
    readiness,
    summary: scoredEvaluations.length === evaluations.length
      ? `You completed ${evaluations.length} ACS-mapped questions with an overall practice-readiness score of ${overallScore}%.`
      : `You completed ${evaluations.length} ACS-mapped questions. ${scoredEvaluations.length} were scored, with an overall practice-readiness score of ${overallScore}%.`,
    strengths,
    areasToReview,
  };
}

export function estimateHaikuCostMicrousd(
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens = 0,
  cacheReadTokens = 0
) {
  // Haiku 4.5: $1 input, $5 output, $1.25 cache write, $0.10 cache read per MTok.
  return Math.round(inputTokens + outputTokens * 5 + cacheCreationTokens * 1.25 + cacheReadTokens * 0.1);
}
