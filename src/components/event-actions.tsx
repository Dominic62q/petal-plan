"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteEvent, updateEvent, type PlannerEvent } from "@/lib/data";
import {
  currentTimeZone,
  parseReminderOffset,
  reminderOptionFromOffset,
  REMINDER_OPTIONS,
  type ReminderOptionValue,
} from "@/lib/reminders";

const useRefreshEvents = (uid: string) => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["all-tasks", uid] }),
    ]);
};

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

function EditForm({ uid, event, onDone }: { uid: string; event: PlannerEvent; onDone: () => void }) {
  const refresh = useRefreshEvents(uid);
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.date);
  const [time, setTime] = useState(event.time);
  const [status, setStatus] = useState(event.status);
  const [reminder, setReminder] = useState<ReminderOptionValue>(reminderOptionFromOffset(event.reminderOffsetMinutes));
  const [problem, setProblem] = useState("");

  const save = useMutation({
    mutationFn: () =>
      updateEvent(event.id, {
        title: title.trim(),
        date,
        time,
        status,
        // A reminder is measured from the time, so a new time gets this device's zone.
        ...(time !== event.time ? { timeZone: currentTimeZone() } : {}),
        reminderOffsetMinutes: parseReminderOffset(reminder) ?? null,
      }),
    onSuccess: async () => {
      await refresh();
      onDone();
    },
    onError: (error) => setProblem(errorText(error, "Could not save the changes. Try again.")),
  });

  const submit = (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (title.trim().length < 3) return setProblem("Give the event a name (at least 3 characters).");
    if (!date) return setProblem("Choose the event date.");
    if (!/^\d{2}:\d{2}$/.test(time)) return setProblem("Set a start time.");
    setProblem("");
    save.mutate();
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="edit-event-title">Event name</Label>
        <Input
          id="edit-event-title"
          value={title}
          onChange={(change) => setTitle(change.target.value)}
          maxLength={120}
          className="h-12 text-base"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="edit-event-date">Date</Label>
          <Input id="edit-event-date" type="date" value={date} onChange={(change) => setDate(change.target.value)} className="h-12 text-base" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-event-time">Start time</Label>
          <Input id="edit-event-time" type="time" value={time} onChange={(change) => setTime(change.target.value)} className="h-12 text-base" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="edit-event-status">Status</Label>
          <select
            id="edit-event-status"
            value={status}
            onChange={(change) => setStatus(change.target.value as PlannerEvent["status"])}
            className="h-12 w-full rounded-2xl border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/25"
          >
            <option value="planning">Planning</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-event-reminder">Remind me</Label>
          <select
            id="edit-event-reminder"
            value={reminder}
            onChange={(change) => setReminder(change.target.value as ReminderOptionValue)}
            className="h-12 w-full rounded-2xl border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/25"
          >
            {REMINDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {problem ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          {problem}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteConfirm({
  uid,
  event,
  taskCount,
  onDone,
  onDeleted,
}: {
  uid: string;
  event: PlannerEvent;
  taskCount: number;
  onDone: () => void;
  onDeleted: () => void;
}) {
  const refresh = useRefreshEvents(uid);
  const [problem, setProblem] = useState("");
  const remove = useMutation({
    mutationFn: () => deleteEvent(event.id),
    onSuccess: async () => {
      await refresh();
      onDone();
      onDeleted();
    },
    onError: (error) => setProblem(errorText(error, "Could not delete the event. Try again.")),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Delete this event?</DialogTitle>
        <DialogDescription>
          “{event.title}”
          {taskCount > 0 ? ` and its ${taskCount} ${taskCount === 1 ? "task" : "tasks"}` : ""}, along with its schedule, will be
          removed for good. This can&apos;t be undone.
        </DialogDescription>
      </DialogHeader>
      {problem ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          {problem}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={remove.isPending}>
          Keep it
        </Button>
        <Button type="button" variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
          {remove.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
          Delete event
        </Button>
      </DialogFooter>
    </>
  );
}

/** Edit and delete controls for the event selected on Today. */
export function EventActions({
  uid,
  event,
  taskCount,
  onDeleted,
}: {
  uid: string;
  event: PlannerEvent;
  taskCount: number;
  /** Called as soon as the event is gone, so the screen can drop its filter. */
  onDeleted: () => void;
}) {
  const [mode, setMode] = useState<"edit" | "delete" | null>(null);
  const close = () => setMode(null);

  return (
    <div className="mt-3 flex gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={() => setMode("edit")} className="gap-1.5">
        <Pencil className="h-4 w-4" aria-hidden />
        Edit event
      </Button>
      <Button type="button" variant="destructive" size="sm" onClick={() => setMode("delete")} className="gap-1.5">
        <Trash2 className="h-4 w-4" aria-hidden />
        Delete
      </Button>

      <Dialog open={mode !== null} onOpenChange={(open) => (open ? null : close())}>
        <DialogContent showCloseButton={mode === "edit"}>
          {mode === "edit" ? (
            <>
              <DialogHeader>
                <DialogTitle>Edit event</DialogTitle>
                <DialogDescription>Changing the date or time moves its reminder too.</DialogDescription>
              </DialogHeader>
              <EditForm uid={uid} event={event} onDone={close} />
            </>
          ) : mode === "delete" ? (
            <DeleteConfirm uid={uid} event={event} taskCount={taskCount} onDone={close} onDeleted={onDeleted} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
