import type { SessionEntry } from "@/lib/oral-session";

const verdictLabels = { strong: "Strong", acceptable: "Acceptable", partial: "Needs detail", incorrect: "Review needed" };

export default function AnswerFeedback({ entry, questionNumber, provisional = false }: {
  entry: SessionEntry;
  questionNumber: number;
  provisional?: boolean;
}) {
  const { question, answer, evaluation } = entry;
  const scored = evaluation.scored !== false;
  return (
    <section aria-label={`Feedback on question ${questionNumber}`} aria-live="polite" aria-atomic="true" className="rounded-lg border border-emerald-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">{provisional ? "Initial answer feedback" : "Answer feedback"} · Question {questionNumber}</p>
          <h2 className="mt-2 text-lg font-bold text-slate-950">{scored ? verdictLabels[evaluation.verdict] : "Answer saved without a score"}</h2>
        </div>
        <p className="shrink-0 rounded-lg bg-slate-950 px-3 py-2 text-lg font-bold text-white">{scored ? `${evaluation.score}/100` : "Not scored"}</p>
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-slate-800">{question.prompt}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{evaluation.feedback}</p>
      {provisional && <p className="mt-3 text-xs font-medium leading-5 text-amber-800">This is your initial score. Answer the follow-up to receive an updated score for this question.</p>}
      {scored && evaluation.demonstrated.length > 0 && <div className="mt-4">
        <h3 className="text-xs font-bold text-emerald-800">What you got right</h3>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-sm leading-6 text-slate-600">{evaluation.demonstrated.map((point, index) => <li key={index}>{point}</li>)}</ul>
      </div>}
      {scored && evaluation.missing.length > 0 && <div className="mt-4">
        <h3 className="text-xs font-bold text-amber-800">What to improve</h3>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-sm leading-6 text-slate-600">{evaluation.missing.map((point, index) => <li key={index}>{point}</li>)}</ul>
      </div>}
      <details className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-800">Your answer</summary>
        <p className="mt-2 whitespace-pre-line leading-6">{answer}</p>
      </details>
      <p className="mt-4 text-xs leading-5 text-slate-500">Reference: {evaluation.reference}</p>
    </section>
  );
}
