// lib/events.ts
import {
  collection,
  collectionGroup,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ----------------------------------------------------------
   Helpers
---------------------------------------------------------- */

/** Create YYYY-MM-DD list between start & end (inclusive) */
function daysBetween(startISO: string, endISO: string) {
  const out: string[] = [];
  const s = new Date(startISO + "T00:00:00");
  const e = new Date(endISO + "T00:00:00");
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/* ----------------------------------------------------------
   Events / Members / Days / Activities
---------------------------------------------------------- */

/** Create an event or trip (normalizes single-day events to start=end and creates the day) */
export async function createEvent({
  ownerId,
  type,               // "event" | "trip"
  name,
  coverPhotoUrl = null,
  startDate = null,   // trips
  endDate = null,     // trips
  eventDate = null,   // single-day event
}: {
  ownerId: string;
  type: "event" | "trip";
  name: string;
  coverPhotoUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  eventDate?: string | null;
}) {
  // For single-day events, normalize start/end to the same day for display
  const normalizedStart = type === "event" ? (eventDate ?? null) : (startDate ?? null);
  const normalizedEnd   = type === "event" ? (eventDate ?? null) : (endDate ?? null);

  // 1) Create the parent event
  const ref = await addDoc(collection(db, "events"), {
    ownerId,
    type,
    name,
    coverPhotoUrl,
    startDate: normalizedStart,
    endDate: normalizedEnd,
    createdAt: serverTimestamp(),
  });

  // 2) Add the owner as a member (role: owner) — include userId so collectionGroup queries work
  await setDoc(doc(db, `events/${ref.id}/members/${ownerId}`), {
    userId: ownerId,
    role: "owner",
    joinedAt: serverTimestamp(),
  });

  // 3) If it's a single-day event, create one day doc (id = YYYY-MM-DD)
  if (type === "event" && eventDate) {
    await setDoc(doc(db, `events/${ref.id}/days/${eventDate}`), {
      dayId: eventDate,
      createdAt: serverTimestamp(),
    });
  }

  return ref.id;
}

/** Invite/add a friend as a member */
export async function addMember(eventId: string, uid: string) {
  await setDoc(doc(db, `events/${eventId}/members/${uid}`), {
    userId: uid,
    role: "member",
    joinedAt: serverTimestamp(),
  });
}

/** For trips: create a day doc (use ISO date as ID) */
export async function createDay(eventId: string, dayId: string /* "YYYY-MM-DD" */) {
  const dayRef = doc(db, `events/${eventId}/days/${dayId}`);
  await setDoc(dayRef, {
    dayId,
    createdAt: serverTimestamp(),
  });
}

/** Add an activity to an event (event or trip) */
export async function addActivity(
  eventId: string,
  activity: {
    title: string;
    time?: string | null;        // "HH:mm"
    kind?: string | null;        // "travel" | "hotel" | "activity" | ...
    dayId?: string | null;       // for trips, link to a day
    refPhotoUrl?: string | null; // optional legacy single reference photo
    notes?: string | null;
  }
) {
  const actsCol = collection(db, `events/${eventId}/activities`);
  const ref = await addDoc(actsCol, {
    ...activity,
    createdAt: serverTimestamp(),
  });
  return ref.id; // activityId
}

/* ----------------------------------------------------------
   Overview helpers (counts, fetch)
---------------------------------------------------------- */

export async function getEvent(eventId: string) {
  const ref = doc(db, "events", eventId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Event not found");
  return { id: snap.id, ...(snap.data() as any) };
}

export async function countMembers(eventId: string) {
  const col = collection(db, `events/${eventId}/members`);
  const snap = await getDocs(col);
  return snap.size;
}

export async function countActivities(eventId: string) {
  const col = collection(db, `events/${eventId}/activities`);
  const snap = await getDocs(col);
  return snap.size;
}

export async function listDayIds(eventId: string) {
  const col = collection(db, `events/${eventId}/days`);
  const snap = await getDocs(col);
  return snap.docs.map((d) => d.id).sort();
}

/** Ensure day docs exist for a trip date range. Safe to call multiple times. */
export async function ensureDaysForRange(eventId: string, start: string, end: string) {
  const existing = await getDocs(collection(db, `events/${eventId}/days`));
  const have = new Set(existing.docs.map((d) => d.id));
  const wanted = daysBetween(start, end);

  const batch = writeBatch(db);
  let toWrite = 0;

  for (const id of wanted) {
    if (!have.has(id)) {
      batch.set(doc(db, `events/${eventId}/days/${id}`), {
        dayId: id,
        createdAt: serverTimestamp(),
      });
      toWrite++;
    }
  }
  if (toWrite) await batch.commit();
}

/** Alias kept for older imports (delegates to ensureDaysForRange) */
export async function ensureTripDays(eventId: string, start: string | null, end: string | null) {
  if (!start || !end) return;
  return ensureDaysForRange(eventId, start, end);
}

/** Create an invite token (MVP: link you can copy/share) */
export async function createInvite(eventId: string, role: "editor" | "viewer" = "editor") {
  const token = crypto.randomUUID();
  await setDoc(doc(db, `events/${eventId}/invites/${token}`), {
    role,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  // Your join route will be /join/[token]
  return token;
}

/* ----------------------------------------------------------
   Shared Reference Photos (activity hero)
   - Any member can add
---------------------------------------------------------- */

export async function addRefPhoto(
  eventId: string,
  activityId: string,
  data: { url: string; width: number; height: number; uploadedBy: string }
) {
  const col = collection(db, `events/${eventId}/activities/${activityId}/refPhotos`);
  await addDoc(col, {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function listRefPhotos(eventId: string, activityId: string) {
  const col = collection(db, `events/${eventId}/activities/${activityId}/refPhotos`);
  const qy = query(col, orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

/* ----------------------------------------------------------
   Outfits (per user per activity)
   - Outfit doc at outfits/{uid}
   - Photos at outfits/{uid}/photos/*
---------------------------------------------------------- */

/** Upsert the current user's outfit metadata (notes/items) */
export async function upsertOutfitMeta(
  eventId: string,
  activityId: string,
  uid: string,
  data: { items?: string[]; notes?: string | null }
) {
  const ref = doc(db, `events/${eventId}/activities/${activityId}/outfits/${uid}`);
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

/** Add a photo to the current user's outfit */
export async function addOutfitPhoto(
  eventId: string,
  activityId: string,
  uid: string,
  data: { url: string; width: number; height: number }
) {
  const col = collection(db, `events/${eventId}/activities/${activityId}/outfits/${uid}/photos`);
  await addDoc(col, { ...data, createdAt: serverTimestamp() });
}

/** Get all outfits (with photos) for an activity, keyed by uid */
export async function listOutfitsWithPhotos(eventId: string, activityId: string) {
  const outfitsCol = collection(db, `events/${eventId}/activities/${activityId}/outfits`);
  const outfitSnap = await getDocs(outfitsCol);

  const result: Record<
    string,
    { uid: string; notes?: string | null; items?: string[]; photos: any[] }
  > = {};

  for (const docSnap of outfitSnap.docs) {
    const uid = docSnap.id;
    const data = docSnap.data() as any;

    const photosCol = collection(
      db,
      `events/${eventId}/activities/${activityId}/outfits/${uid}/photos`
    );
    const qy = query(photosCol, orderBy("createdAt", "desc"));
    const photosSnap = await getDocs(qy);

    result[uid] = {
      uid,
      notes: data?.notes ?? null,
      items: data?.items ?? [],
      photos: photosSnap.docs.map((p) => ({ id: p.id, ...(p.data() as any) })),
    };
  }
  return result;
}

/* ----------------------------------------------------------
   (Legacy) Single upsertOutfit that stored photoUrl on the doc
   – Keeping for compatibility if something else references it.
---------------------------------------------------------- */

export async function upsertOutfit(
  eventId: string,
  activityId: string,
  uid: string,
  data: { photoUrl?: string | null; items?: string[]; notes?: string | null }
) {
  const ref = doc(db, `events/${eventId}/activities/${activityId}/outfits/${uid}`);
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}