export const MANILA_TZ = "Asia/Manila";

export function formatManilaDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function parseManilaDateTimeInput(value: string) {
  // Accept ISO or "YYYY-MM-DDTHH:mm" interpreted as Asia/Manila wall time.
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Date/time is required");
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) throw new Error("Invalid date/time");
    return parsed;
  }
  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) throw new Error("Invalid date/time");
    return parsed;
  }
  const [, y, m, d, hh, mm, ss = "00"] = match;
  // Convert Manila wall clock to UTC using a fixed +08:00 offset (PH has no DST).
  const utc = Date.UTC(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh) - 8,
    Number(mm),
    Number(ss),
  );
  return new Date(utc);
}

export function defaultAppointmentEnd(startsAt: Date, durationMinutes = 60) {
  return new Date(startsAt.getTime() + durationMinutes * 60_000);
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}
