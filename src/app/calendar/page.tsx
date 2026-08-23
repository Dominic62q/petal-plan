"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert, ListChecks, Plus } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Reveal, Stagger, StaggerItem, TapScale } from "@/components/motion-primitives";
import {
  listEvents,
  listStandaloneTasks,
  listTasks,
  setStandaloneTaskDone,
  setTaskDone,
  type EventTask,
  type PlannerEvent,
} from "@/lib/data";
import { daysUntil, formatCountdown, formatDayMonth, formatLongDate, formatTime, startOfWeek, toIso, todayIso } from "@/lib/datetime";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

interface DayColumn {
  isoDate: string;
  dayNumber: number;
  isToday: boolean;
}

type CalendarTask = Omit<EventTask, "eventId"> & {
  eventId: string | null;
  eventTitle: string;
  group: string;
};

function buildWeek(anchor: Date): DayColumn[] {
  const monday = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + offset);
    const isoDate = toIso(date);
    return { isoDate, dayNumber: date.getDate(), isToday: isoDate === todayIso() };
  });
}

function CalendarContent() {
  const { user, status, signOut } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.uid;
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState(todayIso());
  const [actionError, setActionError] = useState<string | null>(null);
  const week = useMemo(() => buildWeek(anchor), [anchor]);

  const calendarQuery = useQuery({
    queryKey: ["calendar", uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      const events = await listEvents(uid!);
      const perEvent = await Promise.all(
        events.map(async (event) => ({
          event,
          tasks: await listTasks(event.id),
        })),
      );
      const standalone = await listStandaloneTasks(uid!);
      return { events, perEvent, standalone };
    },
  });

  const permissionLost =
    calendarQuery.isError &&
    calendarQuery.error instanceof Error &&
    /permission/i.test(calendarQuery.error.message);

  useEffect(() => {
    if (permissionLost && status === "signed-in") void signOut();
  }, [permissionLost, signOut, status]);

  const eventsByDay = useMemo(() => {
    const byDay: Record<string, PlannerEvent[]> = {};
    for (const event of calendarQuery.data?.events ?? []) {
      (byDay[event.date] ??= []).push(event);
    }
    for (const events of Object.values(byDay)) {
      events.sort((a, b) => a.time.localeCompare(b.time));
    }
    return byDay;
  }, [calendarQuery.data?.events]);

  const tasksByDay = useMemo(() => {
    const byDay: Record<string, CalendarTask[]> = {};
    for (const { event, tasks } of calendarQuery.data?.perEvent ?? []) {
      for (const task of tasks) {
        (byDay[task.dueDate] ??= []).push({ ...task, eventTitle: event.title, group: task.group || "General" });
      }
    }
    for (const task of calendarQuery.data?.standalone ?? []) {
      (byDay[task.dueDate] ??= []).push({ ...task, eventId: null, eventTitle: "Personal", group: "Personal" });
    }
    for (const tasks of Object.values(byDay)) {
      tasks.sort((a, b) => (a.dueTime ?? "").localeCompare(b.dueTime ?? "") || Number(a.done) - Number(b.done) || a.priority.localeCompare(b.priority) || a.title.localeCompare(b.title));
    }
    return byDay;
  }, [calendarQuery.data?.perEvent, calendarQuery.data?.standalone]);

  const selectedIsValid = week.some((column) => column.isoDate === selected);
  const activeDay = selectedIsValid ? selected : week.find((column) => column.isToday)?.isoDate ?? week[0].isoDate;
  const selectedEvents = eventsByDay[activeDay] ?? [];
  const selectedTasks = tasksByDay[activeDay] ?? [];

  const toggleTask = useMutation({
    mutationFn: ({ eventId, taskId, done }: { eventId: string | null; taskId: string; done: boolean }) =>
      eventId ? setTaskDone(eventId, taskId, done) : setStandaloneTaskDone(uid!, taskId, done),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar", uid] });
      void queryClient.invalidateQueries({ queryKey: ["all-tasks", uid] });
      void queryClient.invalidateQueries({ queryKey: ["standalone-tasks", uid] });
      setActionError(null);
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Couldn’t save that task."),
  });

  if (calendarQuery.isPending) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-10" aria-busy="true" aria-label="Loading calendar" style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}>
        <div className="h-10 w-52 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse border-y border-border bg-muted/50" />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]"><div className="h-64 animate-pulse border-y border-border" /><div className="h-48 animate-pulse border-y border-border" /></div>
      </div>
    );
  }

  if (calendarQuery.isError) {
    const message = calendarQuery.error instanceof Error ? calendarQuery.error.message : "Could not load your calendar.";
    if (permissionLost) return <div className="mx-auto max-w-lg px-5 pt-14 text-center"><span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden /><p className="mt-3 text-sm text-muted-foreground">Refreshing your session…</p></div>;
    return <div className="mx-auto max-w-lg px-5 pt-14 text-center"><CircleAlert className="mx-auto h-8 w-8 text-destructive" aria-hidden /><h2 className="mt-3 font-heading text-lg font-bold">Something went wrong</h2><p className="mt-1 text-sm text-muted-foreground">{message}</p><button type="button" onClick={() => void calendarQuery.refetch()} className="mt-4 min-h-9 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground">Try again</button></div>;
  }

  const shiftWeek = (direction: -1 | 1) => {
    setAnchor((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + direction * 7);
      return next;
    });
  };

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-10" style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}>
        <Reveal y={10}>
          <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Planner calendar</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h1 className="font-heading text-4xl font-extrabold tracking-[-0.06em] sm:text-5xl">Calendar</h1>
                <p className="text-sm text-muted-foreground">{formatLongDate(todayIso())}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setAnchor(new Date()); setSelected(todayIso()); }} className="hidden min-h-9 rounded-md border border-border px-3 text-sm font-semibold transition-colors hover:border-foreground/30 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:inline-flex">Today</button>
              <Link href={`/tasks?new=1&date=${activeDay}`} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><Plus className="h-4 w-4" aria-hidden />Add task</Link>
            </div>
          </header>
        </Reveal>

        <Reveal delay={0.05} y={8}>
          <section className="mt-6 border-y border-border" aria-label="Week navigation">
            <div className="flex items-center justify-between gap-4 border-b border-border py-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Week of</p><p className="mt-1 font-heading text-base font-extrabold tracking-[-0.025em]">{formatDayMonth(week[0].isoDate)} – {formatDayMonth(week[6].isoDate)}</p></div>
              <div className="flex items-center gap-1">
                <TapScale amount={0.92}><button type="button" onClick={() => shiftWeek(-1)} aria-label="Previous week" className="flex h-9 w-9 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><ChevronLeft className="h-4 w-4" aria-hidden /></button></TapScale>
                <TapScale amount={0.92}><button type="button" onClick={() => shiftWeek(1)} aria-label="Next week" className="flex h-9 w-9 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><ChevronRight className="h-4 w-4" aria-hidden /></button></TapScale>
              </div>
            </div>
            <div className="grid grid-cols-7 divide-x divide-border">
              {week.map((column, index) => {
                const isSelected = column.isoDate === activeDay;
                const eventCount = eventsByDay[column.isoDate]?.length ?? 0;
                const taskCount = tasksByDay[column.isoDate]?.length ?? 0;
                return (
                  <button key={column.isoDate} type="button" onClick={() => setSelected(column.isoDate)} aria-pressed={isSelected} aria-label={`${WEEKDAY_LABELS[index]} ${column.dayNumber}${eventCount > 0 ? `, ${eventCount} event${eventCount === 1 ? "" : "s"}` : ""}${taskCount > 0 ? `, ${taskCount} task${taskCount === 1 ? "" : "s"}` : ""}`} className={cn("relative flex min-h-[4.9rem] flex-col items-center justify-center gap-1 px-1 py-2 transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring", isSelected ? "bg-secondary/70" : "hover:bg-muted/70")}>
                    <span className={cn("text-[10px] font-bold uppercase tracking-[0.12em]", isSelected ? "text-primary" : "text-muted-foreground")}>{WEEKDAY_LABELS[index]}</span>
                    <span className={cn("font-heading text-xl font-extrabold tabular-nums tracking-[-0.04em]", column.isToday || isSelected ? "text-primary" : "text-foreground")}>{column.dayNumber}</span>
                    <span className="flex h-1.5 items-center gap-1">{eventCount > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}{taskCount > 0 ? <span className="h-1.5 w-1.5 rounded-full bg-foreground/35" /> : null}</span>
                    {isSelected ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          </section>
        </Reveal>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12">
          <section aria-label={`Planner for ${formatLongDate(activeDay)}`}>
            <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Selected day</p><AnimatePresence mode="wait" initial={false}><motion.h2 key={activeDay} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="mt-1.5 font-heading text-xl font-extrabold tracking-[-0.045em] sm:text-2xl">{formatLongDate(activeDay)}</motion.h2></AnimatePresence></div>
              <span className="text-xs tabular-nums text-muted-foreground">{selectedEvents.length} {selectedEvents.length === 1 ? "event" : "events"} · {selectedTasks.length} {selectedTasks.length === 1 ? "task" : "tasks"}</span>
            </div>

            {selectedEvents.length > 0 ? (
              <div className="mt-4 space-y-2" aria-label="Events on this day">
                {selectedEvents.map((event) => (
                  <div key={event.id} className="border-l-2 border-primary bg-secondary/35 px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Event day</p><h3 className="mt-1 truncate font-heading text-lg font-extrabold tracking-[-0.03em]">{event.title}</h3><p className="mt-1 text-sm text-muted-foreground">{formatTime(event.time)} · {event.status}</p></div>
                      <Link href={`/tasks?new=1&date=${activeDay}&event=${event.id}`} className="shrink-0 text-xs font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Add task</Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-7 flex items-end justify-between gap-4 border-b border-border pb-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Work due</p><h2 className="mt-1.5 font-heading text-xl font-extrabold tracking-[-0.045em] sm:text-2xl">Tasks</h2></div>
              <Link href={`/tasks?new=1&date=${activeDay}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Add task <Plus className="h-3.5 w-3.5" aria-hidden /></Link>
            </div>

            {selectedTasks.length > 0 ? (
              <Stagger className="divide-y divide-border border-b border-border" gap={0.04}>
                {selectedTasks.map((task) => (
                  <StaggerItem key={`${task.eventId ?? "personal"}-${task.id}`}>
                    <div className={cn("flex items-center gap-3 py-3.5", task.done && "opacity-55")}>
                      <button type="button" role="checkbox" aria-checked={task.done} aria-label={task.done ? `Reopen ${task.title}` : `Complete ${task.title}`} onClick={() => toggleTask.mutate({ eventId: task.eventId, taskId: task.id, done: !task.done })} className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", task.done ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25 hover:border-primary")}>
                        {task.done ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                      </button>
                      <div className="min-w-0 flex-1"><p className={cn("truncate text-sm font-semibold", task.done && "line-through")}>{task.title}</p><p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground"><span>{task.eventTitle}</span><span aria-hidden>·</span><span>{task.group}</span>{task.dueTime ? <><span aria-hidden>·</span><span>{formatTime(task.dueTime)}</span></> : null}</p></div>
                      <span className={cn("shrink-0 text-[10px] font-bold uppercase tracking-[0.12em]", task.priority === "high" ? "text-destructive" : "text-muted-foreground")}>{task.priority}</span>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
            ) : (
              <div className="border-b border-border py-7"><p className="text-sm font-semibold">No tasks due this day</p><p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">Keep the day clear, or add one intentional task for this date.</p><Link href={`/tasks?new=1&date=${activeDay}`} className="mt-3 inline-flex text-sm font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Create a task for this day</Link></div>
            )}
            <Link href="/tasks" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><ListChecks className="h-3.5 w-3.5" aria-hidden />Manage all tasks</Link>
          </section>

          {(calendarQuery.data?.events ?? []).length > 0 ? (
            <Reveal delay={0.08} y={8}>
              <aside className="border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0" aria-label="Your events">
                <div className="flex items-end justify-between gap-3 border-b border-border pb-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Event roster</p><h2 className="mt-1.5 font-heading text-xl font-extrabold tracking-[-0.045em]">Events</h2></div><CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden /></div>
                <ul className="divide-y divide-border">
                  {(calendarQuery.data?.events ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)).map((event) => {
                    const diff = daysUntil(event.date);
                    const isPast = diff < 0;
                    return <li key={event.id} className={cn("py-4", isPast && "opacity-55")}><div className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block truncate text-sm font-bold">{event.title}</span><span className="mt-1 block text-xs text-muted-foreground">{formatDayMonth(event.date)} · {formatTime(event.time)}</span></span><span className={cn("shrink-0 text-[10px] font-bold uppercase tracking-[0.12em]", isPast ? "text-muted-foreground" : "text-primary")}>{formatCountdown(event.date)}</span></div></li>;
                  })}
                </ul>
              </aside>
            </Reveal>
          ) : null}
        </div>
      </div>
      {actionError ? <p role="alert" className="fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-sm rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{actionError}</p> : null}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <RequireAuth>
      <CalendarContent />
    </RequireAuth>
  );
}
