"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, CircleAlert, LoaderCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/components/auth-provider";
import { TapScale, springs } from "@/components/motion-primitives";
import { createEvent } from "@/lib/data";
import { formatLongDate, formatCountdown } from "@/lib/datetime";
import { currentTimeZone, parseReminderOffset, REMINDER_OPTIONS, type ReminderOptionValue } from "@/lib/reminders";
import { cn } from "@/lib/utils";

const STEPS = ["Name", "Details", "Review"] as const;

interface WizardState {
  title: string;
  date: string;
  time: string;
  reminderOffset: ReminderOptionValue;
}

function WizardContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const uid = user?.uid;
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [state, setState] = useState<WizardState>({
    title: "",
    date: "",
    time: "17:00",
    reminderOffset: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof WizardState, string>>>({});
  const [serverError, setServerError] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!user?.uid) throw new Error("You need to be signed in.");
      await createEvent(user.uid, {
        title: state.title.trim(),
        date: state.date,
        time: state.time,
        timeZone: currentTimeZone(),
        ...(parseReminderOffset(state.reminderOffset) !== undefined
          ? { reminderOffsetMinutes: parseReminderOffset(state.reminderOffset) }
          : {}),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["all-tasks", uid] }),
        queryClient.invalidateQueries({ queryKey: ["calendar", uid] }),
      ]);
      router.replace("/");
    },
    onError: (error) => {
      setServerError(error instanceof Error ? error.message : "Could not create the event. Try again.");
    },
  });

  const validateCurrentStep = (): boolean => {
    const next: Partial<Record<keyof WizardState, string>> = {};
    if (stepIndex === 0) {
      if (state.title.trim().length < 3) next.title = "Give the event a name (at least 3 characters).";
    }
    if (stepIndex === 1) {
      if (!state.date) next.date = "Choose the event date.";
      else if (new Date(`${state.date}T23:59`) < new Date()) next.date = "The date can't be in the past.";
      if (!/^\d{2}:\d{2}$/.test(state.time)) next.time = "Set a start time.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validateCurrentStep()) return;
    if (stepIndex === STEPS.length - 1) {
      setServerError("");
      create.mutate();
      return;
    }
    setDirection(1);
    setStepIndex((current) => current + 1);
  };

  const goBack = () => {
    setErrors({});
    if (stepIndex === 0) {
      router.back();
      return;
    }
    setDirection(-1);
    setStepIndex((current) => current - 1);
  };

  return (
    <div className="min-h-dvh bg-background">
      <div
        className="mx-auto grid min-h-dvh max-w-6xl gap-10 px-4 pb-8 sm:px-6 lg:grid-cols-[13rem_minmax(0,40rem)_15rem] lg:gap-14 lg:px-10"
        style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
      >
        <aside className="hidden pt-4 lg:block" aria-label="Event setup steps">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">New planning file</p>
          <h1 className="mt-3 font-heading text-2xl font-extrabold tracking-[-0.05em]">Create event</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Set the essentials now. The working plan can grow with the event.
          </p>
          <ol className="mt-10 space-y-5">
            {STEPS.map((label, index) => (
              <li key={label} className="flex items-start gap-3">
                <motion.span
                  aria-current={index === stepIndex ? "step" : undefined}
                  animate={{
                    backgroundColor: index < stepIndex ? "var(--primary)" : "transparent",
                    color: index < stepIndex ? "var(--primary-foreground)" : index === stepIndex ? "var(--primary)" : "var(--muted-foreground)",
                  }}
                  transition={springs.pop}
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold tabular-nums",
                    index <= stepIndex ? "border-primary" : "border-border",
                  )}
                >
                  {index < stepIndex ? <Check className="h-3 w-3" aria-hidden /> : index + 1}
                </motion.span>
                <span>
                  <span className={cn("block text-sm font-semibold", index <= stepIndex ? "text-foreground" : "text-muted-foreground")}>{label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {index === 0 ? "Name the event" : index === 1 ? "Date and start time" : "Confirm the plan"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </aside>

        <main className="flex min-w-0 flex-col pt-1 lg:pt-12">
          <header className="border-b border-border pb-5">
            <div className="flex items-center justify-between gap-4 lg:hidden">
              <button
                type="button"
                onClick={goBack}
                aria-label="Go back"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </button>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Create event</p>
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">{stepIndex + 1} / {STEPS.length}</span>
            </div>
            <div className="mt-4 flex items-end justify-between gap-4 lg:mt-0">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{STEPS[stepIndex]}</p>
                <h2 className="mt-2 font-heading text-3xl font-extrabold leading-[1.05] tracking-[-0.055em] sm:text-4xl">
                  {stepIndex === 0 ? "What are you planning?" : stepIndex === 1 ? "When is the day?" : "Ready to start the plan?"}
                </h2>
              </div>
              <span className="hidden text-xs font-semibold tabular-nums text-muted-foreground lg:inline">{stepIndex + 1} / {STEPS.length}</span>
            </div>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              {stepIndex === 0
                ? "Name the event clearly; tasks stay yours to define."
                : stepIndex === 1
                  ? "Choose the date and a useful starting time. You can add the full run of show later."
                  : "Check the essentials, then open a clean event workspace for your own tasks and calendar."}
            </p>
            <div className="mt-5 h-1 overflow-hidden rounded-full bg-border lg:hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
                transition={springs.rise}
              />
            </div>
          </header>

          <div className="relative mt-8 flex-1">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={stepIndex}
                custom={direction}
                initial={{ opacity: 0, x: direction * 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -24, transition: { duration: 0.14 } }}
                transition={springs.surface}
              >
                {stepIndex === 0 ? (
                  <section aria-label="Basics" className="space-y-8">
                    <div className="space-y-2">
                      <Label htmlFor="event-title">Event name</Label>
                      <Input
                        id="event-title"
                        placeholder="Sarah & James' Wedding"
                        value={state.title}
                        onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))}
                        aria-invalid={Boolean(errors.title)}
                        autoFocus
                        className="h-12 rounded-md text-base"
                      />
                      {errors.title ? <p className="text-xs text-destructive">{errors.title}</p> : null}
                    </div>
                    <div className="border-y border-border py-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Name it clearly</p>
                      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                        Use the name your team will recognize. Tasks and dates can be added after the event exists.
                      </p>
                    </div>
                  </section>
                ) : null}

                {stepIndex === 1 ? (
                  <section aria-label="Details" className="space-y-8">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="event-date">Event date</Label>
                        <Input
                          id="event-date"
                          type="date"
                          value={state.date}
                          min={new Date().toISOString().slice(0, 10)}
                          onChange={(event) => setState((current) => ({ ...current, date: event.target.value }))}
                          aria-invalid={Boolean(errors.date)}
                          className="h-12 rounded-md text-base"
                        />
                        {errors.date ? <p className="text-xs text-destructive">{errors.date}</p> : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="event-time">Start time</Label>
                        <Input
                          id="event-time"
                          type="time"
                          value={state.time}
                          onChange={(event) => setState((current) => ({ ...current, time: event.target.value }))}
                          aria-invalid={Boolean(errors.time)}
                          className="h-12 rounded-md text-base"
                        />
                        {errors.time ? <p className="text-xs text-destructive">{errors.time}</p> : null}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event-reminder">Remind me</Label>
                      <select
                        id="event-reminder"
                        value={state.reminderOffset}
                        onChange={(event) => setState((current) => ({ ...current, reminderOffset: event.target.value as ReminderOptionValue }))}
                        className="h-12 w-full rounded-md border border-input bg-card px-3 text-base focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {REMINDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground">Turn on notifications in Account to receive it.</p>
                    </div>
                    <div className="border-y border-border py-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Planning note</p>
                      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                        This is the anchor for your event. Add tasks to it, or create personal tasks for any date.
                      </p>
                    </div>
                  </section>
                ) : null}

                {stepIndex === 2 ? (
                  <section aria-label="Review" className="space-y-7">
                    <dl className="divide-y divide-border border-y border-border text-sm">
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springs.rise, delay: 0.03 }} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 py-4">
                        <dt className="text-xs text-muted-foreground">Name</dt>
                        <dd className="font-semibold">{state.title}</dd>
                      </motion.div>
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springs.rise, delay: 0.13 }} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 py-4">
                        <dt className="text-xs text-muted-foreground">When</dt>
                        <dd className="font-semibold">{formatLongDate(state.date)} · {state.time}</dd>
                      </motion.div>
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springs.rise, delay: 0.18 }} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 py-4">
                        <dt className="text-xs text-muted-foreground">Countdown</dt>
                        <dd className="font-semibold text-primary">{formatCountdown(state.date)}</dd>
                      </motion.div>
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springs.rise, delay: 0.23 }} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 py-4">
                        <dt className="text-xs text-muted-foreground">Reminder</dt>
                        <dd className="font-semibold">{REMINDER_OPTIONS.find((option) => option.value === state.reminderOffset)?.label}</dd>
                      </motion.div>
                    </dl>
                    <div className="border-l-2 border-primary bg-secondary/35 px-4 py-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">What happens next</p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        Your event opens clean, ready for the tasks you choose to add.
                      </p>
                    </div>
                    {serverError ? (
                      <p role="alert" className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        <CircleAlert className="mr-1 inline h-4 w-4" aria-hidden />
                        {serverError}
                      </p>
                    ) : null}
                  </section>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>

          <footer className="mt-8 flex items-center gap-3 border-t border-border pt-5">
            <Button variant="outline" onClick={goBack} className="min-h-10 flex-1 rounded-md">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </Button>
            <TapScale amount={0.97} className="flex-[2]">
              <Button onClick={() => goNext()} disabled={create.isPending} className="min-h-10 w-full rounded-md text-base font-semibold">
                {create.isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                ) : stepIndex === STEPS.length - 1 ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : null}
                {stepIndex === STEPS.length - 1 ? "Create event" : "Continue"}
                {stepIndex < STEPS.length - 1 ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
              </Button>
            </TapScale>
          </footer>
        </main>

        <aside className="hidden pt-12 xl:block" aria-label="Event preview">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Live preview</p>
          <div className="mt-4 border-y border-border py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Event</p>
            <p className="mt-2 truncate font-heading text-lg font-extrabold tracking-[-0.03em]">{state.title || "Your event name"}</p>
          </div>
          <div className="border-b border-border py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">When</p>
            <p className="mt-2 text-sm font-semibold">{state.date ? formatLongDate(state.date) : "Choose a date"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{state.time || "Set a start time"}</p>
          </div>
          <p className="mt-5 text-xs leading-5 text-muted-foreground">Add tasks when you know what needs doing.</p>
        </aside>
      </div>
    </div>
  );
}

export default function NewEventPage() {
  return (
    <RequireAuth>
      <WizardContent />
    </RequireAuth>
  );
}
