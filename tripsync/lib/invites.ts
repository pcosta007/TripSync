// lib/invites.ts
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export async function createInvite(eventId: string, opts?: { role?: "owner"|"editor"|"viewer" }) {
  const token = randomToken();
  const ref = doc(db, `invites/${token}`);
  await setDoc(ref, {
    eventId,
    role: opts?.role ?? "editor",
    createdAt: serverTimestamp(),
  });
  return token;
}

export function joinUrl(token: string) {
  const base =
    (typeof window !== "undefined" && window.location.origin) ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  return `${base}/join/${token}`;
}

function randomToken(len = 24) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(36).padStart(2, "0")).join("").slice(0, len);
}