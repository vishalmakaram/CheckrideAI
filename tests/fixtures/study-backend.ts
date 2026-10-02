// An isolated, local Supabase-shaped backend for browser regressions. It never
// connects to a real account, database, microphone, or AI provider.
import { createServer } from "node:http";

const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "pilot@example.test", app_metadata: { provider: "email" }, user_metadata: { display_name: "Test pilot" }, created_at: "2026-01-01T00:00:00Z" };
const questions = Array.from({ length: 60 }, (_, index) => ({ id: `q${index + 1}`, category: index % 2 ? "Navigation" : "Weather", question_text: `Practice question ${index + 1}`, option_a: "Correct choice", option_b: "Incorrect choice", option_c: "Another choice", correct_answer: "option_a", explanation: "This is the explanation for the correct choice.", image_url: null }));
let tables: Record<string, Record<string, unknown>[]>;
function reset() {
  tables = {
    questions,
    profiles: [{ id: user.id, display_name: "Test pilot", preferred_aircraft: "Cessna 172S", checkride_date: null, onboarding_completed: true }],
    quiz_scores: [], question_results: [], oral_sessions: [], ai_usage: [], checklist_items: [],
  };
}
reset();

createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, HEAD, OPTIONS");
  response.setHeader("Access-Control-Expose-Headers", "Content-Range");
  if (request.method === "OPTIONS") { response.end(); return; }
  const url = new URL(request.url!, "http://127.0.0.1:3102");
  response.setHeader("Content-Type", "application/json");
  if (url.pathname === "/__reset") { reset(); response.end("{}"); return; }
  if (url.pathname === "/auth/v1/user") { response.end(JSON.stringify(user)); return; }
  if (url.pathname === "/auth/v1/.well-known/jwks.json") { response.end('{"keys":[]}'); return; }
  const table = url.pathname.split("/").at(-1)!;
  if (!tables[table]) { response.end("[]"); return; }
  if (request.method === "POST" || request.method === "PATCH") {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const payload = JSON.parse(raw || "{}");
    if (request.method === "POST") {
      const rows = Array.isArray(payload) ? payload : [payload];
      for (const row of rows) tables[table].push({ id: tables[table].length + 1, created_at: new Date().toISOString(), ...row });
    } else {
      for (const row of tables[table]) if ([...url.searchParams].every(([key, value]) => !value.startsWith("eq.") || String(row[key]) === value.slice(3))) Object.assign(row, payload);
    }
    response.end("[]");
    return;
  }
  let rows = tables[table].filter((row) => [...url.searchParams].every(([key, value]) => {
    if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
    if (value.startsWith("in.(")) return value.slice(4, -1).split(",").map((item) => item.replaceAll('"', "")).includes(String(row[key]));
    return true;
  }));
  if (url.searchParams.get("order")?.includes("created_at.desc")) rows = [...rows].reverse();
  if (url.searchParams.has("offset")) rows = rows.slice(Number(url.searchParams.get("offset")));
  if (url.searchParams.has("limit")) rows = rows.slice(0, Number(url.searchParams.get("limit")));
  response.setHeader("Content-Range", `0-${Math.max(0, rows.length - 1)}/${rows.length}`);
  response.end(request.method === "HEAD" ? undefined : JSON.stringify(rows));
}).listen(3102, "127.0.0.1");
