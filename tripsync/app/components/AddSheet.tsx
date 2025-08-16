// components/AddSheet.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { addActivity, createDay, listDayIds, getEvent } from "@/lib/events";

type Props = {
  open: boolean;
  onClose: () => void;
  eventId: string;
};

export default function AddSheet({ open, onClose, eventId }: Props) {
  const [mode, setMode] = useState<"day" | "activity">("activity");
  const [days, setDays] = useState<string[]>([]);
  const [evtType, setEvtType] = useState<"event" | "trip">("event");

  // fields
  const [dayId, setDayId] = useState("");
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [kind, setKind] = useState<"travel" | "hotel" | "activity" | "breakfast" | "lunch" | "dinner">("activity");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const evt = await getEvent(eventId);
        setEvtType(evt.type);
        if (evt.type === "trip") {
          const d = await listDayIds(eventId);
          setDays(d);
          if (!dayId && d[0]) setDayId(d[0]);
        } else {
          // single-day: use startDate
          const only = evt.startDate || "";
          setDays(only ? [only] : []);
          if (only) setDayId(only);
        }
      } catch (e: any) {
        console.error(e);
      }
    })();
  }, [open, eventId]); // eslint-disable-line

  const canSave = useMemo(() => {
    if (mode === "day") return !!dayId;
    // activity minimal fields
    return !!title && (!!dayId || evtType === "event");
  }, [mode, title, dayId, evtType]);

  async function handleSave() {
    try {
      setSaving(true);
      setErr(null);

      if (mode === "day") {
        await createDay(eventId, dayId);
      } else {
        await addActivity(eventId, {
          title,
          time: time || null,
          kind,
          dayId: evtType === "trip" ? dayId : (dayId || null),
        });
      }

      onClose();
      // Reset
      setTitle("");
      setTime("");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60]"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* sheet */}
      <div
        className="absolute left-0 right-0 bottom-0 rounded-t-2xl border border-t-[#e2e8f0] bg-white p-4"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Add to this {evtType === "trip" ? "trip" : "event"}</div>
          <button
            onClick={onClose}
            className="border border-[#e2e8f0] rounded-lg px-2 py-1 text-sm"
          >
            Close
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            className={`px-3 py-2 rounded-lg border text-sm ${mode==="activity" ? "border-[#264864] text-[#264864] font-semibold" : "border-[#e2e8f0]"}`}
            onClick={() => setMode("activity")}
          >
            Activity
          </button>
          <button
            className={`px-3 py-2 rounded-lg border text-sm ${mode==="day" ? "border-[#264864] text-[#264864] font-semibold" : "border-[#e2e8f0]"}`}
            onClick={() => setMode("day")}
          >
            Day
          </button>
        </div>

        {/* Form */}
        <div className="mt-3 grid gap-3">
          {/* Day picker – always visible so Activity can pick a day */}
          <label className="grid gap-1">
            <span className="text-xs text-[#64748b]">
              {evtType === "trip" ? "Day" : "Date"}
            </span>
            {evtType === "trip" ? (
              <select
                value={dayId}
                onChange={(e) => setDayId(e.target.value)}
                className="border border-[#e2e8f0] rounded-lg px-2 py-2 text-sm"
              >
                {days.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            ) : (
              <input
                type="date"
                value={dayId}
                onChange={(e) => setDayId(e.target.value)}
                className="border border-[#e2e8f0] rounded-lg px-2 py-2 text-sm"
              />
            )}
          </label>

          {mode === "activity" ? (
            <>
              <label className="grid gap-1">
                <span className="text-xs text-[#64748b]">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Dinner at Manique"
                  className="border border-[#e2e8f0] rounded-lg px-2 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-[#64748b]">Time</span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="border border-[#e2e8f0] rounded-lg px-2 py-2 text-sm"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-[#64748b]">Kind</span>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as any)}
                  className="border border-[#e2e8f0] rounded-lg px-2 py-2 text-sm"
                >
                  <option value="activity">Activity</option>
                  <option value="travel">Travel</option>
                  <option value="hotel">Hotel</option>
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                </select>
              </label>
            </>
          ) : (
            <p className="text-xs text-[#64748b]">
              Pick a date above to create a day record.
            </p>
          )}

          {err && <div className="text-xs text-red-600">{err}</div>}

          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : mode === "day" ? "Add day" : "Add activity"}
          </button>
        </div>
      </div>
    </div>
  );
}