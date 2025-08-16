"use client";

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Home, X, Shirt, Calendar as LCalendar, BarChart3, SquarePlus, ArrowLeft, Clock } from "lucide-react";

export default function BottomNavFitlist({
  active = "home",
  onPlus,
  onOverview,
  onOutfits,
  onItinerary,
  // NEW:
  days = [],
  onCreateDay,
  onCreateActivity,
}: {
  active?: "home" | "overview" | "add" | "itinerary" | "outfits";
  onPlus?: () => void;
  onOverview?: () => void;
  onOutfits?: () => void;
  onItinerary?: () => void;
  // NEW:
  days?: string[];
  onCreateDay?: (dateISO: string) => void | Promise<void>;
  onCreateActivity?: (payload: {
    dayId: string;
    title: string;
    kind: string;
    time12: string;
    desc: string;
  }) => void | Promise<void>;
}) {
  const r = useRouter();
  const [mounted, setMounted] = useState(false);
  const [showAddPopup, setShowAddPopup] = useState(false);
  // step machine for the popup
  type AddStep = "menu" | "day" | "activity";
  const [addStep, setAddStep] = useState<AddStep>("menu");

  // form state
  const [dayDate, setDayDate] = useState("");

  // activity form
  const [actDayId, setActDayId] = useState("");
  const [actTitle, setActTitle] = useState("");
  const [actKind, setActKind] = useState("activity");
  const [actTime12, setActTime12] = useState("");
  const [actDesc, setActDesc] = useState("");

  useEffect(() => {
    setMounted(true);
    console.log("[BottomNav] mounted");
  }, []);

  const toggleAdd = () => {
    setShowAddPopup((p) => {
      const next = !p;
      console.log("[BottomNav] toggleAdd ->", next);
      if (next) setAddStep("menu");
      return next;
    });
    onPlus?.();
  };

  const handleBackToMenu = () => {
    setAddStep("menu");
  };

  const popup = (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {showAddPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              zIndex: 40
            }}
            onClick={() => {
              setShowAddPopup(false);
              setAddStep("menu");
            }}
          />
        )}
      </AnimatePresence>

      {/* Add Options Popup */}
      <AnimatePresence>
        {showAddPopup && addStep === "menu" && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed',
              bottom: '6rem',
              left: '1rem',
              right: '1rem',
              backgroundColor: 'white',
              borderRadius: '1rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #f3f4f6',
              zIndex: 50,
              overflow: 'hidden'
            }}
          >
              <div style={{ padding: '1.5rem' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                marginBottom: '1.5rem' 
              }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '500' }}>Quick Add</h3>
                <button
                  onClick={() => {
                    setShowAddPopup(false);
                    setAddStep("menu");
                  }}
                  style={{
                    padding: '0.25rem',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                {/* Add Day */}
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0 }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={() => setAddStep("day")}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{
                    backgroundColor: '#3b82f6',
                    padding: '0.75rem',
                    borderRadius: '50%',
                    color: 'white',
                    transition: 'transform 0.2s'
                  }}>
                    <LCalendar className="h-6 w-6" />
                  </div>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Add Day</span>
                </motion.button>

                {/* Add Activity */}
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={() => setAddStep("activity")}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{
                    backgroundColor: '#10b981',
                    padding: '0.75rem',
                    borderRadius: '50%',
                    color: 'white',
                    transition: 'transform 0.2s'
                  }}>
                    <SquarePlus className="h-6 w-6" />
                  </div>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>Add Activity</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Day Form */}
      <AnimatePresence>
        {showAddPopup && addStep === "day" && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed',
              bottom: '6rem',
              left: '1rem',
              right: '1rem',
              backgroundColor: 'white',
              borderRadius: '1rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #f3f4f6',
              zIndex: 50,
              overflow: 'hidden',
              maxHeight: '70vh',
              overflowY: 'auto'
            }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleBackToMenu}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 text-gray-500" />
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <LCalendar className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="text-lg font-medium">Add Day</h3>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAddPopup(false);
                    setAddStep("menu");
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!dayDate) return alert("Pick a date.");
                  try {
                    if (onCreateDay) {
                      await onCreateDay(dayDate);
                    } else {
                      console.log("[BottomNav] onCreateDay (no handler):", dayDate);
                    }
                    setDayDate("");
                    setShowAddPopup(false);
                    setAddStep("menu");
                  } catch (e) {
                    console.error(e);
                    alert("Could not create day.");
                  }
                }}
                className="space-y-5"
              >
                {/* Date */}
                <div className="space-y-2">
                  <Label htmlFor="day-date">Date</Label>
                  <Input
                    id="day-date"
                    type="date"
                    value={dayDate}
                    onChange={(e) => setDayDate(e.target.value)}
                    className="h-12"
                    required
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    onClick={handleBackToMenu}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    className="flex-1 bg-blue-500 hover:bg-blue-600"
                  >
                    Add Day
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activity Form - Matching New Trip Form Design */}
      <AnimatePresence>
        {showAddPopup && addStep === "activity" && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed',
              bottom: '6rem',
              left: '1rem',
              right: '1rem',
              backgroundColor: 'white',
              borderRadius: '1rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #f3f4f6',
              zIndex: 50,
              overflow: 'hidden',
              maxHeight: '70vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ padding: '1rem' }}>
              {/* Header - matching New Trip form exactly */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                marginBottom: '0.75rem' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    onClick={handleBackToMenu}
                    style={{
                      padding: '0.25rem',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <ArrowLeft style={{ height: '18px', width: '18px', color: '#6b7280' }} />
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      backgroundColor: '#10b981',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <SquarePlus style={{ height: '14px', width: '14px', color: 'white' }} />
                    </div>
                    <h3 style={{ fontSize: '1.0625rem', fontWeight: '500', margin: 0 }}>Add Activity</h3>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAddPopup(false);
                    setAddStep("menu");
                  }}
                  style={{
                    padding: '0.25rem',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <X style={{ height: '18px', width: '18px', color: '#6b7280' }} />
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!actDayId) return alert("Choose a day.");
                  if (!actTitle.trim()) return alert("Enter an activity name.");

                  try {
                    if (onCreateActivity) {
                      await onCreateActivity({
                        dayId: actDayId,
                        title: actTitle.trim(),
                        kind: actKind,
                        time12: actTime12.trim(),
                        desc: actDesc.trim(),
                      });
                    } else {
                      console.log("[BottomNav] onCreateActivity (no handler):", {
                        dayId: actDayId,
                        title: actTitle,
                        kind: actKind,
                        time12: actTime12,
                        desc: actDesc,
                      });
                    }
                    // reset + close
                    setActDayId("");
                    setActTitle("");
                    setActKind("activity");
                    setActTime12("");
                    setActDesc("");
                    setShowAddPopup(false);
                    setAddStep("menu");
                  } catch (e) {
                    console.error(e);
                    alert("Could not create activity.");
                  }
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
              >
                {/* Day selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <Label htmlFor="activity-day" style={{ fontSize: '12px', lineHeight: 1.25 }} >Day</Label>
                  <select
                    id="activity-day"
                    value={actDayId}
                    onChange={(e) => setActDayId(e.target.value)}
                    style={{
                      width: '100%',
                      height: 'clamp(40px, 5.2vh, 44px',
                      borderRadius: '0.5rem',
                      border: '1px solid #d1d5db',
                      backgroundColor: 'white',
                      padding: '0 0.75rem',
                      fontSize: 'clamp(12px, 1.6vh, 13px)',
                      outline: 'none'
                    }}
                    required
                  >
                    <option value="">Select a day…</option>
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {new Date(d + "T00:00:00").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          weekday: "short",
                        })}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Activity name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <Label htmlFor="activity-name" style={{ fontSize: '12px', lineHeight: 1.25 }}>Activity Name</Label>
                  <Input
                    id="activity-name"
                    type="text"
                    value={actTitle}
                    onChange={(e) => setActTitle(e.target.value)}
                    placeholder="Enter activity name..."
                    style={{
                      height: 'clamp(40px, 5.2vh, 44px)',
                      borderRadius: '0.5rem',
                      border: '1px solid #d1d5db',
                      padding: '0 0.75rem',
                      fontSize: 'clamp(12px, 1.6vh, 13px)'
                    }}
                    required
                  />
                </div>

                {/* Type selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <Label htmlFor="activity-type" style={{ fontSize: '12px', lineHeight: 1.25 }}>Type</Label>
                  <select
                    id="activity-type"
                    value={actKind}
                    onChange={(e) => setActKind(e.target.value)}
                    style={{
                      width: '100%',
                      height: 'clamp(40px, 5.2vh, 44px)',
                      borderRadius: '0.5rem',
                      border: '1px solid #d1d5db',
                      backgroundColor: 'white',
                      padding: '0 0.75rem',
                      fontSize: 'clamp(12px, 1.6vh, 13px)',
                      outline: 'none'
                    }}
                  >
                    <option value="meal">Meal</option>
                    <option value="travel">Travel</option>
                    <option value="activity">Activity</option>
                  </select>
                </div>

                {/* Time */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <Label htmlFor="activity-time" style={{ fontSize: '12px', lineHeight: 1.25 }}>Time</Label>
                  <div style={{ position: 'relative' }}>
                    <Input
                      id="activity-time"
                      type="time"
                      value={actTime12}
                      onChange={(e) => setActTime12(e.target.value)}
                      step={60}
                      style={{
                        height: 'clamp(40px, 5.2vh, 44px)',
                        borderRadius: '0.5rem',
                        border: '1px solid #d1d5db',
                        padding: '0 2.25rem 0 0.75rem',
                        fontSize: 'clamp(12px, 1.6vh, 13px)',
                        width: '100%'
                      }}
                      required
                    />
                    <Clock style={{ 
                      position: 'absolute', 
                      right: '0.75rem', 
                      top: '50%', 
                      transform: 'translateY(-50%)',
                      height: '18px',
                      width: '18px',
                      color: '#9ca3af'
                    }} />
                  </div>
                </div>

                {/* Description */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <Label htmlFor="activity-description" style={{ fontSize: '12px', lineHeight: 1.25 }}>Description</Label>
                  <Textarea
                    id="activity-description"
                    value={actDesc}
                    onChange={(e) => setActDesc(e.target.value)}
                    placeholder="Brief description of the activity..."
                    rows={2}
                    style={{
                      minHeight: '60px',
                      borderRadius: '0.5rem',
                      border: '1px solid #d1d5db',
                      padding: '0.5rem 0.75rem',
                      fontSize: 'clamp(12px, 1.6vh, 13px)',
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* Submit Buttons */}
                <div  style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.75rem' }}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    onClick={handleBackToMenu}
                    style={{
                      flex: 1,
                      height: 'clamp(40px, 5.2vh, 44px',
                      borderRadius: '0.5rem',
                      fontSize: 'clamp(12px, 1.6vh, 13px',
                      fontWeight: '500',
                      border: 'none',

                    }}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    style={{
                      flex: 1,
                      height: 'clamp(40px, 5.2vh, 44px)',
                      borderRadius: '0.5rem',
                      fontSize: 'clamp(12px, 1.6vh, 13px)',
                      fontWeight: '500',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                  >
                    Add Activity
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  return (
    <>
      {/* Portal – logs when it renders */}
      {mounted ? (console.log("[BottomNav] rendering portal", showAddPopup ? 1 : 0), createPortal(popup, document.body)) : null}

      <nav id="ts-fitlist-nav" className="bn" role="tablist" aria-label="Primary">
        {/* Home */}
        <button
          className={`nav-btn ${active === "home" ? "active" : ""}`}
          role="tab"
          aria-selected={active === "home"}
          onClick={() => r.push("/events")}
        >
          <span className="icon" aria-hidden="true"><Home size={22} strokeWidth={2} /></span>
          <span className="label">Home</span>
        </button>

        {/* Overview */}
        <button
          className={`nav-btn ${active === "overview" ? "active" : ""}`}
          role="tab"
          aria-selected={active === "overview"}
          onClick={onOverview || (() => {})}
        >
          <span className="icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>
            </svg>
          </span>
          <span className="label">Overview</span>
        </button>

        {/* Add */}
        <button
          className={`nav-btn ${showAddPopup || active === "add" ? "active" : ""}`}
          role="tab"
          aria-selected={active === "add"}
          onClick={toggleAdd}
          style={active === "add" ? { color: "#264864", fontWeight: 700 } : {}}
        >
          <span className="icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>
            </svg>
          </span>
          <span className="label">Add</span>
        </button>

        {/* Itinerary */}
        <button
          className={`nav-btn ${active === "itinerary" ? "active" : ""}`}
          role="tab"
          aria-selected={active === "itinerary"}
          onClick={onItinerary || (() => {})}
        >
          <span className="icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="6" cy="19" r="3"/>
              <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>
              <circle cx="18" cy="5" r="3"/>
            </svg>
          </span>
          <span className="label">Itinerary</span>
        </button>

        {/* Outfits */}
        <button
          className={`nav-btn ${active === "outfits" ? "active" : ""}`}
          role="tab"
          aria-selected={active === "outfits"}
          onClick={onOutfits || (() => {})}
        >
          <span className="icon" aria-hidden="true"><Shirt size={22} strokeWidth={2} /></span>
          <span className="label">Outfits</span>
        </button>

        <style jsx>{`
          .bn{
            position: fixed; left:0; right:0; bottom:0;
            background:#fff; border-top:1px solid var(--line);
            display:grid; grid-template-columns: repeat(5,1fr);
            padding: 4px 0 calc(4px + env(safe-area-inset-bottom));
            z-index: 30;
          }
          .nav-btn{
            appearance:none; background:transparent; border:0;
            padding: 6px 0; display:grid; justify-items:center; gap:4px;
            font-size:11px; color:#64748b; cursor:pointer;
          }
          .nav-btn .icon{ line-height:0; }
          .nav-btn.active{ color:#264864; font-weight:700; }
        `}</style>
      </nav>
    </>
  );
}