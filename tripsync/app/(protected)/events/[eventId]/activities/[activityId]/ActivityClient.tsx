"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { auth, db, storage } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDownloadURL, ref as sRef, uploadBytes } from "firebase/storage";

// shared UI
import HeaderFitlist from "@/app/components/HeaderFitlist";
import BottomNavFitlist from "@/app/components/BottomNavFitlist";

// ✅ Outfit gallery component (IDENTICAL design)
import OutfitGallery from "@/app/components/OutfitGallery";


console.log("[cfg] storage bucket=", storage.app.options.storageBucket);
// ---- Types ----
type EventDoc = {
  type: "event" | "trip";
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  coverPhotoUrl?: string | null;
};
type ActivityDoc = {
  id: string;
  title: string;
  time?: string | null;   // "HH:MM"
  kind?: string | null;   // travel|hotel|activity|breakfast|lunch|dinner
  dayId?: string | null;  // "YYYY-MM-DD"
  description?: string | null;
};

// Outfit gallery post type (matches OutfitGallery)
type OutfitPost = {
  id: string;
  user: { name: string; avatar: string; initials: string };
  image: string;
  description: string;
  likes: number;
  comments: number;
  timestamp: string; // "2h", "3d", etc
};

// Hide the special gallery "activity"
const GALLERY_KIND = "__gallery";

// ---- Helpers ----
function to12h(t?: string | null) {
  if (!t) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || "");
  if (!m) return t || "";
  let h = +m[1];
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}
function kindLabel(k?: string | null) {
  return (
    { travel: "Travel", hotel: "Hotel", activity: "Activity", breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" }[
      k || "activity"
    ] || "Activity"
  );
}
function kindClass(k?: string | null) {
  return (
    { travel: "k-travel", hotel: "k-hotel", activity: "k-activity", breakfast: "k-breakfast", lunch: "k-lunch", dinner: "k-dinner" }[
      k || "activity"
    ] || "k-activity"
  );
}
// tiny relative time for gallery timestamps
function relTimeFromDate(d?: Date | null) {
  if (!d) return "";
  const ms = Date.now() - d.getTime();
  const sec = Math.max(1, Math.floor(ms / 1000));
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day}d`;
  if (hr > 0) return `${hr}h`;
  if (min > 0) return `${min}m`;
  return `${sec}s`;
}

// ---- Page ----
export default function ActivityClient({
  eventId,
  initialDay,
  initialActId,
  initialView = "itinerary",
}: {
  eventId: string;
  initialDay: string | null;
  initialActId: string | null;
  initialView?: "itinerary" | "summary" | "checklist";
}) {
  // data
  const [evt, setEvt] = useState<EventDoc | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [actsByDay, setActsByDay] = useState<Record<string, ActivityDoc[]>>({});
  const [photosByAct, setPhotosByAct] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  // view state (matches reference)
  const dayIds = days;
  const [activeDay, setActiveDay] = useState<string | null>(initialDay ?? null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [currentView] = useState<"itinerary" | "summary" | "checklist">(initialView);

  // --- upload state/refs for the pills ---
  const fileRefActivity = useRef<HTMLInputElement | null>(null);
  const fileRefOutfit = useRef<HTMLInputElement | null>(null);
  const [uploadingActivity, setUploadingActivity] = useState(false);
  const [uploadingOutfit, setUploadingOutfit] = useState(false);

  // keep outfit photos separate from itinerary photos
  const [outfitPhotosByAct, setOutfitPhotosByAct] = useState<Record<string, string[]>>({});

  // ✅ posts for OutfitGallery (for the currently selected activity)
  const [outfitPosts, setOutfitPosts] = useState<OutfitPost[]>([]);

  // load event + days + activities (+photos)
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Event
        const eSnap = await getDoc(doc(db, "events", eventId));
        const eData = eSnap.exists() ? (eSnap.data() as EventDoc) : null;
        setEvt(eData);

        // Days
        let dayList: string[] = [];
        if (eData?.type === "trip") {
          const dSnap = await getDocs(collection(db, `events/${eventId}/days`));
          dayList = dSnap.docs.map((d) => d.id).sort();
        } else if (eData?.startDate) {
          dayList = [eData.startDate];
        }
        setDays(dayList);

        // Activities (skip the hidden gallery activity)
        const actsSnap = await getDocs(collection(db, `events/${eventId}/activities`));
        const grouped: Record<string, ActivityDoc[]> = {};
        const allActs: ActivityDoc[] = [];

        actsSnap.forEach((s) => {
          const raw = s.data() as Omit<ActivityDoc, "id">;
          const a: ActivityDoc = { id: s.id, ...raw };
          if ((a.kind || "activity") === GALLERY_KIND) return; // 🚫 hide Event Gallery pseudo-activity
          const d = a.dayId || (eData?.startDate ?? "");
          if (!grouped[d]) grouped[d] = [];
          grouped[d].push(a);
          allActs.push(a);
        });

        // sort by time within day
        Object.keys(grouped).forEach((d) => {
          grouped[d].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
        });
        setActsByDay(grouped);

        // Prefetch activity photos (hero)
        const photos: Record<string, string[]> = {};
        for (const a of allActs) {
          try {
            const qy = query(
              collection(db, `events/${eventId}/activities/${a.id}/refPhotos`),
              orderBy("createdAt", "desc"),
              limit(8)
            );
            const snap = await getDocs(qy);
            const urls: string[] = [];
            for (const p of snap.docs) {
              const d = p.data() as any;
              if (d?.url) urls.push(d.url);
            }
            photos[a.id] = urls;
          } catch {}
        }
        setPhotosByAct(photos);

        // Prefetch outfit photos (for pills counts, optional use)
        const outfit: Record<string, string[]> = {};
        for (const a of allActs) {
          try {
            const qy = query(
              collection(db, `events/${eventId}/activities/${a.id}/outfitPhotos`),
              orderBy("createdAt", "desc"),
              limit(8)
            );
            const snap = await getDocs(qy);
            const urls: string[] = [];
            for (const p of snap.docs) {
              const d = p.data() as any;
              if (d?.url) urls.push(d.url);
            }
            outfit[a.id] = urls;
          } catch {}
        }
        setOutfitPhotosByAct(outfit);
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  // ensure active day/index selected
  useEffect(() => {
    if (!dayIds.length) return;
    const day = initialDay && dayIds.includes(initialDay) ? initialDay : dayIds[0];
    setActiveDay((d) => d || day);

    if (initialActId && actsByDay[day]) {
      const idx = actsByDay[day].findIndex((a) => a.id === initialActId);
      if (idx >= 0) setActiveIdx(idx);
    }
  }, [dayIds.length, actsByDay, initialDay, initialActId]);

  // ✅ Load OutfitGallery posts for the current activity
  useEffect(() => {
    (async () => {
      if (!activeDay) {
        setOutfitPosts([]);
        return;
      }
      const act = (actsByDay[activeDay] || [])[activeIdx];
      if (!act) {
        setOutfitPosts([]);
        return;
      }

      try {
        const qy = query(
          collection(db, `events/${eventId}/activities/${act.id}/outfitPhotos`),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        const snap = await getDocs(qy);

        const posts: OutfitPost[] = [];
        for (const p of snap.docs) {
          const d = p.data() as any;
          const uid = d?.uploadedBy || null;

          // Try to hydrate user display info
          let name = "Friend";
          let avatar = "";
          let initials = "??";

          if (uid) {
            try {
              const uSnap = await getDoc(doc(db, "users", uid));
              const u = uSnap.exists() ? (uSnap.data() as any) : null;
              name = u?.displayName || u?.name || name;
              avatar = u?.photoURL || u?.avatar || "";
              const base = name || (u?.email || uid);
              initials =
                (base?.match(/\b\w/g) || [])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "??";
            } catch {
              // swallow — fall back to defaults
            }
          }

          const ts =
            (d?.createdAt && typeof d.createdAt.toDate === "function"
              ? d.createdAt.toDate()
              : null) || null;

          posts.push({
            id: p.id,
            user: { name, avatar, initials, uid: uid },
            image: d?.url || "",
            description: d?.caption || "",
            likes: d?.likesCount || 0,
            comments: d?.commentsCount || 0,
            timestamp: ts ? relTimeFromDate(ts) : "",
            likedBy: d?.likedBy || [],
            eventId: eventId,
            activityId: act.id
          });
        }

        setOutfitPosts(posts);
      } catch {
        setOutfitPosts([]);
      }
    })();
  }, [activeDay, activeIdx, actsByDay, eventId]);

  /* === Upload helpers + handlers === */
  async function uploadImageToStorage(file: File, path: string): Promise<string> {
    const r = sRef(storage, path);
    await uploadBytes(r, file);
    return await getDownloadURL(r);
  }

  async function onUploadActivityPhoto(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!activeDay) return;
    const act = (actsByDay[activeDay] || [])[activeIdx];
    if (!act) return;

    setUploadingActivity(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("You must be signed in.");

      const path = `events/${eventId}/activities/${act.id}/ref/${uid}/${crypto.randomUUID()}.jpg`;
      const url = await uploadImageToStorage(f, path);

      await setDoc(
        doc(collection(db, `events/${eventId}/activities/${act.id}/refPhotos`)),
        {
          url,
          width: null,
          height: null,
          uploadedBy: uid,
          createdAt: serverTimestamp(),
        }
      );

      setPhotosByAct((prev) => {
        const next = { ...prev };
        next[act.id] = [url, ...(next[act.id] || [])];
        return next;
      });
    } catch (e) {
      console.error(e);
      alert("Could not upload photo.");
    } finally {
      setUploadingActivity(false);
      if (fileRefActivity.current) fileRefActivity.current.value = "";
    }
  }

  async function onUploadOutfitPhoto(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!activeDay) return;
    const act = (actsByDay[activeDay] || [])[activeIdx];
    if (!act) return;


    setUploadingOutfit(true);
    try {
      const uid = auth.currentUser?.uid;
      console.groupCollapsed("[upload:outfit] preflight");
    console.log("eventId:", eventId);
    console.log("uid:", uid);
    console.log("activeDay:", activeDay);
    console.log("activityId:", act.id);

      if (!uid) { console.groupEnd(); throw new Error("You must be signed in.");}

      const memRef = doc(db, `events/${eventId}/members/${uid}`);
      const memSnap = await getDoc(memRef);
      console.log("membership doc exists:", memSnap.exists(), "path:", memRef.path);
      if (!memSnap.exists()) {
        console.groupEnd();
        throw new Error("User is not a Firestore member of this event");
      }

      const path = `events/${eventId}/activities/${act.id}/outfits/${uid}/${crypto.randomUUID()}.jpg`;
      console.log("storage filePath:", path);
    console.groupEnd();
      const url = await uploadImageToStorage(f, path);
      console.log("[upload:outfit] upload OK, url=", url);

      await setDoc(
        doc(collection(db, `events/${eventId}/activities/${act.id}/outfitPhotos`)),
        {
          url,
          width: null,
          height: null,
          uploadedBy: uid,
          createdAt: serverTimestamp(),
          caption: "",      // optional, used by gallery description if present
          likesCount: 0,    // optional counters the gallery can display
          commentsCount: 0, // optional counters the gallery can display
        }
      );

      // keep local convenience cache
      setOutfitPhotosByAct((prev) => {
        const next = { ...prev };
        next[act.id] = [url, ...(next[act.id] || [])];
        return next;
      });

      // refresh visible gallery list quickly
      setOutfitPosts((prev) => [
        {
          id: `local-${Date.now()}`,
          user: {
            name: auth.currentUser?.displayName || "You",
            avatar: auth.currentUser?.photoURL || "",
            initials:
              ((auth.currentUser?.displayName || "You")
                .match(/\b\w/g) || [])
                .slice(0, 2)
                .join("")
                .toUpperCase() || "YY",
          },
          image: url,
          description: "",
          likes: 0,
          comments: 0,
          timestamp: "now",
        },
        ...prev,
      ]);
    } catch (e: any) {
      console.groupCollapsed("[upload:outfit] ERROR");
      console.error("error object:", e);
      console.error("code:", e?.code, "message:", e?.message);
      console.error("did user have uid?", !!auth.currentUser?.uid);
      console.error("eventId:", eventId, "activeDay:", activeDay, "actId:", (actsByDay[activeDay] || [])[activeIdx]?.id);
      console.groupEnd();
       alert(e?.message || "Could not upload outfit photo.");
    } finally {
      setUploadingOutfit(false);
      if (fileRefOutfit.current) fileRefOutfit.current.value = "";
    }
  }

  if (loading || !evt || !activeDay) {
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
        <BottomNavFitlist active="itinerary" days={days} />
      </>
    );
  }

  // ————— Reference UI blocks —————
  const acts = actsByDay[activeDay] || [];
  const activeAct = acts[activeIdx] || null;
  const heroPhotos = activeAct ? (photosByAct[activeAct.id] || []) : [];

  return (
    <>
      <div className="iphone-wrap">
        {/* Header matches EventOverview exactly */}
        <HeaderFitlist />

        <div className="wrap phone">
          {/* Dates */}
          <section
            className="section"
            style={{ padding: 8, background: "transparent", border: "none", boxShadow: "none", margin: "0 0 8px" }}
          >
            <div className="dates-scroller">
              <div className="dates">
                {dayIds.map((d) => (
                  <button
                    key={d}
                    className={`date-btn${d === activeDay ? " active" : ""}`}
                    onClick={() => {
                      setActiveDay(d);
                      setActiveIdx(0);
                    }}
                  >
                    {new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Activity buttons (swipeable) */}
          <section
            className="section"
            style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none", margin: "0 0 8px" }}
          >
            <div className="acts-wrap scroll-fade">
              <div className="acts" id="acts">
                {acts.map((a, idx) => (
                  <button
                    key={a.id}
                    className={`act-btn${idx === activeIdx ? " active" : ""}`}
                    onClick={() => setActiveIdx(idx)}
                  >
                    <div className="title">{a.title}</div>
                    <span className={`tag ${kindClass(a.kind || "activity")}`}>{kindLabel(a.kind || "activity")}</span>
                    <div className="time">{to12h(a.time)}</div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Single-photo hero (first image of active activity) */}
          <section className="section" style={{ padding: 10 }}>
            <div className="hero">
              {heroPhotos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroPhotos[0]} alt="Activity photo" />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "#f1f5f9" }} />
              )}
            </div>
          </section>

          {/* + Photos / + Outfit pills (identical to EventOverview look) */}
          <section
            className="section"
            style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none", margin: "0 0 8px" }}
          >
            {/* hidden file inputs */}
            <input
              ref={fileRefActivity}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => onUploadActivityPhoto(e.currentTarget.files)}
            />
            <input
              ref={fileRefOutfit}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => onUploadOutfitPhoto(e.currentTarget.files)}
            />

            <div className="pills-row bare">
              <button
                className="pill sm"
                onClick={() => !uploadingActivity && fileRefActivity.current?.click()}
                disabled={uploadingActivity || !activeDay || !(actsByDay[activeDay]?.[activeIdx])}
                title={!activeDay || !(actsByDay[activeDay]?.[activeIdx]) ? "Pick a day & activity first" : "+ Photos"}
              >
                {uploadingActivity ? "Adding…" : "+ Photos"}
              </button>

              <button
                className="pill sm"
                onClick={() => !uploadingOutfit && fileRefOutfit.current?.click()}
                disabled={uploadingOutfit || !activeDay || !(actsByDay[activeDay]?.[activeIdx])}
                title={!activeDay || !(actsByDay[activeDay]?.[activeIdx]) ? "Pick a day & activity first" : "+ Outfit"}
              >
                {uploadingOutfit ? "Uploading…" : "+ Outfit"}
              </button>
            </div>
          </section>

          {/* ✅ Outfit Gallery — IDENTICAL design component */}
            <OutfitGallery 
              outfits={outfitPosts}
              eventId={eventId}
              activityId={activeAct?.id}
              onOutfitDeleted={(deleteId) => {
                setOutfitPosts(prev => prev.filter(p => p.id !== deleteId));
              }}
              onOutfitLiked={(outfitId, newCount) => {
                setOutfitPosts(prev => prev.map(p =>
                  p.id === outfitId
                    ? { 
                      ...p,
                      likes: newCount,
                      likedBy: auth.currentUser?.uid
                        ? p.likedBy?.includes(auth.currentUser.uid)
                          ? p.likedBy.filter(id => id !== auth.currentUser.uid)
                          : [...(p.likedBy || []), auth.currentUser.uid]
                        : p.likedBy
                      }
                    : p
                  ));
              }} 
            />
        </div>
      </div>

      {/* Bottom nav — use your component */}
      <BottomNavFitlist
        active={currentView === "itinerary" ? "itinerary" : currentView === "summary" ? "overview" : "outfits"}
        days={days}
      />

      {/* Styles (unchanged except your pill/btn and reduced act-btn height) */}
      <style jsx>{`
        :root{ --bg:#fafafa; --card:#fff; --ink:#0f172a; --muted:#64748b; --accent:#264864; --line:#e2e8f0; }
        .iphone-wrap { background: var(--bg); color: var(--ink); min-height: 100dvh; padding-bottom: calc(28px + 72px + env(safe-area-inset-bottom)); }
        .wrap{ padding:10px 10px calc(28px + 72px + env(safe-area-inset-bottom)); margin:0 auto; }
        .phone{ max-width:402px; }
        @supports (height: 100dvh){ .phone{ min-height:100dvh; } }
        @supports not (height: 100dvh){ .phone{ min-height:100vh; } }

        .section{ background:var(--card); border:1px solid var(--line); border-radius:14px; padding:12px; margin:12px 0; box-shadow:0 1px 0 rgba(15,23,42,.03); }
        .hidden{ display:none !important; }

        .dates{ display:flex; gap:8px; }
        .dates-scroller{ overflow-x:auto; -webkit-overflow-scrolling:touch; padding:2px; }
        .dates-scroller::-webkit-scrollbar{ display:none; }
        .date-btn{
          border:1px solid var(--line); background:#fff; border-radius:999px;
          padding:8px 10px; text-align:center; font-size:14px; cursor:pointer; white-space:nowrap;
        }
        .date-btn.active{ border-color:var(--accent); box-shadow:0 0 0 2px rgba(38,72,100,.08) inset; }

        .acts-wrap{ position:relative; margin:10px 0 12px; }
        .acts{ display:flex; gap:8px; overflow-x:auto; -webkit-overflow-scrolling:touch; scroll-snap-type:x mandatory; padding:2px 0; }
        .act-btn{
          border:1px solid var(--line); background:#fff; border-radius:12px; padding:8px; cursor:pointer;
          min-height:72px; display:grid; grid-template-rows:auto auto auto; align-items:center; justify-items:center;
          text-align:center; flex:0 0 auto; min-width:160px; max-width:240px; scroll-snap-align:start;
        }
        .act-btn .title{ font-weight:600; font-size:13px; width:100%; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; line-clamp:2; -webkit-box-orient:vertical; }
        .act-btn .tag{ font-size:11px; color:#fff; padding:2px 8px; border-radius:999px; display:inline-block; }
        .act-btn .time{ color:var(--muted); font-size:12px; }
        .act-btn.active{ border-color:var(--accent); box-shadow:0 0 0 2px rgba(38,72,100,.08) inset; }

        .k-travel{ background:#3b82f6; }
        .k-hotel{ background:#8b5cf6; }
        .k-activity{ background:#10b981; }
        .k-breakfast{ background:#f59e0b; }
        .k-lunch{ background:#fb923c; }
        .k-dinner{ background:#f43f5e; }

        .hero{ position:relative; width:100%; aspect-ratio:16/10; background:#f1f5f9; overflow:hidden; border-radius:12px; border: 1px solid var(--line); }
        .hero img{ width:100%; height:100%; object-fit:cover; display:block; }

        /* Pills like /events toolbar (identical look) */
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
      `}</style>
    </>
  );
}