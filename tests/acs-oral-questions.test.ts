import test from "node:test";
import assert from "node:assert/strict";
import {
  ACS_ORAL_QUESTIONS,
  findAcsQuestion,
  personalizeQuestion,
  selectAcsQuestions,
} from "../lib/acs-oral-questions.ts";

test("ACS bank has unique questions with scoring rubrics and official mappings", () => {
  assert.equal(ACS_ORAL_QUESTIONS.length, 60);
  assert.equal(new Set(ACS_ORAL_QUESTIONS.map((question) => question.id)).size, ACS_ORAL_QUESTIONS.length);
  for (const question of ACS_ORAL_QUESTIONS) {
    assert.match(question.acsCode, /^PA\./);
    assert.ok(question.rubric.length >= 3);
    assert.match(question.reference, /FAA-S-ACS-6C/);
  }
});

test("expanded bank covers the applicable single-engine land operations beyond preflight", () => {
  const operations = new Set(ACS_ORAL_QUESTIONS.map((question) => question.acsCode.split(".")[1]));
  for (const operation of ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "XI", "XII"]) {
    assert.ok(operations.has(operation), `Missing operation ${operation}`);
  }
  const fullSession = selectAcsQuestions(30, "expanded-session");
  assert.equal(fullSession.length, 30);
  assert.equal(new Set(fullSession.map((question) => question.id)).size, 30);
});

test("selector returns a deterministic, unique, broad session", () => {
  const first = selectAcsQuestions(10, "session-a");
  const second = selectAcsQuestions(10, "session-a");
  assert.deepEqual(first.map((question) => question.id), second.map((question) => question.id));
  assert.equal(new Set(first.map((question) => question.id)).size, 10);
  assert.equal(new Set(first.map((question) => question.acsArea)).size, 10);
});

test("selector prioritizes a known weak ACS area", () => {
  const selected = selectAcsQuestions(5, "session-b", ["PA.I.G.K1e"]);
  assert.equal(selected[0]?.acsArea, "Operation of Systems");
});

test("aircraft placeholders are personalized without changing the source", () => {
  const source = findAcsQuestion("fuel-system");
  assert.ok(source);
  const personalized = personalizeQuestion(source, "Piper Warrior II");
  assert.match(personalized.prompt, /Piper Warrior II/);
  assert.match(source.prompt, /\{aircraft\}/);
});
