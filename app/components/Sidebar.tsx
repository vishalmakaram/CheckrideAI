"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ClipboardCheck, Menu, MessageSquareText, UserRound, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";
import LegalFooter from "./LegalFooter";

export default function Sidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => pathname === href;
  const linkClass = (href: string) =>
    `px-3 py-2.5 rounded-lg transition-colors duration-150 text-sm font-medium flex items-center gap-2.5 ${
      isActive(href)
        ? "bg-white text-slate-950"
        : "text-slate-400 hover:text-white hover:bg-white/8"
    }`;

  return (
    <>
    <button type="button" onClick={() => setMobileOpen((open) => !open)} aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} aria-controls="study-navigation" className="fixed left-3 top-3 z-50 rounded-lg border border-slate-200 bg-white p-2 text-slate-800 shadow-sm md:hidden">{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button>
    {mobileOpen && <button type="button" aria-label="Close navigation overlay" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-slate-950/40 md:hidden" />}
    <nav id="study-navigation" aria-label="Study navigation" onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setMobileOpen(false); }} className={`${mobileOpen ? "fixed inset-y-0 left-0 z-40 flex pt-14" : "hidden"} w-60 shrink-0 flex-col overflow-y-auto border-r border-white/5 md:static md:flex md:pt-0`} style={{ backgroundColor: "#0d1117" }}>
      {/* Logo */}
      <div className="border-b border-white/5 px-4 py-4">
        <Link href="/dashboard" aria-label="CheckrideAI dashboard" className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-white/8">
          <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center shrink-0 text-slate-950">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M7 5V9M5 7H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white tracking-tight">CheckrideAI</h1>
            <p className="text-xs text-slate-500 tracking-wide">PPL Oral Prep</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex flex-col p-3 space-y-0.5 flex-grow">
        <p className="px-3 pt-3 pb-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Study</p>

        <Link href="/dashboard" className={linkClass("/dashboard")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
            <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
            <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
            <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
          </svg>
          Dashboard
        </Link>

        <Link href="/practice" className={linkClass("/practice")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M5.5 8L7.5 10L10.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Practice Questions
        </Link>

        <Link href="/exam" className={linkClass("/exam")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <path d="M3 2H11L13 4V14H3V2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M5 6H11M5 9H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          FAA Practice Exams
        </Link>

        <p className="px-3 pt-4 pb-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Checkride Prep</p>

        <Link href="/oral" className={linkClass("/oral")}>
          <MessageSquareText size={16} className="shrink-0" />
          AI Oral Examiner
        </Link>
        <Link href="/checklist" className={linkClass("/checklist")}>
          <ClipboardCheck size={16} className="shrink-0" />
          Checkride Checklist
        </Link>

        <p className="px-3 pt-4 pb-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">Account</p>
        <Link href="/profile" className={linkClass("/profile")}>
          <UserRound size={16} className="shrink-0" />
          Profile & Plan
        </Link>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/5">
        <p className="truncate text-xs text-slate-500">{user.email}</p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-2 text-xs font-medium text-slate-600 transition hover:text-white"
        >
          Sign out
        </button>
        <div className="mt-4"><LegalFooter dark /></div>
      </div>
    </nav>
    </>
  );
}
