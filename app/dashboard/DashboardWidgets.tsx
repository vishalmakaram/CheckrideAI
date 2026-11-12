"use client";

import { useEffect, useState } from "react";
import type { CategoryStat, OralSessionRow, ScorePoint } from "./types";

export function AnimatedDial({ percentage, label, color, count }: {
  percentage: number;
  label: string;
  color: string;
  count: number;
}) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const trackLength = circumference * 0.75;
  const fillLength = animated ? trackLength * (percentage / 100) : 0;

  return (
    <div className="flex min-w-0 items-center gap-2 py-2 first:pr-3 last:pl-3 sm:gap-4 sm:first:pr-8 sm:last:pl-8">
      <svg width="140" height="130" className="h-auto w-20 shrink-0 sm:w-24" viewBox="0 0 140 130" aria-label={`${label}: ${count ? `${Math.round(percentage)} percent` : "no data"}`}>
        <circle cx="70" cy="75" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="8" strokeDasharray={`${trackLength} ${circumference - trackLength}`} strokeLinecap="round" style={{ transform: "rotate(135deg)", transformOrigin: "70px 75px" }} />
        <circle cx="70" cy="75" r={radius} fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${fillLength} ${circumference}`} strokeLinecap="round" style={{ transform: "rotate(135deg)", transformOrigin: "70px 75px", transition: "stroke-dasharray 1.5s cubic-bezier(0.4, 0, 0.2, 1)" }} />
        <text x="70" y="80" textAnchor="middle" style={{ fontSize: "28px", fontWeight: 600, fill: "#0f172a" }}>{count === 0 ? "--" : `${Math.round(percentage)}%`}</text>
      </svg>
      <div className="min-w-0">
        <p className="text-xs font-medium leading-5 text-slate-700 sm:text-sm">{label}</p>
        <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">{count ? `${count} session${count !== 1 ? "s" : ""}` : "No sessions yet"}</p>
      </div>
    </div>
  );
}

export function CategoryBar({ stat }: { stat: CategoryStat }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 400);
    return () => clearTimeout(timer);
  }, []);

  const color = stat.percentage >= 80 ? "#4f46e5" : stat.percentage >= 70 ? "#f59e0b" : "#ef4444";
  const label = stat.percentage >= 90 ? "Strong" : stat.percentage >= 80 ? "Good" : stat.percentage >= 70 ? "Needs work" : "Weak";

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 py-3 sm:flex sm:gap-4">
      <div className="min-w-0 sm:w-44 sm:shrink-0"><p className="truncate text-sm font-medium text-slate-800">{stat.category}</p><p className="text-xs text-slate-400">{stat.total} answered</p></div>
      <div className="order-last col-span-2 h-2 overflow-hidden rounded-full bg-slate-100 sm:order-none sm:flex-1"><div className="h-2 rounded-full transition-colors duration-1000" style={{ width: animated ? `${stat.percentage}%` : "0%", backgroundColor: color }} /></div>
      <span className="w-10 text-right text-sm font-semibold" style={{ color }}>{Math.round(stat.percentage)}%</span>
      <span className="hidden w-24 text-right text-xs font-medium text-slate-500 sm:block">{label}</span>
    </div>
  );
}

export function ScoreOverTimeChart({ points }: { points: ScorePoint[] }) {
  if (points.length < 2) return <EmptyChart title="Score Over Time" detail="Complete two sessions to see your score trend." />;

  const width = 560;
  const height = 180;
  const pad = 28;
  const xFor = (index: number) => pad + (index / Math.max(points.length - 1, 1)) * (width - pad * 2);
  const yFor = (percentage: number) => pad + ((100 - percentage) / 100) * (height - pad * 2);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(point.percentage)}`).join(" ");
  const latest = points[points.length - 1];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-start justify-between"><div><h2 className="text-base font-semibold text-slate-900">Score Over Time</h2><p className="mt-0.5 text-xs text-slate-400">{points.length} saved sessions</p></div><p className="text-2xl font-bold text-emerald-700">{latest.percentage}%</p></div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" aria-label="Score history line chart">
        {[0, 25, 50, 75, 100].map((tick) => <g key={tick}><line x1={pad} x2={width - pad} y1={yFor(tick)} y2={yFor(tick)} stroke="#f1f5f9" /><text x="0" y={yFor(tick) + 4} fontSize="10" fill="#94a3b8">{tick}</text></g>)}
        <line x1={pad} x2={width - pad} y1={yFor(70)} y2={yFor(70)} stroke="#c7d2fe" strokeDasharray="4 4" />
        <path d={path} fill="none" stroke="#047857" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => <circle key={point.id} cx={xFor(index)} cy={yFor(point.percentage)} r="4" fill="#047857" stroke="white" strokeWidth="2" />)}
      </svg>
      <div className="flex justify-between text-xs text-slate-400"><span>{points[0].label}</span><span>70% target</span><span>{latest.label}</span></div>
    </div>
  );
}

function EmptyChart({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="text-base font-semibold text-slate-900">{title}</h2><p className="mt-0.5 text-xs text-slate-400">{detail}</p><div className="mt-8 flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">Not enough history yet</div></div>;
}

export function OralSessionHistory({ sessions, formatDate }: { sessions: OralSessionRow[]; formatDate: (iso: string) => string }) {
  return <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="border-b border-slate-100 px-6 py-5"><h2 className="text-base font-semibold text-slate-900">Recent AI Oral Sessions</h2><p className="mt-0.5 text-xs text-slate-400">ACS-aligned practice scorecards and review summaries</p></div>{sessions.length === 0 ? <div className="p-10 text-center text-sm text-slate-400">Complete a mock oral session to save a scorecard.</div> : <div className="divide-y divide-slate-100">{sessions.map((session) => <div key={session.id} className="px-6 py-4"><div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold capitalize text-slate-800">{session.mode} mode{session.aircraft_model ? ` - ${session.aircraft_model}` : ""}</p><p className="text-xs text-slate-400">{formatDate(session.created_at)} - {session.question_count} questions</p></div>{session.overall_score === null ? <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Legacy summary</span> : <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">{session.overall_score}/100</span>}</div><p className="line-clamp-3 text-xs leading-relaxed text-slate-500">{session.summary}</p></div>)}</div>}</div>;
}
