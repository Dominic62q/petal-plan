"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Eye, EyeOff, LoaderCircle, Lock, Mail, User } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useArrival } from "@/components/arrival";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { springs } from "@/components/motion-primitives";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

function FieldIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted-foreground" aria-hidden>
      {children}
    </span>
  );
}

export default function LoginPage() {
  const { signIn, signUp, status } = useAuth();
  const arrival = useArrival();
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
      await arrival.play({
        name: mode === "signup" ? name.trim().split(" ")[0] : undefined,
        navigate: () => router.replace("/"),
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setFormError(friendlyError(code));
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setFieldError(null);
    setShowPassword(false);
    setFormError("");
  };

  const stagger = (index: number) =>
    reduced ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { ...springs.rise, delay: 0.25 + index * 0.07 } };

  return (
    <div className="relative grid min-h-dvh grid-rows-[auto_1fr] bg-brand lg:grid-rows-none lg:grid-cols-[minmax(0,1.1fr)_minmax(28rem,.9fr)] lg:bg-none">
      {/* Hero — full-bleed gradient on phones, a side panel on desktop. */}
      <section className="relative flex flex-col overflow-hidden px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-14 text-white lg:min-h-dvh lg:justify-between lg:bg-brand lg:px-14 lg:py-12">
          <motion.div
          initial={reduced ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.rise}
          className="relative"
        >
          <BrandLogo size="md" inverted />
        </motion.div>
        <div className="relative mt-9 max-w-md lg:mt-0 lg:mb-10">
          <motion.h1
            initial={reduced ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.surface, delay: 0.1 }}
            className="font-heading text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.055em] lg:text-6xl"
          >
            Events and tasks,
            <br />
            in one place.
          </motion.h1>
          <motion.p
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.surface, delay: 0.2 }}
            className="mt-4 hidden max-w-sm text-base leading-7 text-white/80 sm:block"
          >
            Sign in to see what is coming up and what needs doing.
          </motion.p>
        </div>
      </section>

      {/* Form — a sheet that slides up over the hero. */}
      <main className="relative z-10 flex items-stretch justify-center lg:items-center lg:bg-background">
        <motion.div
          initial={reduced ? false : { y: 70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...springs.surface, delay: 0.15 }}
          className="-mt-8 w-full rounded-t-3xl bg-background px-6 pt-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] shadow-float sm:px-10 lg:mt-0 lg:max-w-md lg:rounded-none lg:bg-transparent lg:px-8 lg:py-10 lg:shadow-none"
        >
          <div className="mx-auto w-full max-w-md">
            <div role="tablist" aria-label="Account" className="relative grid grid-cols-2 rounded-2xl bg-secondary p-1">
              {(["signin", "signup"] as const).map((option) => {
                const selected = mode === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => switchMode(option)}
                    className={cn(
                      "relative z-10 h-10 rounded-xl text-sm font-bold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring/30",
                      selected ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {selected ? (
                      <motion.span
                        layoutId="auth-tab"
                        className="absolute inset-0 -z-10 rounded-xl bg-card shadow-soft"
                        transition={springs.rise}
                      />
                    ) : null}
                    {option === "signin" ? "Sign in" : "Create account"}
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -8, transition: { duration: 0.13 } }}
                transition={springs.rise}
                className="mt-7"
              >
                <h2 className="font-heading text-3xl font-semibold tracking-[-0.045em]">
                  {mode === "signin" ? "Welcome back" : "Let’s get started"}
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {mode === "signin" ? "Sign in to pick up where your last plan left off." : "Create an account for your events, tasks and dates."}
                </p>
              </motion.div>
            </AnimatePresence>

            <form
              className="mt-6 space-y-4"
              noValidate
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
                    <div className="space-y-2 pb-1">
                      <Label htmlFor="name">Your name</Label>
                      <div className="relative">
                        <FieldIcon><User className="h-[18px] w-[18px]" /></FieldIcon>
                        <Input id="name" autoComplete="name" placeholder="Sarah Mensah" value={name} onChange={(event) => setName(event.target.value)} aria-invalid={fieldError?.field === "name"} className="pl-11" />
                      </div>
                      {fieldError?.field === "name" ? <p role="alert" className="text-xs font-medium text-destructive">{fieldError.message}</p> : null}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <motion.div {...stagger(1)} className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <FieldIcon><Mail className="h-[18px] w-[18px]" /></FieldIcon>
                  <Input id="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={fieldError?.field === "email"} className="pl-11" />
                </div>
                {fieldError?.field === "email" ? <p role="alert" className="text-xs font-medium text-destructive">{fieldError.message}</p> : null}
              </motion.div>

              <motion.div {...stagger(2)} className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <FieldIcon><Lock className="h-[18px] w-[18px]" /></FieldIcon>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={fieldError?.field === "password"}
                    className="pr-12 pl-11"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute inset-y-1 right-1 flex w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/30"
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" aria-hidden /> : <Eye className="h-[18px] w-[18px]" aria-hidden />}
                  </button>
                </div>
                {fieldError?.field === "password" ? <p role="alert" className="text-xs font-medium text-destructive">{fieldError.message}</p> : null}
              </motion.div>

              <AnimatePresence>
                {formError ? (
                  <motion.p
                    key="form-error"
                    role="alert"
                    initial={reduced ? false : { opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
                  >
                    {formError}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              <motion.div {...stagger(3)} className="pt-2">
                <Button type="submit" size="lg" disabled={busy || status === "unconfigured"} className="w-full">
                  {busy ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : null}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </motion.div>
            </form>

            {status === "unconfigured" ? (
              <p role="alert" className="mt-4 rounded-2xl bg-muted px-4 py-3 text-xs leading-5 text-muted-foreground">
                Backend isn&apos;t connected yet — add your Firebase keys to .env.local and restart.
              </p>
            ) : null}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
