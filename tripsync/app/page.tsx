"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Link from "next/link";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    const off = onAuthStateChanged(auth, (u)=>{
      setUser(u);
      setLoading(false);
    });
    return () => off();
  },[]);

  if (loading) return <main style={{padding:20}}>Loading…</main>;

  if (!user) {
    return (
      <main style={{padding:20}}>
        <p>You’re signed out.</p>
        <Link href="/login">Go to login</Link>
      </main>
    );
  }

  return (
    <main style={{padding:20}}>
      <p>Signed in as <b>{user.email}</b></p>
      <button onClick={()=>signOut(auth)}>Sign out</button>

      {/* Later: list of events/trips here */}
      <h2 style={{marginTop:16}}>Your events & trips</h2>
      <p>(Coming next)</p>
    </main>
  );
}