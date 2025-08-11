// app/(protected)/events/[eventId]/days/[dayId]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Daily Summary" };

// Server component: params come from the URL
export default async function DaySummaryPage({
  params,
}: {
  params: { eventId: string; dayId: string }; // dayId = "YYYY-MM-DD"
}) {
  const { eventId, dayId } = params;

  // TODO: fetch activities for this day from Firestore:
  // const acts = await getDayActivities(eventId, dayId)

  return (
    <main className="mx-auto max-w-[402px] p-2 pb-[calc(28px+72px+env(safe-area-inset-bottom))] bg-[#fafafa] min-h-[100dvh]">
      {/* Header (sticky look like FitList) */}
      <header className="sticky top-0 z-10 bg-white border-b border-[#e2e8f0] px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[#264864] font-semibold">FitList</span>
          <span className="text-sm text-[#64748b]">Daily Summary</span>
        </div>
      </header>

      {/* Date pill (this day) + back to event */}
      <section className="my-2 bg-white border border-[#e2e8f0] rounded-xl p-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium px-3 py-1 border rounded-full">
            {dayId}
          </span>
          <Link
            href={`/events/${eventId}`}
            className="text-sm text-[#264864] underline"
          >
            Event Overview
          </Link>
        </div>
      </section>

      {/* Summary list (cards). Replace with real data */}
      <section className="grid gap-2">
        {/* Map activities here */}
        {/* acts.map(a => ( */}
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
        {/* )) */}
      </section>

      {/* Bottom nav spacer is already in padding-bottom on <main> */}
    </main>
  );
}