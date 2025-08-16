// app/(protected)/events/[eventId]/eventoverviewclient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  limit,
  orderBy,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { createInvite } from "@/lib/events";

// ✅ shared UI
import HeaderFitlist from "@/app/components/HeaderFitlist";
import BottomNavFitlist from "@/app/components/BottomNavFitlist";


// DEV: verify storage bucket & env once at page load
console.log("[cfg] origin=", typeof window !== "undefined" ? window.location.origin : "ssr");
console.log("[cfg] storage bucket=", storage.app.options.storageBucket);


/* ------------------ helpers (exact date look) ------------------ */
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sept","Oct","Nov","Dec"];

function ordinal(n: number) {
  const s = ["th","st","nd","rd"], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
function formatNice(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  const m = MONTHS[d.getMonth()];
  const day = d.getDate();
  return `${m} ${day}${ordinal(day)}`;
}
async function debugAuthAndMembership(eventId: string) {
  const user = auth.currentUser;
  console.groupCollapsed("[DEBUG] Auth & Membership");
  console.log("auth.currentUser:", user ? { uid: user.uid, email: user.email } : null);

  try {
    const evSnap = await getDoc(doc(db, "events", eventId));
    console.log("event.exists:", evSnap.exists());
    console.log("event.ownerId:", evSnap.exists() ? evSnap.data()?.ownerId : null);
  } catch (e) {
    console.warn("event getDoc failed:", e);
  }

  try {
    if (user?.uid) {
      const memSnap = await getDoc(doc(db, `events/${eventId}/members/${user.uid}`));
      console.log("memberDoc.exists:", memSnap.exists());
      if (memSnap.exists()) console.log("memberDoc.data:", memSnap.data());
    } else {
      console.log("No user UID to check membership.");
    }
  } catch (e) {
    console.warn("member getDoc failed:", e);
  }

  console.groupEnd();
}
function fmtRangeShort(start?: string | null, end?: string | null) {
  if (!start && !end) return "";
  if (start && !end) return formatNice(start);
  if (!start && end) return formatNice(end);
  if (start === end) return formatNice(start!);
  return `${formatNice(start!)} to ${formatNice(end!)}`;
}
function to12h(t?: string | null) {
  if (!t) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return t;
  let h = +m[1];
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

function from12hTo24h(input: string | null | undefined) {
  if (!input) return "";
  // Accepts "8 PM", "08:30 pm", "12:05AM", etc.
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])\s*$/.exec(input);
  if (!m) return ""; // invalid -> let caller validate
  let h = +m[1];
  const min = m[2] ?? "00";
  const ampm = m[3].toUpperCase();
  if (h < 1 || h > 12) return "";
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

/* ------------------ types ------------------ */
type EventDoc = {
  ownerId: string;
  type: "event" | "trip";
  name: string;
  coverPhotoUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};
type ActivityDoc = {
  id: string;
  title: string;
  time?: string | null;
  kind?: string | null;
  dayId?: string | null;
  description?: string | null;
};
type HeroPhoto = { id: string; url: string };

const GALLERY_KIND = "__gallery";

/* ------------------ page ------------------ */
export default function EventOverviewClient({ eventId }: { eventId: string }) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [openDayId, setOpenDayId] = useState<string | null>(null);

  const [evt, setEvt] = useState<EventDoc | null>(null);
  const [membersCount, setMembersCount] = useState(0);
  const [days, setDays] = useState<string[]>([]);
  const [actsByDay, setActsByDay] = useState<Record<string, ActivityDoc[]>>({});
  const [activitiesCount, setActivitiesCount] = useState(0);
  const [hero, setHero] = useState<HeroPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  // prev/next (carousel)
  const prev = () =>
    setPhotoIdx((i) => (hero.length ? (i - 1 + hero.length) % hero.length : 0));
  const next = () => setPhotoIdx((i) => (hero.length ? (i + 1) % hero.length : 0));

  const dateLabel = useMemo(
    () => fmtRangeShort(evt?.startDate ?? null, evt?.endDate ?? null),
    [evt?.startDate, evt?.endDate]
  );
  const friendsCount = Math.max(0, membersCount - (auth.currentUser ? 1 : 0));

  // load data
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // event
        const eSnap = await getDoc(doc(db, "events", eventId));
        if (!eSnap.exists()) {
          setEvt(null);
          return;
        }
        const eData = eSnap.data() as EventDoc;
        setEvt(eData);
        debugAuthAndMembership(eventId);

        // members (raw size)
        const mSnap = await getDocs(collection(db, `events/${eventId}/members`));
        setMembersCount(mSnap.size);

        // days
        let dayIds: string[] = [];
        if (eData.type === "trip") {
          const dSnap = await getDocs(collection(db, `events/${eventId}/days`));
          dayIds = dSnap.docs.map((d) => d.id).sort();
        } else {
          if (eData.startDate) dayIds = [eData.startDate];
        }
        setDays(dayIds);

        // activities
        const aSnap = await getDocs(collection(db, `events/${eventId}/activities`));
        const grouped: Record<string, ActivityDoc[]> = {};
        let actsCount = 0;

        aSnap.docs.forEach((s) => {
          const raw = s.data() as Omit<ActivityDoc, "id">;
          const act: ActivityDoc = { id: s.id, ...raw };
          const kind = act.kind || "activity";
          if (kind !== GALLERY_KIND) {
            actsCount++;
            const d = act.dayId || (eData.startDate ?? "");
            if (!grouped[d]) grouped[d] = [];
            grouped[d].push(act);
          }
        });

        // sort within day by time
        Object.keys(grouped).forEach((d) => {
          grouped[d].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
        });

        setActsByDay(grouped);
        setActivitiesCount(actsCount);

        // hero: cover + gallery refPhotos + recent activities refPhoto (1 each)
        const heroList: HeroPhoto[] = [];
        if (eData.coverPhotoUrl) heroList.push({ id: "cover", url: eData.coverPhotoUrl });

        // gallery
        const actsCol = collection(db, `events/${eventId}/activities`);
        const galleryQ = query(actsCol, where("kind", "==", GALLERY_KIND), limit(1));
        const gallerySnap = await getDocs(galleryQ);
        if (!gallerySnap.empty) {
          const g = gallerySnap.docs[0];
          const rpQ = query(
            collection(db, `events/${eventId}/activities/${g.id}/refPhotos`),
            orderBy("createdAt", "desc"),
            limit(20)
          );
          const rpSnap = await getDocs(rpQ);
          rpSnap.forEach((p) => {
            const d = p.data() as any;
            if (d?.url) heroList.push({ id: `g:${p.id}`, url: d.url });
          });
        }

        // recent activity photos
        const recentActsQ = query(actsCol, orderBy("createdAt", "desc"), limit(12));
        const recentActs = await getDocs(recentActsQ);
        for (const a of recentActs.docs) {
          const dataA = a.data() as ActivityDoc;
          if ((dataA.kind || "activity") === GALLERY_KIND) continue;
          const rpQ = query(
            collection(db, `events/${eventId}/activities/${a.id}/refPhotos`),
            orderBy("createdAt", "desc"),
            limit(1)
          );
          const rpSnap = await getDocs(rpQ);
          rpSnap.forEach((p) => {
            const d = p.data() as any;
            if (d?.url) heroList.push({ id: `${a.id}:${p.id}`, url: d.url });
          });
        }

        setHero(heroList);
        setPhotoIdx(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  async function handleCreateInvite() {
    if (!evt) return;
    try {
      setInviting(true);
      const token = await createInvite(eventId, "editor");
      const url = `${window.location.origin}/join/${token}?e=${eventId}`;
      setInviteLink(url);

      if (navigator.share) {
        try {
          await navigator.share({ title: "Join my trip", url });
        } catch {}
      } else {
        try {
          await navigator.clipboard.writeText(url);
          alert("Invite link copied!");
        } catch {}
      }
    } catch (e: any) {
      alert(e?.message || "Could not create invite (are you the owner?)");
    } finally {
      setInviting(false);
    }
  }

  // ensure a hidden gallery activity exists
  async function getOrCreateGalleryActivity(): Promise<string> {
    const actsCol = collection(db, `events/${eventId}/activities`);
    const qy = query(actsCol, where("kind", "==", GALLERY_KIND), limit(1));
    const snap = await getDocs(qy);
    if (!snap.empty) return snap.docs[0].id;

    const ref = await addDoc(actsCol, {
      title: "Event Gallery",
      kind: GALLERY_KIND,
      dayId: null,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }

  async function handleCreateDay(dateISO: string) {
  // Create /events/{eventId}/days/{YYYY-MM-DD} if it doesn't exist
  const dayRef = doc(db, `events/${eventId}/days/${dateISO}`);
  const snap = await getDoc(dayRef);
  if (!snap.exists()) {
    await setDoc(dayRef, { createdAt: serverTimestamp() });
  }

  // Update local state so the new day shows up immediately
  setDays(prev => Array.from(new Set([...prev, dateISO])).sort());
}

async function handleCreateActivity({
  dayId,
  title,
  kind,
  time12,
  desc,
}: {
  dayId: string;
  title: string;
  kind: string;
  time12: string; // from <input type="time">, already "HH:MM" 24h
  desc: string;
}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in.");

  // Firestore write
  const res = await addDoc(collection(db, `events/${eventId}/activities`), {
    title,
    kind,
    dayId,
    time: time12 || null,
    description: desc || null,
    createdAt: serverTimestamp(),
    createdBy: uid,
  });

  // Optimistic local update so UI reflects immediately
  const newAct = {
    id: res.id,
    title,
    kind,
    dayId,
    time: time12 || "",
    description: desc || "",
  } as ActivityDoc;

  setActsByDay(prev => {
    const next = { ...prev };
    const k = dayId || (evt?.startDate ?? "");
    next[k] = [...(next[k] || []), newAct].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    return next;
  });
  setActivitiesCount(c => c + 1);
}


  async function onPickPhoto(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;

    console.groupCollapsed("[UPLOAD] Begin");
  console.log("Selected file:", { name: f.name, size: f.size, type: f.type });
  console.log("eventId:", eventId);
  console.log("[auth] currentUser=", auth.currentUser ? { uid: auth.currentUser.uid, email: auth.currentUser.email } : null);

  // 🔎 Claims + membership snapshot before writing
  try {
    const tok = await auth.currentUser?.getIdTokenResult();
    console.log("[auth] claims.events?", tok?.claims?.events || null);
  } catch (e) {
    console.warn("[auth] getIdTokenResult failed", e);
  }
    // Auth + membership snapshot
    await debugAuthAndMembership(eventId);

    setUploading(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        throw new Error("You must be signed in to upload.");
      }
      const path = `events/${eventId}/gallery/${uid}/${crypto.randomUUID()}.jpg`;
      console.log("Storage path:", path);
      console.log("[storage] gs://", (storage as any)?._bucket?.bucket || "unknown");
      console.log("[storage] path   =", path);
      const r = sRef(storage, path);
      console.time("[UPLOAD] uploadBytes");
      const putRes = await uploadBytes(r, f);
      console.timeEnd("[UPLOAD] uploadBytes");
      console.log("Upload OK:", {
        fullPath: putRes.metadata.fullPath,
        size: putRes.metadata.size,
        contentType: putRes.metadata.contentType,
      });

      const url = await getDownloadURL(r);
      console.log("Download URL:", url);

      const galleryId = await getOrCreateGalleryActivity();
      console.log("Gallery activity id:", galleryId);

      await addDoc(
        collection(db, `events/${eventId}/activities/${galleryId}/refPhotos`),
        {
          url,
          width: null,
          height: null,
          uploadedBy: auth.currentUser?.uid || null,
          createdAt: serverTimestamp(),
        }
      );
      console.log("refPhoto doc written.");

      setHero((h) => [{ id: `new:${Date.now()}`, url }, ...h]);
      setPhotoIdx(0);
    } catch (e: any) {
  console.groupCollapsed("[UPLOAD] ERROR");
  console.error("error object:", e);
  console.error("code:", e?.code, "message:", e?.message, "name:", e?.name);
  console.error("bucket=", storage.app.options.storageBucket, "eventId=", eventId, "uid=", auth.currentUser?.uid);
  console.groupEnd();
  alert(e?.message || "Could not add photo.");
} finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      console.groupEnd();
    }
  }

  if (loading) {
    return (
      <>
        <div className="iphone-wrap">
          <HeaderFitlist />
          <main className="content">
            <section className="section title-card">
              <div className="title">Loading…</div>
            </section>
          </main>
        </div>
        {/* Bottom nav OUTSIDE iphone-wrap */}
        <BottomNavFitlist
  active="overview"
  days={days} // your existing array of YYYY-MM-DD
  onCreateDay={handleCreateDay}
  onCreateActivity={handleCreateActivity}
  onSignOut={() => auth.signOut()}
        />
      </>
    );
  }

  if (!evt) {
    return (
      <>
        <div className="iphone-wrap">
          <HeaderFitlist />
          <main className="content">
            <section className="section title-card">
              <div className="title">Event not found</div>
            </section>
          </main>
        </div>
        {/* Bottom nav OUTSIDE iphone-wrap */}
        <BottomNavFitlist
          active="overview"
          eventId={eventId}
          onSignOut={() => auth.signOut()}
        />
      </>
    );
  }

  return (
    <>
      <div className="iphone-wrap">
        <HeaderFitlist />

        <main className="content">
          {/* Title + date (centered) */}
          <section className="section title-card">
            <div className="title">{evt.name}</div>
            <div className="sub">
              {evt.type === "trip"
                ? dateLabel
                : evt.startDate
                ? formatNice(evt.startDate)
                : ""}
            </div>
          </section>

          {/* Image carousel – white bg, thin gray border, rounded, inner gap */}
          <section className="section hero-card">
            <div className="hero">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {hero[photoIdx]?.url ? <img src={hero[photoIdx].url} alt="" /> : null}

              {hero.length > 1 && (
                <>
                  <button className="nav prev" onClick={prev} aria-label="Previous">
                    ‹
                  </button>
                  <button className="nav next" onClick={next} aria-label="Next">
                    ›
                  </button>
                </>
              )}

              {hero.length > 1 && (
                <div className="dots">
                  {hero.map((_, i) => (
                    <span
                      key={i}
                      className={"dot" + (i === photoIdx ? " active" : "")}
                      onClick={() => setPhotoIdx(i)}
                      aria-label={`Go to slide ${i + 1}`}
                      role="button"
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Summary row */}
          <section className="summary-row">
            <div className="stat">
              <div className="num">{friendsCount}</div>
              <div className="lbl">Friends</div>
            </div>
            <div className="stat">
              <div className="num">{activitiesCount}</div>
              <div className="lbl">Activities</div>
            </div>
            <div className="stat">
              <div className="num">{days.length || 1}</div>
              <div className="lbl">{evt.type === "trip" ? "Days" : "Day"}</div>
            </div>
          </section>

          {/* Action pills exactly like /events toolbar */}
          <div className="pills-row bare">
            {/* hidden file input */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => onPickPhoto(e.currentTarget.files)}
            />
            <button
              className="pill sm"
              onClick={() => !uploading && fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Adding…" : "+ Photos"}
            </button>

            <button
              className="pill sm"
              onClick={handleCreateInvite}
              disabled={inviting}
              title={inviteLink ? inviteLink : "Create invite link"}
            >
              {inviting ? "Creating…" : "+ Invite"}
            </button>
          </div>

          {/* Days list – EXACT same visual as /events “card” */}
          <section className="list">
            {days.map((d) => {
              const isOpen = openDayId === d;
              const acts = actsByDay[d] || [];
              return (
                <div
                  key={d}
                  className={"card day-row" + (isOpen ? " expand" : "")}
                  onClick={() => setOpenDayId((cur) => (cur === d ? null : d))}
                  role="button"
                  aria-expanded={isOpen}
                >
                  <div className="meta">
                    <div className="title">
                      {new Date(d + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <div className="sub">
                      {new Date(d + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "long",
                      })}
                    </div>
                  </div>

                  <div className="count" aria-label={`${acts.length} activities`}>
                    {acts.length} {acts.length === 1 ? "activity" : "activities"}
                  </div>

                  {isOpen && (
                    <div className="expand-body" onClick={(e) => e.stopPropagation()}>
                      {acts.length === 0 ? (
                        <div className="activity">
                          <span className="name" style={{ color: "var(--muted)" }}>
                            No activities yet
                          </span>
                          <span className="time" />
                        </div>
                      ) : (
                        acts.map((a) => (
                          <Link
                            key={a.id}
                            href={`/events/${eventId}/activities/${a.id}`}
                            className="activity"
                            style={{
                              display: 'grid',                 // enforce a 2-col layout
                              gridTemplateColumns: '1fr auto', // name grows, time auto
                              alignItems: 'center',
                              gap: 8,
                              width: '100%',
                            }}
                          >
                            <span className="name"style={{
      minWidth: 0,                   // required for truncation
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      textAlign: 'left',
    }}>{a.title}</span>
                            <span className="time" style={{
      justifySelf: 'end',            // push to the far right
      whiteSpace: 'nowrap',
      marginLeft: 8,                 // visual breathing room
      color: 'var(--muted)',
      textAlign: 'right',
    }}>{to12h(a.time)}</span>
                          </Link>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </main>

        {/* (No bottom nav here) */}
      </div>

      {/* Global bottom nav — OUTSIDE .iphone-wrap so its popover stacks correctly */}
      <BottomNavFitlist
        active="overview"
        days= {days}
        onCreateActivity={handleCreateActivity}
        onCreateDay={handleCreateDay}
        eventId={eventId}
        onSignOut={() => auth.signOut()}
      />

      {/* === Styles copied to preserve sandbox design === */}
      <style jsx>{`
        .iphone-wrap {
          --bg: #fafafa;
          --card: #fff;
          --ink: #0f172a;
          --muted: #64748b;
          --accent: #264864;
          --line: #e2e8f0;
          background: var(--bg);
          color: var(--ink);
          min-height: 100dvh;
          padding-bottom: calc(28px + 72px + env(safe-area-inset-bottom));
        }
        .content {
          max-width: 402px;
          margin: 0 auto;
          padding: 10px;
        }

        /* Default card section (adds separators) */
        .section {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 12px;
          margin: 8px 0;
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.03);
        }

        /* Title card */
        .title-card { text-align: center; }
        .title-card .title { font-weight: 700; font-size: 16px; }
        .title-card .sub { color: var(--muted); font-size: 12px; margin-top: 4px; }

        /* Carousel card (white bg, rounded) */
        .hero-card { padding: 10px; }
        .hero {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 10;
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--line);
        }
        .hero img {
          width: 100%; height: 100%; object-fit: cover; display: block;
          backface-visibility: hidden; transform: translateZ(0);
        }
        .hero .nav {
          position: absolute; top: 50%; transform: translateY(-50%);
          background: #fff; border: 1px solid var(--line);
          padding: 6px 8px; border-radius: 10px; cursor: pointer;
        }
        .hero .prev { left: 6px; }
        .hero .next { right: 6px; }
        .dots {
          position: absolute; left: 0; right: 0; bottom: 6px;
          display: flex; gap: 6px; justify-content: center;
        }
        .dot { width: 6px; height: 6px; border-radius: 999px; background: #cbd5e1; cursor: pointer; }
        .dot.active { background: var(--accent); }

        /* Summary row */
        .summary-row {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 8px; margin: 8px 0;
        }
        .stat {
          background: var(--card); border: 1px solid var(--line);
          border-radius: 14px; padding: 10px; text-align: center;
          box-shadow: 0 1px 0 rgba(15,23,42,.03);
        }
        .stat .num { font-weight: 700; font-size: 18px; }
        .stat .lbl { color: var(--muted); font-size: 12px; }

        /* Pills like /events toolbar */
        .pills-row { display: flex; gap: 8px; }
        .pill {
          border: 1px solid var(--accent);
          color: var(--accent);
          background: #fff;
          border-radius: 999px;
          padding: 8px 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .pill.sm { padding: 6px 10px; font-size: 14px; }
        .pills-row.bare {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 8px; margin: 8px 0;
        }

        /* Days list (cards) */
        .list { display: grid; gap: 10px; margin: 8px 0; }
        .card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 10px;
          text-decoration: none; color: inherit;
          box-shadow: 0 1px 0 rgba(15,23,42,.03);
        }
        .card.day-row {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }
        .meta { display: grid; gap: 4px; align-content: center; }
        .meta .title { font-weight: 700; }
        .meta .sub { color: var(--muted); font-size: 12px; }

        .day-row.expand { background: #f8fafc; }
        .card.day-row .expand-body {
          grid-column: 1 / -1;
          margin-top: 8px;
          border-top: 1px solid var(--line);
          padding-top: 8px;
        }
        .expand-body .activity {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 6px 0;
          font-size: 14px;
          text-decoration: none;
          color: inherit;
        }
        .activity .time {
          justify-self: end;
          white-space: nowrap;
          color: var(--muted);
          text-align: right;
        }
        .expand-body .activity .name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: left;
        }
      `}</style>
    </>
  );
}