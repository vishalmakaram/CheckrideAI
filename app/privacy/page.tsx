import Link from "next/link";

export const metadata = { title: "Privacy | CheckrideAI" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-12 text-slate-950">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-950">CheckrideAI</Link>
        <p className="mt-12 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Last updated October 1, 2026</p>
        <h1 className="mt-3 text-4xl font-bold">Privacy policy</h1>
        <p className="mt-5 text-base leading-7 text-slate-600">This policy explains what CheckrideAI stores, why it is used, and the choices available to you.</p>

        <div className="mt-10 space-y-9 border-t border-slate-300 pt-9 text-sm leading-7 text-slate-700">
          <section><h2 className="text-lg font-bold text-slate-950">Information we collect</h2><p className="mt-2">We store account details, profile preferences, checkride dates, practice answers and scores, checklist progress, oral-session assessments, and technical usage records needed to operate the service.</p></section>
          <section><h2 className="text-lg font-bold text-slate-950">How information is used</h2><p className="mt-2">Your information is used to authenticate your account, save study progress, personalize practice, generate oral-exam feedback, protect the service, and understand reliability and operating cost.</p></section>
          <section><h2 className="text-lg font-bold text-slate-950">Service providers</h2><p className="mt-2">CheckrideAI relies on Supabase for authentication and data storage, Anthropic for AI-assisted oral assessment, and Vercel for hosting and product analytics. These providers process limited information as needed to deliver their services.</p></section>
          <section><h2 className="text-lg font-bold text-slate-950">Oral session recovery and voice dictation</h2><p className="mt-2">Oral drafts, answers, follow-up questions, and scorecards are stored per account in this browser to restore interrupted sessions. Starting another oral session clears the current recovery record. Clearing browser storage removes these local records; completed sessions saved to your account remain in your study history.</p><p className="mt-2">Optional voice dictation uses your browser&apos;s speech recognition service with microphone permission. Depending on the browser, audio may be sent to its speech service for processing. CheckrideAI does not upload or store audio recordings. You can edit the transcript before submitting it; submitted text is processed like a typed oral answer.</p></section>
          <section><h2 className="text-lg font-bold text-slate-950">Data control</h2><p className="mt-2">You may update profile information in the app. To request account or data deletion, contact the project owner through the repository linked below.</p></section>
          <section><h2 className="text-lg font-bold text-slate-950">Important limitation</h2><p className="mt-2">Do not enter sensitive aviation, financial, health, or government-identification information. CheckrideAI is a study tool and is not an FAA service.</p></section>
        </div>

        <div className="mt-12 border-t border-slate-300 pt-6 text-sm">
          <a href="https://github.com/imabeginnercoder/CheckrideAI" className="font-semibold text-slate-700 hover:text-slate-950">Project repository</a>
          <span className="mx-3 text-slate-300">|</span>
          <Link href="/terms" className="font-semibold text-slate-700 hover:text-slate-950">Terms of use</Link>
        </div>
      </article>
    </main>
  );
}
