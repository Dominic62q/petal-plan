import { queryOptions, useQuery } from "@tanstack/react-query";
import { listEvents, listStandaloneTasks, listTasks, type EventTask, type PlannerEvent } from "@/lib/data";

/**
 * The reads every screen shares. Today, Tasks, Calendar and the assistant all
 * ask for the same two things, so they use the same query keys: opening one
 * screen after another reuses what is cached instead of fetching it all again.
 */

export type EventWithTasks = { event: PlannerEvent; tasks: EventTask[] };

/** Events, then every event's tasks in parallel: two round trips however many events there are. */
async function loadEventPairs(uid: string): Promise<EventWithTasks[]> {
  const events = await listEvents(uid);
  return Promise.all(events.map(async (event) => ({ event, tasks: await listTasks(event.id) })));
}

export const eventPairsQuery = (uid: string | undefined) =>
  queryOptions({
    queryKey: ["all-tasks", uid],
    queryFn: () => loadEventPairs(uid!),
    enabled: Boolean(uid),
  });

export const standaloneTasksQuery = (uid: string | undefined) =>
  queryOptions({
    queryKey: ["standalone-tasks", uid],
    queryFn: () => listStandaloneTasks(uid!),
    enabled: Boolean(uid),
  });

export const useEventPairs = (uid: string | undefined) => useQuery(eventPairsQuery(uid));
export const useStandaloneTasks = (uid: string | undefined) => useQuery(standaloneTasksQuery(uid));
