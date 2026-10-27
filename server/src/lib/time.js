// All booking times are wall-clock times in a single campus timezone,
// so the server (which runs in UTC on Render) must convert explicitly.
export const SLOT_MINUTES = 30;
export const MAX_BOOKING_MINUTES = 120;
export const MAX_DAYS_AHEAD = 14;
export const MAX_ACTIVE_BOOKINGS = 3;

export const timezone = () => process.env.APP_TIMEZONE || 'Asia/Kolkata';

/** Current date (YYYY-MM-DD) and minute-of-day in the app timezone. */
export function nowInZone(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone(),
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const isValidDate = (s) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

/** "09:30" -> 570 */
export function parseTime(s) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export const formatTime = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Slot indexes (30-min blocks from midnight) covered by [start, end). */
export function slotsFor(start, end) {
  const out = [];
  for (let m = start; m < end; m += SLOT_MINUTES) out.push(m / SLOT_MINUTES);
  return out;
}
