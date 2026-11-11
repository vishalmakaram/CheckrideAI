import test from "node:test";
import assert from "node:assert/strict";
import { oralStorageKey, restoreOralSession, type SavedSession } from "../lib/oral-session.ts";
import { buildAssessmentFromEvaluations } from "../lib/oral-exam.ts";

const question = { id: "weather-go-no-go", acsArea: "Weather Information", acsCode: "PA.I.C.R1", topic: "Weather", prompt: "Explain your decision.", hint: "Consider the forecast.", reference: "FAA-S-ACS-6C" };
const evaluation = { ...question, questionId: question.id, answer: "Divert early.", score: 90, verdict: "strong" as const, feedback: "Sound decision.", demonstrated: [], missing: [], needsFollowUp: false, followUpQuestion: null };
const saved: SavedSession = {
  version: 3, userId: "pilot-a", screen: "exam", mode: "intermediate", questionCount: 5,
  questions: [question], entries: [], sessionKey: "5a1b9b2a-f75d-4fbb-9d89-25e1e8c2d57a", aircraftModel: "Cessna 172S", assessment: null,
  input: "My follow-up draft", originalAnswer: "My original answer", followUpQuestion: "What would make you divert?", hintVisible: false, feedbackVisible: false,
  scoringFailed: false, saveStatus: "idle",
};

test("oral recovery preserves draft, original answer, follow-up, and feedback state", () => {
  const restored = restoreOralSession(JSON.stringify(saved), "pilot-a");
  assert.equal(restored?.input, saved.input);
  assert.equal(restored?.originalAnswer, saved.originalAnswer);
  assert.equal(restored?.followUpQuestion, saved.followUpQuestion);
  const feedback = { ...saved, questions: [question, { ...question, id: "next" }], entries: [{ question, answer: evaluation.answer, evaluation }], originalAnswer: null, followUpQuestion: null, input: "", feedbackVisible: true };
  assert.equal(restoreOralSession(JSON.stringify(feedback), "pilot-a")?.feedbackVisible, true);
});

test("oral recovery rejects another account, corrupt JSON, and inconsistent progress", () => {
  assert.notEqual(oralStorageKey("pilot-a"), oralStorageKey("pilot-b"));
  assert.equal(restoreOralSession(JSON.stringify(saved), "pilot-b"), null);
  assert.equal(restoreOralSession("{bad", "pilot-a"), null);
  assert.equal(restoreOralSession(JSON.stringify({ ...saved, originalAnswer: null }), "pilot-a"), null);
  assert.equal(restoreOralSession(JSON.stringify({ ...saved, entries: [{ question: { ...question, id: "wrong" }, answer: "", evaluation }] }), "pilot-a"), null);
});

test("a completed session interrupted during saving restores its scorecard with a retry", () => {
  const completed = { ...saved, entries: [{ question, answer: evaluation.answer, evaluation }], input: "", originalAnswer: null, followUpQuestion: null,
    assessment: buildAssessmentFromEvaluations([evaluation]), saveStatus: "pending" };
  const restored = restoreOralSession(JSON.stringify(completed), "pilot-a");
  assert.equal(restored?.screen, "results");
  assert.equal(restored?.saveStatus, "failed");
  assert.equal(restored?.assessment?.overallScore, 90);
});

test("completed oral answers rebuild a missing assessment instead of restoring a blank exam", () => {
  const completed = { ...saved, entries: [{ question, answer: evaluation.answer, evaluation }], assessment: null };
  const restored = restoreOralSession(JSON.stringify(completed), "pilot-a");
  assert.equal(restored?.screen, "results");
  assert.equal(restored?.assessment?.overallScore, 90);
  assert.equal(restored?.originalAnswer, null);
  assert.equal(restored?.followUpQuestion, null);
  assert.equal(restored?.input, "");
});

test("oral recovery rejects duplicate questions and feedback without a recorded answer", () => {
  assert.equal(restoreOralSession(JSON.stringify({ ...saved, questions: [question, question] }), "pilot-a"), null);
  assert.equal(restoreOralSession(JSON.stringify({ ...saved, feedbackVisible: true }), "pilot-a"), null);
});

test("initial feedback is recovered with its follow-up without counting the answer twice", () => {
  const pendingEvaluation = { ...evaluation, score: 55, verdict: "partial" as const, needsFollowUp: true, followUpQuestion: saved.followUpQuestion };
  const restored = restoreOralSession(JSON.stringify({ ...saved, pendingEvaluation, feedbackVisible: true }), "pilot-a");
  assert.equal(restored?.pendingEvaluation?.score, 55);
  assert.equal(restored?.followUpQuestion, saved.followUpQuestion);
  assert.equal(restored?.entries.length, 0);
  assert.equal(restoreOralSession(JSON.stringify({ ...saved, pendingEvaluation: { ...pendingEvaluation, questionId: "unrelated" } }), "pilot-a"), null);
  assert.equal(restoreOralSession(JSON.stringify({ ...saved, pendingEvaluation: { ...pendingEvaluation, followUpQuestion: "Unrelated follow-up" } }), "pilot-a"), null);
});
