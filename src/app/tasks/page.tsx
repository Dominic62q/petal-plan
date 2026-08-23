"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, LoaderCircle, Plus, Trash2 } from "lucide-react";
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
import {
  Reveal,
  Stagger,
  StaggerItem,
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
import { formatCountdown, formatLongDate, formatTime, todayIso } from "@/lib/datetime";
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

function AnimatedCheck({
  done,
  onToggle,
}: {
  done: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Completed` : `Mark complete`}
      onClick={onToggle}
      className={cn(
        "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        done
          ? "border-primary bg-primary text-primary-foreground"
          : "border-outline bg-transparent hover:border-primary",
      )}
      whileTap={{ scale: 0.82 }}
      transition={springs.pop}
    >
      <AnimatePresence>
        {done ? (
          <motion.svg
            key="check"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={springs.pop}
          >
            <motion.path
              d="M5 13l4 4L19 7"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.25, delay: 0.05 }}
            />
          </motion.svg>
        ) : null}
      </AnimatePresence>
    </motion.button>
  );
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
      <SheetContent side="bottom" className="rounded-t-2xl px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2">
        <SheetHeader className="p-0">
          <SheetTitle className="text-left font-heading text-lg font-bold">Add task</SheetTitle>
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
                className="min-h-9 text-sm font-semibold text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowDueTime(true)}
                className="min-h-9 text-sm font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
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
                    "min-h-10 flex-1 rounded-md border px-3 text-sm font-semibold capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    priority === option
                      ? option === "high"
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "border-primary bg-primary/[0.06] text-foreground"
                      : "border-border bg-card text-muted-foreground",
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
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            >
              <option value="none">No event — personal task</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={addTask.isPending} className="min-h-10 w-full rounded-md text-base font-semibold">
            {addTask.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Add task
          </Button>
          {error ? (
            <p role="alert" className="border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
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
  const [filter, setFilter] = useState<Filter>("open");
  const [scope, setScope] = useState<Scope>("all");
  const [sheetOpen, setSheetOpen] = useState(searchParams.get("new") === "1");
  const [pendingDelete, setPendingDelete] = useState<TaskRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const deleteTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
  }, []);

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
  const remove = useMutation({
    mutationFn: ({ eventId, taskId }: { eventId: string | null; taskId: string }) =>
      eventId ? deleteTask(eventId, taskId) : deleteStandaloneTask(uid!, taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["all-tasks", uid] });
      void queryClient.invalidateQueries({ queryKey: ["standalone-tasks", uid] });
      void queryClient.invalidateQueries({ queryKey: ["calendar", uid] });
    },
    onError: (error) => setActionError(error instanceof Error ? `Couldn’t delete that task: ${error.message}` : "Couldn’t delete that task."),
    onSettled: () => setPendingDelete(null),
  });

  const requestDelete = (row: TaskRow) => {
    setActionError(null);
    setPendingDelete(row);
    deleteTimer.current = window.setTimeout(() => {
      remove.mutate({ eventId: row.eventId, taskId: row.id });
    }, 5_000);
  };

  const undoDelete = () => {
    if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
    deleteTimer.current = null;
    setPendingDelete(null);
  };

  const taskRows = useMemo(
    () => mergeTaskRows(combined.data ?? [], standalone.data ?? []),
    [combined.data, standalone.data],
  );
  const scopedTasks = useMemo(
    () => taskRows.filter((task) => scope === "all" || (scope === "events" ? Boolean(task.eventId) : !task.eventId)),
    [taskRows, scope],
  );
  const groupedEntries = useMemo(() => {
    const visible = scopedTasks.filter((task) =>
      matchesFilter(task, filter) &&
      !(pendingDelete?.id === task.id && pendingDelete.eventId === task.eventId),
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
  }, [scopedTasks, filter, pendingDelete]);

  const events = useMemo(() => (combined.data ?? []).map((pair) => pair.event), [combined.data]);

  if (combined.isPending || standalone.isPending) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-5" aria-busy="true" aria-label="Loading tasks" style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}>
        <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-9 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-2">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (combined.isError || standalone.isError) {
    const queryError = combined.error ?? standalone.error;
    const message = queryError instanceof Error ? queryError.message : "Could not load tasks.";
    return (
      <div className="mx-auto max-w-lg px-5 pt-14 text-center">
        <CircleAlert className="mx-auto h-8 w-8 text-destructive" aria-hidden />
        <h2 className="mt-3 font-heading text-lg font-bold">Something went wrong</h2>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        <button
          type="button"
          onClick={() => {
            if (combined.isError) void combined.refetch();
            if (standalone.isError) void standalone.refetch();
          }}
          className="mt-4 min-h-9 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Try again
        </button>
      </div>
    );
  }

  const totalVisible = groupedEntries.reduce((sum, [, rows]) => sum + rows.length, 0);
  const { totalTasks, totalDone, totalOpen, progressPercent } = summarizeTasks(scopedTasks);


  return (
    <div className="min-h-full bg-background">
      <div
        className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-10"
        style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}
      >
        <Reveal y={10}>
          <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Work desk</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h1 className="font-heading text-4xl font-extrabold tracking-[-0.06em] sm:text-5xl">Tasks</h1>
                <p className="text-sm text-muted-foreground">{totalOpen} open · {progressPercent}% complete</p>
              </div>
            </div>
            <TapScale amount={0.97}>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-label="Add task"
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add task
              </button>
            </TapScale>
          </header>
        </Reveal>

        <div className="mt-5 grid grid-cols-3 border-y border-border" aria-label="Task summary">
          <div className="border-r border-border py-3 pr-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Open</p>
            <p className="mt-1 font-heading text-xl font-extrabold tracking-[-0.04em]">{totalOpen}</p>
          </div>
          <div className="border-r border-border px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Due today</p>
            <p className="mt-1 font-heading text-xl font-extrabold tracking-[-0.04em]">{taskRows.filter((task) => !task.done && task.dueDate === todayIso()).length}</p>
          </div>
          <div className="py-3 pl-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Completed</p>
            <p className="mt-1 font-heading text-xl font-extrabold tracking-[-0.04em]">{totalDone}<span className="ml-1 text-sm font-semibold text-muted-foreground">/ {totalTasks}</span></p>
          </div>
        </div>

        <div className="sticky top-0 z-10 mt-6 border-b border-border bg-background/95 py-2 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Task status">
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
                      "min-h-9 shrink-0 border-b-2 px-0.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
                      selected ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span className="sr-only">Task context</span>
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value as Scope)}
                className="min-h-8 rounded-md border border-border bg-card px-2.5 text-xs font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {SCOPES.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
              </select>
            </label>
          </div>
        </div>

        {totalVisible === 0 ? (
          <Reveal delay={0.05}>
            <section className="mt-8 border-y border-border py-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{scope === "personal" ? "Personal tasks" : scope === "events" ? "Event tasks" : "Task desk"}</p>
              <h2 className="mt-3 font-heading text-2xl font-extrabold tracking-[-0.045em]">
                {filter === "overdue" || filter === "due"
                  ? `Nothing ${filter === "due" ? "due today" : "overdue"}`
                  : filter === "done"
                    ? "Nothing completed yet"
                    : "No open tasks"}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {filter === "due" ? "Keep the day clear, or add one intentional task." : filter === "overdue" ? "You’re caught up for now." : "Add a task when there is real work to capture."}
              </p>
              <div className="mt-5 flex flex-wrap gap-4">
                <button type="button" onClick={() => setSheetOpen(true)} className="text-sm font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Add task</button>
                {filter !== "open" ? <button type="button" onClick={() => setFilter("open")} className="text-sm font-semibold text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Show open tasks</button> : null}
              </div>
            </section>
          </Reveal>
        ) : (
          <Stagger gap={0.05} className="mt-8 divide-y divide-border">
            {groupedEntries.map(([dueDate, rows]) => {
              const openCount = rows.filter((row) => !row.done).length;
              return (
                <StaggerItem key={dueDate}>
                  <section aria-label={`Tasks for ${formatLongDate(dueDate)}`}>
                    <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{formatLongDate(dueDate)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatCountdown(dueDate)}</p>
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">{openCount} open</span>
                    </div>
                    <ul className="divide-y divide-border">
                      <AnimatePresence initial={false}>
                        {rows.map((row) => {
                          const overdue = !row.done && row.dueDate < todayIso();
                          return (
                            <motion.li
                              key={`${row.eventId ?? "personal"}-${row.id}`}
                              layout
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0, transition: springs.rise }}
                              className={cn("flex items-center gap-3 py-4", row.done && "opacity-55")}
                            >
                              <AnimatedCheck
                                done={row.done}
                                onToggle={() => toggle.mutate({ eventId: row.eventId, taskId: row.id, done: !row.done })}
                              />
                              <div className="min-w-0 flex-1">
                                <motion.p className="truncate text-sm font-semibold" animate={{ opacity: row.done ? 0.55 : 1 }}>
                                  {row.done ? <s>{row.title}</s> : row.title}
                                </motion.p>
                                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                                  <span className={cn("font-semibold", row.eventId ? "text-foreground/75" : "text-primary")}>{row.eventId ? row.eventTitle : "Personal task"}</span>
                                  <span aria-hidden>·</span>
                                  <span>{row.group}</span>
                                  {row.dueTime ? <><span aria-hidden>·</span><span>{formatTime(row.dueTime)}</span></> : null}
                                  {overdue ? <><span aria-hidden>·</span><span className="font-semibold text-destructive">Overdue</span></> : null}
                                </p>
                              </div>
                              <span className={cn("hidden shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] sm:inline", row.priority === "high" ? "text-destructive" : "text-muted-foreground")}>{row.priority}</span>
                              <button
                                type="button"
                                onClick={() => requestDelete(row)}
                                aria-label={`Delete ${row.title}`}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                              </button>
                            </motion.li>
                          );
                        })}
                      </AnimatePresence>
                    </ul>
                  </section>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </div>

      {pendingDelete ? (
        <div role="status" className="fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-sm items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm shadow-lg">
          <span>Task deleted</span>
          <button type="button" onClick={undoDelete} className="min-h-9 font-semibold text-primary underline-offset-4 hover:underline">Undo</button>
        </div>
      ) : actionError ? (
        <p role="alert" className="fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-sm rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{actionError}</p>
      ) : null}

      <NewTaskSheet
        events={events}
        defaultEventId={requestedEventId || events[0]?.id || ""}
        defaultDueDate={requestedDate}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}

export default function TasksPage() {
  return (
    <RequireAuth>
      <TasksContent />
    </RequireAuth>
  );
}
