import test from "node:test";
import assert from "node:assert/strict";
import { buildQuestionReviewQueue, buildTodayStudyPlan, practiceLink, type QuestionResult } from "../lib/study-plan.ts";

const now = new Date("2026-10-01T12:00:00Z");
const result = (question_id: string, correct: boolean, created_at: string): QuestionResult => ({ question_id, correct, created_at, category: "Weather" });

test("exam mistakes are due now; a later correct answer removes the old mistake", () => {
  const history = [result("missed", false, "2026-10-01T11:00:00Z"), result("fixed", false, "2026-09-30T11:00:00Z"), result("fixed", true, "2026-10-01T11:00:00Z")];
  assert.deepEqual(buildQuestionReviewQueue(history, now).map((item) => item.questionId), ["missed"]);
});

test("review intervals grow with successful attempts and reset after a mistake", () => {
  const history = [result("repeat", true, "2026-09-28T11:00:00Z"), result("repeat", true, "2026-09-27T11:00:00Z"), result("single", true, "2026-09-28T11:00:00Z")];
  assert.deepEqual(buildQuestionReviewQueue(history, now).map((item) => item.questionId), ["single"]);
  assert.equal(buildQuestionReviewQueue([...history, result("repeat", false, "2026-10-01T11:00:00Z")], now)[0].questionId, "repeat");
});

test("daily plan starts with actual missed IDs and respects the selected time budget", () => {
  const results = Array.from({ length: 30 }, (_, index) => result(`q${index}`, false, "2026-10-01T11:00:00Z"));
  const plan = buildTodayStudyPlan({ results, categories: ["Weather"], oralSessions: [], checkrideDate: null, minutes: 10, now });
  const params = new URL(plan.steps[0].href, "https://example.test").searchParams;
  assert.equal(params.get("questionIds")?.split(",").length, 6);
  assert.ok(plan.steps.reduce((total, step) => total + step.minutes, 0) <= 10);
  assert.equal(plan.daysRemaining, null);
});

test("new students get an available category and oral gaps link to a focused session", () => {
  const plan = buildTodayStudyPlan({ results: [], categories: ["Weather"], oralSessions: [{ created_at: now.toISOString(), assessment: { areasToReview: [{ acsArea: "Emergency Operations", acsCode: "PA.IX.B.K1" }] } }], checkrideDate: "2026-10-03", minutes: 20, now });
  assert.match(plan.steps[0].href, /categories=Weather/);
  const params = new URL(plan.steps[1].href, "https://example.test").searchParams;
  assert.equal(params.get("focus"), "PA.IX.B.K1");
  assert.equal(params.get("mode"), "checkride");
});

test("practice links preserve categories containing punctuation", () => {
  const params = new URL(practiceLink({ categories: ["Weight & Balance"], count: 5 }), "https://example.test").searchParams;
  assert.equal(params.get("categories"), "Weight & Balance");
});
