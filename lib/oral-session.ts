import { z } from "zod";
import { buildAssessmentFromEvaluations, oralAssessmentSchema, oralEvaluationSchema, oralModeSchema } from "./oral-exam";

export const publicOralQuestionSchema = z.object({
  id: z.string(), acsArea: z.string(), acsCode: z.string(), topic: z.string(),
  prompt: z.string(), hint: z.string(), reference: z.string(),
});
export const oralSessionSchema = z.object({
  version: z.literal(3),
  userId: z.string(),
  screen: z.enum(["select", "exam", "results"]),
  mode: oralModeSchema,
  questionCount: z.number().int().min(5).max(30),
  questions: z.array(publicOralQuestionSchema).max(30),
  entries: z.array(z.object({ question: publicOralQuestionSchema, answer: z.string(), evaluation: oralEvaluationSchema })).max(30),
  sessionKey: z.string(),
  aircraftModel: z.string(),
  assessment: oralAssessmentSchema.nullable(),
  input: z.string().max(3_000),
  originalAnswer: z.string().nullable(),
  followUpQuestion: z.string().nullable(),
  hintVisible: z.boolean(),
  feedbackVisible: z.boolean(),
  scoringFailed: z.boolean(),
  saveStatus: z.enum(["idle", "pending", "saved", "failed"]),
});

export type PublicQuestion = z.infer<typeof publicOralQuestionSchema>;
export type SessionEntry = z.infer<typeof oralSessionSchema>["entries"][number];
export type SavedSession = z.infer<typeof oralSessionSchema>;
export const oralStorageKey = (userId: string) => `oral_session_v3:${userId}`;

export function restoreOralSession(raw: string | null, userId: string): SavedSession | null {
  if (!raw) return null;
  try {
    const parsed = oralSessionSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.userId !== userId) return null;
    const saved = parsed.data;
    if (saved.screen === "select") return null;
    if (!saved.questions.length || saved.entries.length > saved.questions.length || !z.string().uuid().safeParse(saved.sessionKey).success) return null;
    if (new Set(saved.questions.map((question) => question.id)).size !== saved.questions.length) return null;
    if (saved.entries.some((entry, index) => entry.question.id !== saved.questions[index]?.id || entry.evaluation.questionId !== entry.question.id)) return null;
    if (Boolean(saved.followUpQuestion) !== Boolean(saved.originalAnswer)) return null;
    if (saved.feedbackVisible && !saved.entries.length) return null;
    if (saved.screen === "results" && saved.entries.length !== saved.questions.length) return null;
    // Recover the completed scorecard even if the tab closed during its save.
    if (saved.entries.length === saved.questions.length) {
      saved.assessment ??= buildAssessmentFromEvaluations(saved.entries.map((entry) => entry.evaluation));
      saved.screen = "results";
      saved.input = "";
      saved.originalAnswer = null;
      saved.followUpQuestion = null;
      saved.feedbackVisible = false;
    } else if (saved.assessment || saved.saveStatus !== "idle") return null;
    if (saved.saveStatus === "pending") saved.saveStatus = "failed";
    return saved;
  } catch {
    return null;
  }
}
