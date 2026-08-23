import { describe, expect, it } from "vitest";
import { mergeTaskRows, summarizeTasks } from "../src/lib/task-model";

const event = {
  id: "event-1",
  ownerUid: "user-1",
  title: "Launch party",
  category: "corporate",
  date: "2026-09-01",
  time: "18:00",
  status: "planning" as const,
};

describe("task model", () => {
  it("keeps standalone tasks in the same rows as event tasks", () => {
    const rows = mergeTaskRows(
      [
        {
          event,
          tasks: [
            {
              id: "event-task",
              eventId: event.id,
              title: "Confirm venue",
              group: "Venue",
              priority: "high",
              dueDate: "2026-08-25",
              dueTime: "14:30",
              done: false,
            },
          ],
        },
      ],
      [
        {
          id: "personal-task",
          title: "Buy stamps",
          dueDate: "2026-08-24",
          dueTime: "09:00",
          priority: "low",
          done: false,
        },
      ],
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "event-task",
      dueTime: "14:30",
    });
    expect(rows[1]).toMatchObject({
      id: "personal-task",
      dueTime: "09:00",
      eventId: null,
      eventTitle: "Personal",
      group: "Personal",
    });
  });

  it("includes standalone tasks in open, done, and progress totals", () => {
    const rows = mergeTaskRows([], [
      {
        id: "open-personal",
        title: "Call supplier",
        dueDate: "2026-08-25",
        priority: "medium",
        done: false,
      },
      {
        id: "done-personal",
        title: "Send invoice",
        dueDate: "2026-08-20",
        priority: "low",
        done: true,
      },
    ]);

    expect(summarizeTasks(rows)).toEqual({
      totalTasks: 2,
      totalDone: 1,
      totalOpen: 1,
      progressPercent: 50,
    });
  });

  it("reports zero progress for an empty task list", () => {
    expect(summarizeTasks([])).toEqual({
      totalTasks: 0,
      totalDone: 0,
      totalOpen: 0,
      progressPercent: 0,
    });
  });
});
