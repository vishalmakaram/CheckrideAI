import test from "node:test";
import assert from "node:assert/strict";
import { buildQuestionResultRows, saveExamAttempt, saveQuizAttempt, type SaveProgress } from "../lib/quiz-attempt.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

const questions = [{ id: "q1", category: "Weather", correct_answer: "option_a" }, { id: "q2", category: "Navigation", correct_answer: "option_b" }];
test("every exam response including unanswered questions feeds question-level history", () => {
  const rows = buildQuestionResultRows(questions, { 0: "option_a" }, "pilot", "session");
  assert.deepEqual(rows.map((row) => row.correct), [true, false]);
  assert.ok(rows.every((row) => row.user_id === "pilot" && row.session_id === "session"));
});

test("practice acknowledges answer saves before waiting for its score", async () => {
  const progress: SaveProgress = { resultsSaved: false, scoreSaved: false };
  const notifications: SaveProgress[] = [];
  const client = { from: (table: string) => ({ insert: async () => {
    if (table === "quiz_scores") {
      assert.deepEqual(notifications, [{ resultsSaved: true, scoreSaved: false }]);
      return { error: { message: "offline" } };
    }
    return { error: null };
  } }) } as unknown as Pick<SupabaseClient, "from">;
  await assert.rejects(saveQuizAttempt(client, questions, {}, "pilot", "session", progress, "Weather", () => notifications.push({ ...progress })), /answers were saved/);
  assert.deepEqual(progress, { resultsSaved: true, scoreSaved: false });
});

test("retrying a partially saved exam does not repeat successful answer writes", async () => {
  const calls: string[] = [];
  let failScore = true;
  const client = { from: (table: string) => ({ insert: async () => { calls.push(table); return { error: table === "quiz_scores" && failScore ? { message: "offline" } : null }; } }) } as unknown as Pick<SupabaseClient, "from">;
  const progress: SaveProgress = { resultsSaved: false, scoreSaved: false };
  await assert.rejects(saveExamAttempt(client, questions, {}, "pilot", "session", progress));
  assert.deepEqual(progress, { resultsSaved: true, scoreSaved: false });
  failScore = false;
  await saveExamAttempt(client, questions, {}, "pilot", "session", progress);
  assert.deepEqual(calls, ["question_results", "quiz_scores", "quiz_scores"]);
  assert.equal(progress.scoreSaved, true);
});
