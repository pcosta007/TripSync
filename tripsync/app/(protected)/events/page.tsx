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
          const eid = parts[1]; // "events", "{eventId}", "members", "{uid}"
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

        // 4) Fallback: events you own (in case membership list is empty)
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
        setItems([]); // safe empty state
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
      <Header />

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

      <BottomNav />

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

/* ---------- UI bits ---------- */

function Header() {
  return (
    <header className="hdr">
      <div className="brand">
        <svg width="24" height="24" viewBox="0 0 256 256" fill="none" aria-hidden="true">
          <rect x="36" y="68" width="184" height="140" rx="20" stroke="#264864" strokeWidth="12"/>
          <path d="M92 68V52c0-11 9-20 20-20h32c11 0 20 9 20 20v16" stroke="#264864" strokeWidth="12"/>
          <path d="M88 138l28 28 52-56" stroke="#264864" strokeWidth="12"/>
        </svg>
        <span className="brand-text">FitList Friends</span>
      </div>
      <style jsx>{`
        .hdr{
          position:sticky; top:0; z-index:5;
          background:#fff; border-bottom:1px solid #e2e8f0;
          padding: calc(10px + env(safe-area-inset-top)) 12px 10px;
        }
        .brand{ display:flex; align-items:center; gap:8px; }
        .brand-text{ color:#264864; font-weight:700; }
      `}</style>
    </header>
  );
}

function BottomNav() {
  return (
    <nav className="bn">
      <button className="nav-btn active">
        <span className="icon">🏠</span>
        <span className="label">Home</span>
      </button>
      <button className="nav-btn" onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}>
        <span className="icon">➕</span>
        <span className="label">New</span>
      </button>
      <button className="nav-btn" onClick={()=>auth.signOut()}>
        <span className="icon">👤</span>
        <span className="label">Sign out</span>
      </button>
      <style jsx>{`
        .bn{
          position: fixed; left:0; right:0; bottom:0;
          background:#fff; border-top:1px solid #e2e8f0;
          display:grid; grid-template-columns: repeat(3,1fr);
          gap:0; padding: 2px 10px calc(2px + env(safe-area-inset-bottom));
          z-index:10;
        }
        .nav-btn{
          appearance:none; background:transparent; border:0;
          padding: 6px; display:grid; justify-items:center; gap:4px;
          font-size:11px; color:#64748b; cursor:pointer;
        }
        .nav-btn.active{ color:#264864; font-weight:700; }
      `}</style>
    </nav>
  );
}

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