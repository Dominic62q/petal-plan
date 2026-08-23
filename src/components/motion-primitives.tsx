"use client";

import { motion, useReducedMotion, type Transition } from "motion/react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Motion tokens — the spring vocabulary for the whole app. Tone: calm,
// premium, slight overshoot on entry (playful but not bouncy). Every
// primitive respects prefers-reduced-motion by rendering static.
// ---------------------------------------------------------------------------

export const springs = {
  /** Tactile controls — press feedback, chip toggles. */
  tap: { type: "spring", stiffness: 500, damping: 32 },
  /** Cards and sheets entering. */
  rise: { type: "spring", stiffness: 320, damping: 28 },
  /** Large surfaces — page sections, hero cards. */
  surface: { type: "spring", stiffness: 260, damping: 26 },
  /** Checkbox / completion moments — a satisfying pop. */
  pop: { type: "spring", stiffness: 600, damping: 20 },
} satisfies Record<string, Transition>;

// ---------------------------------------------------------------------------
// Reveal — fade+rise once on mount (or when `show` flips true).
// ---------------------------------------------------------------------------

export function Reveal({
  children,
  delay = 0,
  y = 18,
  show = true,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  show?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ ...springs.rise, delay }}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Stagger — orchestrates direct <StaggerItem> children with a cascade.
// ---------------------------------------------------------------------------

export function Stagger({
  children,
  className,
  gap = 0.06,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  y = 16,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        visible: { opacity: 1, y: 0, transition: springs.rise },
      }}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// TapScale — haptic-style press feedback wrapper (scale-down-and-back).
// ---------------------------------------------------------------------------

export function TapScale({
  children,
  className,
  amount = 0.97,
}: {
  children: ReactNode;
  className?: string;
  amount?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      whileTap={{ scale: amount }}
      transition={springs.tap}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// AnimatedNumber — counts up to a value on mount; dashboard stats feel alive.
// ---------------------------------------------------------------------------

export function AnimatedNumber({ value }: { value: number }) {
  const reduced = useReducedMotion();
  if (reduced) return <span>{value}</span>;
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.rise}
      className="inline-block tabular-nums"
    >
      {value}
    </motion.span>
  );
}
