"use client";

import Link from "next/link";
import { auth } from "@/lib/firebase";

type Props = {
  eventId?: string;
  active?: "home" | "overview" | "outfits";
  onAdd?: () => void; // opens your AddSheet
};

export default function BottomNav({ eventId, active = "home", onAdd }: Props) {
  async function signOutNow() {
    const { signOut } = await import("firebase/auth");
    try { await signOut(auth); } catch {}
    window.location.href = "/login";
  }

  return (
    <nav
      className="
        fixed inset-x-0 bottom-0 z-50
        bg-white border-t border-[#e2e8f0]
        grid grid-cols-5 items-stretch
        px-2 pt-1 pb-[calc(6px+env(safe-area-inset-bottom))]
      "
      role="tablist"
      aria-label="Primary"
    >
      {/* Home */}
      <Link
        href="/events"
        className={`grid place-items-center gap-1 py-2 text-[11px] ${
          active === "home" ? "text-[#264864] font-semibold" : "text-[#64748b]"
        }`}
        role="tab"
        aria-selected={active === "home"}
      >
        <span className="leading-none">
          {/* home icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10.5L12 3l9 7.5" />
            <path d="M9 21V12h6v9" />
          </svg>
        </span>
        <span>Home</span>
      </Link>

      {/* Overview (only meaningful inside an event) */}
      <Link
        href={eventId ? `/events/${eventId}` : "/events"}
        className={`grid place-items-center gap-1 py-2 text-[11px] ${
          active === "overview" ? "text-[#264864] font-semibold" : "text-[#64748b]"
        }`}
        role="tab"
        aria-selected={active === "overview"}
      >
        <span className="leading-none">
          {/* dashboard/overview icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="2" />
            <rect x="14" y="3" width="7" height="7" rx="2" />
            <rect x="14" y="14" width="7" height="7" rx="2" />
            <rect x="3" y="14" width="7" height="7" rx="2" />
          </svg>
        </span>
        <span>Overview</span>
      </Link>

      {/* Add (+) — centered */}
      <button
        onClick={onAdd}
        className="grid place-items-center gap-1 py-2 text-[11px] text-[#264864]"
        aria-label="Add"
      >
        <span className="leading-none">
          {/* Instagram-like plus in a rounded square */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <path d="M12 8v8" />
            <path d="M8 12h8" />
          </svg>
        </span>
        <span>Add</span>
      </button>

      {/* Outfits */}
      <Link
        href={eventId ? `/events/${eventId}/outfits` : "/events"}
        className={`grid place-items-center gap-1 py-2 text-[11px] ${
          active === "outfits" ? "text-[#264864] font-semibold" : "text-[#64748b]"
        }`}
        role="tab"
        aria-selected={active === "outfits"}
      >
        <span className="leading-none">
          {/* hanger/tshirt-ish icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 7a2 2 0 1 0-2-2" />
            <path d="M12 7v2l8 4v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4l8-4" />
          </svg>
        </span>
        <span>Outfits</span>
      </Link>

      {/* Sign out */}
      <button
        onClick={signOutNow}
        className="grid place-items-center gap-1 py-2 text-[11px] text-[#64748b]"
      >
        <span className="leading-none">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </span>
        <span>Sign out</span>
      </button>
    </nav>
  );
}