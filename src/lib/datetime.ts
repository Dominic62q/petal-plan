// Date/time formatting shared across screens. All dates are YYYY-MM-DD
// strings (Firestore stores them as plain text for simple range queries).

export function todayIso(): string {
  const now = new Date();
  return toIso(now);
}

export function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIso(value: string): Date {
  // T00:00:00 keeps the calendar day stable across time zones.
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function daysUntil(isoDate: string): number {
  const target = parseIso(isoDate).getTime();
  const today = parseIso(todayIso()).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function formatDayMonth(isoDate: string): string {
  return parseIso(isoDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function formatLongDate(isoDate: string): string {
  return parseIso(isoDate).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "42 days remaining" / "Today" / "3 days ago" — human countdown. */
export function formatCountdown(isoDate: string): string {
  const diff = daysUntil(isoDate);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1) return `In ${diff} days`;
  return `${Math.abs(diff)} days ago`;
}

/** Greeting bucketed by hour — morning, afternoon, evening. */
export function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function formatTime(hhmm: string): string {
  const [hourRaw, minute] = hhmm.split(":");
  const hour = Number(hourRaw);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${suffix}`;
}

/** Monday-based start of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const weekday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - weekday);
  return result;
}
