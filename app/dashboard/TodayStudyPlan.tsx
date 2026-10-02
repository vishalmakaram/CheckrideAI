"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { buildTodayStudyPlan, type QuestionResult } from "@/lib/study-plan";

export default function TodayStudyPlan({ results, categories, oralSessions, checkrideDate, loading, unavailable }: {
  results: QuestionResult[];
  categories: string[];
  oralSessions: { created_at: string; assessment?: { areasToReview?: { acsCode: string; acsArea: string }[] } | null }[];
  checkrideDate: string | null;
  loading: boolean;
  unavailable: boolean;
}) {
  const [minutes, setMinutes] = useState(20);
  const plan = buildTodayStudyPlan({ results, categories, oralSessions, checkrideDate, minutes });
  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-emerald-200 bg-white" aria-labelledby="today-plan-title">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-100 bg-emerald-50 px-5 py-5">
        <div>
          <h2 id="today-plan-title" className="text-lg font-bold text-slate-950">Today&apos;s study plan</h2>
          <p className="mt-1 text-sm text-slate-600">{plan.daysRemaining !== null && plan.daysRemaining >= 0 ? `${plan.daysRemaining} days to your checkride. ` : ""}One focused block, based on your latest results.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Clock3 size={15} /> Time available
          <select aria-label="Time available" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className="rounded-md border border-emerald-200 bg-white px-2 py-2 text-sm">
            {[10, 20, 30, 45].map((value) => <option key={value} value={value}>{value} min</option>)}
          </select>
        </label>
      </div>
      {loading ? <p className="px-5 py-6 text-sm text-slate-500" role="status">Preparing your study plan...</p> : unavailable ? (
        <p role="status" className="px-5 py-6 text-sm text-slate-600">Your history could not be loaded. <Link href="/practice" className="font-semibold text-emerald-800 underline">Choose a practice set</Link> while it reconnects.</p>
      ) : (
        <ol className="divide-y divide-slate-100">
          {plan.steps.map((step, index) => <li key={step.href} className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
            <div className="flex flex-1 items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{index + 1}</span>
              <div><h3 className="text-sm font-bold text-slate-900">{step.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{step.reason} About {step.minutes} min.</p></div>
            </div>
            <Link href={step.href} className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">{step.action}<ArrowRight size={14} /></Link>
          </li>)}
        </ol>
      )}
    </section>
  );
}
