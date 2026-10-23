"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { springs } from "@/components/motion-primitives";
import { cn } from "@/lib/utils";

/**
 * Every main screen is built the same way: a pink canvas holding the greeting,
 * the headline number and any controls, with a white sheet that slides up over
 * it for the content.
 */
export function ScreenShell({
  title,
  greeting,
  action,
  canvas,
  children,
  className,
}: {
  title: string;
  greeting?: ReactNode;
  action?: ReactNode;
  /** Extra canvas content below the title: stats, a week strip, filters. */
  canvas?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-brand">
      <header
        className="relative text-primary-foreground"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <div className="relative mx-auto max-w-3xl px-5 pt-3 pb-14 md:px-8 md:pt-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {greeting ? <p className="text-[15px] font-bold text-white/85">{greeting}</p> : null}
              <h1 className="font-heading text-[2.15rem] leading-[1.05] font-bold tracking-tight md:text-5xl">{title}</h1>
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
          {canvas ? <div className="mt-5">{canvas}</div> : null}
        </div>
      </header>

      <motion.div
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={springs.surface}
        className="relative -mt-8 flex-1 rounded-t-3xl bg-card "
      >
        <div
          className={cn(
            "mx-auto max-w-3xl px-5 pt-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:px-8 md:pb-12",
            className,
          )}
        >
          {children}
        </div>
      </motion.div>
    </div>
  );
}

/** Heading above a group of rows in the sheet. */
export function GroupHeading({
  children,
  count,
  tone = "default",
  className,
}: {
  children: ReactNode;
  count?: number;
  tone?: "default" | "danger";
  className?: string;
}) {
  return (
    <div className={cn("mt-6 mb-1 flex items-baseline justify-between gap-3 first:mt-1", className)}>
      <h2 className={cn("font-heading text-xl font-bold tracking-tight", tone === "danger" && "text-destructive")}>
        {children}
      </h2>
      {count !== undefined ? (
        <span className="text-sm font-bold text-muted-foreground tabular-nums">{count}</span>
      ) : null}
    </div>
  );
}

/** Round translucent button that sits on the pink canvas. */
export const canvasButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/25 px-4 text-sm font-semibold text-primary-foreground backdrop-blur outline-none transition-colors hover:bg-white/35 active:scale-95 focus-visible:ring-4 focus-visible:ring-white/40";
