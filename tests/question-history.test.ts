import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readQuestionHistory } from "../lib/question-history.ts";

test("question history reads beyond the Supabase page cap", async () => {
  const ranges: number[] = [];
  const query = {
    select() { return this; }, eq() { return this; }, order() { return this; },
    async range(offset: number) {
      ranges.push(offset);
      return { data: Array.from({ length: offset === 0 ? 1_000 : 1 }, (_, index) => ({ id: offset + index, question_id: `q${offset + index}`, correct: false, category: "Weather", created_at: "2026-10-01T00:00:00Z" })), error: null };
    },
  };
  const client = { from: () => query } as unknown as Pick<SupabaseClient, "from">;
  const result = await readQuestionHistory(client, "pilot");
  assert.equal(result.data?.length, 1_001);
  assert.deepEqual(ranges, [0, 1_000]);
});
