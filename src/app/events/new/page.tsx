"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, CalendarDays, CircleAlert, Clock3, LoaderCircle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/components/auth-provider";
import { TapScale, springs } from "@/components/motion-primitives";
import { createEvent } from "@/lib/data";
import { formatLongDate, formatCountdown, formatTime, todayIso } from "@/lib/datetime";
import { currentTimeZone, parseReminderOffset, REMINDER_OPTIONS, type ReminderOptionValue } from "@/lib/reminders";
import { cn } from "@/lib/utils";

const STEPS = ["Name", "Details", "Review"] as const;

interface WizardState {
  title: string;
  date: string;
  time: string;
  reminderOffset: ReminderOptionValue;
}

/** Live card that fills in as the form does. */
function EventPreview({ state }: { state: WizardState }) {
  const hasDate = Boolean(state.date);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-brand p-5 text-primary-foreground">
      <p className="relative text-xs font-bold tracking-wide text-white/80 uppercase">Preview</p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.h3
          key={state.title.trim() ? "title" : "placeholder"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "relative mt-1.5 line-clamp-2 font-heading text-2xl leading-tight font-semibold tracking-[-0.035em]",
            !state.title.trim() && "text-white/60",
          )}
        >
          {state.title.trim() || "Your event name"}
        </motion.h3>
      </AnimatePresence>
      <div className="relative mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm font-medium text-white/90">
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-white/70" aria-hidden />
          {hasDate ? formatLongDate(state.date) : "Choose a date"}
        </span>
        <span className="inline-flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-white/70" aria-hidden />
          {state.time ? formatTime(state.time) : "Set a time"}
        </span>
      </div>
    </div>
  );
}

function SuccessOverlay({ title }: { title: string }) {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-background px-8 text-center"
    >
      <BrandLogo variant="mark" size="xl" animated decorative />
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.rise, delay: 1 }}
        className="mt-7 font-heading text-3xl font-semibold tracking-[-0.045em]"
      >
        Event created
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.rise, delay: 1.1 }}
        className="mt-2 max-w-xs text-sm text-muted-foreground"
      >
        {title} is on your calendar.
      </motion.p>
    </motion.div>
  );
}

function WizardContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const uid = user?.uid;
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [created, setCreated] = useState(false);
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
      ]);
      setCreated(true);
    },
    onError: (error) => {
      setServerError(error instanceof Error ? error.message : "Could not create the event. Try again.");
    },
  });

  // Let the bloom play before heading back to the overview.
  useEffect(() => {
    if (!created) return;
    const timer = window.setTimeout(() => router.replace("/"), 1900);
    return () => window.clearTimeout(timer);
  }, [created, router]);

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

  const heading =
    stepIndex === 0 ? "What are you planning?" : stepIndex === 1 ? "When is the day?" : "Review and create";
  const lead =
    stepIndex === 0
      ? "Name the event clearly; tasks stay yours to define."
      : stepIndex === 1
        ? "Choose the date and a useful starting time. You can add the full run of show later."
        : "Check the essentials, then open a clean event workspace for your own tasks and calendar.";
  const reviewRows: Array<[string, string, boolean?]> = [
    ["Name", state.title],
    ["When", `${formatLongDate(state.date)} · ${formatTime(state.time)}`],
    ["Countdown", formatCountdown(state.date), true],
    ["Reminder", REMINDER_OPTIONS.find((option) => option.value === state.reminderOffset)?.label ?? "None"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-brand">
      <header
        className="relative mx-auto w-full max-w-xl px-5 pb-9 text-primary-foreground"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={goBack}
            aria-label={stepIndex === 0 ? "Close" : "Go back"}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/25 outline-none transition-transform active:scale-90 focus-visible:ring-4 focus-visible:ring-white/40"
          >
            {stepIndex === 0 ? <X className="h-5 w-5" aria-hidden /> : <ArrowLeft className="h-5 w-5" aria-hidden />}
          </button>
          <div
            className="flex items-center gap-2"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={stepIndex + 1}
            aria-label={`Step ${stepIndex + 1} of ${STEPS.length}: ${STEPS[stepIndex]}`}
          >
            {STEPS.map((label, index) => (
              <motion.span
                key={label}
                className="h-2.5 rounded-full bg-white"
                initial={false}
                animate={{ width: index === stepIndex ? 28 : 10, opacity: index <= stepIndex ? 1 : 0.4 }}
                transition={springs.rise}
              />
            ))}
          </div>
          <span className="w-11" aria-hidden />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
            transition={springs.rise}
            className="mt-6"
          >
            <h1 className="font-heading text-[2rem] leading-[1.05] font-bold tracking-tight">{heading}</h1>
            <p className="mt-2 text-base leading-6 font-semibold text-white/85">{lead}</p>
          </motion.div>
        </AnimatePresence>
      </header>

      <div className="relative min-h-0 flex-1 rounded-t-3xl bg-card shadow-[0_-12px_40px_-16px_rgb(120_0_50/0.35)]">
        <div className="mx-auto flex h-full max-w-xl flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-7 pb-4">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={stepIndex}
                initial={{ opacity: 0, x: direction * 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -24, transition: { duration: 0.14 } }}
                transition={springs.surface}
              >
                {stepIndex === 0 ? (
                  <section aria-label="Basics" className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="event-title">Event name</Label>
                      <Input
                        id="event-title"
                        placeholder="Sarah & James' Wedding"
                        value={state.title}
                        onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            goNext();
                          }
                        }}
                        aria-invalid={Boolean(errors.title)}
                        autoFocus
                        className="h-14 text-lg"
                      />
                      {errors.title ? <p className="text-sm font-bold text-destructive">{errors.title}</p> : null}
                    </div>
                    <EventPreview state={state} />
                  </section>
                ) : null}

                {stepIndex === 1 ? (
                  <section aria-label="Details" className="space-y-6">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="event-date">Event date</Label>
                        <Input
                          id="event-date"
                          type="date"
                          value={state.date}
                          min={todayIso()}
                          onChange={(event) => setState((current) => ({ ...current, date: event.target.value }))}
                          aria-invalid={Boolean(errors.date)}
                          className="h-14 text-base"
                        />
                        {errors.date ? <p className="text-sm font-bold text-destructive">{errors.date}</p> : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="event-time">Start time</Label>
                        <Input
                          id="event-time"
                          type="time"
                          value={state.time}
                          onChange={(event) => setState((current) => ({ ...current, time: event.target.value }))}
                          aria-invalid={Boolean(errors.time)}
                          className="h-14 text-base"
                        />
                        {errors.time ? <p className="text-sm font-bold text-destructive">{errors.time}</p> : null}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event-reminder">Remind me</Label>
                      <select
                        id="event-reminder"
                        value={state.reminderOffset}
                        onChange={(event) => setState((current) => ({ ...current, reminderOffset: event.target.value as ReminderOptionValue }))}
                        className="h-14 w-full rounded-2xl border border-input bg-card px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/25"
                      >
                        {REMINDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground">Turn on notifications in Account to receive it.</p>
                    </div>
                    <EventPreview state={state} />
                  </section>
                ) : null}

                {stepIndex === 2 ? (
                  <section aria-label="Review" className="space-y-5">
                    <EventPreview state={state} />
                    <dl className="divide-y divide-card overflow-hidden rounded-3xl bg-secondary/60 text-sm">
                      {reviewRows.map(([label, value, accent], index) => (
                        <motion.div
                          key={label}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...springs.rise, delay: 0.05 + index * 0.06 }}
                          className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4 px-4 py-3.5"
                        >
                          <dt className="font-bold text-muted-foreground">{label}</dt>
                          <dd className={cn("font-semibold", accent && "text-primary")}>{value}</dd>
                        </motion.div>
                      ))}
                    </dl>
                    {serverError ? (
                      <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
                        <CircleAlert className="mr-1 inline h-4 w-4" aria-hidden />
                        {serverError}
                      </p>
                    ) : null}
                  </section>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>

          <footer
            className="flex items-center gap-3 px-5 pt-3"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <TapScale amount={0.97} className="flex-1">
              <Button onClick={() => goNext()} disabled={create.isPending || created} className="h-14 w-full text-base font-semibold">
                {create.isPending ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
                ) : stepIndex === STEPS.length - 1 ? (
                  <Check className="h-5 w-5" aria-hidden />
                ) : null}
                {stepIndex === STEPS.length - 1 ? "Create event" : "Continue"}
                {stepIndex < STEPS.length - 1 ? <ArrowRight className="h-5 w-5" aria-hidden /> : null}
              </Button>
            </TapScale>
          </footer>
        </div>
      </div>

      <AnimatePresence>{created ? <SuccessOverlay title={state.title.trim()} /> : null}</AnimatePresence>
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
