export function fmtRange(start?: string|null, end?: string|null) {
  if (!start && !end) return "";
  if (start && !end) return start;
  if (!start && end) return end!;
  return start === end ? start! : `${start} – ${end}`;
}