"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const off = onAuthStateChanged(auth, (user) => {
      if (user) router.replace("/"); // go home if logged in
    });
    return () => off();
  }, [router]);

  const doSignIn = async () => {
    try {
      setError(null);
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const doSignUp = async () => {
    try {
      setError(null);
      await createUserWithEmailAndPassword(auth, email, pass);
    } catch (e: any) {
      setError(e.message);
    }
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
      />
      <input
        type="password"
        placeholder="Password"
        value={pass}
        onChange={e=>setPass(e.target.value)}
        style={{width:"100%", padding:10, marginBottom:8}}
      />
      <div style={{display:"flex", gap:8}}>
        <button onClick={doSignIn}>Sign in</button>
        <button onClick={doSignUp}>Create account</button>
      </div>
      {error && <p style={{color:"crimson", marginTop:8}}>{error}</p>}
      <p style={{marginTop:16}}>
        <Link href="/">Back home</Link>
      </p>
    </main>
  );
}