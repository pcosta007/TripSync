// components/ui/HeaderFitlist.tsx
"use client";

import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export default function HeaderFitlist() {
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log("User signed out");
      // optional redirect:
      window.location.href = "/";
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  return (
    <header className="hdr">
      <div className="brand">
        {/* suitcase + check (brand) */}
        <svg width="24" height="24" viewBox="0 0 256 256" fill="none" aria-hidden="true">
          <rect x="36" y="68" width="184" height="140" rx="20" stroke="#264864" strokeWidth="12"/>
          <path d="M92 68V52c0-11 9-20 20-20h32c11 0 20 9 20 20v16" stroke="#264864" strokeWidth="12"/>
          <g transform="translate(88, 104) scale(3.2)">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" stroke="#264864" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 3v5h-5" stroke="#264864" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" stroke="#264864" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 16H3v5" stroke="#264864" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </g>
        </svg>
        <span className="brand-text">TripSync</span>
      </div>

      <div className="signout" onClick={handleSignOut}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m16 17 5-5-5-5"/>
          <path d="M21 12H9"/>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        </svg>
        <span>Sign Out</span>
      </div>

      <style jsx>{`
        .hdr {
          position: sticky; top: 0; z-index: 5;
          background: #fff; border-bottom: 1px solid #e2e8f0;
          padding: calc(10px + env(safe-area-inset-top)) 12px 10px;
          display: flex; justify-content: space-between; align-items: center;
        }
        .brand {
          display: flex; align-items: center; gap: 8px;
        }
        .brand-text {
          color: #264864; font-weight: 700;
        }
        .signout {
          display: flex; flex-direction: column; align-items: center;
          color: #264864; font-size: 0.75rem; font-weight: 500;
          cursor: pointer;
        }
        .signout svg {
          margin-bottom: 2px;
        }
      `}</style>
    </header>
  );
}