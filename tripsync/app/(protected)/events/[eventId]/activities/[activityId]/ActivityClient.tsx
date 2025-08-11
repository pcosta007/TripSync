"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import {
  listRefPhotos,
  addRefPhoto,
  listOutfitsWithPhotos,
  addOutfitPhoto,
  upsertOutfitMeta,
} from "@/lib/events";
import { downscaleImage, uploadImage } from "@/lib/images";

type ActivityDoc = {
  title: string;
  time?: string | null;
  kind?: string | null;          // "travel" | "hotel" | "activity" | ...
  dayId?: string | null;
  notes?: string | null;
};

type RefPhoto = {
  id: string;
  url: string;
  width: number;
  height: number;
  uploadedBy: string;
};

type OutfitBundle = {
  uid: string;
  notes?: string | null;
  items?: string[];
  photos: { id: string; url: string; width: number; height: number }[];
};

export default function ActivityClient({
  eventId,
  activityId,
}: {
  eventId: string;
  activityId: string;
}) {
  const [activity, setActivity] = useState<ActivityDoc | null>(null);

  // Reference photos (hero)
  const [refPhotos, setRefPhotos] = useState<RefPhoto[]>([]);
  const [heroIdx, setHeroIdx] = useState(0);

  // Outfits (all members)
  const [outfits, setOutfits] = useState<Record<string, OutfitBundle>>({});
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});

  // My stuff
  const uid = auth.currentUser?.uid ?? null;
  const myNotes = outfits[uid ?? ""]?.notes ?? "";
  const [noteDraft, setNoteDraft] = useState<string>("");

  // Busy flags
  const [uploadingRef, setUploadingRef] = useState(false);
  const [uploadingOutfit, setUploadingOutfit] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const refInput = useRef<HTMLInputElement>(null);
  const outfitInput = useRef<HTMLInputElement>(null);

  // Fetch activity + photos + outfits
  useEffect(() => {
    (async () => {
      // Activity doc
      const aRef = doc(db, `events/${eventId}/activities/${activityId}`);
      const aSnap = await getDoc(aRef);
      if (aSnap.exists()) setActivity(aSnap.data() as ActivityDoc);

      // Reference photos (shared)
      const refs = await listRefPhotos(eventId, activityId);
      setRefPhotos(refs as RefPhoto[]);
      setHeroIdx(0);

      // All outfits (keyed by uid)
      const bundles = await listOutfitsWithPhotos(eventId, activityId);
      setOutfits(bundles);

      // Seed noteDraft from my current notes (if any)
      if (uid && bundles[uid]?.notes) setNoteDraft(bundles[uid].notes || "");

      // Fetch display names for all seen uids (members who posted outfits or ref photos)
      const allUids = new Set<string>();
      Object.keys(bundles).forEach((k) => allUids.add(k));
      refs.forEach((r) => allUids.add(r.uploadedBy));

      const namePairs: [string, string][] = await Promise.all(
        Array.from(allUids).map(async (u) => {
          try {
            const s = await getDoc(doc(db, "users", u));
            const dn = s.exists() ? (s.data().displayName as string | undefined) : undefined;
            return [u, dn || "Friend"] as [string, string];
          } catch {
            return [u, "Friend"] as [string, string];
          }
        })
      );
      const nameMap: Record<string, string> = {};
      namePairs.forEach(([k, v]) => (nameMap[k] = v));
      setDisplayNames(nameMap);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, activityId, uid]);

  // Time label (12h)
  const timeLabel = useMemo(() => {
    const t = activity?.time;
    if (!t) return null;
    const [H, M] = t.split(":").map(Number);
    if (Number.isNaN(H) || Number.isNaN(M)) return t;
    const ampm = H >= 12 ? "PM" : "AM";
    const h12 = H % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${String(M).padStart(2, "0")} ${ampm}`;
  }, [activity?.time]);

  /* ------------------------------
     Reference photo upload
  ------------------------------ */
  async function pickRefPhoto() {
    refInput.current?.click();
  }
  async function onRefFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !uid) return;
    try {
      setUploadingRef(true);
      const scaled = await downscaleImage(f, 1600);
      const key = Date.now();
      const path = `events/${eventId}/activities/${activityId}/ref/${key}.jpg`;
      const { url, width, height } = await uploadImage(scaled, path);
      await addRefPhoto(eventId, activityId, {
        url, width, height, uploadedBy: uid,
      });
      // refresh lightweight: push into state
      setRefPhotos((prev) => [{ id: String(key), url, width, height, uploadedBy: uid }, ...prev]);
      setHeroIdx(0);
    } finally {
      setUploadingRef(false);
      if (refInput.current) refInput.current.value = "";
    }
  }

  /* ------------------------------
     Outfit photo upload (my outfit)
  ------------------------------ */
  async function pickOutfitPhoto() {
    outfitInput.current?.click();
  }
  async function onOutfitFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !uid) return;
    try {
      setUploadingOutfit(true);
      const scaled = await downscaleImage(f, 1600);
      const key = Date.now();
      const path = `events/${eventId}/activities/${activityId}/outfits/${uid}/${key}.jpg`;
      const { url, width, height } = await uploadImage(scaled, path);
      await addOutfitPhoto(eventId, activityId, uid, { url, width, height });

      // optimistic update
      setOutfits((prev) => {
        const mine = prev[uid] || { uid, notes: null, items: [], photos: [] };
        return {
          ...prev,
          [uid]: { ...mine, photos: [{ id: String(key), url, width, height }, ...mine.photos] },
        };
      });
    } finally {
      setUploadingOutfit(false);
      if (outfitInput.current) outfitInput.current.value = "";
    }
  }

  /* ------------------------------
     Save my notes (on blur)
  ------------------------------ */
  async function saveMyNotes() {
    if (!uid) return;
    setSavingNote(true);
    try {
      await upsertOutfitMeta(eventId, activityId, uid, {
        notes: noteDraft || null,
      });
      setOutfits((prev) => {
        const mine = prev[uid] || { uid, notes: null, items: [], photos: [] };
        return { ...prev, [uid]: { ...mine, notes: noteDraft || null } };
      });
    } finally {
      setSavingNote(false);
    }
  }

  /* ------------------------------
     UI helpers
  ------------------------------ */
  function heroPrev() {
    if (!refPhotos.length) return;
    setHeroIdx((i) => (i - 1 + refPhotos.length) % refPhotos.length);
  }
  function heroNext() {
    if (!refPhotos.length) return;
    setHeroIdx((i) => (i + 1) % refPhotos.length);
  }

  const myBundle = uid ? outfits[uid] : undefined;
  const friends = Object.values(outfits).filter((o) => o.uid !== uid);

  return (
    <main className="mx-auto max-w-[402px] p-2 pb-[calc(28px+72px+env(safe-area-inset-bottom))] bg-[#fafafa] min-h-[100dvh]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-[#e2e8f0] px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[#264864] font-semibold">FitList</span>
          <span className="text-sm text-[#64748b]">Itinerary</span>
          <div className="ml-auto">
            <Link href={`/events/${eventId}`} className="text-sm text-[#264864] underline">
              Back
            </Link>
          </div>
        </div>
      </header>

      {/* Meta */}
      <section className="border border-[#e2e8f0] bg-white rounded-xl p-3 mt-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{activity?.title ?? "Activity"}</div>
            <div className="text-xs text-[#64748b]">
              {timeLabel ? `${timeLabel} • ` : ""}
              {(activity?.kind ?? "Activity")}
            </div>
          </div>
        </div>
      </section>

      {/* Hero: shared reference photos */}
      <section className="border border-[#e2e8f0] bg-white rounded-xl p-3 mt-2">
        <div className="w-full aspect-[16/10] bg-[#f1f5f9] rounded-lg overflow-hidden relative">
          {refPhotos.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={refPhotos[heroIdx].url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : null}

          {/* Prev/Next if multiple */}
          {refPhotos.length > 1 && (
            <>
              <button
                onClick={heroPrev}
                aria-label="Previous"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-lg border border-[#e2e8f0] px-2 py-1 active:translate-y-px"
              >
                ‹
              </button>
              <button
                onClick={heroNext}
                aria-label="Next"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-lg border border-[#e2e8f0] px-2 py-1 active:translate-y-px"
              >
                ›
              </button>

              {/* Dots */}
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                {refPhotos.map((_, i) => (
                  <span
                    key={i}
                    className={`w-[6px] h-[6px] rounded-full ${i === heroIdx ? "bg-[#264864]" : "bg-[#cbd5e1]"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Add ref photo */}
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={pickRefPhoto}
            disabled={uploadingRef}
            className="px-3 py-2 rounded-lg border border-[#e2e8f0] bg-white active:translate-y-px disabled:opacity-50"
          >
            {uploadingRef ? "Uploading…" : "Add reference photo"}
          </button>
          <input
            ref={refInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onRefFileChange}
          />
          {refPhotos[heroIdx]?.uploadedBy && (
            <span className="text-xs text-[#64748b]">
              by {displayNames[refPhotos[heroIdx].uploadedBy] || "Friend"}
            </span>
          )}
        </div>
      </section>

      {/* Notes + my outfit upload */}
      <section className="border border-[#e2e8f0] bg-white rounded-xl p-3 mt-2">
        <textarea
          placeholder="Write outfit idea / links / reminders…"
          className="w-full min-h-[90px] border border-[#e2e8f0] rounded-lg p-2"
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={saveMyNotes}
        />
        <div className="flex gap-2 mt-2 items-center">
          <button
            onClick={pickOutfitPhoto}
            disabled={uploadingOutfit}
            className="px-3 py-2 rounded-lg border border-[#e2e8f0] bg-white active:translate-y-px disabled:opacity-50"
          >
            {uploadingOutfit ? "Uploading…" : "Add outfit photo"}
          </button>
          <input
            ref={outfitInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onOutfitFileChange}
          />
          {savingNote && <span className="text-xs text-[#64748b]">Saving…</span>}
        </div>

        {/* My outfit photos grid */}
        {myBundle?.photos?.length ? (
          <div className="grid grid-cols-4 gap-2 mt-2">
            {myBundle.photos.map((p) => (
              <div key={p.id} className="aspect-square rounded-lg bg-[#f1f5f9] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-[#64748b] mt-2">No outfit photos yet.</div>
        )}
      </section>

      {/* Friends’ outfits */}
      <section className="border border-[#e2e8f0] bg-white rounded-xl p-3 mt-2">
        <div className="text-sm font-semibold mb-2">Friends’ outfits</div>
        {friends.length === 0 ? (
          <div className="text-sm text-[#64748b]">No outfits yet.</div>
        ) : (
          <div className="grid gap-3">
            {friends.map((bundle) => (
              <div key={bundle.uid} className="rounded-lg border border-[#e2e8f0] bg-white p-2">
                <div className="text-xs text-[#64748b] mb-1">
                  {displayNames[bundle.uid] || "Friend"}
                </div>
                {bundle.photos.length ? (
                  <div className="grid grid-cols-4 gap-2">
                    {bundle.photos.map((p) => (
                      <div key={p.id} className="aspect-square rounded-lg bg-[#f1f5f9] overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[#64748b]">No photos yet.</div>
                )}
                {bundle.notes ? (
                  <div className="text-xs text-[#64748b] mt-1">{bundle.notes}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="h-6" />
    </main>
  );
}