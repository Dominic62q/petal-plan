"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, ClipboardList, ListChecks, LoaderCircle, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { GroupHeading, ScreenShell } from "@/components/page-header";
import { ProgressRing } from "@/components/progress-ring";
import { TaskItem } from "@/components/task-item";
import {
  AnimatedNumber,
  Reveal,
  TapScale,
  springs,
} from "@/components/motion-primitives";
import {
  createStandaloneTask,
  createTask,
  deleteStandaloneTask,
  deleteTask,
  listEvents,
  listStandaloneTasks,
  listTasks,
  setStandaloneTaskDone,
  setTaskDone,
  type EventTask,
  type PlannerEvent,
  type TaskPriority,
} from "@/lib/data";
import { mergeTaskRows, summarizeTasks, type TaskRow } from "@/lib/task-model";
import { formatCountdown, formatLongDate, todayIso } from "@/lib/datetime";
import { currentTimeZone, parseReminderOffset, REMINDER_OPTIONS, type ReminderOptionValue } from "@/lib/reminders";
import { PRIORITY_ORDER } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Filter = "open" | "due" | "overdue" | "done";
type Scope = "all" | "events" | "personal";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "open", label: "Open" },
  { key: "due", label: "Due today" },
  { key: "overdue", label: "Overdue" },
  { key: "done", label: "Completed" },
];

const SCOPES: Array<{ key: Scope; label: string }> = [
  { key: "all", label: "All work" },
  { key: "events", label: "Event tasks" },
  { key: "personal", label: "Personal tasks" },
];

const taskKey = (task: { eventId?: string | null; id: string }) =>
  `${task.eventId ?? "personal"}-${task.id}`;

function matchesFilter(
  task: Omit<EventTask, "eventId"> & { eventId?: string | null; eventTitle?: string },
  filter: Filter,
): boolean {
  const today = todayIso();
  switch (filter) {
    case "open":
      return !task.done;
    case "due":
      return !task.done && task.dueDate === today;
    case "overdue":
      return !task.done && task.dueDate < today;
    case "done":
      return task.done;
  }
}

// ---------------------------------------------------------------------------
// New task sheet
// ---------------------------------------------------------------------------

function NewTaskSheet({
  events,
  defaultEventId,
  defaultDueDate,
  open,
  onOpenChange,
}: {
  events: PlannerEvent[];
  defaultEventId: string;
  defaultDueDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [group, setGroup] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState(defaultDueDate || todayIso());
  const [dueTime, setDueTime] = useState("");
  const [showDueTime, setShowDueTime] = useState(false);
  const [reminderOffset, setReminderOffset] = useState<ReminderOptionValue>("");
  // null = untouched. The sheet mounts before events finish loading (so the
  // incoming defaultEventId starts as ""), so the effective selection is
  // derived during render rather than synced with an effect.
  const [pickedEventId, setPickedEventId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const selectedEventId = pickedEventId ?? (defaultEventId || "none");

  const addTask = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Give the task a name.");
      if (!dueDate) throw new Error("Pick a due date.");
      const payload = {
        title: title.trim(),
        group: group.trim() || "General",
        priority,
        dueDate,
        ...(dueTime
          ? {
              dueTime,
              timeZone: currentTimeZone(),
              ...(parseReminderOffset(reminderOffset) !== undefined
                ? { reminderOffsetMinutes: parseReminderOffset(reminderOffset) }
                : {}),
            }
          : {}),
      };
      // "none" = standalone personal task, not tied to any event.
      if (selectedEventId === "none") {
        await createStandaloneTask(user!.uid, payload);
      } else {
        await createTask(selectedEventId, payload);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["all-tasks", user?.uid] });
      void queryClient.invalidateQueries({ queryKey: ["standalone-tasks", user?.uid] });
      void queryClient.invalidateQueries({ queryKey: ["calendar", user?.uid] });
      setTitle("");
      setGroup("");
      setDueDate(defaultDueDate || todayIso());
      setDueTime("");
      setShowDueTime(false);
      setReminderOffset("");
      setPickedEventId(null);
      setError("");
      onOpenChange(false);
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Could not save the task.");
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2">
        <SheetHeader className="p-0">
          <SheetTitle className="text-left font-heading text-xl font-semibold tracking-tight">Add task</SheetTitle>
        </SheetHeader>
        <form
          className="mt-5 space-y-5"
          onSubmit={(formEvent) => {
            formEvent.preventDefault();
            addTask.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Task</Label>
            <Input
              id="task-title"
              placeholder="Confirm final guest count"
              value={title}
              onChange={(inputEvent) => setTitle(inputEvent.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-group">Group</Label>
              <Input
                id="task-group"
                placeholder="Catering"
                value={group}
                onChange={(inputEvent) => setGroup(inputEvent.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(inputEvent) => setDueDate(inputEvent.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Due time</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Optional. Required for reminders.</p>
            </div>
            {showDueTime ? (
              <button
                type="button"
                onClick={() => {
                  setDueTime("");
                  setShowDueTime(false);
                }}
                className="min-h-9 rounded-lg bg-muted px-4 text-sm font-bold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/30"
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowDueTime(true)}
                className="min-h-9 rounded-lg bg-secondary px-4 text-sm font-bold text-secondary-foreground outline-none transition-colors hover:bg-secondary/70 focus-visible:ring-4 focus-visible:ring-ring/30"
              >
                Add time
              </button>
            )}
          </div>
          {showDueTime ? (
            <div className="space-y-1.5">
              <Label htmlFor="task-time">Time</Label>
              <Input
                id="task-time"
                type="time"
                value={dueTime}
                onChange={(inputEvent) => setDueTime(inputEvent.target.value)}
              />
            </div>
          ) : null}
          {dueTime ? (
            <div className="space-y-1.5">
              <Label htmlFor="task-reminder">Remind me</Label>
              <select
                id="task-reminder"
                value={reminderOffset}
                onChange={(selectEvent) => setReminderOffset(selectEvent.target.value as ReminderOptionValue)}
                className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/25"
              >
                {REMINDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Turn on notifications in Account to receive it.</p>
            </div>
          ) : null}
          <fieldset>
            <legend className="text-sm font-medium">Priority</legend>
            <div className="mt-2 flex gap-2">
              {(["low", "medium", "high"] as TaskPriority[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={priority === option}
                  onClick={() => setPriority(option)}
                  className={cn(
                    "min-h-11 flex-1 rounded-2xl border-2 px-3 text-sm font-bold capitalize outline-none transition-all active:scale-95 focus-visible:ring-4 focus-visible:ring-ring/30",
                    priority === option
                      ? option === "high"
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "border-primary bg-secondary text-secondary-foreground"
                      : "border-transparent bg-muted text-muted-foreground",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="task-event">For event</Label>
            <select
              id="task-event"
              value={selectedEventId}
              onChange={(selectEvent) => setPickedEventId(selectEvent.target.value)}
              className="h-12 w-full rounded-2xl border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/25"
            >
              <option value="none">No event — personal task</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={addTask.isPending} className="h-12 w-full text-base font-bold">
            {addTask.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Add task
          </Button>
          {error ? (
            <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              <CircleAlert className="mr-1 inline h-4 w-4" aria-hidden />
              {error}
            </p>
          ) : null}
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function TasksContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const requestedDate = searchParams.get("date") ?? "";
  const requestedEventId = searchParams.get("event") ?? "";
  const uid = user?.uid;
  // Reminder notifications link here with ?focusTask=<id>[&event=<id>].
  const focusTaskId = searchParams.get("focusTask") ?? "";
  const [filterChoice, setFilter] = useState<Filter | null>(null);
  const [scope, setScope] = useState<Scope>("all");
  const [sheetOpen, setSheetOpen] = useState(searchParams.get("new") === "1");
  const [highlightExpired, setHighlightExpired] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Deletes wait 5s so they can be undone. Each one keeps its own timer; the
  // Map is the source of truth, `pendingDeletes` mirrors it for rendering.
  const pendingRef = useRef(new Map<string, { row: TaskRow; timer: number }>());
  const [pendingDeletes, setPendingDeletes] = useState<TaskRow[]>([]);

  const combined = useQuery({
    queryKey: ["all-tasks", uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      const events = await listEvents(uid!);
      const pairs = await Promise.all(
        events.map(async (event) => ({ event, tasks: await listTasks(event.id) })),
      );
      return pairs;
    },
  });

  const standalone = useQuery({
    queryKey: ["standalone-tasks", uid],
    enabled: Boolean(uid),
    queryFn: () => listStandaloneTasks(uid!),
  });

  // Toggle routes to the right store based on whether the task has an event.
  const toggle = useMutation({
    mutationFn: ({ eventId, taskId, done }: { eventId: string | null; taskId: string; done: boolean }) =>
      eventId ? setTaskDone(eventId, taskId, done) : setStandaloneTaskDone(uid!, taskId, done),
    onMutate: async ({ eventId, taskId, done }) => {
      setActionError(null);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["all-tasks", uid] }),
        queryClient.cancelQueries({ queryKey: ["standalone-tasks", uid] }),
      ]);
      const previousCombined = queryClient.getQueryData<typeof combined.data>(["all-tasks", uid]);
      const previousStandalone = queryClient.getQueryData<typeof standalone.data>(["standalone-tasks", uid]);
      if (eventId) queryClient.setQueryData<typeof combined.data>(["all-tasks", uid], (pairs) => pairs?.map((pair) => pair.event.id === eventId ? { ...pair, tasks: pair.tasks.map((task) => task.id === taskId ? { ...task, done } : task) } : pair));
      else queryClient.setQueryData<typeof standalone.data>(["standalone-tasks", uid], (tasks) => tasks?.map((task) => task.id === taskId ? { ...task, done } : task));
      return { previousCombined, previousStandalone };
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(["all-tasks", uid], context?.previousCombined);
      queryClient.setQueryData(["standalone-tasks", uid], context?.previousStandalone);
      setActionError(error instanceof Error ? `Couldn’t save that change: ${error.message}` : "Couldn’t save that change.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["all-tasks", uid] });
      void queryClient.invalidateQueries({ queryKey: ["standalone-tasks", uid] });
      void queryClient.invalidateQueries({ queryKey: ["calendar", uid] });
    },
  });
  const commitDelete = async (row: TaskRow) => {
    try {
      if (row.eventId) await deleteTask(row.eventId, row.id);
      else await deleteStandaloneTask(uid!, row.id);
      void queryClient.invalidateQueries({ queryKey: ["all-tasks", uid] });
      void queryClient.invalidateQueries({ queryKey: ["standalone-tasks", uid] });
      void queryClient.invalidateQueries({ queryKey: ["calendar", uid] });
    } catch (error) {
      setActionError(error instanceof Error ? `Couldn’t delete that task: ${error.message}` : "Couldn’t delete that task.");
    } finally {
      setPendingDeletes((current) => current.filter((pending) => taskKey(pending) !== taskKey(row)));
    }
  };
  // The unmount/pagehide flush below must call the latest closure.
  const commitDeleteRef = useRef(commitDelete);
  useEffect(() => {
    commitDeleteRef.current = commitDelete;
  });

  // Leaving the screen (or hiding the app) must not silently drop deletes the
  // user already saw confirmed, so flush whatever is still waiting.
  useEffect(() => {
    const pending = pendingRef.current;
    const flush = () => {
      for (const { row, timer } of pending.values()) {
        window.clearTimeout(timer);
        void commitDeleteRef.current(row);
      }
      pending.clear();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const requestDelete = (row: TaskRow) => {
    const key = taskKey(row);
    if (pendingRef.current.has(key)) return;
    setActionError(null);
    const timer = window.setTimeout(() => {
      pendingRef.current.delete(key);
      void commitDeleteRef.current(row);
    }, 5_000);
    pendingRef.current.set(key, { row, timer });
    setPendingDeletes((current) => [...current, row]);
  };

  // Undo applies to the most recent delete still inside its 5s window.
  const undoDelete = () => {
    const last = [...pendingRef.current.entries()].pop();
    if (!last) return;
    const [key, { row, timer }] = last;
    window.clearTimeout(timer);
    pendingRef.current.delete(key);
    setPendingDeletes((current) => current.filter((pending) => taskKey(pending) !== taskKey(row)));
  };

  const taskRows = useMemo(
    () => mergeTaskRows(combined.data ?? [], standalone.data ?? []),
    [combined.data, standalone.data],
  );
  const focusRow = useMemo(
    () =>
      focusTaskId
        ? taskRows.find((task) => task.id === focusTaskId && (!requestedEventId || (task.eventId ?? "") === requestedEventId))
        : undefined,
    [taskRows, focusTaskId, requestedEventId],
  );
  const focusRowId = focusRow?.id;
  // A linked task may already be done; show the list it actually lives in.
  const filter: Filter = filterChoice ?? (focusRow?.done ? "done" : "open");

  useEffect(() => {
    if (!focusRowId) return;
    document.getElementById(`task-${focusRowId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    const timer = window.setTimeout(() => setHighlightExpired(true), 4_000);
    return () => window.clearTimeout(timer);
  }, [focusRowId]);
  const scopedTasks = useMemo(
    () => taskRows.filter((task) => scope === "all" || (scope === "events" ? Boolean(task.eventId) : !task.eventId)),
    [taskRows, scope],
  );
  const groupedEntries = useMemo(() => {
    const hidden = new Set(pendingDeletes.map(taskKey));
    const visible = scopedTasks.filter((task) =>
      matchesFilter(task, filter) && !hidden.has(taskKey(task)),
    );
    const byDate: Record<string, TaskRow[]> = {};
    for (const task of [...visible].sort((a, b) =>
      a.dueDate === b.dueDate
        ? (a.dueTime ?? "").localeCompare(b.dueTime ?? "") || Number(a.done) - Number(b.done) || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        : a.dueDate.localeCompare(b.dueDate),
    )) {
      (byDate[task.dueDate] ??= []).push(task);
    }
    return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b));
  }, [scopedTasks, filter, pendingDeletes]);

  const events = useMemo(() => (combined.data ?? []).map((pair) => pair.event), [combined.data]);

  if (combined.isPending || standalone.isPending) {
    return (
      <div className="min-h-dvh bg-brand" aria-busy="true" aria-label="Loading tasks">
        <div className="mx-auto max-w-3xl space-y-4 px-5 pt-[max(1.75rem,env(safe-area-inset-top))] pb-16">
          <div className="h-10 w-32 rounded-2xl bg-white/30" />
          <div className="h-20 rounded-3xl bg-white/20" />
          <div className="h-11 rounded-xl bg-white/20" />
        </div>
        <div className="-mt-8 min-h-[60dvh] space-y-3 rounded-t-3xl bg-card px-5 pt-8">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="skeleton h-14 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (combined.isError || standalone.isError) {
    const queryError = combined.error ?? standalone.error;
    const message = queryError instanceof Error ? queryError.message : "Could not load tasks.";
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

  const totalVisible = groupedEntries.reduce((sum, [, rows]) => sum + rows.length, 0);
  const { totalTasks, totalDone, totalOpen, progressPercent } = summarizeTasks(scopedTasks);
  const emptyTitle =
    filter === "overdue" || filter === "due"
      ? `Nothing ${filter === "due" ? "due today" : "overdue"}`
      : filter === "done"
        ? "Nothing completed yet"
        : "No open tasks";
  const emptyBody =
    filter === "due"
      ? "Keep the day clear, or add one intentional task."
      : filter === "overdue"
        ? "You’re caught up for now."
        : "Add a task when there is real work to capture.";

  return (
    <ScreenShell
      greeting={`${totalDone} of ${totalTasks} done`}
      title="Tasks"
      action={
        <TapScale amount={0.92}>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Add task"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary shadow-float outline-none focus-visible:ring-4 focus-visible:ring-white/50"
          >
            <Plus className="h-6 w-6" strokeWidth={2.8} aria-hidden />
          </button>
        </TapScale>
      }
      canvas={
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-heading text-6xl leading-none font-bold tabular-nums">
                <AnimatedNumber value={totalOpen} />
              </p>
              <p className="mt-1.5 text-base font-semibold text-white/90">open {totalOpen === 1 ? "task" : "tasks"}</p>
            </div>
            <ProgressRing value={progressPercent} size={92} stroke={11} onDark label={`${progressPercent}% of tasks complete`}>
              <span className="font-heading text-lg font-bold tabular-nums">{progressPercent}%</span>
            </ProgressRing>
          </div>

          <div className="flex items-center gap-2">
            <div
              role="tablist"
              aria-label="Task status"
              className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-xl bg-black/10 p-1"
            >
              {FILTERS.map((option) => {
                const selected = filter === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setFilter(option.key)}
                    className={cn(
                      "relative shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-4 focus-visible:ring-white/40",
                      selected ? "text-primary" : "text-white/85",
                    )}
                  >
                    {selected ? (
                      <motion.span
                        layoutId="tasks-filter-pill"
                        className="absolute inset-0 rounded-lg bg-white"
                        transition={springs.rise}
                      />
                    ) : null}
                    <span className="relative">{option.label}</span>
                  </button>
                );
              })}
            </div>
            <label>
              <span className="sr-only">Task context</span>
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value as Scope)}
                className="h-10 max-w-[7.5rem] rounded-xl bg-black/10 px-3 text-sm font-semibold text-white outline-none focus-visible:ring-4 focus-visible:ring-white/40 [&>option]:text-foreground"
              >
                {SCOPES.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      }
    >
      {totalVisible === 0 ? (
        <Reveal delay={0.1}>
          <div className="flex flex-col items-center px-2 pt-10 pb-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-primary">
              {filter === "open" ? <ClipboardList className="h-8 w-8" aria-hidden /> : <ListChecks className="h-8 w-8" aria-hidden />}
            </div>
            <h2 className="mt-6 font-heading text-2xl font-bold tracking-tight">{emptyTitle}</h2>
            <p className="mt-2 max-w-xs text-base leading-6 text-muted-foreground">{emptyBody}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="inline-flex h-12 items-center rounded-xl bg-brand px-6 text-base font-semibold text-primary-foreground outline-none active:scale-95 focus-visible:ring-4 focus-visible:ring-ring/30"
              >
                Add task
              </button>
              {filter !== "open" ? (
                <button
                  type="button"
                  onClick={() => setFilter("open")}
                  className="inline-flex h-12 items-center rounded-xl bg-secondary px-6 text-base font-semibold text-secondary-foreground outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                >
                  Show open tasks
                </button>
              ) : null}
            </div>
          </div>
        </Reveal>
      ) : (
        groupedEntries.map(([dueDate, rows]) => {
          const isToday = dueDate === todayIso();
          return (
            <section key={dueDate} aria-label={`Tasks for ${formatLongDate(dueDate)}`}>
              <GroupHeading count={rows.length}>
                {isToday ? "Today" : formatLongDate(dueDate)}
              </GroupHeading>
              <p className="mb-1 text-sm font-bold text-primary">
                {isToday ? formatLongDate(dueDate) : formatCountdown(dueDate)}
              </p>
              <ul>
                <AnimatePresence initial={false}>
                  {rows.map((row) => (
                    <TaskItem
                      key={taskKey(row)}
                      domId={`task-${row.id}`}
                      row={row}
                      overdue={!row.done && row.dueDate < todayIso()}
                      highlighted={focusRowId === row.id && !highlightExpired}
                      onToggle={() => toggle.mutate({ eventId: row.eventId, taskId: row.id, done: !row.done })}
                      onDelete={() => requestDelete(row)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          );
        })
      )}

      <AnimatePresence>
        {pendingDeletes.length > 0 ? (
          <motion.div
            key="undo"
            role="status"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={springs.rise}
            className="fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-sm items-center justify-between gap-3 rounded-full bg-foreground py-2 pr-2 pl-5 text-sm font-semibold text-background shadow-float md:bottom-6"
          >
            <span>{pendingDeletes.length > 1 ? `${pendingDeletes.length} tasks deleted` : "Task deleted"}</span>
            <button
              type="button"
              onClick={undoDelete}
              className="min-h-10 rounded-lg bg-brand px-5 font-semibold text-primary-foreground outline-none active:scale-95 focus-visible:ring-4 focus-visible:ring-white/30"
            >
              Undo
            </button>
          </motion.div>
        ) : actionError ? (
          <motion.p
            key="error"
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

      <NewTaskSheet
        events={events}
        defaultEventId={requestedEventId || events[0]?.id || ""}
        defaultDueDate={requestedDate}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </ScreenShell>
  );
}

export default function TasksPage() {
  return (
    <RequireAuth>
      <TasksContent />
    </RequireAuth>
  );
}
