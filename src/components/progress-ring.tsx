"use client";

import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Circular progress with an animated, gradient stroke. `value` is 0–100. */
export function ProgressRing({
  value,
  size = 72,
  stroke = 8,
  onDark = false,
  className,
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  /** Use white-on-translucent colours so the ring reads on the brand gradient. */
  onDark?: boolean;
  className?: string;
  children?: ReactNode;
  label?: string;
}) {
  const gradientId = useId();
  const radius = (size - stroke) / 2;
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand-from)" />
            <stop offset="100%" stopColor="var(--brand-to)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={onDark ? "rgb(255 255 255 / 0.28)" : "var(--secondary)"}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={onDark ? "white" : `url(#${gradientId})`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: clamped / 100 }}
          transition={{ type: "spring", stiffness: 70, damping: 18, delay: 0.15 }}
        />
      </svg>
      {children ? <div className="absolute inset-0 flex items-center justify-center">{children}</div> : null}
    </div>
  );
}
