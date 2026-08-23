"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { springs } from "@/components/motion-primitives";

type Mode = "signin" | "signup";
type ArrivalPhase = "idle" | "arriving" | "leaving";

function BrandArrival({
  phase,
  reduced,
}: {
  phase: Exclude<ArrivalPhase, "idle">;
  reduced: boolean | null;
}) {
  const leaving = phase === "leaving";
  const motionDisabled = Boolean(reduced);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label="Opening Petal and Plan"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: motionDisabled ? 0.1 : 0.36, ease: "easeOut" }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground px-6 text-background"
    >
      <motion.div
        initial={motionDisabled ? { opacity: 0 } : { opacity: 0, y: 20 }}
        animate={leaving ? (motionDisabled ? { opacity: 0 } : { opacity: 0, y: -12 }) : { opacity: 1, y: 0 }}
        transition={{ duration: motionDisabled ? 0.1 : 0.48, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm text-center"
      >
        <motion.div
          initial={motionDisabled ? { opacity: 0 } : { opacity: 0, scale: 0.72, rotate: -18 }}
          animate={leaving ? { opacity: 0 } : { opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: motionDisabled ? 0.1 : 0.52, delay: motionDisabled ? 0 : 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-background text-foreground"
        >
          <BrandLogo variant="mark" size="lg" inverted decorative />
        </motion.div>
        <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.24em] text-background/50">Your planning workspace</p>
        <div className="mt-3 overflow-hidden">
          <motion.h1
            initial={motionDisabled ? { opacity: 0 } : { opacity: 0, y: "110%" }}
            animate={leaving ? (motionDisabled ? { opacity: 0 } : { opacity: 0, y: "-20%" }) : { opacity: 1, y: 0 }}
            transition={{ duration: motionDisabled ? 0.1 : 0.62, delay: motionDisabled ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="font-heading text-5xl font-extrabold tracking-[-0.075em] sm:text-6xl"
          >
            Petal <span className="text-background/55">&amp;</span> Plan
          </motion.h1>
        </div>
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={leaving ? { scaleX: 0.7, opacity: 0 } : { scaleX: 1, opacity: 1 }}
          transition={{ duration: motionDisabled ? 0.1 : 0.5, delay: motionDisabled ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-6 h-px w-20 origin-center bg-background/40"
        />
      </motion.div>
    </motion.div>
  );
}


export default function LoginPage() {
  const { signIn, signUp, status } = useAuth();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<{ field: "name" | "email" | "password"; message: string } | null>(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [arrivalPhase, setArrivalPhase] = useState<ArrivalPhase>("idle");

  const friendlyError = (code: string): string => {
    if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
      return "Email or password is incorrect.";
    }
    if (code.includes("email-already-in-use")) return "An account with this email already exists — sign in instead.";
    if (code.includes("weak-password")) return "Password needs at least 6 characters.";
    if (code.includes("invalid-email")) return "That email address doesn't look right.";
    if (code.includes("too-many-requests")) return "Too many attempts. Wait a minute and try again.";
    if (code.includes("network")) return "Network problem — check your connection and retry.";
    return "Something went wrong. Try again.";
  };

  const submit = async () => {
    setFieldError(null);
    setFormError("");

    if (mode === "signup" && name.trim().length < 2) {
      setFieldError({ field: "name", message: "Tell us your name." });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFieldError({ field: "email", message: "Enter a valid email address." });
      return;
    }
    if (password.length < 6) {
      setFieldError({ field: "password", message: "Password needs at least 6 characters." });
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") await signUp(name.trim(), email.trim(), password);
      else await signIn(email.trim(), password);
      setArrivalPhase("arriving");
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, reduced ? 140 : 2_080);
      });
      setArrivalPhase("leaving");
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, reduced ? 100 : 420);
      });
      router.replace("/");
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setFormError(friendlyError(code));
      setBusy(false);
    }
  };

  const stagger = (index: number) =>
    reduced ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { ...springs.rise, delay: index * 0.07 } };

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.15fr)_minmax(26rem,.85fr)]">
      <aside className="relative hidden min-h-dvh flex-col bg-foreground px-10 py-10 text-background lg:flex xl:px-16">
        <div className="flex items-center gap-3">
          <BrandLogo size="sm" inverted />
        </div>

        <div className="mt-auto max-w-xl pb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-background/55">Events · tasks · dates</p>
          <h1 className="mt-5 max-w-2xl font-heading text-5xl font-extrabold leading-[0.96] tracking-[-0.07em] xl:text-6xl">
            Make the work behind the day visible.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-background/65">
            Create the event, decide what needs doing, and keep personal tasks on their own dates. Nothing gets invented for you.
          </p>
          <dl className="mt-10 max-w-lg divide-y divide-background/15 border-y border-background/15">
            <div className="grid grid-cols-[5rem_1fr] gap-5 py-4">
              <dt className="text-xs font-bold uppercase tracking-[0.16em] text-background/45">01</dt>
              <dd className="text-sm font-semibold">Create a clear event home</dd>
            </div>
            <div className="grid grid-cols-[5rem_1fr] gap-5 py-4">
              <dt className="text-xs font-bold uppercase tracking-[0.16em] text-background/45">02</dt>
              <dd className="text-sm font-semibold">Add only the tasks that matter</dd>
            </div>
            <div className="grid grid-cols-[5rem_1fr] gap-5 py-4">
              <dt className="text-xs font-bold uppercase tracking-[0.16em] text-background/45">03</dt>
              <dd className="text-sm font-semibold">See the dates at a glance</dd>
            </div>
          </dl>
        </div>

        <p className="text-xs text-background/45">Your planning workspace, kept intentionally simple.</p>
      </aside>

      <main className="flex min-h-dvh items-center justify-center px-5 py-10 sm:px-8" style={{ paddingTop: "max(2.5rem, env(safe-area-inset-top))" }}>
        <div className="w-full max-w-md">
          <motion.div {...stagger(0)} className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandLogo size="sm" />
          </motion.div>

          <header className="border-b border-border pb-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Private planning workspace</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -8, transition: { duration: 0.13 } }}
                transition={springs.rise}
              >
                <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-[-0.055em] sm:text-4xl">
                  {mode === "signin" ? "Welcome back" : "Start a new workspace"}
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {mode === "signin" ? "Sign in to pick up where your last plan left off." : "Create an account for your events, tasks, and dates."}
                </p>
              </motion.div>
            </AnimatePresence>
          </header>

          <form
            className="mt-7 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <AnimatePresence initial={false}>
              {mode === "signup" ? (
                <motion.div
                  key="name-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
                  transition={springs.rise}
                  className="overflow-hidden"
                >
                  <div {...stagger(1)} className="space-y-2 pb-1">
                    <Label htmlFor="name">Your name</Label>
                    <Input id="name" autoComplete="name" placeholder="Sarah Mensah" value={name} onChange={(event) => setName(event.target.value)} aria-invalid={fieldError?.field === "name"} className="h-11 rounded-md" />
                    {fieldError?.field === "name" ? <p className="text-xs text-destructive">{fieldError.message}</p> : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <motion.div {...stagger(mode === "signin" ? 1 : 2)} className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={fieldError?.field === "email"} className="h-11 rounded-md" />
              {fieldError?.field === "email" ? <p className="text-xs text-destructive">{fieldError.message}</p> : null}
            </motion.div>

            <motion.div {...stagger(mode === "signin" ? 2 : 3)} className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={fieldError?.field === "password"}
                  className="h-11 rounded-md pr-11"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
              {fieldError?.field === "password" ? <p className="text-xs text-destructive">{fieldError.message}</p> : null}
            </motion.div>

            <AnimatePresence>
              {formError ? (
                <motion.p key="form-error" role="alert" initial={reduced ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  {formError}
                </motion.p>
              ) : null}
            </AnimatePresence>

            <motion.div {...stagger(mode === "signin" ? 3 : 4)}>
              <Button type="submit" disabled={busy || status === "unconfigured"} className="min-h-11 w-full rounded-md text-base font-semibold">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </motion.div>
          </form>

          {status === "unconfigured" ? <p role="alert" className="mt-4 border border-border bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">Backend isn&apos;t connected yet — add your Firebase keys to .env.local and restart.</p> : null}

          <motion.p {...stagger(5)} className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New to Petal & Plan? " : "Already have an account? "}
            <button
              type="button"
              className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setFieldError(null);
                setShowPassword(false);
                setFormError("");
              }}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </motion.p>
        </div>
      </main>
      {arrivalPhase !== "idle" ? <BrandArrival phase={arrivalPhase} reduced={reduced} /> : null}
    </div>
  );
}
