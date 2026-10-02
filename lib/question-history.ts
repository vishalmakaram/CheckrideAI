import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuestionResult } from "./study-plan";

// Paginate in a stable order so recent exams are not hidden behind Supabase's
// default cap of 1,000 historical practice answers per read.
export async function readQuestionHistory(supabase: Pick<SupabaseClient, "from">, userId: string) {
  const results: QuestionResult[] = [];
  const pageSize = 1_000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("question_results")
      .select("id, question_id, category, correct, created_at, session_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) return { data: null, error };
    results.push(...(data ?? []));
    if (!data || data.length < pageSize) return { data: results, error: null };
  }
}
