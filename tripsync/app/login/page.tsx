"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/";

  useEffect(() => {
    const off = onAuthStateChanged(auth, (user) => {
      if (user) router.replace(next); // go to ?next=... or home
    });
    return () => off();
  }, [router, next]);

  const doSignIn = async () => {
    try {
      setError(null);
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will redirect, but we can also eagerly push:
      router.replace(next);
    } catch (e: any) {
      setError(e.message || "Could not sign in.");
    }
  };

  // ⬇️ No account creation here. Send them to /signup where you collect
  // first/last name & avatar, create the user, write Firestore, etc.
  const goToSignup = () => {
    const url = new URL("/signup", window.location.origin);
    url.searchParams.set("next", next);
    if (email) url.searchParams.set("email", email);
    router.push(url.pathname + "?" + url.searchParams.toString());
  };

  return (
    <main style={{maxWidth: 420, margin: "40px auto", padding: 16}}>
      <h1 style={{marginBottom: 12}}>Sign in</h1>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e=>setEmail(e.target.value)}
        style={{width:"100%", padding:10, marginBottom:8}}
        autoComplete="email"
      />
      <input
        type="password"
        placeholder="Password"
        value={pass}
        onChange={e=>setPass(e.target.value)}
        style={{width:"100%", padding:10, marginBottom:8}}
        autoComplete="current-password"
      />

      <div style={{display:"flex", gap:8}}>
        <button onClick={doSignIn}>Sign in</button>
        <button type="button" onClick={goToSignup}>Create account</button>
      </div>

      {error && <p style={{color:"crimson", marginTop:8}}>{error}</p>}

      <p style={{marginTop:16}}>
        <Link href="/">Back home</Link>
      </p>
    </main>
  );
}