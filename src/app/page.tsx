"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, CalendarPlus, Check, CircleAlert, MessageCircle, Plus } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { EventActions } from "@/components/event-actions";
import { RequireAuth } from "@/components/require-auth";
import { AnimatedNumber, Reveal, TapScale, springs } from "@/components/motion-primitives";
import { canvasButton, GroupHeading, ScreenShell } from "@/components/page-header";
import { ProgressRing } from "@/components/progress-ring";
import { TaskItem } from "@/components/task-item";
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
  overdue: RowTask[];
  dueToday: RowTask[];
  dueTodayTotal: number;
  upcomingByDate: Array<{ date: string; tasks: RowTask[] }>;
  openCount: number;
  completedCount: number;
}

function buildAgenda(
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
  const grouped = new Map<string, RowTask[]>();
  for (const task of byPriorityThenDate.filter((item) => item.dueDate > today)) {
    const bucket = grouped.get(task.dueDate) ?? [];
    bucket.push(task);
    grouped.set(task.dueDate, bucket);
  }

  return {
    overdue: byPriorityThenDate.filter((task) => task.dueDate < today),
    dueToday: byPriorityThenDate.filter((task) => task.dueDate === today),
    dueTodayTotal: all.filter((task) => task.dueDate === today).length,
    upcomingByDate: [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, tasks]) => ({ date, tasks })),
    openCount: open.length,
    completedCount: all.length - open.length,
  };
}

function DashboardSkeleton() {
  return (
    <div className="min-h-dvh bg-brand" aria-busy="true" aria-label="Loading your overview">
      <div className="mx-auto max-w-3xl space-y-4 px-5 pt-[max(1.75rem,env(safe-area-inset-top))] pb-16">
        <div className="h-4 w-36 rounded-full bg-white/30" />
        <div className="h-10 w-32 rounded-2xl bg-white/30" />
        <div className="h-24 rounded-3xl bg-white/20" />
      </div>
      <div className="-mt-8 min-h-[60dvh] space-y-4 rounded-t-3xl bg-card px-5 pt-8">
        <div className="skeleton h-28 rounded-3xl" />
        {[0, 1, 2].map((row) => (
          <div key={row} className="skeleton h-14 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function EventRail({
  pairs,
  value,
  onChange,
}: {
  pairs: Array<{ event: PlannerEvent; tasks: EventTask[] }>;
  value: string;
  onChange: (next: string) => void;
}) {
  const [showPast, setShowPast] = useState(false);
  const byDate = [...pairs].sort((a, b) => a.event.date.localeCompare(b.event.date));
  const upcoming = byDate.filter((pair) => daysUntil(pair.event.date) >= 0);
  // Most recent first, so the one you probably want is nearest the front.
  const past = byDate.filter((pair) => daysUntil(pair.event.date) < 0).reverse();
  // Past events stay out of the way unless asked for, but never hide the one that is selected.
  const sorted = showPast ? [...upcoming, ...past] : upcoming;

  const togglePast = () => {
    if (showPast && past.some((pair) => pair.event.id === value)) onChange("all");
    setShowPast((current) => !current);
  };

  return (
    <section aria-label="Your events">
      <div className="mt-1 mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-xl font-bold tracking-tight">Your events</h2>
        <Link
          href="/calendar"
          className="rounded-full px-1 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-4 focus-visible:ring-ring/30"
        >
          Calendar
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">No upcoming events.</p>
      ) : null}
      <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
        {sorted.map(({ event, tasks }, index) => {
          const days = daysUntil(event.date);
          const selected = value === event.id;
          const done = tasks.filter((task) => task.done).length;
          const pct = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);
          return (
            <motion.button
              key={event.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? "all" : event.id)}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...springs.rise, delay: 0.1 + index * 0.06 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "relative flex w-40 shrink-0 snap-start flex-col rounded-3xl p-4 text-left outline-none transition-colors focus-visible:ring-4 focus-visible:ring-ring/30",
                selected ? "bg-brand text-primary-foreground" : "bg-secondary text-secondary-foreground",
                days < 0 && !selected && "opacity-60",
              )}
            >
              <span className="font-heading text-4xl leading-none font-bold tabular-nums">
                {days > 0 ? days : days === 0 ? "Now" : "—"}
              </span>
              <span className={cn("mt-1 text-xs font-semibold", selected ? "text-white/85" : "text-primary")}>
                {days > 0 ? (days === 1 ? "day to go" : "days to go") : days === 0 ? "today" : "passed"}
              </span>
              <span className="mt-3 line-clamp-2 min-h-10 text-[15px] leading-5 font-semibold">{event.title}</span>
              <span className={cn("mt-1 text-xs font-bold", selected ? "text-white/80" : "text-muted-foreground")}>
                {formatDayMonth(event.date)}
              </span>
              <span className={cn("mt-3 block h-1.5 overflow-hidden rounded-full", selected ? "bg-white/30" : "bg-primary/15")}>
                <motion.span
                  className={cn("block h-full rounded-full", selected ? "bg-white" : "bg-primary")}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ ...springs.surface, delay: 0.3 }}
                />
              </span>
            </motion.button>
          );
        })}
        {past.length > 0 ? (
          <button
            type="button"
            onClick={togglePast}
            aria-expanded={showPast}
            className="flex w-32 shrink-0 snap-start flex-col items-start justify-center rounded-3xl border border-dashed border-primary/30 p-4 text-left text-sm font-semibold text-primary outline-none transition-colors hover:bg-secondary focus-visible:ring-4 focus-visible:ring-ring/30"
          >
            {showPast ? "Hide past events" : `Past events (${past.length})`}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function TaskList({
  rows,
  onToggle,
  overdue = false,
}: {
  rows: RowTask[];
  onToggle: (row: RowTask) => void;
  overdue?: boolean;
}) {
  return (
    <ul>
      <AnimatePresence initial={false}>
        {rows.map((row) => (
          <TaskItem key={`${row.eventId ?? "personal"}-${row.id}`} row={row} overdue={overdue} onToggle={() => onToggle(row)} />
        ))}
      </AnimatePresence>
    </ul>
  );
}

function QuietState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">{icon}</div>
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function EmptyOverview() {
  return (
    <Reveal delay={0.1} y={14}>
      <div className="flex flex-col items-center px-2 pt-8 pb-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-primary">
          <CalendarPlus className="h-8 w-8" aria-hidden />
        </div>
        <h2 className="mt-6 font-heading text-2xl font-bold tracking-tight">No events yet</h2>
        <p className="mt-2 max-w-xs text-base leading-6 text-muted-foreground">
          Create an event and add the tasks it needs. Personal tasks can sit alongside it on any date.
        </p>
        <TapScale className="mt-7">
          <Link
            href="/events/new"
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-brand px-7 text-base font-semibold text-primary-foreground outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
          >
            <Plus className="h-5 w-5" aria-hidden />
            Create your first event
          </Link>
        </TapScale>
      </div>
    </Reveal>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.uid;
  const [eventFilter, setEventFilter] = useState<string>("all");

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

  if (combined.isPending || standalone.isPending) return <DashboardSkeleton />;

  if (combined.isError || standalone.isError) {
    const queryError = combined.error ?? standalone.error;
    const message = queryError instanceof Error ? queryError.message : "Could not load your overview.";
    return (
      <div className="mx-auto max-w-lg px-6 pt-28 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <CircleAlert className="h-9 w-9" aria-hidden />
        </div>
        <h2 className="mt-5 font-heading text-2xl font-bold tracking-tight">Something went wrong</h2>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">{message}</p>
        <button
          type="button"
          onClick={() => {
            if (combined.isError) void combined.refetch();
            if (standalone.isError) void standalone.refetch();
          }}
          className="mt-6 inline-flex h-14 items-center justify-center rounded-xl bg-brand px-8 text-base font-semibold text-primary-foreground outline-none active:scale-95 focus-visible:ring-4 focus-visible:ring-ring/30"
        >
          Try again
        </button>
      </div>
    );
  }

  const pairs = combined.data ?? [];
  // A filter pointing at a since-deleted event falls back to "all".
  const activeFilter = eventFilter === "all" || pairs.some((pair) => pair.event.id === eventFilter) ? eventFilter : "all";
  const filteredPairs = activeFilter === "all" ? pairs : pairs.filter((pair) => pair.event.id === activeFilter);
  const selectedPair = activeFilter === "all" ? null : filteredPairs[0] ?? null;
  const model = buildAgenda(filteredPairs, activeFilter === "all" ? standalone.data ?? [] : []);
  const firstName = (user?.displayName || "there").split(" ")[0];
  const initial = (user?.displayName || user?.email || "P").charAt(0).toUpperCase();
  const isEmpty = pairs.length === 0 && (standalone.data ?? []).length === 0;
  const upcomingCount = model.upcomingByDate.reduce((total, group) => total + group.tasks.length, 0);
  const todayDone = model.dueTodayTotal - model.dueToday.length;
  const todayPct = model.dueTodayTotal === 0 ? 0 : Math.round((todayDone / model.dueTodayTotal) * 100);
  const toggle = (row: RowTask) => checkOff.mutate({ eventId: row.eventId, taskId: row.id, done: !row.done });

  return (
    <ScreenShell
      greeting={`${greetingForNow()}, ${firstName}`}
      title="Today"
      action={
        <div className="flex items-center gap-2">
          <Link href="/assistant" className={cn(canvasButton, "h-11 gap-2 px-3.5 text-sm font-semibold")}>
            <MessageCircle className="h-[18px] w-[18px]" aria-hidden />
            Ask
          </Link>
          <Link href="/profile" aria-label="Account" className={cn(canvasButton, "h-11 w-11 px-0 text-base font-bold")}>
            {initial}
          </Link>
        </div>
      }
      canvas={
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-white/80">{formatLongDate(todayIso())}</p>
            <p className="mt-3 font-heading text-6xl leading-none font-bold tabular-nums">
              <AnimatedNumber value={model.dueToday.length} />
            </p>
            <p className="mt-1.5 text-base font-semibold text-white/90">
              {model.dueToday.length === 1 ? "task" : "tasks"} left today
            </p>
            {model.overdue.length > 0 ? (
              <p className="mt-2 inline-flex rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-destructive">
                {model.overdue.length} overdue
              </p>
            ) : null}
          </div>
          <ProgressRing value={todayPct} size={104} stroke={12} onDark label={`${todayPct}% of today's tasks complete`}>
            <span className="font-heading text-xl font-bold tabular-nums">{todayPct}%</span>
          </ProgressRing>
        </div>
      }
    >
      {isEmpty ? (
        <EmptyOverview />
      ) : (
        <>
          {pairs.length > 0 ? <EventRail pairs={pairs} value={activeFilter} onChange={setEventFilter} /> : null}
          {selectedPair && user ? (
            <EventActions
              key={selectedPair.event.id}
              uid={user.uid}
              event={selectedPair.event}
              taskCount={selectedPair.tasks.length}
              onDeleted={() => setEventFilter("all")}
            />
          ) : null}

          {model.overdue.length > 0 ? (
            <section aria-label="Needs attention">
              <GroupHeading count={model.overdue.length} tone="danger">
                Needs attention
              </GroupHeading>
              <TaskList rows={model.overdue} onToggle={toggle} overdue />
            </section>
          ) : null}

          <section aria-label="Today">
            <GroupHeading count={model.dueToday.length}>Due today</GroupHeading>
            {model.dueToday.length === 0 ? (
              <QuietState
                icon={<Check className="h-6 w-6" aria-hidden />}
                title={model.dueTodayTotal > 0 ? "All done for today" : "Nothing due today"}
                body={model.dueTodayTotal > 0 ? "You are all caught up." : "Nothing is scheduled for today."}
              />
            ) : (
              <TaskList rows={model.dueToday} onToggle={toggle} />
            )}
          </section>

          <section aria-label="Upcoming">
            <GroupHeading count={upcomingCount}>Coming up</GroupHeading>
            {model.upcomingByDate.length > 0 ? (
              model.upcomingByDate.map(({ date, tasks }) => (
                <div key={date} className="mt-3">
                  <p className="mb-0.5 text-sm font-semibold text-primary">
                    {formatDayMonth(date)} <span className="font-bold text-muted-foreground">· {formatCountdown(date)}</span>
                  </p>
                  <TaskList rows={tasks} onToggle={toggle} />
                </div>
              ))
            ) : (
              <QuietState
                icon={<CalendarDays className="h-6 w-6" aria-hidden />}
                title="Nothing coming up"
                body="New tasks with a future due date will show up here."
              />
            )}
            <Link
              href="/tasks"
              className="mt-4 inline-flex h-11 items-center rounded-xl bg-secondary px-5 text-sm font-semibold text-secondary-foreground outline-none hover:bg-secondary/70 focus-visible:ring-4 focus-visible:ring-ring/30"
            >
              Open all tasks
            </Link>
          </section>
        </>
      )}

      <AnimatePresence>
        {checkOff.isError ? (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={springs.rise}
            className="fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-sm rounded-xl bg-destructive px-5 py-3 text-center text-sm font-semibold text-white shadow-float md:bottom-6"
          >
            Couldn&apos;t save that change. Try again.
          </motion.p>
        ) : null}
      </AnimatePresence>
    </ScreenShell>
  );
}

export default function TodayPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
