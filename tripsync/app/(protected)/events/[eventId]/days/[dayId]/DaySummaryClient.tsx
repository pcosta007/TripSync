"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type Activity = {
  id: string;
  title: string;
  time?: string | null;        // "HH:mm"
  kind?: string | null;        // "travel" | "hotel" | "activity" | ...
  dayId?: string | null;       // this day
  refPhotoUrl?: string | null; // (legacy single photo; hero carousel later)
  notes?: string | null;
};

export default function DaySummaryClient({
  eventId,
  dayId,
}: {
  eventId: string;
  dayId: string;
}) {
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  // new activity fields
  const [title, setTitle] = useState("");
  const [time, setTime] = useState(""); // "HH:mm"
  const [kind, setKind] = useState<"activity" | "travel" | "hotel" | "food" | "other">("activity");

  const dateLabel = useMemo(() => dayId, [dayId]);

  async function load() {
    setLoading(true);
    try {
      const col = collection(db, `events/${eventId}/activities`);
      const qy = query(
        col,
        where("dayId", "==", dayId),
        orderBy("time", "asc")
      );
      const snap = await getDocs(qy);
      const list: Activity[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setItems(list);
    } catch (e) {
      console.error("[day] load error:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, dayId]);

  async function handleCreate() {
    if (!title.trim()) return;
    try {
      const col = collection(db, `events/${eventId}/activities`);
      await addDoc(col, {
        title: title.trim(),
        time: time || null,
        kind,
        dayId,
        createdAt: serverTimestamp(),
      });
      setShowNew(false);
      setTitle("");
      setTime("");
      setKind("activity");
      await load();
    } catch (e: any) {
      console.error("add activity failed:", e);
      alert(e?.message || "Failed to add activity");
    }
  }

  return (
    <main className="mx-auto max-w-[402px] p-2 pb-[calc(28px+72px+env(safe-area-inset-bottom))] bg-[#fafafa] min-h-[100dvh]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-[#e2e8f0] px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#264864] font-semibold">FitList</span>
            <span className="text-sm text-[#64748b]">Daily Summary</span>
          </div>
          <Link href={`/events/${eventId}`} className="text-sm text-[#264864] underline">
            Event
          </Link>
        </div>
      </header>

      {/* Date chip + new */}
      <section className="my-2 bg-white border border-[#e2e8f0] rounded-xl p-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium px-3 py-1 border rounded-full">{dateLabel}</span>
          <button
            onClick={() => setShowNew(true)}
            className="px-3 py-2 border border-[#e2e8f0] rounded-lg"
          >
            + Activity
          </button>
        </div>
      </section>

      {/* List */}
      {loading ? (
        <div className="text-sm text-[#64748b]">Loading…</div>
      ) : items.length === 0 ? (
        <div className="border border-[#e2e8f0] bg-white rounded-xl p-4 text-sm text-[#64748b]">
          No activities yet. Tap <b>+ Activity</b> to add one.
        </div>
      ) : (
        <section className="grid gap-2">
          {items.map((a) => (
            <Link
              key={a.id}
              href={`/events/${eventId}/activities/${a.id}`}
              className="grid grid-cols-[1fr_auto] gap-2 items-center border border-[#e2e8f0] bg-white rounded-xl p-3 active:translate-y-px"
            >
              <div className="grid">
                <div className="text-sm font-semibold">{a.title}</div>
                <div className="text-xs text-[#64748b]">
                  {a.time ? a.time : "—"}{a.kind ? ` • ${a.kind}` : ""}
                </div>
              </div>
              <div className="grid grid-flow-col gap-2">
                {/* placeholders for hero thumbs; we’ll wire real photos later */}
                <div className="w-16 h-16 rounded-lg bg-[#f1f5f9]" />
                <div className="w-16 h-16 rounded-lg bg-[#f1f5f9]" />
              </div>
            </Link>
          ))}
        </section>
      )}

      {/* Add Activity Sheet */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 z-[60]" onClick={(e)=>{ if(e.target===e.currentTarget) setShowNew(false); }}>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-full max-w-[402px] bg-white border border-[#e2e8f0] rounded-t-2xl p-4">
            <div className="font-semibold mb-2">New activity — {dayId}</div>

            <label className="text-xs text-[#64748b]">Title</label>
            <input
              className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 mb-2"
              value={title}
              onChange={(e)=>setTitle(e.target.value)}
              placeholder="Beach, dinner, museum…"
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-[#64748b]">Time</label>
                <input
                  type="time"
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2"
                  value={time}
                  onChange={(e)=>setTime(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-[#64748b]">Kind</label>
                <select
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2"
                  value={kind}
                  onChange={(e)=>setKind(e.target.value as any)}
                >
                  <option value="activity">Activity</option>
                  <option value="food">Food</option>
                  <option value="travel">Travel</option>
                  <option value="hotel">Hotel</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-3">
              <button className="px-3 py-2 border border-[#e2e8f0] rounded-lg" onClick={()=>setShowNew(false)}>
                Cancel
              </button>
              <button
                className="px-3 py-2 border border-[#264864] text-white bg-[#264864] rounded-lg disabled:opacity-50"
                disabled={!title.trim()}
                onClick={handleCreate}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}