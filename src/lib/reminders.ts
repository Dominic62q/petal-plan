export const REMINDER_OPTIONS = [
  { value: "", label: "No reminder" },
  { value: "0", label: "At time" },
  { value: "10", label: "10 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
] as const;

export type ReminderOptionValue = (typeof REMINDER_OPTIONS)[number]["value"];

export function parseReminderOffset(value: ReminderOptionValue): number | undefined {
  if (value === "") return undefined;
  return Number(value);
}

export function reminderOptionFromOffset(offset: number | undefined): ReminderOptionValue {
  return REMINDER_OPTIONS.some((option) => option.value === String(offset))
    ? String(offset) as ReminderOptionValue
    : "";
}

export function currentTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
