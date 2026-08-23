"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  ListChecks,
  Plus,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Reveal, Stagger, StaggerItem, springs } from "@/components/motion-primitives";
import {
  listEvents,
  listStandaloneTasks,
  listTasks,
  setStandaloneTaskDone,
  setTaskDone,
  type EventTask,
  type PlannerEvent,
  type StandaloneTask,
} from "@/lib/data";
import {
  daysUntil,
  formatCountdown,
  formatDayMonth,
  formatLongDate,
  formatTime,
  greetingForNow,
  todayIso,
} from "@/lib/datetime";
import { PRIORITY_ORDER } from "@/lib/labels";
import { cn } from "@/lib/utils";

interface RowTask extends Omit<EventTask, "eventId"> {
  eventId: string | null;
  eventTitle: string;
}

interface AgendaModel {
  events: PlannerEvent[];
  nextEvent: PlannerEvent | null;
  overdue: RowTask[];
  dueToday: RowTask[];
  upcomingByDate: Array<{ date: string; tasks: RowTask[] }>;
  openCount: number;
  completedCount: number;
}

function buildAgenda(
  events: PlannerEvent[],
  tasksByEvent: Array<{ event: PlannerEvent; tasks: EventTask[] }>,
  standaloneTasks: StandaloneTask[],
): AgendaModel {
  const today = todayIso();
  const all: RowTask[] = [
    ...tasksByEvent.flatMap(({ event, tasks }) =>
      tasks.map((task) => ({ ...task, eventId: event.id, eventTitle: event.title })),
    ),
    ...standaloneTasks.map((task) => ({
      ...task,
      eventId: null,
      eventTitle: "Personal",
      group: "Personal",
    })),
  ];
  const open = all.filter((task) => !task.done);
  const byPriorityThenDate = [...open].sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueTime !== b.dueTime) return (a.dueTime ?? "").localeCompare(b.dueTime ?? "");
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });
  const upcomingEvents = events
    .filter((event) => daysUntil(event.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const grouped = new Map<string, RowTask[]>();
  for (const task of byPriorityThenDate.filter((item) => item.dueDate > today)) {
    const bucket = grouped.get(task.dueDate) ?? [];
    bucket.push(task);
    grouped.set(task.dueDate, bucket);
  }

  return {
    events,
    nextEvent: upcomingEvents[0] ?? [...events].sort((a, b) => a.date.localeCompare(b.date))[0] ?? null,
    overdue: byPriorityThenDate.filter((task) => task.dueDate < today),
    dueToday: byPriorityThenDate.filter((task) => task.dueDate === today),
    upcomingByDate: [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, tasks]) => ({ date, tasks })),
    openCount: open.length,
    completedCount: all.length - open.length,
  };
}


function countdownLabel(isoDate: string): string {
  const days = daysUntil(isoDate);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  if (days === -1) return "Yesterday";
  return `${Math.abs(days)} days ago`;
}

function DashboardContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.uid;
  const [eventFilter, setEventFilter] = useState<string | "all">("all");

  const combined = useQuery({
    queryKey: ["all-tasks", uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      const events = await listEvents(uid!);
      return Promise.all(
        events.map(async (event) => ({
          event,
          tasks: await listTasks(event.id),
        })),
      );
    },
  });

  const standalone = useQuery({
    queryKey: ["standalone-tasks", uid],
    enabled: Boolean(uid),
    queryFn: () => listStandaloneTasks(uid!),
  });

  const checkOff = useMutation({
    mutationFn: ({ eventId, taskId, done }: { eventId: string | null; taskId: string; done: boolean }) =>
      eventId ? setTaskDone(eventId, taskId, done) : setStandaloneTaskDone(uid!, taskId, done),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["all-tasks", uid] });
      void queryClient.invalidateQueries({ queryKey: ["standalone-tasks", uid] });
    },
  });

  if (combined.isPending || standalone.isPending) {
    return (
      <div
        className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-10"
        style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}
        aria-busy="true"
        aria-label="Loading your overview"
      >
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        <div className="h-12 w-full max-w-md animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-5 lg:grid-cols-[1.45fr_.75fr]">
          <div className="h-72 animate-pulse rounded-[1.4rem] bg-muted" />
          <div className="h-72 animate-pulse rounded-[1.4rem] border border-border" />
        </div>
        <div className="h-48 animate-pulse rounded-xl border border-border" />
      </div>
    );
  }

  if (combined.isError || standalone.isError) {
    const queryError = combined.error ?? standalone.error;
    const message = queryError instanceof Error ? queryError.message : "Could not load your overview.";
    return (
      <div className="mx-auto max-w-lg px-5 pt-20 text-center">
        <CircleAlert className="mx-auto h-6 w-6 text-destructive" aria-hidden />
        <h2 className="mt-4 font-heading text-lg font-bold">Something went wrong</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
        <button
          type="button"
          onClick={() => {
            if (combined.isError) void combined.refetch();
            if (standalone.isError) void standalone.refetch();
          }}
          className="mt-5 min-h-10 rounded-lg bg-foreground px-4 text-sm font-semibold text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Try again
        </button>
      </div>
    );
  }

  const pairs = combined.data ?? [];
  const filteredPairs = eventFilter === "all" ? pairs : pairs.filter((pair) => pair.event.id === eventFilter);
  const model = buildAgenda(
    filteredPairs.map((pair) => pair.event),
    filteredPairs,
    eventFilter === "all" ? standalone.data ?? [] : [],
  );
  const firstName = (user?.displayName || "there").split(" ")[0];
  const activeEvent = model.nextEvent;
  const activePair = activeEvent
    ? filteredPairs.find((pair) => pair.event.id === activeEvent.id) ?? pairs.find((pair) => pair.event.id === activeEvent.id)
    : undefined;
  const activeTotal = activePair?.tasks.length ?? 0;
  const activeDone = activePair?.tasks.filter((task) => task.done).length ?? 0;
  const activeProgress = activeTotal === 0 ? 0 : Math.round((activeDone / activeTotal) * 100);
  const isEmpty = model.events.length === 0 && model.openCount === 0 && model.completedCount === 0;
  const toggle = (row: RowTask) => checkOff.mutate({ eventId: row.eventId, taskId: row.id, done: !row.done });

  return (
    <div className="min-h-full bg-background">
      <div
        className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-10"
        style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}
      >
        <Reveal y={10}>
          <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                {greetingForNow()}, {firstName}
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h1 className="font-heading text-4xl font-extrabold tracking-[-0.06em] sm:text-5xl">Overview</h1>
                <p className="text-sm text-muted-foreground">{formatLongDate(todayIso())}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/calendar"
                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold transition-colors hover:border-foreground/30 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <CalendarDays className="h-4 w-4" aria-hidden />
                Calendar
              </Link>
              <Link
                href="/events/new"
                className="inline-flex min-h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Plus className="h-4 w-4" aria-hidden />
                New event
              </Link>
            </div>
          </header>
        </Reveal>

        {isEmpty ? (
          <EmptyOverview />
        ) : (
          <>
            <Reveal delay={0.05} y={8}>
              <div className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between">
                {pairs.length > 0 ? (
                  <label className="flex items-center gap-3 text-sm font-semibold" htmlFor="event-focus">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Planning for</span>
                    <span className="relative">
                      <select
                        id="event-focus"
                        value={eventFilter}
                        onChange={(event) => setEventFilter(event.target.value as string | "all")}
                        className="min-h-8 min-w-40 appearance-none border-b border-foreground/30 bg-transparent py-1 pr-7 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <option value="all">All events</option>
                        {pairs.map(({ event }) => (
                          <option key={event.id} value={event.id}>
                            {event.title}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-muted-foreground">⌄</span>
                    </span>
                  </label>
                ) : (
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Personal tasks</p>
                )}
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{model.openCount}</span> open tasks · {model.completedCount} complete
                </p>
              </div>
            </Reveal>

            {activeEvent ? (
              <Reveal delay={0.08} y={10}>
                <section className="border-b border-border py-5" aria-label="Event focus">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                        {eventFilter === "all" ? "Next event" : "Focused event"}
                        <span className="px-2 text-muted-foreground/50" aria-hidden>/</span>
                        <span className="text-muted-foreground">{activeEvent.status}</span>
                      </p>
                      <h2 className="mt-2 truncate font-heading text-3xl font-extrabold tracking-[-0.055em] sm:text-4xl">
                        {activeEvent.title}
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-primary/70" aria-hidden />
                          {formatLongDate(activeEvent.date)}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-primary/70" aria-hidden />
                          {formatTime(activeEvent.time)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Countdown</p>
                        <p className="mt-1 font-heading text-xl font-extrabold tracking-[-0.04em]">{countdownLabel(activeEvent.date)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Event tasks</p>
                        <p className="mt-1 inline-flex items-center gap-1.5 font-heading text-xl font-extrabold tracking-[-0.04em]">
                          <ListChecks className="h-4 w-4 text-primary" aria-hidden />
                          {activeDone}/{activeTotal}
                        </p>
                      </div>
                      <Link
                        href="/calendar"
                        className="inline-flex min-h-9 items-center gap-2 border-b border-primary/40 pb-1 text-sm font-semibold text-primary transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                      >
                        Open calendar
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>
                  </div>
                  <div
                    className="mt-5 h-1 overflow-hidden rounded-full bg-secondary"
                    aria-label={`${activeProgress}% of event tasks complete`}
                    role="progressbar"
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={activeProgress}
                  >
                    <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${activeProgress}%` }} />
                  </div>
                </section>
              </Reveal>
            ) : null}

            <Stagger className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(17rem,.9fr)] lg:gap-12" gap={0.06}>
              <StaggerItem>
                <section aria-label="Today">
                  <SectionHeading eyebrow="Today" title="Work in front of you" count={model.dueToday.length} />
                  {model.overdue.length > 0 ? (
                    <div className="mt-4 border-l-2 border-destructive pl-4">
                      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-destructive">
                        <CircleAlert className="h-3.5 w-3.5" aria-hidden />
                        Needs attention
                      </p>
                      <ul className="mt-1 divide-y divide-destructive/15">
                        {model.overdue.map((row) => (
                          <TaskRow key={`overdue-${row.id}`} row={row} onToggle={() => toggle(row)} tone="danger" />
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="mt-4">
                    {model.dueToday.length === 0 ? (
                      <div className="border-y border-border py-6">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <Check className="h-4 w-4 text-emerald-700" aria-hidden />
                          Nothing due today.
                        </p>
                        <p className="mt-1 pl-6 text-sm text-muted-foreground">Use the time to move one upcoming task forward.</p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-border border-y border-border">
                        {model.dueToday.map((row) => (
                          <TaskRow key={`today-${row.id}`} row={row} onToggle={() => toggle(row)} />
                        ))}
                      </ul>
                    )}
                  </div>
                  <Link
                    href="/tasks"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline decoration-primary/25 underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  >
                    Open all tasks
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </section>
              </StaggerItem>

              <StaggerItem>
                <section aria-label="Upcoming" className="lg:border-l lg:border-border lg:pl-10">
                  <SectionHeading
                    eyebrow="Coming up"
                    title="Upcoming"
                    count={model.upcomingByDate.reduce((total, group) => total + group.tasks.length, 0)}
                  />
                  {model.upcomingByDate.length > 0 ? (
                    <div className="mt-4 space-y-5">
                      {model.upcomingByDate.map(({ date, tasks }) => (
                        <div key={date}>
                          <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
                            <p className="text-sm font-bold">{formatDayMonth(date)}</p>
                            <p className="text-xs text-muted-foreground">{formatCountdown(date)}</p>
                          </div>
                          <ul className="divide-y divide-border">
                            {tasks.map((row) => (
                              <TaskRow key={`upcoming-${row.id}`} row={row} onToggle={() => toggle(row)} />
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 border-y border-border py-6 text-sm text-muted-foreground">
                      No upcoming tasks yet. Your next useful move can start here.
                    </div>
                  )}
                </section>
              </StaggerItem>
            </Stagger>
          </>
        )}
      </div>
      {checkOff.isError ? (
        <p
          role="alert"
          className="fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-sm rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Couldn&apos;t save that change. Try again.
        </p>
      ) : null}
    </div>
  );
}

function SectionHeading({ eyebrow, title, count }: { eyebrow: string; title: string; count: number }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        <h2 className="mt-1.5 font-heading text-xl font-extrabold tracking-[-0.045em] sm:text-2xl">{title}</h2>
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{count} {count === 1 ? "item" : "items"}</span>
    </div>
  );
}

function EmptyOverview() {
  return (
    <Reveal delay={0.08} y={12}>
      <section className="mt-10 grid gap-8 border-y border-border py-12 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16 lg:py-16">
        <div className="max-w-2xl">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-primary">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
          <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Your planning desk is ready</p>
          <h2 className="mt-3 max-w-xl font-heading text-4xl font-extrabold leading-[1.02] tracking-[-0.06em] sm:text-5xl">
            Give the next gathering a clear shape.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
            Start with an event, then add the tasks that make the day happen. Personal tasks can live alongside it on any date.
          </p>
        </div>
        <Link
          href="/events/new"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:min-w-44"
        >
          Create your first event
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>
    </Reveal>
  );
}

function TaskRow({ row, onToggle, tone = "normal" }: { row: RowTask; onToggle: () => void; tone?: "normal" | "danger" }) {
  return (
    <motion.li layout initial={false} animate={{ opacity: 1 }} transition={springs.rise}>
      <div className="group flex min-h-[3.6rem] items-center gap-3 py-2.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={row.done}
          aria-label={`Mark complete: ${row.title}`}
          onClick={onToggle}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-foreground/30 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            row.done && "border-primary bg-primary text-primary-foreground",
          )}
        >
          {row.done ? <Check className="h-3 w-3" aria-hidden /> : null}
        </button>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[13px] font-semibold", row.done && "text-muted-foreground line-through")}>{row.title}</span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            {row.eventTitle}
            {row.group ? <><span aria-hidden>·</span>{row.group}</> : null}
            {row.dueTime ? <><span aria-hidden>·</span>{formatTime(row.dueTime)}</> : null}
          </span>
        </span>
        {tone === "danger" ? <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-destructive">Overdue</span> : null}
      </div>
    </motion.li>
  );
}

export default function TodayPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
