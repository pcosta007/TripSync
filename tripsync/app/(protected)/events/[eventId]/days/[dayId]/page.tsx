// app/(protected)/events/[eventId]/days/[dayId]/page.tsx
import { use } from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Daily Summary" };

export default function DaySummaryPage({
  params,
}: {
  params: Promise<{ eventId: string; dayId: string }>; // dayId = "YYYY-MM-DD"
}) {
  // Unwrap promised params (Next.js App Router)
  const { eventId, dayId } = use(params);

  // TODO: fetch activities for this day from Firestore
  // const acts = await getDayActivities(eventId, dayId)

  return (
    <main className="mx-auto max-w-[402px] p-2 pb-[calc(28px+72px+env(safe-area-inset-bottom))] bg-[#fafafa] min-h-[100dvh]">
      {/* Header (sticky, FitList style) */}
      <header className="sticky top-0 z-10 bg-white border-b border-[#e2e8f0] px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[#264864] font-semibold">FitList</span>
          <span className="text-sm text-[#64748b]">Daily Summary</span>
          <div className="ml-auto">
            <Link href={`/events/${eventId}`} className="text-sm text-[#264864] underline">
              Event Overview
            </Link>
          </div>
        </div>
      </header>

      {/* Date chip */}
      <section className="my-2 bg-white border border-[#e2e8f0] rounded-xl p-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium px-3 py-1 border rounded-full">{dayId}</span>
          {/* You can add left/right day arrows later */}
        </div>
      </section>

      {/* Summary list (placeholder; replace with real data) */}
      <section className="grid gap-2">
        {/* {acts.map(a => ( */}
        <div className="grid grid-cols-[1fr_auto] gap-2 items-center border border-[#e2e8f0] bg-white rounded-xl p-3">
          <div className="grid">
            <div className="text-sm font-semibold">Sample Activity</div>
            <div className="text-xs text-[#64748b]">09:30 AM</div>
          </div>
          <div className="grid grid-flow-col gap-2">
            <div className="w-16 h-16 rounded-lg bg-[#f1f5f9]" />
            <div className="w-16 h-16 rounded-lg bg-[#f1f5f9]" />
          </div>
        </div>
        {/* ))} */}
      </section>
    </main>
  );
}