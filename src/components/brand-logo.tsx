"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "full" | "mark";
  size?: "sm" | "md" | "lg" | "xl";
  /** Light mark on a dark/brand surface. */
  inverted?: boolean;
  decorative?: boolean;
  /** Petals bloom one after another — used for the arrival moment. */
  animated?: boolean;
  className?: string;
};

const markSizes = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
} as const;

export const PETAL_PATH =
  "M32 8.5c-7.3 1.2-12 5.9-12 12.2 0 6.2 4.8 10.6 12 11.3 7.2 -0.7 12 -5.1 12 -11.3 0 -6.3 -4.7 -11 -12 -12.2Z";
export const ROTATIONS = [0, 90, 180, 270];

function BrandMark({ inverted, decorative, animated, size, className }: Omit<BrandLogoProps, "variant">) {
  const surface = inverted ? "white" : "var(--primary)";
  const petal = inverted ? "var(--primary)" : "white";
  const center = inverted ? "var(--primary)" : "white";
  const check = inverted ? "white" : "var(--primary)";

  return (
    <svg
      viewBox="0 0 64 64"
      className={cn(markSizes[size ?? "md"], "shrink-0", className)}
      fill="none"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : "Petal & Plan"}
    >
      <rect x="1" y="1" width="62" height="62" rx="19" fill={surface} />
      <g fill={petal}>
        {ROTATIONS.map((rotation, index) => (
          // Rotation lives on the <g>: motion's scale would override a transform on the path itself.
          <g key={rotation} transform={`rotate(${rotation} 32 32)`}>
            <motion.path
              d={PETAL_PATH}
              style={{ transformOrigin: "32px 32px", transformBox: "view-box" }}
              initial={animated ? { scale: 0, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 14, delay: animated ? 0.25 + index * 0.14 : 0 }}
            />
          </g>
        ))}
      </g>
      <motion.circle
        cx="32"
        cy="32"
        r="6.5"
        fill={center}
        initial={animated ? { scale: 0 } : false}
        animate={{ scale: 1 }}
        style={{ transformOrigin: "32px 32px", transformBox: "view-box" }}
        transition={{ type: "spring", stiffness: 300, damping: 14, delay: animated ? 0.95 : 0 }}
      />
      <motion.path
        d="m28.9 32.1 2.1 2.1 4.3-4.6"
        stroke={check}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animated ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, delay: animated ? 1.15 : 0 }}
      />
    </svg>
  );
}

export function BrandLogo({
  variant = "full",
  size = "md",
  inverted = false,
  decorative = false,
  animated = false,
  className,
}: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <span className="inline-flex shrink-0">
        <BrandMark size={size} inverted={inverted} decorative={decorative} animated={animated} className={className} />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={size} inverted={inverted} decorative animated={animated} />
      <span className={cn("font-heading text-lg font-semibold tracking-[-0.035em]", inverted ? "text-white" : "text-foreground")}>
        Petal <span className={inverted ? "text-white/70" : "text-primary"}>&amp;</span> Plan
      </span>
    </span>
  );
}
