// app/(protected)/events/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import type { User } from "firebase/auth";
import {
  collection, collectionGroup, doc, getDoc, getDocs, query, where,
} from "firebase/firestore";
import { createEvent } from "@/lib/events";

// ✅ shared UI (the FitList-style header & bottom nav)
import HeaderFitlist from "@/app/components/HeaderFitlist";
import BottomNavFitlist from "@/app/components/BottomNavFitlist";

type EventDoc = {
  id: string;
  name: string;
  type: "event" | "trip";
  startDate?: string | null;
  endDate?: string | null;
  coverPhotoUrl?: string | null;
};

export default function EventsPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [items, setItems] = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState<null | "event" | "trip">(null);

  // Keep user in sync
  useEffect(() => {
    const off = auth.onAuthStateChanged((u) => setUser(u));
    return () => off();
  }, []);

  // Load events for the user
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        // 1) Find membership rows (eventId/members/{uid}) by userId field
        const qMembers = query(
          collectionGroup(db, "members"),
          where("userId", "==", user.uid)
        );
        const memSnap = await getDocs(qMembers);

        // 2) Extract eventIds
        const eventIds = new Set<string>();
        memSnap.forEach((m) => {
          // path: events/{eventId}/members/{uid}
          const parts = m.ref.path.split("/");
          const eid = parts[1];
          if (eid) eventIds.add(eid);
        });

        // 3) Fetch each event
        const list: EventDoc[] = [];
        await Promise.all(
          Array.from(eventIds).map(async (eventId) => {
            const e = await getDoc(doc(db, "events", eventId));
            if (e.exists()) {
              const d = e.data() as any;
              list.push({
                id: e.id,
                name: d.name,
                type: d.type,
                startDate: d.startDate ?? null,
                endDate: d.endDate ?? null,
                coverPhotoUrl: d.coverPhotoUrl ?? null,
              });
            }
          })
        );

        // 4) Fallback: events you own
        if (list.length === 0) {
          try {
            const qOwn = query(collection(db, "events"), where("ownerId", "==", user.uid));
            const ownSnap = await getDocs(qOwn);
            ownSnap.forEach((e) => {
              const d = e.data() as any;
              list.push({
                id: e.id,
                name: d.name,
                type: d.type,
                startDate: d.startDate ?? null,
                endDate: d.endDate ?? null,
                coverPhotoUrl: d.coverPhotoUrl ?? null,
              });
            });
          } catch {
            /* ignore */
          }
        }

        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setItems(list);
      } catch (err: any) {
        console.error("[events] load error:", err?.code, err?.message, err);
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (!user) {
    return (
      <main className="mx-auto max-w-[402px] p-3">
        <p>You’re signed out.</p>
        <Link href="/login" className="text-[#264864] underline">Go to login</Link>
      </main>
    );
  }

  return (
    <div className="iphone-wrap">
      {/* ✅ shared sticky header (TripSync brand) */}
      <HeaderFitlist />

      <main className="content">
        <div className="toolbar">
          <button className="pill" onClick={() => setShowNew("trip")}>+ Trip</button>
          <button className="pill" onClick={() => setShowNew("event")}>+ Event</button>
        </div>

        {loading ? (
          <div className="muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="empty">
            <div className="muted">No events yet. Tap “+ Trip” or “+ Event”.</div>
          </div>
        ) : (
          <div className="list">
            {items.map((ev) => (
              <a key={ev.id} className="card" href={`/events/${ev.id}`}>
                <div className="thumb">
                  {ev.coverPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ev.coverPhotoUrl} alt="" />
                  ) : (
                    <div className="thumb-empty">No cover</div>
                  )}
                </div>
                <div className="meta">
                  <div className="title">{ev.name}</div>
                  <div className="sub">
                    {ev.type === "trip"
                      ? dateRange(ev.startDate, ev.endDate)
                      : (ev.startDate ? ev.startDate : "Event")}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>

      {/* ✅ shared bottom nav (FitList style) */}
      <BottomNavFitlist
        active="home"
        onPlus={() => setShowNew("trip")}
        onSignOut={() => auth.signOut()}
      />

      {showNew && (
        <NewEventSheet
          mode={showNew}
          onClose={() => setShowNew(null)}
          onCreate={async (payload) => {
            if (!auth.currentUser) return;
            try {
              const eventId = await createEvent({
                ownerId: auth.currentUser.uid,
                type: showNew,
                name: payload.name,
                // trips:
                startDate: showNew === "trip" ? payload.startDate ?? null : null,
                endDate:   showNew === "trip" ? payload.endDate   ?? null : null,
                // events (single day):
                eventDate: showNew === "event" ? payload.date ?? null : null,
                coverPhotoUrl: null,
              });
              window.location.href = `/events/${eventId}`;
            } catch (e: any) {
              console.error("createEvent failed:", e);
              alert(e?.message || "Failed to create");
            }
          }}
        />
      )}

      <style jsx>{`
        .iphone-wrap {
          --bg:#fafafa; --card:#fff; --ink:#0f172a; --muted:#64748b; --accent:#264864; --line:#e2e8f0;
          background:var(--bg); color:var(--ink);
          min-height:100dvh;
          padding-bottom: calc(28px + 72px + env(safe-area-inset-bottom));
        }
        .content { max-width: 402px; margin: 0 auto; padding: 10px; }
        .toolbar { display:flex; gap:8px; margin: 8px 0; }
        .pill {
          border:1px solid var(--line); background:#fff; border-radius:999px;
          padding:8px 12px; font-weight:600; cursor:pointer;
        }
        .muted { color: var(--muted); }
        .empty { padding: 24px; text-align:center; }
        .list { display:grid; gap:10px; }
        .card {
          display:grid; grid-template-columns: 88px 1fr; gap:10px;
          background:var(--card); border:1px solid var(--line); border-radius:14px; padding:10px;
          text-decoration:none; color:inherit;
        }
        .thumb { width:88px; height:64px; border-radius:10px; overflow:hidden; background:#f1f5f9; }
        .thumb img { width:100%; height:100%; object-fit:cover; display:block; }
        .thumb-empty { display:flex; align-items:center; justify-content:center; height:100%; color:var(--muted); font-size:12px; }
        .meta { display:grid; gap:4px; align-content:center; }
        .title { font-weight:700; }
        .sub { color: var(--muted); font-size:12px; }
      `}</style>
    </div>
  );
}

/* ---------- helpers & sheet ---------- */

function dateRange(a?: string | null, b?: string | null) {
  if (!a || !b) return "";
  return `${a} – ${b}`;
}

function NewEventSheet({
  mode, onClose, onCreate
}: {
  mode: "event" | "trip";
  onClose: () => void;
  onCreate: (payload: { name: string; date?: string; startDate?: string; endDate?: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");

  const canSave =
    !!name.trim() &&
    (mode === "trip" ? (startDate && endDate) : !!eventDate);

  return (
    <div className="sheet" onClick={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="panel">
        <div className="title">{mode === "trip" ? "New Trip" : "New Event"}</div>

        <label className="lbl">Name</label>
        <input
          className="inp"
          value={name}
          onChange={e=>setName(e.target.value)}
          placeholder={mode === "trip" ? "Mallorca Friends" : "Birthday Dinner"}
        />

        {mode === "trip" ? (
          <>
            <label className="lbl">Start date</label>
            <input
              className="inp"
              type="date"
              value={startDate}
              onChange={(e)=>setStart(e.target.value)}
            />
            <label className="lbl">End date</label>
            <input
              className="inp"
              type="date"
              value={endDate}
              onChange={(e)=>setEnd(e.target.value)}
            />
          </>
        ) : (
          <>
            <label className="lbl">Event date</label>
            <input
              className="inp"
              type="date"
              value={eventDate}
              onChange={(e)=>setEventDate(e.target.value)}
            />
          </>
        )}

        <div className="row">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            disabled={!canSave}
            onClick={() =>
              onCreate({
                name: name.trim(),
                date: mode === "event" ? eventDate : undefined,
                startDate: mode === "trip" ? startDate : undefined,
                endDate: mode === "trip" ? endDate : undefined,
              })
            }
          >
            Create
          </button>
        </div>
      </div>

      <style jsx>{`
        .sheet{
          position:fixed; inset:0; background:rgba(0,0,0,.35);
          display:flex; align-items:flex-end; justify-content:center;
          z-index:60; /* above bottom nav */
          padding-bottom: calc(72px + env(safe-area-inset-bottom)); /* clear bottom nav */
        }
        .panel{
          width:100%; max-width:402px; background:#fff;
          border-top-left-radius:16px; border-top-right-radius:16px;
          padding:16px; border:1px solid #e2e8f0; border-bottom:0;
        }
        .title{ font-weight:700; margin-bottom:8px; }
        .lbl{ font-size:12px; color:#64748b; margin-top:8px; }
        .inp{
          width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:10px; font-size:16px;
        }
        .row{ display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
        .btn{
          padding:8px 12px; border:1px solid #e2e8f0; border-radius:10px; background:#fff; cursor:pointer;
        }
        .btn.primary{ border-color:#264864; color:#fff; background:#264864; }
      `}</style>
    </div>
  );
}