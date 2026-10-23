import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({
  addCustomCategory: vi.fn(),
  createEvent: vi.fn(),
  createScheduleEntry: vi.fn(),
  createStandaloneTask: vi.fn(),
  createTask: vi.fn(),
  deleteEvent: vi.fn(),
  deleteStandaloneTask: vi.fn(),
  deleteTask: vi.fn(),
  getUserProfile: vi.fn(),
  listEvents: vi.fn(),
  listSchedule: vi.fn(),
  listStandaloneTasks: vi.fn(),
  listTasks: vi.fn(),
  setStandaloneTaskDone: vi.fn(),
  setTaskDone: vi.fn(),
  updateEvent: vi.fn(),
  updateScheduleEntry: vi.fn(),
}));

vi.mock("@/lib/data", () => ({ ...data, BUILT_IN_CATEGORIES: ["wedding"] }));

import { createToolRunner, describeAction } from "@/lib/assistant/tools";

const event = { id: "ev1", title: "Spring gala", date: "2026-05-01", time: "18:00", status: "planning" };
const task = { id: "t1", eventId: "ev1", title: "Book the band", group: "Music", priority: "high", dueDate: "2026-04-01", done: false };

beforeEach(() => {
  vi.resetAllMocks();
  data.listEvents.mockResolvedValue([event]);
  data.listTasks.mockResolvedValue([task]);
  data.listStandaloneTasks.mockResolvedValue([
    { id: "p1", title: "Renew passport", dueDate: "2026-04-02", priority: "low", done: false },
  ]);
  data.listSchedule.mockResolvedValue([
    { id: "s1", eventId: "ev1", title: "Soundcheck", kind: "slot", date: "2026-05-01", startAt: "15:00", endAt: "16:00", location: "Hall" },
  ]);
});

const runner = (confirm?: (message: string) => Promise<boolean>) =>
  createToolRunner({ uid: "u1", queryClient: new QueryClient(), confirm });

describe("assistant tools", () => {
  it("deletes only after the user approves, and says what it deleted", async () => {
    const confirm = vi.fn().mockResolvedValue(true);
    const result = await runner(confirm).run("delete_task", { taskId: "t1", eventId: "ev1" });
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Book the band"));
    expect(data.deleteTask).toHaveBeenCalledWith("ev1", "t1");
    expect(describeAction(result)).toBe("Deleted “Book the band”");
  });

  it("deletes nothing when the user declines", async () => {
    const result = await runner(vi.fn().mockResolvedValue(false)).run("delete_task", { taskId: "p1", eventId: "personal" });
    expect(data.deleteStandaloneTask).not.toHaveBeenCalled();
    expect(data.deleteTask).not.toHaveBeenCalled();
    expect(describeAction(result)).toBeNull();
  });

  it("refuses to delete when there is nobody to ask", async () => {
    await expect(runner().run("delete_task", { taskId: "t1", eventId: "ev1" })).rejects.toThrow();
    expect(data.deleteTask).not.toHaveBeenCalled();
  });

  it("deletes personal tasks through the personal path", async () => {
    await runner(vi.fn().mockResolvedValue(true)).run("delete_task", { taskId: "p1", eventId: "personal" });
    expect(data.deleteStandaloneTask).toHaveBeenCalledWith("u1", "p1");
  });

  it("validates before it writes", async () => {
    const tools = runner();
    await expect(tools.run("create_event", { title: "Party", date: "tomorrow", time: "18:00" })).rejects.toThrow(/date/);
    await expect(tools.run("create_task", { title: "x", dueDate: "2026-04-01", reminderMinutes: 10 })).rejects.toThrow(/time/);
    await expect(
      tools.run("create_schedule_entry", { eventId: "ev1", title: "x", kind: "slot", date: "2026-05-01", startAt: "16:00", endAt: "15:00" }),
    ).rejects.toThrow(/after/);
    await expect(tools.run("create_schedule_entry", { eventId: "nope", title: "x", kind: "slot", date: "2026-05-01", startAt: "10:00", endAt: "11:00" })).rejects.toThrow(
      /No event/,
    );
    expect(data.createEvent).not.toHaveBeenCalled();
    expect(data.createTask).not.toHaveBeenCalled();
    expect(data.createScheduleEntry).not.toHaveBeenCalled();
  });

  it("creates an event, with a reminder, for the signed-in user", async () => {
    data.createEvent.mockResolvedValue("ev2");
    const result = await runner().run("create_event", { title: "Dinner", date: "2026-06-01", time: "19:30", reminderMinutes: 60 });
    expect(data.createEvent).toHaveBeenCalledWith("u1", expect.objectContaining({ title: "Dinner", reminderOffsetMinutes: 60, status: "planning" }));
    expect(describeAction(result)).toBe("Created event “Dinner”");
  });

  it("changes only the given fields of a schedule entry", async () => {
    await runner().run("update_schedule_entry", { eventId: "ev1", entryId: "s1", endAt: "16:30" });
    expect(data.updateScheduleEntry).toHaveBeenCalledWith("ev1", "s1", {
      title: "Soundcheck",
      kind: "slot",
      date: "2026-05-01",
      startAt: "15:00",
      endAt: "16:30",
      location: "Hall",
    });
  });

  it("changes only the given fields of an event", async () => {
    const result = await runner().run("update_event", { eventId: "ev1", date: "2026-05-08", status: "confirmed" });
    expect(data.updateEvent).toHaveBeenCalledWith("ev1", { date: "2026-05-08", status: "confirmed" });
    expect(describeAction(result)).toBe("Updated “Spring gala”");
  });

  it("clears an event's reminder, and rejects an empty or invalid change", async () => {
    await runner().run("update_event", { eventId: "ev1", clearReminder: true });
    expect(data.updateEvent).toHaveBeenCalledWith("ev1", { reminderOffsetMinutes: null });

    data.updateEvent.mockClear();
    const tools = runner();
    await expect(tools.run("update_event", { eventId: "ev1" })).rejects.toThrow(/Nothing to change/);
    await expect(tools.run("update_event", { eventId: "ev1", time: "6pm" })).rejects.toThrow(/time/);
    await expect(tools.run("update_event", { eventId: "ev1", title: "  " })).rejects.toThrow(/title/);
    await expect(tools.run("update_event", { eventId: "nope", title: "x" })).rejects.toThrow(/No event/);
    expect(data.updateEvent).not.toHaveBeenCalled();
  });

  it("deletes an event only after the user approves, naming what goes with it", async () => {
    const confirm = vi.fn().mockResolvedValue(true);
    const result = await runner(confirm).run("delete_event", { eventId: "ev1" });
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/Spring gala.*1 task and 1 schedule entry/));
    expect(data.deleteEvent).toHaveBeenCalledWith("ev1");
    expect(describeAction(result)).toContain("Deleted the event “Spring gala”");
  });

  it("keeps the event when the user declines, or when there is nobody to ask", async () => {
    const declined = await runner(vi.fn().mockResolvedValue(false)).run("delete_event", { eventId: "ev1" });
    expect(describeAction(declined)).toBeNull();
    await expect(runner().run("delete_event", { eventId: "ev1" })).rejects.toThrow();
    expect(data.deleteEvent).not.toHaveBeenCalled();
  });

  it("reads one event with its tasks and schedule", async () => {
    const result = (await runner().run("get_event", { eventId: "ev1" })) as { tasks: unknown[]; schedule: unknown[] };
    expect(result.tasks).toHaveLength(1);
    expect(result.schedule).toHaveLength(1);
  });
});
