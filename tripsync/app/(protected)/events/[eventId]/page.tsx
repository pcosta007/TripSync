// app/(protected)/events/[eventId]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getEvent, countMembers, countActivities, ensureTripDays, listDayIds } from "@/lib/events";
import { createInvite, joinUrl } from "@/lib/invites";
import { prettyRange } from "@/lib/dates";

export default function EventOverviewPage({
  params,
}: {
  params: { eventId: string };
}) {
  const { eventId } = params;
  const [loading, setLoading] = useState(true);
  const [evt, setEvt] = useState<any>(null);
  const [members, setMembers] = useState<number>(0);
  const [acts, setActs] = useState<number>(0);
  const [days, setDays] = useState<string[]>([]);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const e = await getEvent(eventId);
        if (!mounted) return;

        setEvt(e);

        // If trip, ensure days exist (free + simple)
        if (e.type === "trip" && e.startDate && e.endDate) {
          await ensureTripDays(eventId, e.startDate, e.endDate);
          const ds = await listDayIds(eventId);
          if (!mounted) return;
          setDays(ds);
        }

        const [m, a] = await Promise.all([
          countMembers(eventId),
          countActivities(eventId),
        ]);
        if (!mounted) return;
        setMembers(m);
        setActs(a);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [eventId]);

  const rangeText = useMemo(
    () => prettyRange(evt?.startDate, evt?.endDate),
    [evt?.startDate, evt?.endDate]
  );

  async function makeInvite() {
    try {
      const token = await createInvite(eventId, { role: "editor" });
      setInviteLink(joinUrl(token));
    } catch (e) {
      console.error(e);
      alert("Failed to create invite.");
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-[402px] min-h-[100dvh] bg-[#fafafa]">
        <header className="sticky top-0 z-10 bg-white border-b border-[#e2e8f0] px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[#264864] font-semibold">FitList</span>
            <span className="text-sm text-[#64748b]">Loading…</span>
          </div>
        </header>
      </main>
    );
  }

  if (!evt) {
    return (
      <main className="mx-auto max-w-[402px] min-h-[100dvh] bg-[#fafafa] p-4">
        <p className="text-sm text-[#64748b]">Event not found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[402px] p-2 pb-[calc(28px+72px+env(safe-area-inset-bottom))] bg-[#fafafa] min-h-[100dvh]">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-white border-b border-[#e2e8f0] px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#264864] font-semibold">FitList</span>
            <span className="text-sm text-[#64748b]">Overview</span>
          </div>
          <Link href="/" className="text-sm text-[#264864] underline">Home</Link>
        </div>
      </header>

      {/* Cover + title */}
      <section className="border border-[#e2e8f0] bg-white rounded-xl p-3 mt-2">
        <div className="w-full aspect-[16/10] bg-[#f1f5f9] rounded-lg overflow-hidden mb-2">
          {/* Optional: show evt.coverPhotoUrl */}
        </div>
        <div className="text-base font-semibold">{evt.name}</div>
        <div className="text-xs text-[#64748b]">
          {evt.type === "trip" ? rangeText : "Single-day event"}
        </div>
      </section>

      {/* Stats + Invite */}
      <section className="grid gap-2 mt-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="border border-[#e2e8f0] bg-white rounded-xl p-3 text-center">
            <div className="text-xl font-semibold">{members}</div>
            <div className="text-xs text-[#64748b]">Members</div>
          </div>
          <div className="border border-[#e2e8f0] bg-white rounded-xl p-3 text-center">
            <div className="text-xl font-semibold">{acts}</div>
            <div className="text-xs text-[#64748b]">Activities</div>
          </div>
          <div className="border border-[#e2e8f0] bg-white rounded-xl p-3 text-center">
            <div className="text-xl font-semibold">
              {evt.type === "trip" ? days.length : 1}
            </div>
            <div className="text-xs text-[#64748b]">{evt.type === "trip" ? "Days" : "Day"}</div>
          </div>
        </div>

        <div className="border border-[#e2e8f0] bg-white rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Invite friends</div>
            <button
              onClick={makeInvite}
              className="px-3 py-2 border border-[#e2e8f0] rounded-lg"
            >
              Create link
            </button>
          </div>
          {inviteLink && (
            <div className="mt-2 grid gap-2">
              <input
                readOnly
                value={inviteLink}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full border border-[#e2e8f0] rounded-lg px-2 py-2 text-xs"
              />
              <button
                className="px-3 py-2 border border-[#e2e8f0] rounded-lg"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(inviteLink); alert("Copied!"); }
                  catch { /* no-op */ }
                }}
              >
                Copy
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Days list for trips → Daily Summary */}
      {evt.type === "trip" && (
        <section className="border border-[#e2e8f0] bg-white rounded-xl p-3 mt-2">
          <div className="text-sm font-semibold mb-2">Days</div>
          <div className="grid gap-2">
            {days.map((d) => (
              <Link
                key={d}
                href={`/events/${eventId}/days/${d}`}
                className="flex items-center justify-between border border-[#e2e8f0] rounded-lg px-3 py-2"
              >
                <span className="text-sm">{d}</span>
                <span className="text-xs text-[#64748b] underline">Open</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}