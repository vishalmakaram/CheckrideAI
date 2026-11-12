"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { daysUntilDate } from "@/lib/profile";
import { supabase } from "@/lib/supabase/client";

export default function CheckrideCountdown({ userId }: { userId: string }) {
  const [date, setDate] = useState<string | null>(null);
  const [aircraft, setAircraft] = useState("Cessna 172S");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("profiles").select("checkride_date, preferred_aircraft").eq("id", userId).maybeSingle();
      if (data) {
        setDate(data.checkride_date);
        setAircraft(data.preferred_aircraft);
      }
    };
    load();
  }, [userId]);

  const days = daysUntilDate(date);

  return (
    <section aria-label="Study configuration" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 py-5 text-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="font-medium text-slate-700">{aircraft}</p>
        <span aria-hidden="true" className="hidden h-3 w-px bg-slate-300 sm:block" />
        <p className="text-slate-500">Checkride <span className="font-medium text-slate-700">{days === null ? "date not set" : days < 0 ? "— update date" : `in ${days} day${days === 1 ? "" : "s"}`}</span></p>
      </div>
      <Link href="/profile" className="py-1 font-medium text-slate-500 hover:text-slate-900 hover:underline">Edit profile</Link>
    </section>
  );
}
