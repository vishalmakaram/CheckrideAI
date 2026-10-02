import { test, expect, type Page } from "@playwright/test";

const userId = "11111111-1111-4111-8111-111111111111";
const storageKey = `oral_session_v3:${userId}`;
const sessionKey = "5a1b9b2a-f75d-4fbb-9d89-25e1e8c2d57a";
const question = { id: "weather-go-no-go", acsArea: "Weather Information", acsCode: "PA.I.C.R1", topic: "Weather decisions", prompt: "Explain your weather decision.", hint: "Consider the forecast.", reference: "FAA-S-ACS-6C" };

test.beforeEach(async ({ context, request }) => {
  await request.post("http://127.0.0.1:3102/__reset");
  const expiry = Math.floor(Date.now() / 1000) + 86_400;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, aud: "authenticated", role: "authenticated", iat: expiry - 86_400, exp: expiry })}.test-signature`;
  const session = { access_token: token, refresh_token: "test-refresh-token", expires_at: expiry, expires_in: 86_400, token_type: "bearer", user: { id: userId, email: "pilot@example.test", app_metadata: {}, user_metadata: {} } };
  await context.addCookies([{ name: "sb-127-auth-token", value: `base64-${encode(session)}`, domain: "127.0.0.1", path: "/", sameSite: "Lax" }]);
});

async function seedOral(page: Page) {
  await page.goto("/oral");
  await expect(page.getByRole("button", { name: "Begin oral practice" })).toBeVisible();
  await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key: storageKey, saved: {
    version: 3, userId, screen: "exam", mode: "intermediate", questionCount: 5,
    questions: Array.from({ length: 5 }, (_, index) => ({ ...question, id: index ? `next-${index}` : question.id })), entries: [], sessionKey, aircraftModel: "Cessna 172S", assessment: null,
    input: "My draft answer", originalAnswer: "My original explanation", followUpQuestion: "When would you divert?", hintVisible: false, feedbackVisible: false, scoringFailed: false, saveStatus: "idle",
  } });
  await page.reload();
}

test("daily plan starts a focused practice set", async ({ page }, testInfo) => {
  await page.goto("/dashboard");
  const plan = page.getByRole("region", { name: "Today's study plan" });
  await expect(plan.getByRole("link", { name: "Start practice" })).toBeVisible();
  await plan.getByLabel("Time available").selectOption("10");
  await page.screenshot({ path: testInfo.outputPath("dashboard-plan.png"), fullPage: true });
  await plan.getByRole("link", { name: "Start practice" }).click();
  await expect(page.getByRole("heading", { name: /Practice question/ })).toBeVisible();
  await expect(page.getByText(/Question 1 of 6/)).toBeVisible();
});

test("exam mistakes save to history and retry the exact missed questions", async ({ page, request }) => {
  await page.goto("/exam");
  await page.getByRole("button", { name: "Begin Examination" }).click();
  await page.getByRole("button", { name: /Incorrect choice/ }).click();
  await page.getByRole("button", { name: /Correct choice/, exact: false }).click();
  await page.getByRole("button", { name: /Incorrect choice/ }).click();
  await page.getByRole("button", { name: "Submit Exam" }).click();
  await expect(page.getByText("Score and answers saved to your study history")).toBeVisible();
  const rows = await (await request.get("http://127.0.0.1:3102/rest/v1/question_results")).json();
  expect(rows).toHaveLength(60);
  expect(rows.every((row: { correct: boolean }) => !row.correct)).toBe(true);
  const oralStart = await page.request.post("/api/chat", { data: { action: "start", mode: "intermediate", questionCount: 5, sessionKey } });
  expect(oralStart.ok()).toBe(true);
  expect((await oralStart.json()).adaptiveAreas).toEqual(expect.arrayContaining(["PA.I.C", "PA.I.D"]));
  await page.getByRole("link", { name: "Practise missed questions" }).click();
  await expect(page.getByText("Question 1 of 60")).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Revisit your missed questions" })).toBeVisible();
});

test("oral drafts and follow-ups survive reload and a new tab", async ({ page, context }) => {
  await seedOral(page);
  await expect(page.getByRole("heading", { name: "When would you divert?" })).toBeVisible();
  await expect(page.getByLabel("Your answer")).toHaveValue("My draft answer");
  await page.getByLabel("Your answer").fill("I would divert before my margin shrinks.");
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).input, storageKey)).toBe("I would divert before my margin shrinks.");
  const reopened = await context.newPage();
  await reopened.goto("/oral");
  await expect(reopened.getByRole("heading", { name: "When would you divert?" })).toBeVisible();
  await expect(reopened.getByLabel("Your answer")).toHaveValue("I would divert before my margin shrinks.");
});

test("a failed final save leaves the scorecard visible and can be retried after reload", async ({ page }) => {
  await seedOral(page);
  await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key)!);
    saved.entries = saved.questions.slice(0, -1).map((item: typeof question) => ({ question: item, answer: "Earlier answer", evaluation: { questionId: item.id, acsArea: item.acsArea, acsCode: item.acsCode, topic: item.topic, reference: item.reference, answer: "Earlier answer", score: 90, verdict: "strong", feedback: "Sound reasoning", demonstrated: [], missing: [], needsFollowUp: false, followUpQuestion: null, scored: true } }));
    localStorage.setItem(key, JSON.stringify(saved));
  }, storageKey);
  await page.reload();
  await page.route("**/api/chat", async (route) => route.fulfill({ json: { evaluation: { ...question, questionId: route.request().postDataJSON().questionId, answer: "Draft", score: 90, verdict: "strong", feedback: "Sound reasoning", demonstrated: [], missing: [], needsFollowUp: false, followUpQuestion: null, scored: true } } }));
  await page.route("**/rest/v1/oral_sessions*", async (route) => {
    if (route.request().method() === "POST") await route.fulfill({ status: 503, json: { message: "Offline" } });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByRole("heading", { name: "Oral practice scorecard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry saving scorecard" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Oral practice scorecard" })).toBeVisible();
  await page.unroute("**/rest/v1/oral_sessions*");
  await page.getByRole("button", { name: "Retry saving scorecard" }).click();
  await expect(page.getByText("Scorecard saved to your account.")).toBeVisible();
});

test("voice dictation fills an editable transcript without submitting it", async ({ page }) => {
  await page.addInitScript(() => {
    class TestRecognition {
      onresult?: (event: unknown) => void;
      onend?: () => void;
      start() { setTimeout(() => this.onresult?.({ results: [{ isFinal: true, 0: { transcript: "I would divert early." } }] }), 10); }
      stop() { this.onend?.(); }
      abort() {}
    }
    Object.assign(window, { SpeechRecognition: TestRecognition });
  });
  await seedOral(page);
  await page.getByRole("button", { name: "Dictate answer" }).click();
  await expect(page.getByLabel("Your answer")).toHaveValue("My draft answer I would divert early.");
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeDisabled();
  await page.getByRole("button", { name: "Stop dictation" }).click();
  await page.getByLabel("Your answer").fill("My reviewed explanation.");
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeEnabled();
});

test("denied microphone permission keeps the draft and typed answers usable", async ({ page }) => {
  await page.addInitScript(() => {
    class DeniedRecognition {
      onerror?: (event: unknown) => void;
      start() { setTimeout(() => this.onerror?.({ error: "not-allowed" }), 10); }
      abort() { throw new Error("Service already stopped"); }
    }
    Object.assign(window, { SpeechRecognition: DeniedRecognition });
  });
  await seedOral(page);
  await page.getByRole("button", { name: "Dictate answer" }).click();
  await expect(page.getByText(/Microphone access was denied/)).toBeVisible();
  await expect(page.getByLabel("Your answer")).toHaveValue("My draft answer");
  await expect(page.getByRole("button", { name: "Submit answer" })).toBeEnabled();
});

for (const failure of ["constructor", "start", "stop"] as const) {
  test(`a speech ${failure} failure leaves typing and submission usable`, async ({ page }) => {
    await page.addInitScript((stage) => {
      class BrokenRecognition {
        onresult?: (event: unknown) => void;
        constructor() { if (stage === "constructor") throw new Error("Unavailable"); }
        start() {
          if (stage === "start") throw new Error("Unavailable");
          setTimeout(() => this.onresult?.({ results: [{ isFinal: true, 0: { transcript: "My spoken explanation." } }] }), 10);
        }
        stop() { throw new Error("Unavailable"); }
        abort() { throw new Error("Already stopped"); }
      }
      Object.assign(window, { SpeechRecognition: BrokenRecognition });
    }, failure);
    await seedOral(page);
    await page.getByRole("button", { name: "Dictate answer" }).click();
    if (failure === "stop") {
      await expect(page.getByLabel("Your answer")).toHaveValue("My draft answer My spoken explanation.");
      await page.getByRole("button", { name: "Stop dictation" }).click();
    }
    await expect(page.getByRole("button", { name: "Dictate answer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit answer" })).toBeEnabled();
    await page.getByLabel("Your answer").fill("My reviewed answer.");
    await expect(page.getByLabel("Your answer")).toHaveValue("My reviewed answer.");
  });
}

test("practice save retries survive reload during saving without repeating saved answers", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3102/rest/v1/question_results", { data: { question_id: "q1", category: "Weather", correct: false, user_id: userId, session_id: "earlier-exam" } });
  await page.route("**/rest/v1/quiz_scores*", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.fulfill({ status: 503, json: { message: "Offline" } }).catch(() => { /* Reload can cancel this request. */ });
    }
    else await route.continue();
  });
  await page.goto("/practice?autostart=true&questionIds=q1&count=1");
  await page.getByRole("button", { name: /Correct choice/ }).click();
  await page.getByRole("button", { name: "Finish and save score" }).click();
  await expect(page.getByRole("heading", { name: "Practice Complete" })).toBeVisible();
  await expect.poll(() => page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)!).saveProgress.resultsSaved, `practice_session:${userId}`)).toBe(true);
  await expect(page.getByText("Saving score and answers...", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Practice Complete" })).toBeVisible();
  await page.unroute("**/rest/v1/quiz_scores*");
  await page.getByRole("button", { name: "Retry saving practice" }).click();
  await expect(page.getByText("Score and answers saved to your study history.", { exact: true })).toBeVisible();
  const rows = await (await request.get("http://127.0.0.1:3102/rest/v1/question_results")).json();
  expect(rows).toHaveLength(2);
  expect(rows[1].correct).toBe(true);
  const scores = await (await request.get("http://127.0.0.1:3102/rest/v1/quiz_scores")).json();
  expect(scores).toHaveLength(1);
  expect(scores[0].category).toBe("Weather");
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "Today's study plan" }).getByRole("link", { name: "Start practice" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Revisit your missed questions" })).toHaveCount(0);
  await page.goto("/practice?autostart=true&questionIds=q1&count=1");
  await expect(page.getByText("Question 1 of 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Correct choice/ })).toBeEnabled();
});

test("oral feedback stays with the answered question across reload", async ({ page }, testInfo) => {
  await seedOral(page);
  await page.route("**/api/chat", async (route) => route.fulfill({ json: { evaluation: { ...question, questionId: question.id, answer: "Draft", score: 90, verdict: "strong", feedback: "Sound reasoning", demonstrated: [], missing: [], needsFollowUp: false, followUpQuestion: null, scored: true } } }));
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByRole("button", { name: "Next question" })).toBeVisible();
  await expect(page.getByRole("heading", { name: question.prompt })).toBeVisible();
  await expect(page.getByText("Question 1 of 5", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: question.prompt })).toBeVisible();
  await expect(page.getByText(/Your answer: My original explanation/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("oral-feedback.png"), fullPage: true });
  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page.getByText("Question 2 of 5", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Your answer")).toBeEditable();
});

test("complete oral entries recover a missing scorecard", async ({ page }) => {
  await seedOral(page);
  await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key)!);
    saved.entries = saved.questions.map((item: typeof question) => ({ question: item, answer: "Recorded answer", evaluation: { questionId: item.id, acsArea: item.acsArea, acsCode: item.acsCode, topic: item.topic, reference: item.reference, answer: "Recorded answer", score: 90, verdict: "strong", feedback: "Sound reasoning", demonstrated: [], missing: [], needsFollowUp: false, followUpQuestion: null, scored: true } }));
    saved.assessment = null;
    localStorage.setItem(key, JSON.stringify(saved));
  }, storageKey);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Oral practice scorecard" })).toBeVisible();
  await page.getByRole("button", { name: "Retry saving scorecard" }).click();
  await expect(page.getByText("Scorecard saved to your account.")).toBeVisible();
});
