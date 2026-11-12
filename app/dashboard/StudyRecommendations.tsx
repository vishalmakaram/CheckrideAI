import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CategoryStat } from "./types";

function Recommendation({ stat, index }: { stat: CategoryStat; index: number }) {
  return (
    <li className="flex items-center justify-between gap-4 py-5">
      <div className="flex min-w-0 items-start gap-4">
        <span aria-hidden="true" className="pt-0.5 text-xs font-medium tabular-nums text-slate-400">{String(index + 1).padStart(2, "0")}</span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight text-slate-900">{stat.category}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {Math.round(stat.percentage)}% correct · {stat.total} question{stat.total === 1 ? "" : "s"} answered
          </p>
        </div>
      </div>
      <Link href={`/practice?categories=${encodeURIComponent(stat.category)}`} className="inline-flex shrink-0 items-center gap-2 py-2 text-xs font-semibold text-emerald-800 transition hover:text-emerald-950 hover:underline">
        Practice <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </li>
  );
}

export default function StudyRecommendations({ stats, loading, unavailable }: {
  stats: CategoryStat[];
  loading: boolean;
  unavailable: boolean;
}) {
  const weakCategories = stats.filter((stat) => stat.percentage < 70);
  const priorities = weakCategories.slice(0, 3);
  const remaining = weakCategories.slice(3);

  return (
    <section aria-labelledby="study-recommendations-title" className="min-w-0 py-1 xl:pt-8">
      <div className="mb-5">
        <h2 id="study-recommendations-title" className="text-xl font-semibold tracking-tight text-slate-950">Study Recommendations</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{priorities.length ? "A little focus here will make the biggest difference." : "Your next focus, based on your practice results."}</p>
      </div>
      <div>
        {loading ? (
          <p role="status" className="py-4 text-sm text-slate-500">Finding your study priorities...</p>
        ) : unavailable ? (
          <p role="status" className="py-4 text-sm text-slate-600">Your practice history could not be loaded. <Link href="/practice" className="font-semibold text-emerald-800 underline">Choose a practice set</Link> while it reconnects.</p>
        ) : priorities.length ? (
          <>
            <ul className="divide-y divide-slate-200/70 border-y border-slate-200/70">
              {priorities.map((stat, index) => <Recommendation key={stat.category} stat={stat} index={index} />)}
            </ul>
            {remaining.length > 0 && (
              <details className="py-4">
                <summary className="cursor-pointer text-xs font-semibold text-slate-600">{remaining.length} more topic{remaining.length === 1 ? "" : "s"} to review</summary>
                <ul className="mt-2 divide-y divide-slate-100">
                  {remaining.map((stat, index) => <Recommendation key={stat.category} stat={stat} index={index + 3} />)}
                </ul>
              </details>
            )}
          </>
        ) : (
          <div className="py-4 text-sm text-slate-600">
            <p>{stats.length ? "No categories are below 70% right now. Use today's plan to keep reviewing and cover new topics." : "Complete a practice set to find the topics to focus on first."}</p>
            {!stats.length && <Link href="/practice" className="mt-3 inline-block font-semibold text-emerald-800 underline">Start practice</Link>}
          </div>
        )}
      </div>
      {!loading && !unavailable && priorities.length >= 2 && (
        <Link href={`/practice?categories=${encodeURIComponent(priorities.map((stat) => stat.category).join(","))}&autostart=true`} className="mt-5 inline-flex items-center gap-3 rounded-md bg-emerald-900 px-4 py-3 text-xs font-semibold text-white transition hover:bg-emerald-950">
          Focus on weak areas <ArrowRight size={15} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
