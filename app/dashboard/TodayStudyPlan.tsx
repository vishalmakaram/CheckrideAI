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
    <section className="min-w-0 rounded-sm bg-[#edf3ee] p-6 sm:p-7 lg:p-8" aria-labelledby="today-plan-title">
      <div>
        <div>
          <h2 id="today-plan-title" className="text-xl font-semibold tracking-tight text-slate-950">Today&apos;s study plan</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{plan.daysRemaining !== null && plan.daysRemaining >= 0 ? `${plan.daysRemaining} days to your checkride. ` : ""}One focused block, based on your latest results.</p>
        </div>
        <label className="mt-5 flex items-center gap-2 border-y border-emerald-900/10 py-3 text-xs font-medium text-slate-600">
          <Clock3 size={15} aria-hidden="true" /> Time available
          <select aria-label="Time available" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className="ml-auto rounded-md border border-emerald-900/15 bg-white/70 px-2 py-1.5 text-xs font-semibold text-emerald-950">
            {[10, 20, 30, 45].map((value) => <option key={value} value={value}>{value} min</option>)}
          </select>
        </label>
      </div>
      {loading ? <p className="py-6 text-sm text-slate-500" role="status">Preparing your study plan...</p> : unavailable ? (
        <p role="status" className="py-6 text-sm text-slate-600">Your history could not be loaded. <Link href="/practice" className="font-semibold text-emerald-800 underline">Choose a practice set</Link> while it reconnects.</p>
      ) : (
        <ol className="mt-6 space-y-6">
          {plan.steps.map((step, index) => <li key={step.href} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-900/20 text-xs font-semibold text-emerald-900">{index + 1}</span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-6 text-slate-900">{step.title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">{step.reason} About {step.minutes} min.</p>
              <Link href={step.href} className="mt-3 inline-flex items-center gap-2 py-1 text-xs font-semibold text-emerald-900 hover:text-emerald-950 hover:underline">{step.action}<ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
          </li>)}
        </ol>
      )}
    </section>
  );
}
