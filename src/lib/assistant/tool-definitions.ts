/**
 * The tools the model may call. The schemas live here so the server can offer
 * exactly these and nothing else; the implementations run in the browser
 * (see tools.ts), next to the user's data.
 */

const date = { type: "string", description: "Date as YYYY-MM-DD" };
const time = { type: "string", description: "Time as HH:mm (24-hour)" };
const priority = { type: "string", enum: ["high", "medium", "low"] };
const reminder = {
  type: "integer",
  enum: [0, 10, 60, 1440],
  description: "Minutes before the time to send a reminder: 0 (at the time), 10, 60 or 1440 (a day). Needs a time. Omit for no reminder.",
};

export const TOOL_DEFINITIONS = [
  // -- Reading ---------------------------------------------------------------
  {
    type: "function",
    function: {
      name: "get_overview",
      description:
        "Counts for the whole account: events, open tasks, tasks due today, overdue tasks. Good first call for broad questions.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_profile",
      description: "The user's profile: display name and custom categories.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_events",
      description: "The user's events, soonest first, with open and done task counts.",
      parameters: {
        type: "object",
        properties: {
          from: { ...date, description: "Only events on or after this date (YYYY-MM-DD)" },
          to: { ...date, description: "Only events on or before this date (YYYY-MM-DD)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_event",
      description: "Everything about one event: its details, all of its tasks and its schedule.",
      parameters: {
        type: "object",
        properties: { eventId: { type: "string" } },
        required: ["eventId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "Tasks across all events plus personal tasks, ordered by due date. Defaults to open tasks only.",
      parameters: {
        type: "object",
        properties: {
          eventId: { type: "string", description: 'An event id, or "personal" for tasks that belong to no event' },
          status: { type: "string", enum: ["open", "done", "all"] },
          dueFrom: { ...date, description: "Due on or after this date" },
          dueTo: { ...date, description: "Due on or before this date" },
          priority,
          search: { type: "string", description: "Case-insensitive text to look for in the title or group" },
          limit: { type: "integer", description: "Max rows, default 30, at most 60" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_schedule",
      description: "The timed schedule (appointments and slots) for one event.",
      parameters: {
        type: "object",
        properties: { eventId: { type: "string" } },
        required: ["eventId"],
        additionalProperties: false,
      },
    },
  },

  // -- Changing --------------------------------------------------------------
  {
    type: "function",
    function: {
      name: "create_event",
      description: "Create an event. Only when the user asked for it. Returns the new event's id.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          date,
          time,
          status: { type: "string", enum: ["planning", "confirmed"], description: "Defaults to planning" },
          reminderMinutes: reminder,
        },
        required: ["title", "date", "time"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Add a task. Only when the user asked for it. Omit eventId for a personal task. Returns the new task.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          dueDate: date,
          dueTime: time,
          priority,
          eventId: { type: "string", description: "Event to attach the task to; omit for a personal task" },
          group: { type: "string", description: "Group heading inside an event, such as Catering" },
          reminderMinutes: reminder,
        },
        required: ["title", "dueDate"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_task_done",
      description: "Mark a task done or not done. Only when the user asked for it.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          eventId: { type: "string", description: "The task's event id, or \"personal\"" },
          done: { type: "boolean" },
        },
        required: ["taskId", "eventId", "done"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description:
        "Permanently delete a task. Only when the user clearly asked. The app shows the user a confirmation first; if they decline, nothing is deleted.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          eventId: { type: "string", description: "The task's event id, or \"personal\"" },
        },
        required: ["taskId", "eventId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_schedule_entry",
      description: "Add an appointment or slot to an event's schedule. Only when the user asked for it.",
      parameters: {
        type: "object",
        properties: {
          eventId: { type: "string" },
          title: { type: "string" },
          kind: { type: "string", enum: ["appointment", "slot"] },
          date,
          startAt: time,
          endAt: time,
          location: { type: "string" },
        },
        required: ["eventId", "title", "kind", "date", "startAt", "endAt"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_schedule_entry",
      description:
        "Change a schedule entry. Pass only the fields to change; the rest stay as they are. Only when the user asked for it.",
      parameters: {
        type: "object",
        properties: {
          eventId: { type: "string" },
          entryId: { type: "string" },
          title: { type: "string" },
          kind: { type: "string", enum: ["appointment", "slot"] },
          date,
          startAt: time,
          endAt: time,
          location: { type: "string" },
        },
        required: ["eventId", "entryId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_category",
      description: "Add a custom category to the user's profile. Only when the user asked for it.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
] as const;

export const TOOL_NAMES: ReadonlySet<string> = new Set(TOOL_DEFINITIONS.map((tool) => tool.function.name));
