"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Plus } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Reveal, TapScale, springs } from "@/components/motion-primitives";
import { canvasButton, GroupHeading, ScreenShell } from "@/components/page-header";
import { TaskItem } from "@/components/task-item";
import {
  listEvents,
  listStandaloneTasks,
  listTasks,
  setStandaloneTaskDone,
  setTaskDone,
  type EventTask,
  type PlannerEvent,
} from "@/lib/data";
import { daysUntil, formatCountdown, formatDayMonth, formatLongDate, formatTime, parseIso, startOfWeek, toIso, todayIso } from "@/lib/datetime";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

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
  // Reminder notifications link here with ?date=YYYY-MM-DD.
  const requestedDate = useSearchParams().get("date") ?? "";
  const deepLinkDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : null;
  const [anchor, setAnchor] = useState(() => (deepLinkDate ? parseIso(deepLinkDate) : new Date()));
  const [selected, setSelected] = useState(deepLinkDate ?? todayIso());
  const [actionError, setActionError] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
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

  // Firestore reports a rejected request as code "permission-denied". That can
  // mean an expired session, but also a rules problem, so check the session
  // once and only sign out if it really is gone.
  const permissionDenied =
    calendarQuery.isError && (calendarQuery.error as { code?: string } | null)?.code === "permission-denied";
  const [sessionCheck, setSessionCheck] = useState<"idle" | "done">("idle");
  const sessionCheckStarted = useRef(false);
  const permissionLost = permissionDenied && sessionCheck === "idle";

  useEffect(() => {
    if (!permissionDenied || status !== "signed-in" || !user || sessionCheckStarted.current) return;
    sessionCheckStarted.current = true;
    user
      .getIdToken(true)
      .then(() => queryClient.invalidateQueries({ queryKey: ["calendar", user.uid] }))
      .catch(() => signOut())
      .finally(() => setSessionCheck("done"));
  }, [permissionDenied, queryClient, signOut, status, user]);

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
      tasks.sort((a, b) => (a.dueTime ?? "").localeCompare(b.dueTime ?? "") || Number(a.done) - Number(b.done) || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.title.localeCompare(b.title));
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
      <div className="min-h-dvh bg-brand" aria-busy="true" aria-label="Loading calendar">
        <div className="mx-auto max-w-3xl space-y-4 px-5 pt-[max(1.75rem,env(safe-area-inset-top))] pb-16">
          <div className="h-10 w-40 rounded-2xl bg-white/30" />
          <div className="h-20 rounded-3xl bg-white/20" />
        </div>
        <div className="-mt-8 min-h-[60dvh] space-y-3 rounded-t-3xl bg-card px-5 pt-8">
          {[0, 1, 2].map((row) => (
            <div key={row} className="skeleton h-14 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (calendarQuery.isError) {
    const message = calendarQuery.error instanceof Error ? calendarQuery.error.message : "Could not load your calendar.";
    if (permissionLost) {
      return (
        <div className="mx-auto max-w-lg px-6 pt-28 text-center">
          <span className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-secondary border-t-primary" aria-hidden />
          <p className="mt-4 text-base font-bold text-muted-foreground">Refreshing your session…</p>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-lg px-6 pt-28 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <CircleAlert className="h-9 w-9" aria-hidden />
        </div>
        <h2 className="mt-5 font-heading text-2xl font-bold tracking-tight">Something went wrong</h2>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">{message}</p>
        <button
          type="button"
          onClick={() => void calendarQuery.refetch()}
          className="mt-6 inline-flex h-14 items-center justify-center rounded-xl bg-brand px-8 text-base font-semibold text-primary-foreground outline-none active:scale-95 focus-visible:ring-4 focus-visible:ring-ring/30"
        >
          Try again
        </button>
      </div>
    );
  }

  const shiftWeek = (step: -1 | 1) => {
    setDirection(step);
    setAnchor((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + step * 7);
      return next;
    });
  };

  const jumpTo = (isoDate: string) => {
    setDirection(isoDate >= activeDay ? 1 : -1);
    setAnchor(parseIso(isoDate));
    setSelected(isoDate);
  };

  const allEvents = (calendarQuery.data?.events ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const todayInWeek = week.some((column) => column.isToday);
  const monthLabel = parseIso(week[3].isoDate).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const overdueFor = (task: CalendarTask) => !task.done && task.dueDate < todayIso();

  return (
    <ScreenShell
      greeting={monthLabel}
      title="Calendar"
      action={
        <div className="flex items-center gap-2">
          {!todayInWeek ? (
            <button type="button" onClick={() => jumpTo(todayIso())} className={canvasButton}>
              Today
            </button>
          ) : null}
          <TapScale amount={0.92}>
            <Link
              href={`/tasks?new=1&date=${activeDay}`}
              aria-label="Add task"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary shadow-float outline-none focus-visible:ring-4 focus-visible:ring-white/50"
            >
              <Plus className="h-6 w-6" strokeWidth={2.8} aria-hidden />
            </Link>
          </TapScale>
        </div>
      }
      canvas={
        <section aria-label="Week navigation">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-white/90">
              {formatDayMonth(week[0].isoDate)} – {formatDayMonth(week[6].isoDate)}
            </p>
            <div className="flex items-center gap-1.5">
              <TapScale amount={0.9}>
                <button
                  type="button"
                  onClick={() => shiftWeek(-1)}
                  aria-label="Previous week"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/25 outline-none transition-colors hover:bg-white/35 focus-visible:ring-4 focus-visible:ring-white/40"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
              </TapScale>
              <TapScale amount={0.9}>
                <button
                  type="button"
                  onClick={() => shiftWeek(1)}
                  aria-label="Next week"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/25 outline-none transition-colors hover:bg-white/35 focus-visible:ring-4 focus-visible:ring-white/40"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
              </TapScale>
            </div>
          </div>
          <motion.div
            className="grid grid-cols-7 gap-1.5"
            style={{ touchAction: "pan-y" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            dragSnapToOrigin
            onDragEnd={(_event, info) => {
              if (info.offset.x < -60) shiftWeek(1);
              else if (info.offset.x > 60) shiftWeek(-1);
            }}
          >
            {week.map((column, index) => {
              const isSelected = column.isoDate === activeDay;
              const eventCount = eventsByDay[column.isoDate]?.length ?? 0;
              const taskCount = tasksByDay[column.isoDate]?.length ?? 0;
              return (
                <button
                  key={column.isoDate}
                  type="button"
                  onClick={() => setSelected(column.isoDate)}
                  aria-pressed={isSelected}
                  aria-label={`${WEEKDAY_LABELS[index]} ${column.dayNumber}${eventCount > 0 ? `, ${eventCount} event${eventCount === 1 ? "" : "s"}` : ""}${taskCount > 0 ? `, ${taskCount} task${taskCount === 1 ? "" : "s"}` : ""}`}
                  className="relative flex min-h-[5.25rem] flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-2 outline-none focus-visible:ring-4 focus-visible:ring-white/50"
                >
                  {isSelected ? (
                    <motion.span
                      layoutId="calendar-day-pill"
                      className="absolute inset-0 rounded-2xl bg-white"
                      transition={springs.rise}
                    />
                  ) : null}
                  <span className={cn("relative text-xs font-semibold", isSelected ? "text-primary" : "text-white/75")}>
                    {WEEKDAY_LABELS[index].slice(0, 3)}
                  </span>
                  <motion.span
                    key={column.isoDate}
                    initial={{ opacity: 0, y: direction * 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={springs.rise}
                    className={cn(
                      "relative font-heading text-xl font-bold tabular-nums",
                      isSelected ? "text-foreground" : "text-primary-foreground",
                    )}
                  >
                    {column.dayNumber}
                  </motion.span>
                  <span className="relative flex h-1.5 items-center gap-1" aria-hidden>
                    {eventCount > 0 ? (
                      <span className={cn("h-1.5 w-1.5 rounded-full", isSelected ? "bg-primary" : "bg-white")} />
                    ) : null}
                    {taskCount > 0 ? (
                      <span className={cn("h-1.5 w-1.5 rounded-full", isSelected ? "bg-primary/40" : "bg-white/50")} />
                    ) : null}
                    {column.isToday && eventCount === 0 && taskCount === 0 ? (
                      <span className={cn("h-1 w-4 rounded-full", isSelected ? "bg-primary/30" : "bg-white/40")} />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </motion.div>
        </section>
      }
    >
      <section aria-label={`Planner for ${formatLongDate(activeDay)}`}>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2
              key={activeDay}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="font-heading text-xl font-bold tracking-tight"
            >
              {activeDay === todayIso() ? "Today" : formatLongDate(activeDay)}
            </motion.h2>
          </AnimatePresence>
          <span className="shrink-0 text-sm font-bold text-muted-foreground tabular-nums">
            {selectedEvents.length} {selectedEvents.length === 1 ? "event" : "events"} · {selectedTasks.length}{" "}
            {selectedTasks.length === 1 ? "task" : "tasks"}
          </span>
        </div>

        <AnimatePresence initial={false}>
          {selectedEvents.length > 0 ? (
            <motion.div
              key="events"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-2.5 pt-2 pb-3" aria-label="Events on this day">
                {selectedEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-4 rounded-3xl bg-brand p-4 text-primary-foreground">
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/25 backdrop-blur">
                      <CalendarDays className="h-6 w-6" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-heading text-lg font-bold tracking-tight">{event.title}</h3>
                      <p className="text-sm font-bold text-white/85">
                        {formatTime(event.time)} · {event.status}
                      </p>
                    </div>
                    <Link
                      href={`/tasks?new=1&date=${activeDay}&event=${event.id}`}
                      aria-label={`Add task to ${event.title}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/25 outline-none transition-colors hover:bg-white/35 focus-visible:ring-4 focus-visible:ring-white/40"
                    >
                      <Plus className="h-5 w-5" aria-hidden />
                    </Link>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {selectedTasks.length > 0 ? (
          <ul>
            <AnimatePresence initial={false} mode="popLayout">
              {selectedTasks.map((task) => (
                <TaskItem
                  key={`${activeDay}-${task.eventId ?? "personal"}-${task.id}`}
                  row={task}
                  overdue={overdueFor(task)}
                  onToggle={() => toggleTask.mutate({ eventId: task.eventId, taskId: task.id, done: !task.done })}
                />
              ))}
            </AnimatePresence>
          </ul>
        ) : selectedEvents.length === 0 ? (
          <div className="flex flex-col items-center px-2 pt-8 pb-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
              <CalendarDays className="h-7 w-7" aria-hidden />
            </div>
            <p className="mt-5 font-heading text-xl font-bold tracking-tight">Nothing scheduled</p>
            <p className="mt-1 max-w-xs text-base leading-6 text-muted-foreground">
              There are no events or tasks on this date.
            </p>
            <Link
              href={`/tasks?new=1&date=${activeDay}`}
              className="mt-6 inline-flex h-12 items-center rounded-xl bg-brand px-6 text-base font-semibold text-primary-foreground outline-none active:scale-95 focus-visible:ring-4 focus-visible:ring-ring/30"
            >
              Add a task
            </Link>
          </div>
        ) : null}
      </section>

      {allEvents.length > 0 ? (
        <Reveal delay={0.08} y={10}>
          <aside aria-label="Your events" className="mt-8">
            <GroupHeading count={allEvents.length}>All events</GroupHeading>
            <ul>
              {allEvents.map((event) => {
                const diff = daysUntil(event.date);
                const isPast = diff < 0;
                return (
                  <li key={event.id} className="border-b border-border/70 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => jumpTo(event.date)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 py-3.5 text-left outline-none transition-opacity focus-visible:ring-4 focus-visible:ring-ring/30",
                        isPast && "opacity-55",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-base font-semibold">{event.title}</span>
                        <span className="block text-sm text-muted-foreground">
                          {formatDayMonth(event.date)} · {formatTime(event.time)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold",
                          isPast ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {formatCountdown(event.date)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        </Reveal>
      ) : null}

      <AnimatePresence>
        {actionError ? (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={springs.rise}
            className="fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-sm rounded-xl bg-destructive px-5 py-3 text-center text-sm font-semibold text-white shadow-float md:bottom-6"
          >
            {actionError}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </ScreenShell>
  );
}

export default function CalendarPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <CalendarContent />
      </Suspense>
    </RequireAuth>
  );
}
