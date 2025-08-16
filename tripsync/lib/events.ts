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
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ----------------------------------------------------------
   Helpers
---------------------------------------------------------- */

/** Inclusive list of YYYY-MM-DD strings between start & end */
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

/** Create an event or trip (single-day events normalize start=end and get a day doc) */
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
  const normalizedStart = type === "event" ? (eventDate ?? null) : (startDate ?? null);
  const normalizedEnd   = type === "event" ? (eventDate ?? null) : (endDate ?? null);

  // 1) Create parent event
  const ref = await addDoc(collection(db, "events"), {
    ownerId,
    type,
    name,
    coverPhotoUrl,
    startDate: normalizedStart,
    endDate: normalizedEnd,
    createdAt: serverTimestamp(),
  });

  // 2) Add owner as a member
  await setDoc(doc(db, `events/${ref.id}/members/${ownerId}`), {
    userId: ownerId,
    role: "owner",
    joinedAt: serverTimestamp(),
  });

  // 3) Create days
  if (type === "event" && eventDate) {
    await setDoc(doc(db, `events/${ref.id}/days/${eventDate}`), {
      dayId: eventDate,
      createdAt: serverTimestamp(),
    });
  } else if (type === "trip" && normalizedStart && normalizedEnd) {
    await ensureDaysForRange(ref.id, normalizedStart, normalizedEnd);
  }

  return ref.id;
}

/** Manually add a member (owner-only by rules) */
export async function addMember(eventId: string, uid: string) {
  await setDoc(doc(db, `events/${eventId}/members/${uid}`), {
    userId: uid,
    role: "member",
    joinedAt: serverTimestamp(),
  });
}

/** Create a day doc (id = YYYY-MM-DD) */
export async function createDay(eventId: string, dayId: string) {
  await setDoc(doc(db, `events/${eventId}/days/${dayId}`), {
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
  const ref = await addDoc(collection(db, `events/${eventId}/activities`), {
    ...activity,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/* ----------------------------------------------------------
   Overview helpers
---------------------------------------------------------- */

export async function getEvent(eventId: string) {
  const snap = await getDoc(doc(db, "events", eventId));
  if (!snap.exists()) throw new Error("Event not found");
  return { id: snap.id, ...(snap.data() as any) };
}

export async function countMembers(eventId: string) {
  const snap = await getDocs(collection(db, `events/${eventId}/members`));
  return snap.size;
}

export async function countActivities(eventId: string) {
  const snap = await getDocs(collection(db, `events/${eventId}/activities`));
  return snap.size;
}

export async function listDayIds(eventId: string) {
  const snap = await getDocs(collection(db, `events/${eventId}/days`));
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

/** Legacy alias */
export async function ensureTripDays(eventId: string, start: string | null, end: string | null) {
  if (!start || !end) return;
  return ensureDaysForRange(eventId, start, end);
}

/* ----------------------------------------------------------
   Invites
---------------------------------------------------------- */

/** Create an invite token (link will be /join/[token]?e={eventId}) */
export async function createInvite(eventId: string, role: "editor" | "viewer" = "editor") {
  const token = crypto.randomUUID();
  const ref = doc(db, `events/${eventId}/invites/${token}`);
  await setDoc(ref, {
    token,             // we query on this; keep it
    role,              // "editor" | "viewer"
    status: "pending", // rules validate during join
    createdAt: serverTimestamp(),
  });
  return token;
}

/**
 * Find an invite by token across all events (still available for tooling).
 * Requires a single-field index on invites.token (collection group).
 */
export async function findInviteByToken(token: string): Promise<null | {
  eventId: string;
  role: "editor" | "viewer";
  status: "pending" | "accepted" | "expired";
}> {
  const qy = query(
    collectionGroup(db, "invites"),
    where("token", "==", token),
    limit(1)
  );
  const snap = await getDocs(qy);
  if (snap.empty) return null;

  const inviteDoc = snap.docs[0];
  const eventId = inviteDoc.ref.parent.parent?.id;
  if (!eventId) return null;

  // Re-read via absolute path for clarity
  const abs = await getDoc(doc(db, `events/${eventId}/invites/${token}`));
  if (!abs.exists()) return null;

  const data = abs.data() as any;
  return {
    eventId,
    role: (data.role ?? "editor"),
    status: (data.status ?? "pending"),
  };
}

/** Direct read by eventId + token (used by the new join flow) */
export async function getInviteForEvent(eventId: string, token: string) {
  const ref = doc(db, `events/${eventId}/invites/${token}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  return {
    eventId,
    role: (data.role ?? "editor") as "editor" | "viewer",
    status: (data.status ?? "pending") as "pending" | "accepted" | "expired",
  };
}

/** Join using the invite token (rules validate inviteToken/status/role) */
export async function joinEventWithToken({
  eventId, token, uid
}: { eventId: string; token: string; uid: string }) {
  const found = await getInviteForEvent(eventId, token);
  if (!found) throw new Error("Invite not found.");
  if (found.status !== "pending") throw new Error("Invite is not valid anymore.");

  const memRef = doc(db, `events/${eventId}/members/${uid}`);
  const memSnap = await getDoc(memRef);
  if (memSnap.exists()) {
    return { eventId, already: true };
  }

  await setDoc(memRef, {
    userId: uid,
    role: found.role,
    inviteToken: token,
    joinedAt: serverTimestamp(),
  });

  return { eventId, already: false };
}

/* ----------------------------------------------------------
   Reference Photos
---------------------------------------------------------- */

export async function addRefPhoto(
  eventId: string,
  activityId: string,
  data: { url: string; width: number; height: number; uploadedBy: string }
) {
  await addDoc(collection(db, `events/${eventId}/activities/${activityId}/refPhotos`), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function listRefPhotos(eventId: string, activityId: string) {
  const qy = query(
    collection(db, `events/${eventId}/activities/${activityId}/refPhotos`),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

/* ----------------------------------------------------------
   Outfits
---------------------------------------------------------- */

export async function upsertOutfitMeta(
  eventId: string,
  activityId: string,
  uid: string,
  data: { items?: string[]; notes?: string | null }
) {
  await setDoc(
    doc(db, `events/${eventId}/activities/${activityId}/outfits/${uid}`),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function addOutfitPhoto(
  eventId: string,
  activityId: string,
  uid: string,
  data: { url: string; width: number; height: number }
) {
  await addDoc(
    collection(db, `events/${eventId}/activities/${activityId}/outfits/${uid}/photos`),
    { ...data, createdAt: serverTimestamp() }
  );
}

export async function listOutfitsWithPhotos(eventId: string, activityId: string) {
  const outfitsCol = collection(db, `events/${eventId}/activities/${activityId}/outfits`);
  const outfitSnap = await getDocs(outfitsCol);

  const result: Record<string, { uid: string; notes?: string | null; items?: string[]; photos: any[] }> = {};
  for (const docSnap of outfitSnap.docs) {
    const uid = docSnap.id;
    const data = docSnap.data() as any;

    const photosQ = query(
      collection(db, `events/${eventId}/activities/${activityId}/outfits/${uid}/photos`),
      orderBy("createdAt", "desc")
    );
    const photosSnap = await getDocs(photosQ);

    result[uid] = {
      uid,
      notes: data?.notes ?? null,
      items: data?.items ?? [],
      photos: photosSnap.docs.map((p) => ({ id: p.id, ...(p.data() as any) })),
    };
  }
  return result;
}

/** Legacy single-upsert that stored photoUrl on the outfit doc */
export async function upsertOutfit(
  eventId: string,
  activityId: string,
  uid: string,
  data: { photoUrl?: string | null; items?: string[]; notes?: string | null }
) {
  await setDoc(
    doc(db, `events/${eventId}/activities/${activityId}/outfits/${uid}`),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}