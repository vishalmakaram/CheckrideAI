import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { findAcsQuestion, personalizeQuestion, selectAcsQuestions } from "@/lib/acs-oral-questions";
import {
  AI_REQUESTS_PER_DAY,
  AI_REQUESTS_PER_MINUTE,
  ORAL_MODEL,
  buildEvaluationSystemPrompt,
  estimateHaikuCostMicrousd,
  modelEvaluationSchema,
  oralRequestSchema,
} from "@/lib/oral-exam";
import { createClient } from "@/lib/supabase/server";
import { readQuestionHistory } from "@/lib/question-history";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function usageCountSince(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  since: Date
) {
  return supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());
}

function quizCategoryToAcsCode(category: string) {
  const label = category.toLowerCase();
  if (label.includes("weather")) return "PA.I.C";
  if (label.includes("airspace")) return "PA.I.E";
  if (label.includes("performance") || label.includes("weight")) return "PA.I.F";
  if (label.includes("system")) return "PA.I.G";
  if (label.includes("human") || label.includes("medical")) return "PA.I.H";
  if (label.includes("navigation") || label.includes("cross-country")) return "PA.I.D";
  if (label.includes("airworth")) return "PA.I.B";
  if (label.includes("regulation") || label.includes("pilot")) return "PA.I.A";
  if (label.includes("aerodynamic") || label.includes("stall") || label.includes("spin")) return "PA.VII.A";
  if (label.includes("emergency")) return "PA.IX.B";
  if (label.includes("night")) return "PA.XI.A";
  if (label.includes("communication")) return "PA.III.A";
  return null;
}

async function loadWeakCodes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const [oralResult, questionResult] = await Promise.all([
    supabase
      .from("oral_sessions")
      .select("assessment")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8),
    readQuestionHistory(supabase, userId),
  ]);

  const codes = new Set<string>();
  for (const session of oralResult.data ?? []) {
    const assessment = session.assessment as { areasToReview?: { acsCode?: string }[] } | null;
    for (const area of assessment?.areasToReview ?? []) if (area.acsCode) codes.add(area.acsCode);
  }

  const categoryStats = new Map<string, { correct: number; total: number }>();
  for (const result of questionResult.data ?? []) {
    const stat = categoryStats.get(result.category) ?? { correct: 0, total: 0 };
    stat.total += 1;
    if (result.correct) stat.correct += 1;
    categoryStats.set(result.category, stat);
  }
  for (const [category, stat] of categoryStats) {
    if (stat.total >= 2 && stat.correct / stat.total < 0.7) {
      const code = quizCategoryToAcsCode(category);
      if (code) codes.add(code);
    }
  }
  return [...codes];
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) {
    return NextResponse.json({ error: "You must be signed in to use the AI oral examiner." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = oralRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "The oral-session request was invalid." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("preferred_aircraft")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) {
    console.error("Unable to load AI profile", profileError);
    return NextResponse.json({ error: "Your study profile is not configured yet." }, { status: 503 });
  }
  const aircraftModel = profile?.preferred_aircraft || "Cessna 172S";

  if (parsed.data.action === "start") {
    const weakCodes = await loadWeakCodes(supabase, userId);
    const focusCodes = parsed.data.focusCodes?.length ? parsed.data.focusCodes : weakCodes;
    const questions = selectAcsQuestions(parsed.data.questionCount, parsed.data.sessionKey, focusCodes)
      .map((question) => personalizeQuestion(question, aircraftModel))
      .map(({ id, acsArea, acsCode, topic, prompt, hint, reference }) => ({
        id, acsArea, acsCode, topic, prompt, hint, reference,
      }));
    return NextResponse.json({ questions, aircraftModel, adaptiveAreas: weakCodes });
  }

  const sourceQuestion = findAcsQuestion(parsed.data.questionId);
  if (!sourceQuestion) return NextResponse.json({ error: "That ACS question was not found." }, { status: 404 });
  const question = personalizeQuestion(sourceQuestion, aircraftModel);

  if (parsed.data.action === "unknown") {
    return NextResponse.json({
      evaluation: {
        questionId: question.id,
        acsArea: question.acsArea,
        acsCode: question.acsCode,
        topic: question.topic,
        reference: question.reference,
        answer: "I don't know",
        score: 0,
        verdict: "incorrect",
        feedback: `Review ${question.topic} before attempting this ACS area again.`,
        demonstrated: [],
        missing: ["No answer was provided for this knowledge or risk-management scenario."],
        needsFollowUp: false,
        followUpQuestion: null,
        scored: true,
      },
      aircraftModel,
      usage: null,
    });
  }

  const now = Date.now();
  const [minuteUsage, dailyUsage] = await Promise.all([
    usageCountSince(supabase, userId, new Date(now - 60_000)),
    usageCountSince(supabase, userId, new Date(now - 86_400_000)),
  ]);
  if (minuteUsage.error || dailyUsage.error) {
    return NextResponse.json({ error: "AI usage tracking is not configured yet." }, { status: 503 });
  }
  if ((minuteUsage.count ?? 0) >= AI_REQUESTS_PER_MINUTE) {
    return NextResponse.json({ error: "You are sending answers too quickly. Wait a minute and try again." }, { status: 429, headers: { "Retry-After": "60" } });
  }
  if ((dailyUsage.count ?? 0) >= AI_REQUESTS_PER_DAY) {
    return NextResponse.json({ error: "You have reached today's AI practice limit." }, { status: 429, headers: { "Retry-After": "3600" } });
  }

  const answerContext = parsed.data.followUpQuestion
    ? `Original answer: ${parsed.data.previousAnswer}\nFollow-up question: ${parsed.data.followUpQuestion}\nFollow-up answer: ${parsed.data.answer}`
    : `Student answer: ${parsed.data.answer}`;

  try {
    const response = await anthropic.messages.parse({
      model: ORAL_MODEL,
      max_tokens: 900,
      system: buildEvaluationSystemPrompt(parsed.data.mode, aircraftModel),
      messages: [{
        role: "user",
        content: `ACS area: ${question.acsArea}\nACS code: ${question.acsCode}\nQuestion: ${question.prompt}\nScoring rubric:\n- ${question.rubric.join("\n- ")}\n\n${answerContext}`,
      }],
      output_config: { format: zodOutputFormat(modelEvaluationSchema) },
    });
    const result = response.parsed_output;
    if (!result) throw new Error(`No structured evaluation returned; stop reason: ${response.stop_reason}`);

    const evaluation = {
      ...result,
      needsFollowUp: parsed.data.attempt === 0 && result.needsFollowUp,
      followUpQuestion: parsed.data.attempt === 0 && result.needsFollowUp ? result.followUpQuestion : null,
      questionId: question.id,
      acsArea: question.acsArea,
      acsCode: question.acsCode,
      topic: question.topic,
      reference: question.reference,
      answer: parsed.data.previousAnswer
        ? `${parsed.data.previousAnswer}\nFollow-up: ${parsed.data.answer}`
        : parsed.data.answer,
      scored: true,
    };
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cacheCreationTokens = response.usage.cache_creation_input_tokens ?? 0;
    const cacheReadTokens = response.usage.cache_read_input_tokens ?? 0;
    const estimatedCostMicrousd = estimateHaikuCostMicrousd(inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens);

    const { error: usageError } = await supabase.from("ai_usage").insert({
      user_id: userId,
      session_key: parsed.data.sessionKey,
      request_id: response.id,
      request_kind: "oral_evaluation",
      model: response.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: cacheCreationTokens,
      cache_read_input_tokens: cacheReadTokens,
      estimated_cost_microusd: estimatedCostMicrousd,
    });
    if (usageError) console.error("Unable to store AI usage", usageError);

    return NextResponse.json({
      evaluation,
      aircraftModel,
      usage: { inputTokens, outputTokens, estimatedCostMicrousd },
    });
  } catch (error) {
    const apiError = error instanceof Anthropic.APIError ? error : null;
    console.error("AI oral answer evaluation failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
      status: apiError?.status,
      requestId: apiError?.requestID,
    });
    return NextResponse.json({
      error: "Scoring is temporarily unavailable. Your answer is still here; retry or continue without a score.",
      code: "SCORING_UNAVAILABLE",
      retryable: true,
    }, { status: 503 });
  }
}
