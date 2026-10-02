import Link from "next/link";
import LegalFooter from "./components/LegalFooter";

const features = [
  {
    number: "01",
    label: "Focused practice",
    detail: "Build a question set around the knowledge categories that need attention, with immediate explanations after each answer.",
    proof: "5 to 100 questions",
  },
  {
    number: "02",
    label: "Written exam rehearsal",
    detail: "Work through a timed 60-question session with question navigation, flags, and category-level results after submission.",
    proof: "FAA-style test flow",
  },
  {
    number: "03",
    label: "AI oral examiner",
    detail: "Respond to aircraft-aware scenarios mapped to the Private Pilot ACS and receive a structured session scorecard.",
    proof: "FAA-S-ACS-6C mapped",
  },
  {
    number: "04",
    label: "A study plan that adjusts",
    detail: "See score movement, category mastery, and a spaced-repetition queue built from your saved performance.",
    proof: "Per-user history",
  },
];

function LogoMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-white">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M9 2L15 5.5V12.5L9 16L3 12.5V5.5L9 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 5.5V12.5M5.8 9H12.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-950">CheckrideAI</p>
        <p className="hidden text-xs font-medium text-slate-500 sm:block">Private pilot prep</p>
      </div>
    </div>
  );
}

function ProductPreview() {
  return (
    <section aria-label="CheckrideAI product preview" className="border-y border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto grid max-w-6xl lg:grid-cols-[0.72fr_1.28fr]">
        <div className="border-b border-white/10 px-6 py-7 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-editorial text-base text-slate-400">Your next study block</p>
              <p className="mt-2 text-lg font-semibold">Weather and cross-country</p>
            </div>
            <span className="rounded-md bg-emerald-950 px-2.5 py-1 text-xs font-semibold text-emerald-300">VFR</span>
          </div>
          <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-white/10 pt-5">
            <div><dt className="text-xs text-slate-500">Practice</dt><dd className="mt-1 text-xl font-bold">78%</dd></div>
            <div><dt className="text-xs text-slate-500">Exam</dt><dd className="mt-1 text-xl font-bold">74%</dd></div>
            <div><dt className="text-xs text-slate-500">Due</dt><dd className="mt-1 text-xl font-bold">3 areas</dd></div>
          </dl>
        </div>

        <div className="grid md:grid-cols-2">
          <div className="border-b border-white/10 px-6 py-7 md:border-b-0 md:border-r">
            <p className="font-editorial text-base text-slate-400">Category mastery</p>
            <div className="mt-5 space-y-4">
              {[
                ["Weather", "74%"],
                ["Navigation", "82%"],
                ["Regulations", "68%"],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-slate-300">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: value }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 py-7">
            <p className="font-editorial text-base text-slate-400">AI oral examiner</p>
            <p className="mt-5 text-base font-medium leading-7 text-slate-100">
              Tell me how you would evaluate ceilings and visibility before a short cross-country in your aircraft.
            </p>
            <div className="mt-6 border-t border-white/10 pt-4">
              <p className="text-xs font-semibold text-emerald-300">Suggested next session</p>
              <p className="mt-1 text-sm leading-6 text-slate-400">Review weather minimums, then run a 15-question focused set.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <section>
        <div className="mx-auto max-w-6xl px-6 py-6">
          <nav className="flex items-center justify-between">
            <LogoMark />
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/login" className="whitespace-nowrap text-sm font-semibold text-slate-600 transition-colors hover:text-slate-950">Sign in</Link>
              <Link href="/login?mode=signup" className="whitespace-nowrap rounded-md bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 sm:px-4">Create account</Link>
            </div>
          </nav>

          <div className="max-w-5xl py-16 md:py-20">
            <p className="font-editorial text-xl leading-7 text-emerald-900">Prepare for both sides of the checkride.</p>
            <h1 className="font-editorial mt-5 max-w-5xl text-5xl font-normal leading-[1.06] text-slate-950 md:text-6xl">Private Pilot Prep Designed for You.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Practice FAA-style questions, rehearse oral scenarios with an adaptive examiner, and use your results to decide what deserves another pass.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login?mode=signup" className="inline-flex items-center justify-center rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800">Start studying</Link>
              <Link href="/login" className="inline-flex items-center justify-center rounded-md border border-slate-400 px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-950">Sign in</Link>
            </div>
          </div>
        </div>
        <ProductPreview />
      </section>

      <section className="border-b border-slate-300">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 border-b border-slate-300 pb-8 md:grid-cols-[0.72fr_1.28fr]">
            <p className="font-editorial text-xl leading-7 text-slate-700">A complete preparation loop.</p>
            <h2 className="font-editorial max-w-3xl text-4xl font-normal leading-tight">One record of your preparation, from the first practice set through the oral rehearsal.</h2>
          </div>
          <div>
            {features.map((feature) => (
              <article key={feature.number} className="grid gap-4 border-b border-slate-300 py-7 md:grid-cols-[0.18fr_0.55fr_1.27fr] md:items-start">
                <span className="text-xs font-bold text-emerald-800">{feature.number}</span>
                <div>
                  <h3 className="font-editorial text-xl font-normal leading-7">{feature.label}</h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{feature.proof}</p>
                </div>
                <p className="max-w-2xl text-sm leading-7 text-slate-600">{feature.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 px-6 py-8 sm:flex-row sm:items-center">
        <p className="max-w-xl text-sm leading-6 text-slate-600">Independent practice for student pilots. Always verify operational and aircraft-specific information with current FAA sources and the applicable POH or AFM.</p>
        <LegalFooter />
      </div>
    </main>
  );
}
