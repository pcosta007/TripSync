"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection, collectionGroup, doc, getDoc, getDocs, limit, orderBy, query
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/** Simple date range formatter (YYYY-MM-DD inputs) */
function fmtRange(start?: string|null, end?: string|null) {
  if (!start && !end) return "";
  if (start && !end) return start;
  if (!start && end) return end;
  if (start === end) return start!;
  return `${start} – ${end}`;
}

type EventDoc = {
  ownerId: string;
  type: "event" | "trip";
  name: string;
  coverPhotoUrl?: string|null;
  startDate?: string|null;
  endDate?: string|null;
};

type HeroPhoto = { url: string; id: string };

export default function EventOverviewClient({ eventId }: { eventId: string }) {
  const [evt, setEvt] = useState<EventDoc | null>(null);
  const [members, setMembers] = useState(0);
  const [acts, setActs] = useState(0);
  const [days, setDays] = useState<string[]>([]);
  const [hero, setHero] = useState<HeroPhoto[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load event + counts + hero photos
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Event doc
        const eRef = doc(db, "events", eventId);
        const eSnap = await getDoc(eRef);
        if (!eSnap.exists()) { setEvt(null); setLoading(false); return; }
        const data = eSnap.data() as EventDoc;
        setEvt(data);

        // Members count
        const memCol = collection(db, `events/${eventId}/members`);
        const memSnap = await getDocs(memCol);
        setMembers(memSnap.size);

        // Activities count
        const actCol = collection(db, `events/${eventId}/activities`);
        const actSnap = await getDocs(actCol);
        setActs(actSnap.size);

        // Days (for trips)
        if (data.type === "trip") {
          const dCol = collection(db, `events/${eventId}/days`);
          const dSnap = await getDocs(dCol);
          setDays(dSnap.docs.map(d => d.id).sort());
        } else {
          // single-day event: day is startDate (normalized when created)
          if (data.startDate) setDays([data.startDate]);
        }

        // Hero photos:
        //  - Start with coverPhotoUrl if present
        //  - Then pull up to ~10 recent refPhotos from activities (1 per activity to keep it cheap)
        const heroList: HeroPhoto[] = [];
        if (data.coverPhotoUrl) {
          heroList.push({ id: "cover", url: data.coverPhotoUrl });
        }

        // Grab recent activities (up to 10), then each one's newest refPhoto (if any)
        const actsQ = query(actCol, orderBy("createdAt", "desc"), limit(10));
        const actsSnap = await getDocs(actsQ);

        for (const a of actsSnap.docs) {
          const rpCol = collection(db, `events/${eventId}/activities/${a.id}/refPhotos`);
          const rpQ = query(rpCol, orderBy("createdAt", "desc"), limit(1));
          const rpSnap = await getDocs(rpQ);
          rpSnap.forEach((p) => {
            const d = p.data() as any;
            if (d?.url) heroList.push({ id: `${a.id}:${p.id}`, url: d.url });
          });
        }

        setHero(heroList);
        setIdx(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  const dateLabel = useMemo(
    () => fmtRange(evt?.startDate ?? null, evt?.endDate ?? null),
    [evt?.startDate, evt?.endDate]
  );

  function prev() {
    setIdx((i) => (hero.length ? (i - 1 + hero.length) % hero.length : 0));
  }
  function next() {
    setIdx((i) => (hero.length ? (i + 1) % hero.length : 0));
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
          <Link href="/events" className="text-sm text-[#264864] underline">Back</Link>
        </div>
      </header>

      {/* Image hero (carousel) */}
      <section className="border border-[#e2e8f0] bg-white rounded-xl p-3 mt-2">
        <div className="relative w-full aspect-[16/10] bg-[#f1f5f9] rounded-lg overflow-hidden">
          {hero[idx]?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero[idx].url} alt="" className="w-full h-full object-cover" />
          ) : null}

          {/* Prev/Next */}
          {hero.length > 1 && (
            <>
              <button
                aria-label="Previous"
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur px-2 py-1 rounded-lg border border-[#e2e8f0]"
              >
                ‹
              </button>
              <button
                aria-label="Next"
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur px-2 py-1 rounded-lg border border-[#e2e8f0]"
              >
                ›
              </button>
            </>
          )}
        </div>

        {/* Dots */}
        {hero.length > 1 && (
          <div className="flex justify-center gap-2 mt-2">
            {hero.map((_, i) => (
              <button
                key={i}
                className={`w-2 h-2 rounded-full ${i===idx ? "bg-[#264864]" : "bg-[#cbd5e1]"}`}
                onClick={() => setIdx(i)}
                aria-label={`Go to slide ${i+1}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Title + date */}
      <section className="border border-[#e2e8f0] bg-white rounded-xl p-3 mt-2">
        <div className="text-base font-semibold">{evt.name}</div>
        <div className="text-xs text-[#64748b] mt-1">
          {evt.type === "trip" ? dateLabel : (evt.startDate || dateLabel)}
        </div>
      </section>

      {/* Quick stats */}
      <section className="grid grid-cols-3 gap-2 mt-2">
        <div className="border border-[#e2e8f0] bg-white rounded-xl p-3 text-center">
          <div className="text-xl font-semibold">{members}</div>
          <div className="text-xs text-[#64748b]">Friends</div>
        </div>
        <div className="border border-[#e2e8f0] bg-white rounded-xl p-3 text-center">
          <div className="text-xl font-semibold">{acts}</div>
          <div className="text-xs text-[#64748b]">Activities</div>
        </div>
        <div className="border border-[#e2e8f0] bg-white rounded-xl p-3 text-center">
          <div className="text-xl font-semibold">{evt.type === "trip" ? days.length : 1}</div>
          <div className="text-xs text-[#64748b]">{evt.type === "trip" ? "Days" : "Day"}</div>
        </div>
      </section>

      {/* Days list for trips */}
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