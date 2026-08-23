import type { EventTask, PlannerEvent, StandaloneTask } from "@/lib/data";

export type TaskRow = Omit<EventTask, "eventId"> & {
  eventId: string | null;
  eventTitle: string;
};

export type EventTaskPair = {
  event: PlannerEvent;
  tasks: EventTask[];
};

export function mergeTaskRows(
  pairs: EventTaskPair[],
  standaloneTasks: StandaloneTask[],
): TaskRow[] {
  return [
    ...pairs.flatMap(({ event, tasks }) =>
      tasks.map((task) => ({ ...task, eventTitle: event.title })),
    ),
    ...standaloneTasks.map((task) => ({
      ...task,
      eventId: null,
      group: "Personal",
      eventTitle: "Personal",
    })),
  ];
}

export function summarizeTasks(rows: TaskRow[]) {
  const totalTasks = rows.length;
  const totalDone = rows.filter((task) => task.done).length;
  const totalOpen = totalTasks - totalDone;
  const progressPercent =
    totalTasks === 0 ? 0 : Math.round((totalDone / totalTasks) * 100);

  return { totalTasks, totalDone, totalOpen, progressPercent };
}
