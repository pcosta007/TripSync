// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function RootRedirect() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const off = onAuthStateChanged(auth, (user) => {
      // If signed in -> go to events list (protected)
      if (user) router.replace("/events");
      else router.replace("/login");
      setReady(true);
    });
    return () => off();
  }, [router]);

  // Simple splash while we decide
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
      <div style={{ opacity: 0.6 }}>Loading…</div>
    </main>
  );
}