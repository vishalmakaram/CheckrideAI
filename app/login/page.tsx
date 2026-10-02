"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { authErrorMessage } from "@/lib/user-facing-errors";
import { aircraftOptions } from "@/lib/profile";
import { supabase } from "@/lib/supabase/client";
import { useAuthState } from "../components/AuthProvider";
import FormStatus from "../components/FormStatus";
import { Skeleton } from "../components/Skeleton";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuthState();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const nextPath = safeNextPath(searchParams.get("next"));
  const confirmationFailed = searchParams.get("error") === "confirmation";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [preferredAircraft, setPreferredAircraft] = useState("Cessna 172S");
  const [checkrideDate, setCheckrideDate] = useState("");
  const [status, setStatus] = useState(confirmationFailed ? "That confirmation link is invalid or has expired. Request a new email and try again." : "");
  const [statusTone, setStatusTone] = useState<"error" | "success">("error");
  const [submitting, setSubmitting] = useState(false);
  const [confirmationHelp, setConfirmationHelp] = useState(confirmationFailed);
  const [resendCooldown, setResendCooldown] = useState(0);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    if (!loading && user) router.replace(nextPath);
  }, [loading, nextPath, router, user]);

  useEffect(() => {
    if (!resendCooldown) return;
    const timer = setTimeout(() => setResendCooldown((remaining) => Math.max(0, remaining - 1)), 1_000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function resendConfirmation() {
    if (requestInFlightRef.current || resendCooldown || !emailInputRef.current?.reportValidity()) return;
    requestInFlightRef.current = true;
    setSubmitting(true);
    setStatus("");
    setStatusTone("error");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup", email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/auth/confirmed` },
      });
      if (error) setStatus(authErrorMessage(error, "We could not request another confirmation email. Please try again."));
      else {
        setStatusTone("success");
        setStatus("If this address has an unconfirmed account, a new confirmation email has been requested. Check your inbox and spam folder. Already confirmed? Sign in instead.");
        setResendCooldown(60);
      }
    } catch {
      setStatus("We could not reach the sign-in service. Check your connection and try again.");
    } finally {
      requestInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (requestInFlightRef.current) return;
    setSubmitting(true);
    setStatus("");
    setStatusTone("error");

    if (mode === "signup" && !/(?=.*[A-Za-z])(?=.*\d).{8,}/.test(password)) {
      setStatus("Use at least 8 characters with both a letter and a number.");
      setSubmitting(false);
      return;
    }

    requestInFlightRef.current = true;
    try {
      const authCall = mode === "signin"
        ? supabase.auth.signInWithPassword({ email: email.trim(), password })
        : supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback?next=/auth/confirmed`,
              data: {
                display_name: displayName.trim(),
                preferred_aircraft: preferredAircraft,
                checkride_date: checkrideDate || null,
              },
            },
          });

      const { data, error } = await authCall;

      if (error) {
        setStatus(authErrorMessage(error, mode === "signin" ? "We could not sign you in. Please try again." : "We could not create your account. Please try again."));
        if (error.code === "email_not_confirmed" || error.message.toLowerCase().includes("email not confirmed")) setConfirmationHelp(true);
      } else if (mode === "signup" && !data.session) {
        setStatusTone("success");
        setConfirmationHelp(true);
        // Supabase can return success for an existing account to protect privacy.
        setStatus("If this address needs confirmation, check your inbox and spam folder for a link. If you already registered, sign in or reset your password instead.");
      } else {
        router.replace(nextPath);
        router.refresh();
      }
    } catch {
      setStatus("We could not reach the sign-in service. Check your connection and try again.");
    } finally {
      requestInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-slate-950">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:block">
          <Link href="/" className="mb-10 inline-flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M9 2L15 5.5V12.5L9 16L3 12.5V5.5L9 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M9 5.5V12.5M5.8 9H12.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-950">CheckrideAI</p>
              <p className="text-xs font-medium text-slate-500">Private pilot prep</p>
            </div>
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Saved study progress</p>
          <h1 className="font-editorial mt-3 max-w-md text-4xl font-normal leading-tight text-slate-950">
            Keep your preparation tied to one clear plan.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-600">
            Your scores, oral feedback, checklist, aircraft profile, and checkride countdown stay with your account.
          </p>
        </section>

        <section className="mx-auto w-full max-w-md rounded-lg border border-slate-200 bg-white p-8">
          <div className="mb-7">
            <Link href="/" className="mb-6 flex items-center gap-3 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white">CA</div>
              <span className="text-sm font-bold text-slate-950">CheckrideAI</span>
            </Link>
            <h1 className="text-2xl font-bold text-slate-950">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {mode === "signin"
                ? "Sign in to continue your PPL prep."
                : "Tell us enough to personalize your study dashboard and oral practice."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label htmlFor="display-name" className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
                  <input
                    id="display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoComplete="name"
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500"
                  />
                </div>
                <div>
                  <label htmlFor="aircraft" className="mb-1.5 block text-sm font-medium text-slate-700">Preferred aircraft</label>
                  <select
                    id="aircraft"
                    value={preferredAircraft}
                    onChange={(event) => setPreferredAircraft(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500"
                  >
                    {aircraftOptions.map((aircraft) => <option key={aircraft}>{aircraft}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="checkride-date" className="mb-1.5 block text-sm font-medium text-slate-700">Checkride date <span className="text-slate-400">(optional)</span></label>
                  <input
                    id="checkride-date"
                    type="date"
                    value={checkrideDate}
                    onChange={(event) => setCheckrideDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500"
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input
                id="email"
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500"
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
                {mode === "signin" && <Link href="/forgot-password" className="text-xs font-medium text-slate-500 hover:text-slate-950">Forgot password?</Link>}
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={mode === "signup" ? 8 : 6}
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-3 pr-11 text-sm outline-none transition focus:border-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {mode === "signup" && <p className="mt-1.5 text-xs text-slate-400">At least 8 characters with a letter and a number.</p>}
            </div>

            <FormStatus message={status} tone={statusTone} />

            {confirmationHelp && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
              <p>Still waiting for confirmation? Check that the email above is correct, then request another link.</p>
              <button type="button" onClick={resendConfirmation} disabled={submitting || loading || resendCooldown > 0} className="mt-2 font-semibold text-slate-950 underline disabled:cursor-not-allowed disabled:opacity-50">
                {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : "Resend confirmation email"}
              </button>
              <p className="mt-2">Already registered? <button type="button" disabled={submitting} onClick={() => { setMode("signin"); setStatus(""); setConfirmationHelp(false); }} className="font-semibold text-slate-950 underline">Sign in instead</button> or <Link href="/forgot-password" className="font-semibold text-slate-950 underline">reset your password</Link>.</p>
            </div>}

            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
            </button>
            {mode === "signup" && (
              <p className="text-center text-xs leading-5 text-slate-500">
                By creating an account, you agree to the <Link href="/terms" className="font-semibold text-slate-700 hover:text-slate-950">Terms</Link> and acknowledge the <Link href="/privacy" className="font-semibold text-slate-700 hover:text-slate-950">Privacy Policy</Link>.
              </p>
            )}
          </form>

          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setMode((current) => current === "signin" ? "signup" : "signin");
              setStatus("");
              setConfirmationHelp(false);
            }}
            className="mt-5 w-full text-center text-sm font-medium text-slate-600 transition hover:text-slate-950"
          >
            {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><div className="w-full max-w-md border-y border-slate-300 py-8"><Skeleton className="h-8 w-48" /><Skeleton className="mt-8 h-11 w-full" /><Skeleton className="mt-4 h-11 w-full" /><Skeleton className="mt-6 h-11 w-full" /></div></div>}>
      <LoginForm />
    </Suspense>
  );
}
