import type { QueryClient } from "@tanstack/react-query";
import {
  addCustomCategory,
  BUILT_IN_CATEGORIES,
  createEvent,
  createScheduleEntry,
  createStandaloneTask,
  createTask,
  deleteEvent,
  deleteStandaloneTask,
  deleteTask,
  getUserProfile,
  listEvents,
  listSchedule,
  listStandaloneTasks,
  listTasks,
  setStandaloneTaskDone,
  setTaskDone,
  updateEvent,
  updateScheduleEntry,
  type EventChanges,
  type EventTask,
  type PlannerEvent,
  type ScheduleKind,
  type StandaloneTask,
  type TaskPriority,
} from "@/lib/data";
import { todayIso } from "@/lib/datetime";
import { currentTimeZone } from "@/lib/reminders";

/**
 * Tool implementations. They run in the browser as the signed-in user, so
 * Firestore's own rules decide what they can touch, and only what a tool
 * returns ever leaves the device.
 */

const PERSONAL = "personal";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const PRIORITIES: readonly TaskPriority[] = ["high", "medium", "low"];
const KINDS: readonly ScheduleKind[] = ["appointment", "slot"];
const REMINDERS = [0, 10, 60, 1440];

type Pair = { event: PlannerEvent; tasks: EventTask[] };

type TaskRow = {
  id: string;
  title: string;
  eventId: string;
  eventTitle: string | null;
  group: string | null;
  priority: TaskPriority;
  dueDate: string;
  dueTime: string | null;
  done: boolean;
  overdue: boolean;
};

export const TOOL_LABELS: Record<string, string> = {
  get_overview: "Checking your plan",
  get_profile: "Checking your profile",
  list_events: "Looking at your events",
  get_event: "Opening an event",
  list_tasks: "Looking through your tasks",
  list_schedule: "Reading an event schedule",
  create_event: "Creating an event",
  update_event: "Updating an event",
  delete_event: "Waiting for your OK to delete",
  create_task: "Adding a task",
  set_task_done: "Updating a task",
  delete_task: "Waiting for your OK to delete",
  create_schedule_entry: "Adding to the schedule",
  update_schedule_entry: "Updating the schedule",
  add_category: "Adding a category",
};

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function requireDate(value: unknown, field: string): string {
  const text = asString(value);
  if (!DATE.test(text)) throw new Error(`${field} must be a date like 2026-03-14`);
  return text;
}

function optionalDate(value: unknown, field: string): string | undefined {
  return value === undefined || value === null || value === "" ? undefined : requireDate(value, field);
}

function requireTime(value: unknown, field: string): string {
  const text = asString(value);
  if (!TIME.test(text)) throw new Error(`${field} must look like 14:30`);
  return text;
}

/** An optional reminder, in minutes before the time. Needs a time to count from. */
function reminderFrom(value: unknown, hasTime: boolean): { reminderOffsetMinutes: number } | Record<string, never> {
  if (value === undefined || value === null || value === "") return {};
  if (typeof value !== "number" || !REMINDERS.includes(value)) throw new Error("reminderMinutes must be 0, 10, 60 or 1440");
  if (!hasTime) throw new Error("A reminder needs a time");
  return { reminderOffsetMinutes: value };
}

export type ToolRunner = {
  run: (name: string, args: Record<string, unknown>) => Promise<unknown>;
};

export type ConfirmFn = (message: string) => Promise<boolean>;

export function createToolRunner({
  uid,
  queryClient,
  confirm,
}: {
  uid: string;
  queryClient: QueryClient;
  /** Asks the user to approve something destructive. Without it, deletes are refused. */
  confirm?: ConfirmFn;
}): ToolRunner {
  // The same query keys as the Today screen, so the assistant reuses what is
  // already cached and a write there refreshes both.
  const loadPairs = () =>
    queryClient.fetchQuery({
      queryKey: ["all-tasks", uid],
      queryFn: async (): Promise<Pair[]> => {
        const events = await listEvents(uid);
        return Promise.all(events.map(async (event) => ({ event, tasks: await listTasks(event.id) })));
      },
    });
  const loadPersonal = () =>
    queryClient.fetchQuery({ queryKey: ["standalone-tasks", uid], queryFn: () => listStandaloneTasks(uid) });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["all-tasks", uid] }),
      queryClient.invalidateQueries({ queryKey: ["standalone-tasks", uid] }),
      queryClient.invalidateQueries({ queryKey: ["calendar", uid] }),
    ]);

  const rows = async (): Promise<TaskRow[]> => {
    const [pairs, personal] = await Promise.all([loadPairs(), loadPersonal()]);
    const today = todayIso();
    const fromEvents = pairs.flatMap(({ event, tasks }) =>
      tasks.map((task) => ({
        id: task.id,
        title: task.title,
        eventId: event.id,
        eventTitle: event.title,
        group: task.group || null,
        priority: task.priority,
        dueDate: task.dueDate,
        dueTime: task.dueTime ?? null,
        done: task.done,
        overdue: !task.done && task.dueDate < today,
      })),
    );
    const own = personal.map((task: StandaloneTask) => ({
      id: task.id,
      title: task.title,
      eventId: PERSONAL,
      eventTitle: null,
      group: null,
      priority: task.priority,
      dueDate: task.dueDate,
      dueTime: task.dueTime ?? null,
      done: task.done,
      overdue: !task.done && task.dueDate < today,
    }));
    return [...fromEvents, ...own].sort(
      (a, b) => a.dueDate.localeCompare(b.dueDate) || (a.dueTime ?? "").localeCompare(b.dueTime ?? ""),
    );
  };

  const findEvent = async (eventId: string): Promise<Pair> => {
    if (!eventId || eventId === PERSONAL) throw new Error("eventId must be an event id");
    const pair = (await loadPairs()).find(({ event }) => event.id === eventId);
    if (!pair) throw new Error("No event with that id");
    return pair;
  };

  const scheduleRows = async (eventId: string) =>
    (await listSchedule(eventId)).map((entry) => ({
      id: entry.id,
      title: entry.title,
      kind: entry.kind,
      date: entry.date,
      startAt: entry.startAt,
      endAt: entry.endAt,
      location: entry.location || null,
    }));

  const tools: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
    // -- Reading -------------------------------------------------------------
    async get_overview() {
      const [pairs, all] = await Promise.all([loadPairs(), rows()]);
      const today = todayIso();
      const open = all.filter((row) => !row.done);
      return {
        today,
        events: pairs.length,
        upcomingEvents: pairs.filter((pair) => pair.event.date >= today).length,
        openTasks: open.length,
        doneTasks: all.length - open.length,
        dueToday: open.filter((row) => row.dueDate === today).length,
        overdue: open.filter((row) => row.overdue).length,
      };
    },

    async get_profile() {
      const profile = await getUserProfile(uid);
      return {
        name: profile.displayName ?? null,
        categories: [...BUILT_IN_CATEGORIES, ...(profile.categories ?? [])],
      };
    },

    async list_events(args) {
      const from = optionalDate(args.from, "from");
      const to = optionalDate(args.to, "to");
      const pairs = await loadPairs();
      return pairs
        .filter(({ event }) => (!from || event.date >= from) && (!to || event.date <= to))
        .sort((a, b) => a.event.date.localeCompare(b.event.date))
        .map(({ event, tasks }) => ({
          id: event.id,
          title: event.title,
          date: event.date,
          time: event.time || null,
          status: event.status,
          openTasks: tasks.filter((task) => !task.done).length,
          doneTasks: tasks.filter((task) => task.done).length,
        }));
    },

    async get_event(args) {
      const { event, tasks } = await findEvent(asString(args.eventId));
      const today = todayIso();
      return {
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time || null,
        status: event.status,
        reminderMinutes: event.reminderOffsetMinutes ?? null,
        tasks: tasks
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
          .map((task) => ({
            id: task.id,
            title: task.title,
            group: task.group || null,
            priority: task.priority,
            dueDate: task.dueDate,
            dueTime: task.dueTime ?? null,
            done: task.done,
            overdue: !task.done && task.dueDate < today,
          })),
        schedule: await scheduleRows(event.id),
      };
    },

    async list_tasks(args) {
      const status = asString(args.status) || "open";
      const eventId = asString(args.eventId);
      const priority = asString(args.priority);
      const search = asString(args.search).toLowerCase();
      const dueFrom = optionalDate(args.dueFrom, "dueFrom");
      const dueTo = optionalDate(args.dueTo, "dueTo");
      const requested = Number(args.limit);
      const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 60) : 30;

      const matches = (await rows()).filter(
        (row) =>
          (status === "all" || (status === "done" ? row.done : !row.done)) &&
          (!eventId || row.eventId === eventId) &&
          (!priority || row.priority === priority) &&
          (!dueFrom || row.dueDate >= dueFrom) &&
          (!dueTo || row.dueDate <= dueTo) &&
          (!search || `${row.title} ${row.group ?? ""}`.toLowerCase().includes(search)),
      );
      return { total: matches.length, shown: Math.min(matches.length, limit), tasks: matches.slice(0, limit) };
    },

    async list_schedule(args) {
      const { event } = await findEvent(asString(args.eventId));
      return scheduleRows(event.id);
    },

    // -- Changing ------------------------------------------------------------
    async create_event(args) {
      const title = asString(args.title).slice(0, 120);
      if (!title) throw new Error("title is required");
      const date = requireDate(args.date, "date");
      const time = requireTime(args.time, "time");
      const status = asString(args.status) === "confirmed" ? "confirmed" : "planning";
      const id = await createEvent(uid, {
        title,
        date,
        time,
        status,
        timeZone: currentTimeZone(),
        ...reminderFrom(args.reminderMinutes, true),
      });
      await refresh();
      return { ok: true, summary: `Created event “${title}”`, event: { id, title, date, time, status } };
    },

    async update_event(args) {
      const { event } = await findEvent(asString(args.eventId));
      const changes: EventChanges = {};
      if (args.title !== undefined) {
        const title = asString(args.title).slice(0, 120);
        if (!title) throw new Error("title can't be empty");
        changes.title = title;
      }
      if (args.date !== undefined) changes.date = requireDate(args.date, "date");
      if (args.time !== undefined) {
        changes.time = requireTime(args.time, "time");
        changes.timeZone = currentTimeZone();
      }
      if (args.status !== undefined) {
        const status = asString(args.status);
        if (status !== "planning" && status !== "confirmed") throw new Error("status must be planning or confirmed");
        changes.status = status;
      }
      if (args.clearReminder === true) {
        changes.reminderOffsetMinutes = null;
      } else {
        const reminder = reminderFrom(args.reminderMinutes, true);
        if ("reminderOffsetMinutes" in reminder) changes.reminderOffsetMinutes = reminder.reminderOffsetMinutes;
      }
      if (Object.keys(changes).length === 0) throw new Error("Nothing to change: pass at least one field");

      await updateEvent(event.id, changes);
      await refresh();
      const next = { ...event, ...changes };
      return {
        ok: true,
        summary: `Updated “${next.title}”`,
        event: { id: event.id, title: next.title, date: next.date, time: next.time || null, status: next.status },
      };
    },

    async delete_event(args) {
      const { event, tasks } = await findEvent(asString(args.eventId));
      if (!confirm) throw new Error("Deleting isn't available here");

      const entries = await listSchedule(event.id);
      const parts = [
        tasks.length ? `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}` : "",
        entries.length ? `${entries.length} schedule ${entries.length === 1 ? "entry" : "entries"}` : "",
      ].filter(Boolean);
      const alongWith = parts.length ? ` and its ${parts.join(" and ")}` : "";

      // The user decides, not the model: nothing is deleted until they approve.
      const approved = await confirm(`Delete the event “${event.title}”${alongWith}? This can't be undone.`);
      if (!approved) return { ok: false, deleted: false, note: "The user chose not to delete it. Nothing was changed." };

      await deleteEvent(event.id);
      await refresh();
      return { ok: true, deleted: true, summary: `Deleted the event “${event.title}”${alongWith}` };
    },

    async create_task(args) {
      const title = asString(args.title).slice(0, 120);
      if (!title) throw new Error("title is required");
      const dueDate = requireDate(args.dueDate, "dueDate");
      const dueTime = asString(args.dueTime);
      if (dueTime) requireTime(dueTime, "dueTime");
      const priority = (PRIORITIES as readonly string[]).includes(asString(args.priority))
        ? (asString(args.priority) as TaskPriority)
        : "medium";
      const eventId = asString(args.eventId);
      const timing = dueTime ? { dueTime, timeZone: currentTimeZone() } : {};
      const reminder = reminderFrom(args.reminderMinutes, Boolean(dueTime));

      if (!eventId || eventId === PERSONAL) {
        const id = await createStandaloneTask(uid, { title, dueDate, priority, ...timing, ...reminder });
        await refresh();
        return {
          ok: true,
          summary: `Added “${title}”`,
          task: { id, eventId: PERSONAL, title, dueDate, dueTime: dueTime || null, priority },
        };
      }
      await findEvent(eventId);
      const group = asString(args.group).slice(0, 60) || "General";
      const id = await createTask(eventId, { title, group, priority, dueDate, ...timing, ...reminder });
      await refresh();
      return {
        ok: true,
        summary: `Added “${title}”`,
        task: { id, eventId, title, group, dueDate, dueTime: dueTime || null, priority },
      };
    },

    async set_task_done(args) {
      const taskId = asString(args.taskId);
      const eventId = asString(args.eventId);
      if (!taskId || !eventId) throw new Error("taskId and eventId are required");
      if (typeof args.done !== "boolean") throw new Error("done must be true or false");
      const known = (await rows()).find((row) => row.id === taskId && row.eventId === eventId);
      if (!known) throw new Error("No task with that id");
      if (eventId === PERSONAL) await setStandaloneTaskDone(uid, taskId, args.done);
      else await setTaskDone(eventId, taskId, args.done);
      await refresh();
      return {
        ok: true,
        summary: `${args.done ? "Completed" : "Reopened"} “${known.title}”`,
        task: { id: taskId, title: known.title, done: args.done },
      };
    },

    async delete_task(args) {
      const taskId = asString(args.taskId);
      const eventId = asString(args.eventId);
      if (!taskId || !eventId) throw new Error("taskId and eventId are required");
      const known = (await rows()).find((row) => row.id === taskId && row.eventId === eventId);
      if (!known) throw new Error("No task with that id");
      if (!confirm) throw new Error("Deleting isn't available here");

      // The user decides, not the model: nothing is deleted until they approve.
      const where = known.eventTitle ? ` from “${known.eventTitle}”` : "";
      const approved = await confirm(`Delete the task “${known.title}”${where}? This can't be undone.`);
      if (!approved) return { ok: false, deleted: false, note: "The user chose not to delete it. Nothing was changed." };

      if (eventId === PERSONAL) await deleteStandaloneTask(uid, taskId);
      else await deleteTask(eventId, taskId);
      await refresh();
      return { ok: true, deleted: true, summary: `Deleted “${known.title}”` };
    },

    async create_schedule_entry(args) {
      const { event } = await findEvent(asString(args.eventId));
      const title = asString(args.title).slice(0, 120);
      if (!title) throw new Error("title is required");
      const kind = asString(args.kind) as ScheduleKind;
      if (!KINDS.includes(kind)) throw new Error("kind must be appointment or slot");
      const date = requireDate(args.date, "date");
      const startAt = requireTime(args.startAt, "startAt");
      const endAt = requireTime(args.endAt, "endAt");
      if (endAt <= startAt) throw new Error("endAt must be after startAt");
      const location = asString(args.location).slice(0, 120);
      const id = await createScheduleEntry(event.id, { title, kind, date, startAt, endAt, location });
      await queryClient.invalidateQueries({ queryKey: ["calendar", uid] });
      return { ok: true, summary: `Added “${title}” to ${event.title}`, entry: { id, title, kind, date, startAt, endAt, location } };
    },

    async update_schedule_entry(args) {
      const { event } = await findEvent(asString(args.eventId));
      const entryId = asString(args.entryId);
      const current = (await listSchedule(event.id)).find((entry) => entry.id === entryId);
      if (!current) throw new Error("No schedule entry with that id");

      const kind = args.kind === undefined ? current.kind : (asString(args.kind) as ScheduleKind);
      if (!KINDS.includes(kind)) throw new Error("kind must be appointment or slot");
      const next = {
        title: args.title === undefined ? current.title : asString(args.title).slice(0, 120),
        kind,
        date: args.date === undefined ? current.date : requireDate(args.date, "date"),
        startAt: args.startAt === undefined ? current.startAt : requireTime(args.startAt, "startAt"),
        endAt: args.endAt === undefined ? current.endAt : requireTime(args.endAt, "endAt"),
        location: args.location === undefined ? current.location : asString(args.location).slice(0, 120),
      };
      if (!next.title) throw new Error("title can't be empty");
      if (next.endAt <= next.startAt) throw new Error("endAt must be after startAt");
      await updateScheduleEntry(event.id, entryId, next);
      await queryClient.invalidateQueries({ queryKey: ["calendar", uid] });
      return { ok: true, summary: `Updated “${next.title}”`, entry: { id: entryId, ...next } };
    },

    async add_category(args) {
      const name = asString(args.name).slice(0, 40);
      if (!name) throw new Error("name is required");
      const categories = await addCustomCategory(uid, name);
      return { ok: true, summary: `Added category “${name}”`, categories };
    },
  };

  return {
    async run(name, args) {
      const tool = tools[name];
      if (!tool) throw new Error(`Unknown tool ${name}`);
      return tool(args);
    },
  };
}

/** Plain-language record of a change, shown under the assistant's reply. */
export function describeAction(result: unknown): string | null {
  const data = result as { ok?: boolean; summary?: unknown } | null;
  return data?.ok === true && typeof data.summary === "string" ? data.summary : null;
}
