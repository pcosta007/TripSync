// lib/dates.ts
export function toISO(d: Date) {
  // local date → YYYY-MM-DD
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

export function* eachDayISO(startISO: string, endISO: string) {
  const [y1, m1, d1] = startISO.split("-").map(Number);
  const [y2, m2, d2] = endISO.split("-").map(Number);
  const cur = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  while (cur <= end) {
    yield toISO(cur);
    cur.setDate(cur.getDate() + 1);
  }
}

export function prettyRange(startISO?: string | null, endISO?: string | null) {
  if (!startISO) return "";
  if (!endISO || startISO === endISO) return nice(startISO);
  const a = new Date(startISO);
  const b = new Date(endISO);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (sameMonth) {
    return `${shortMonth(a)} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}`;
  }
  return `${nice(startISO)} – ${nice(endISO)}`;
}

function nice(iso: string) {
  const d = new Date(iso);
  return `${shortMonth(d)} ${d.getDate()}, ${d.getFullYear()}`;
}
function shortMonth(d: Date) {
  return d.toLocaleString(undefined, { month: "short" });
}