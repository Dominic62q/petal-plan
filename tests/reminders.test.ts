import { describe, expect, it } from "vitest";
import { parseReminderOffset, reminderOptionFromOffset } from "../src/lib/reminders";

describe("reminder options", () => {
  it("keeps no-reminder distinct from an at-time reminder", () => {
    expect(parseReminderOffset("")).toBeUndefined();
    expect(parseReminderOffset("0")).toBe(0);
  });

  it("maps supported stored offsets back to form values", () => {
    expect(reminderOptionFromOffset(60)).toBe("60");
    expect(reminderOptionFromOffset(15)).toBe("");
  });
});
