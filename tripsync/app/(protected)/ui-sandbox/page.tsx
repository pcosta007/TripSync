"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";

// ✅ Import shared UI from app/components/
import HeaderFitlist from "@/app/components/HeaderFitlist";
import BottomNavFitlist from "@/app/components/BottomNavFitlist";

const MOCK = {
  name: "Mallorca Friends",
  dateRange: "Sept 28th to Oct 5th",
  photos: ["/mock/a.jpg", "/mock/b.jpg", "/mock/c.jpg"],
  friends: 5,
  activities: 18,
  days: [
    { id: "2025-09-28", title: "Sep 28", when: "Sunday", count: 4 },
    { id: "2025-09-29", title: "Sep 29", when: "Monday", count: 3 },
    { id: "2025-09-30", title: "Sep 30", when: "Tuesday", count: 5 },
  ],
};

export default function UISandbox() {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [openDayId, setOpenDayId] = useState<string | null>(null);
const toggleDay = (id: string) => setOpenDayId(cur => (cur === id ? null : id));

function to12h(t?: string | null) {
  if (!t) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return t;
  let h = +m[1];
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

  const prev = () =>
    setPhotoIdx((i) => (i - 1 + MOCK.photos.length) % MOCK.photos.length);
  const next = () => setPhotoIdx((i) => (i + 1) % MOCK.photos.length);

  return (
    <div className="iphone-wrap">
      <HeaderFitlist subtitle="UI Sandbox" />

      <main className="content">
        {/* Title + date (centered) */}
        <section className="section title-card">
          <div className="title">{MOCK.name}</div>
          <div className="sub">{MOCK.dateRange}</div>
        </section>

        {/* Image carousel – white bg, thin gray border, rounded, inner gap */}
        <section className="section hero-card">
          <div className="hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MOCK.photos[photoIdx]} alt="" />
            {MOCK.photos.length > 1 && (
              <>
                <button className="nav prev" onClick={prev} aria-label="Previous">
                  ‹
                </button>
                <button className="nav next" onClick={next} aria-label="Next">
                  ›
                </button>
              </>
            )}
            {MOCK.photos.length > 1 && (
              <div className="dots">
                {MOCK.photos.map((_, i) => (
                  <span
                    key={i}
                    className={"dot" + (i === photoIdx ? " active" : "")}
                    onClick={() => setPhotoIdx(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    role="button"
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Summary row */}
        <section className="summary-row">
          <div className="stat">
            <div className="num">{MOCK.friends}</div>
            <div className="lbl">Friends</div>
          </div>
          <div className="stat">
            <div className="num">{MOCK.activities}</div>
            <div className="lbl">Activities</div>
          </div>
          <div className="stat">
            <div className="num">{MOCK.days.length}</div>
            <div className="lbl">Days</div>
          </div>
        </section>

        {/* Action pills exactly like /events toolbar */}
        <div className="pills-row bare">
  <button className="pill sm" onClick={()=>alert("+ Photos")}>+ Photos</button>
  <button className="pill sm" onClick={()=>alert("Invite link created")}>+ Invite</button>
</div>

    {/* Days list – EXACT same visual as /events “card” */}
<section className="list">
  {MOCK.days.map((d) => (
    <div
      key={d.id}
      className={"card day-row" + (openDayId === d.id ? " expand" : "")}
      onClick={() => toggleDay(d.id)}
      role="button"
      aria-expanded={openDayId === d.id}
    >
      <div className="meta">
        <div className="title">{d.title}</div>
        <div className="sub">
          {new Date(d.id).toLocaleDateString("en-US", { weekday: "long" })}
        </div>
      </div>

      <div className="count" aria-label={`${d.count} activities`}>
        {d.count} {d.count === 1 ? "activity" : "activities"}
      </div>

      {openDayId === d.id && (
        <div className="expand-body">
          <div className="activity">
            <span className="name">Breakfast at Hotel</span>
            <span className="time">{to12h("09:00")}</span>
          </div>
          <div className="activity">
            <span className="name">Beach – Cala d'Or</span>
            <span className="time">{to12h("11:00")}</span>
          </div>
          <div className="activity">
            <span className="name">Dinner: Ocre</span>
            <span className="time">{to12h("20:30")}</span>
          </div>
        </div>
      )}
    </div>
  ))}
</section>
      </main>

      {/* Global bottom nav */}
      <BottomNavFitlist
        active="overview"
        eventId="demo-event"
        onPlus={() => alert("Add Day / Activity sheet")}
        onSignOut={() => auth.signOut()}
      />

      <style jsx>{`
        .iphone-wrap {
          --bg: #fafafa;
          --card: #fff;
          --ink: #0f172a;
          --muted: #64748b;
          --accent: #264864;
          --line: #e2e8f0;
          background: var(--bg);
          color: var(--ink);
          min-height: 100dvh;
          /* room for bottom nav */
          padding-bottom: calc(28px + 72px + env(safe-area-inset-bottom));
        }
        .content {
          max-width: 402px;
          margin: 0 auto;
          padding: 10px;
        }

        /* Default card section (adds separators) */
        .section {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 12px;
          margin: 8px 0;
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.03);
        }

        /* Title card */
        .title-card {
          text-align: center;
        }
        .title-card .title {
          font-weight: 700;
          font-size: 16px;
        }
        .title-card .sub {
          color: var(--muted);
          font-size: 12px;
          margin-top: 4px;
        }

        /* Carousel card (white bg, thin gray border around image, rounded, small inner gap) */
        .hero-card {
          padding: 10px;
        }
        .hero {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 10;
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
        }
        .hero img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          backface-visibility: hidden;
          transform: translateZ(0);
        }
        .hero .nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: #fff;
          border: 1px solid var(--line);
          padding: 6px 8px;
          border-radius: 10px;
          cursor: pointer;
        }
        .hero .prev {
          left: 6px;
        }
        .hero .next {
          right: 6px;
        }
        .dots {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 6px;
          display: flex;
          gap: 6px;
          justify-content: center;
        }
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #cbd5e1;
          cursor: pointer;
        }
        .dot.active {
          background: var(--accent);
        }

        /* Summary row: three mini-cards (like spaced stats) */
        .summary-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin: 8px 0;
        }
        .stat {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 10px;
          text-align: center;
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.03);
        }
        .stat .num {
          font-weight: 700;
          font-size: 18px;
        }
        .stat .lbl {
          color: var(--muted);
          font-size: 12px;
        }

        /* Pills like /events toolbar (“+ Trip” / “+ Event”) */
        .pills-row {
          display: flex;
          gap: 8px;
        }
        .pill {
          border: 1px solid var(--accent);
          color: var(--accent);
          background: #fff;
          border-radius: 999px;
          padding: 8px 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .pill.sm { padding: 6px 10px; font-size: 14px; }

        .pills-row.bare{
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin: 8px 0;
        }

        /* EXACT same card list as /events (used for Days) */
        .list {
          display: grid;
          gap: 10px;
          margin: 8px 0;
        }
        .card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 10px;
          text-decoration: none;
          color: inherit;
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.03);
        }
        .card.day-row {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 10px;
        }
        .meta {
          display: grid;
          gap: 4px;
          align-content: center;
        }
        .meta .title {
          font-weight: 700;
        }
        .meta .sub {
          color: var(--muted);
          font-size: 12px, text-align: right;
        }
        .day-row.expand {
          background: #f8fafc;
        }
        .card.day-row .expand-body {
          grid-column: 1 / -1;
          margin-top: 8px;
          border-top: 1px solid var(--line);
          padding-top: 8px;
        }
        .expand-body .activity {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          padding: 6px 0;
          font-size: 14px;
        }
        .activity .time {
          color: var(--muted);
          width: 64px;
          text-align: right;
        }
        .expand-body .activity .name {
          min-width: 64px;
          text-align: left;
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}