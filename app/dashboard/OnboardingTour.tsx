"use client";

import { useEffect, useState } from "react";
import { BarChart3, BookOpenCheck, ChevronLeft, ChevronRight, ClipboardCheck, MessageSquareText, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { isMissingDatabaseColumn } from "@/lib/user-facing-errors";

const steps = [
  {
    title: "Your study picture",
    description: "Start with your study recommendations and today's plan. Your average practice and exam scores give you a quick progress check.",
    icon: BarChart3,
  },
  {
    title: "Practice where it matters",
    description: "Build focused question sets by category. Your results update your study recommendations and daily review plan.",
    icon: BookOpenCheck,
  },
  {
    title: "Rehearse the written exam",
    description: "Use practice exams for a broader readiness check, then review missed questions by category.",
    icon: ClipboardCheck,
  },
  {
    title: "Meet the AI oral examiner",
    description: "Run an ACS-based oral session, get structured feedback, and update your aircraft in Profile so questions fit what you fly.",
    icon: MessageSquareText,
  },
];

export default function OnboardingTour({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const localKey = `checkride_onboarding:${userId}`;
      if (localStorage.getItem(localKey) === "complete") return;

      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", userId)
        .maybeSingle();

      if (active && isMissingDatabaseColumn(error, "onboarding_completed")) setOpen(true);
      else if (active && !error && data && !data.onboarding_completed) setOpen(true);
    };

    load();
    return () => { active = false; };
  }, [userId]);

  const dismiss = async () => {
    setSaving(true);
    setOpen(false);
    localStorage.setItem(`checkride_onboarding:${userId}`, "complete");
    await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", userId);
    setSaving(false);
  };

  if (!open) return null;

  const step = steps[stepIndex];
  const Icon = step.icon;
  const isLast = stepIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <section className="relative w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
        <button
          type="button"
          onClick={dismiss}
          disabled={saving}
          aria-label="Close tutorial"
          title="Close tutorial"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
        >
          <X size={19} />
        </button>

        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white">
          <Icon size={21} aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Quick tour · {stepIndex + 1} of {steps.length}</p>
        <h2 id="onboarding-title" className="mt-2 pr-8 text-xl font-bold text-slate-950">{step.title}</h2>
        <p className="mt-3 min-h-20 text-sm leading-6 text-slate-600">{step.description}</p>

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
          <button type="button" onClick={dismiss} disabled={saving} className="text-sm font-semibold text-slate-500 transition hover:text-slate-950 disabled:opacity-50">
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button type="button" onClick={() => setStepIndex((current) => current - 1)} className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:border-slate-950">
                <ChevronLeft size={16} aria-hidden="true" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={() => isLast ? dismiss() : setStepIndex((current) => current + 1)}
              disabled={saving}
              className="inline-flex h-10 items-center gap-1 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isLast ? "Start studying" : "Next"}
              {!isLast && <ChevronRight size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
