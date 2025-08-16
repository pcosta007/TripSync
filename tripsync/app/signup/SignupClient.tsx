"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { auth, db, storage } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref as sRef, uploadBytes } from "firebase/storage";
import HeaderFitlist from "@/app/components/HeaderFitlist";

type Status = "idle" | "creating" | "saving" | "done" | "error";

export default function SignupClient() {
  const search = useSearchParams();
  const next = search.get("next") || "/";

  const [status, setStatus] = useState<Status>("idle");
  const [err, setErr] = useState<string>("");

  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const displayName = useMemo(
    () => [firstName.trim(), lastName.trim()].filter(Boolean).join(" "),
    [firstName, lastName]
  );

  const initials = useMemo(() => {
    const base = displayName || email;
    const letters = (base.match(/\b\w/g) || []).slice(0, 2).join("");
    return letters.toUpperCase();
  }, [displayName, email]);

  const onPickFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0] || null;
    setFile(f);
  }, []);

  async function uploadAvatar(uid: string): Promise<string | null> {
    try {
      if (!file) return null;
      const path = `users/${uid}/avatar/${crypto.randomUUID()}.jpg`;
      const r = sRef(storage, path);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      return url;
    } catch {
      return null;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setStatus("creating");

    try {
      // 1) Create auth user
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
      const uid = cred.user.uid;

      // 2) Upload avatar (optional)
      setStatus("saving");
      const photoURL = await uploadAvatar(uid);

      // 3) Update auth displayName / photoURL (best-effort)
      try {
        await updateProfile(cred.user, {
          displayName: displayName || undefined,
          photoURL: photoURL || undefined,
        });
      } catch {}

      // 4) Save user profile doc
      await setDoc(doc(db, "users", uid), {
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        displayName: displayName || null,
        initials,
        email: email.trim(),
        photoURL: photoURL || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setStatus("done");
      // 5) Redirect to next (e.g., back to /join/... flow or home)
      window.location.href = next;
    } catch (e: any) {
      setStatus("error");
      setErr(e?.message || "Could not create your account.");
    }
  }

  return (
    <>
      <div className="iphone-wrap">
        <HeaderFitlist />
        
        <main className="content">
          <div className="wrap phone">
            {/* Form Card */}
            <section className="section" style={{ marginTop: '20px' }}>
              <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Header */}
                <div style={{ marginBottom: '8px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>Create Account</h2>
                </div>

                {err && (
                  <div className="error-alert">
                    {err}
                  </div>
                )}

                {/* First Name */}
                <div className="form-group">
                  <label htmlFor="firstName" className="form-label">First name</label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirst(e.target.value)}
                    placeholder="Jane"
                    className="form-input"
                  />
                </div>

                {/* Last Name */}
                <div className="form-group">
                  <label htmlFor="lastName" className="form-label">Last name</label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLast(e.target.value)}
                    placeholder="Doe"
                    className="form-input"
                  />
                </div>

                {/* Email */}
                <div className="form-group">
                  <label htmlFor="email" className="form-label">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="form-input"
                  />
                </div>

                {/* Password */}
                <div className="form-group">
                  <label htmlFor="password" className="form-label">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="form-input"
                  />
                </div>

                {/* Profile Photo */}
                <div className="form-group">
                  <label htmlFor="photo" className="form-label">Profile photo (optional)</label>
                  <div className="file-input-wrapper">
                    <input
                      id="photo"
                      type="file"
                      accept="image/*"
                      onChange={onPickFile}
                      className="file-input"
                    />
                    <label htmlFor="photo" className="file-input-label">
                      Choose photo
                    </label>
                  </div>
                  
                  {/* Live preview */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                    <div className="avatar-preview">
                      {file ? (
                        <img
                          src={URL.createObjectURL(file)}
                          alt="Preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span className="avatar-initials">{initials}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
                      {displayName || "Your display name will appear here"}
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '8px' }}>
                  <button
                    type="submit"
                    disabled={status === "creating" || status === "saving"}
                    className="pill primary lg"
                    style={{ width: '100%' }}
                  >
                    {status === "creating"
                      ? "Creating account…"
                      : status === "saving"
                      ? "Saving profile…"
                      : "Create Account"}
                  </button>

                  <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--muted)' }}>
                    Already have an account?{" "}
                    <a 
                      href={`/login?next=${encodeURIComponent(next)}`}
                      style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                    >
                      Log in
                    </a>
                  </p>
                </div>
              </form>
            </section>
          </div>
        </main>
      </div>

      <style jsx>{`
        :root { 
          --bg: #fafafa; 
          --card: #fff; 
          --ink: #0f172a; 
          --muted: #64748b; 
          --accent: #264864; 
          --line: #e2e8f0; 
        }

        .iphone-wrap {
          background: var(--bg);
          color: var(--ink);
          min-height: 100dvh;
        }

        .content {
          padding-top: 0;
        }

        .wrap {
          padding: 10px 10px 40px;
          margin: 0 auto;
        }

        .phone {
          max-width: 402px;
          min-height: 100dvh;
        }

        .section {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 20px;
          margin: 12px 0;
          box-shadow: 0 1px 0 rgba(15, 23, 42, .03);
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--ink);
        }

        .form-input {
          width: 100%;
          height: 48px;
          border-radius: 8px;
          border: 1px solid var(--line);
          background: white;
          padding: 0 12px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        .form-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(38, 72, 100, 0.08);
        }

        .file-input-wrapper {
          position: relative;
        }

        .file-input {
          position: absolute;
          opacity: 0;
          width: 100%;
          height: 48px;
          cursor: pointer;
        }

        .file-input-label {
          display: block;
          width: 100%;
          height: 48px;
          border-radius: 8px;
          border: 1px solid var(--accent);
          background: white;
          padding: 0 12px;
          font-size: 14px;
          line-height: 46px;
          color: var(--accent);
          cursor: pointer;
          text-align: center;
          font-weight: 500;
          transition: all 0.2s;
        }

        .file-input-label:hover {
          background: rgba(38, 72, 100, 0.04);
        }

        .avatar-preview {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          overflow: hidden;
          background: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .avatar-initials {
          font-size: 16px;
          font-weight: 500;
          color: var(--muted);
        }

        .error-alert {
          background: #fee2e2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
        }

        .pill {
          border: 1px solid var(--accent);
          color: var(--accent);
          background: #fff;
          border-radius: 999px;
          padding: 8px 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .pill.primary {
          background: var(--accent);
          color: white;
        }

        .pill.primary:hover:not(:disabled) {
          background: #1a3d52;
        }

        .pill:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .pill.lg {
          padding: 12px 20px;
          font-size: 16px;
        }
      `}</style>
    </>
  );
}