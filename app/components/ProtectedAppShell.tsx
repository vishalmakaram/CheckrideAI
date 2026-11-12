"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import { useAuthState } from "./AuthProvider";
import { AppShellSkeleton } from "./Skeleton";

export default function ProtectedAppShell({
  children,
  focus = false,
}: {
  children: React.ReactNode;
  focus?: boolean;
}) {
  const { user, loading } = useAuthState();
  const pathname = usePathname();
  const next = pathname && pathname !== "/dashboard" ? `?next=${encodeURIComponent(pathname)}` : "";

  if (loading) {
    return <AppShellSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-8">
        <div className="w-full max-w-md border-y border-slate-300 py-8 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
            <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M7 5V9M5 7H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Sign in to continue</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Your practice history, oral sessions, and checklist are saved to your account.
          </p>
          {/* Cross the auth boundary with a fresh request, not a cached login redirect. */}
          <a
            href={`/login${next}`}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Go to sign in
          </a>
        </div>
      </div>
    );
  }

  if (focus) {
    return <main className="min-h-screen bg-slate-100 text-slate-900">{children}</main>;
  }

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto pt-14 md:pt-0">{children}</main>
    </div>
  );
}
